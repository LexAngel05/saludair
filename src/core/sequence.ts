/**
 * Boot-segment and packet-loss tracking (AGENTS.md §5).
 * - seq or uptime_s going backwards = device reboot → new boot segment, not loss.
 * - Loss = missing seq values within a boot segment.
 */

export interface SequenceState {
  bootSegment: number;
  lastSeq: number | null;
  lastUptimeS: number | null;
  /** Distinct packets received. */
  received: number;
  /** Seq values skipped within boot segments. */
  missing: number;
  reboots: number;
  duplicates: number;
}

export interface SequenceStep {
  state: SequenceState;
  bootSegment: number;
  reboot: boolean;
  duplicate: boolean;
  /** Seq values missing right before this packet. */
  missedBefore: number;
}

export function initialSequenceState(): SequenceState {
  return { bootSegment: 0, lastSeq: null, lastUptimeS: null, received: 0, missing: 0, reboots: 0, duplicates: 0 };
}

export function trackSequence(prev: SequenceState, p: { seq: number; uptimeS: number }): SequenceStep {
  if (prev.lastSeq === null || prev.lastUptimeS === null) {
    const state = { ...prev, lastSeq: p.seq, lastUptimeS: p.uptimeS, received: prev.received + 1 };
    return { state, bootSegment: state.bootSegment, reboot: false, duplicate: false, missedBefore: 0 };
  }

  if (p.seq === prev.lastSeq && p.uptimeS === prev.lastUptimeS) {
    const state = { ...prev, duplicates: prev.duplicates + 1 };
    return { state, bootSegment: state.bootSegment, reboot: false, duplicate: true, missedBefore: 0 };
  }

  if (p.seq < prev.lastSeq || p.uptimeS < prev.lastUptimeS) {
    const state = {
      ...prev,
      bootSegment: prev.bootSegment + 1,
      reboots: prev.reboots + 1,
      lastSeq: p.seq,
      lastUptimeS: p.uptimeS,
      received: prev.received + 1,
    };
    return { state, bootSegment: state.bootSegment, reboot: true, duplicate: false, missedBefore: 0 };
  }

  const missedBefore = Math.max(0, p.seq - prev.lastSeq - 1);
  const state = {
    ...prev,
    lastSeq: p.seq,
    lastUptimeS: p.uptimeS,
    received: prev.received + 1,
    missing: prev.missing + missedBefore,
  };
  return { state, bootSegment: state.bootSegment, reboot: false, duplicate: false, missedBefore };
}

/** Missing / expected × 100. */
export function lossPercent(s: Pick<SequenceState, 'received' | 'missing'>): number {
  const expected = s.received + s.missing;
  return expected === 0 ? 0 : (s.missing / expected) * 100;
}
