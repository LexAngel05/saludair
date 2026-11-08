import { initialSequenceState, trackSequence, type SequenceState } from '../core/sequence';
import { LineBuffer, parseLine, type InvalidReason, type Packet } from './lineParser';
import type { DeviceError, DeviceSource, LinkState } from './types';

/** A valid packet plus arrival time and boot bookkeeping. */
export interface StreamPacket extends Packet {
  t: number;
  bootSegment: number;
  reboot: boolean;
  missedBefore: number;
}

export interface StreamStats {
  sequence: SequenceState;
  /** "Líneas inválidas", by reason. */
  invalid: Partial<Record<InvalidReason | 'overflow', number>>;
  invalidTotal: number;
  /** Last unknown protocol version seen (shown as a visible error). */
  unknownVersion: string | null;
}

export interface StreamHandlers {
  packet?(p: StreamPacket): void;
  invalid?(line: string, reason: InvalidReason | 'overflow'): void;
  link?(state: LinkState, t: number): void;
  error?(err: DeviceError): void;
}

/**
 * Turns raw text from any DeviceSource into validated, sequenced packets.
 * Never throws on bad input; everything is counted in `stats`.
 */
export class DeviceStream {
  private buffer = new LineBuffer();
  private seq = initialSequenceState();
  private invalid: StreamStats['invalid'] = {};
  private unknownVersion: string | null = null;
  private lastOverflow = 0;

  readonly source: DeviceSource;
  private readonly handlers: StreamHandlers;

  constructor(source: DeviceSource, handlers: StreamHandlers) {
    this.source = source;
    this.handlers = handlers;
    source.setListener({
      chunk: (text, t) => this.onChunk(text, t),
      link: (state, t) => {
        // A partial line from before a link drop can't be completed reliably.
        if (state !== 'connected') this.buffer.reset();
        this.handlers.link?.(state, t);
      },
      error: (err) => this.handlers.error?.(err),
    });
  }

  get stats(): StreamStats {
    const invalidTotal = Object.values(this.invalid).reduce((a, b) => a + (b ?? 0), 0);
    return { sequence: this.seq, invalid: { ...this.invalid }, invalidTotal, unknownVersion: this.unknownVersion };
  }

  /** Clears per-session counters (e.g. when a new session starts). Keeps boot tracking. */
  resetCounters(): void {
    this.seq = { ...initialSequenceState(), bootSegment: this.seq.bootSegment, lastSeq: this.seq.lastSeq, lastUptimeS: this.seq.lastUptimeS };
    this.invalid = {};
  }

  detach(): void {
    this.source.setListener(null);
  }

  private countInvalid(line: string, reason: InvalidReason | 'overflow') {
    this.invalid[reason] = (this.invalid[reason] ?? 0) + 1;
    this.handlers.invalid?.(line, reason);
  }

  private onChunk(text: string, t: number) {
    const lines = this.buffer.push(text);
    if (this.buffer.overflowCount !== this.lastOverflow) {
      this.lastOverflow = this.buffer.overflowCount;
      this.countInvalid('', 'overflow');
    }
    for (const line of lines) {
      const r = parseLine(line);
      if (!r.ok) {
        if (r.reason === 'unknown-version') this.unknownVersion = r.version;
        this.countInvalid(line, r.reason);
        continue;
      }
      const step = trackSequence(this.seq, r.packet);
      this.seq = step.state;
      if (step.duplicate) continue;
      this.handlers.packet?.({
        ...r.packet,
        t,
        bootSegment: step.bootSegment,
        reboot: step.reboot,
        missedBefore: step.missedBefore,
      });
    }
  }
}
