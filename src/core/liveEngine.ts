import type { Settings } from '../config/defaults';
import { PACKET } from '../config/device';
import type { StreamPacket } from '../device/deviceStream';
import type { LinkState } from '../device/types';
import { isWarmup, windowMean, type WindowMean } from './averaging';
import { initialAlertState, stepAlert, type AlertEvent, type AlertState } from './alerts';
import { levelFromWindow, type LevelStatus } from './levels';
import { computeQualityFlags, type QualityFlag } from './quality';

const TREND_MS = 10 * 60_000;

export interface LiveSnapshot {
  last: StreamPacket | null;
  /** 1-min mean ("Ahora, promedio 1 min"). */
  short: WindowMean;
  /** Level from the 5-min mean ("Nivel, promedio 5 min"). */
  level: LevelStatus;
  hour: WindowMean;
  flags: QualityFlag[];
  alert: Pick<AlertState, 'active' | 'episode'>;
  /** Last 10 min of raw pm25, null where data is missing (drawn as gaps). */
  trend: { t: number; v: number | null }[];
}

export interface SnapshotInput {
  now: number;
  link: LinkState;
  connectedAt: number | null;
  lossPct: number;
  reboots: number;
}

/**
 * Live computations for the En vivo page. Pure logic (no timers, no DOM):
 * packets in → alert events out; snapshot(now) → everything the page renders.
 */
export class LiveEngine {
  private buffer: StreamPacket[] = [];
  private alert: AlertState = initialAlertState();
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  get bufferSize(): number {
    return this.buffer.length;
  }

  setSettings(s: Settings): void {
    this.settings = s;
  }

  reset(): void {
    this.buffer = [];
    this.alert = initialAlertState();
  }

  /** Feeds one packet; returns alert events triggered at the packet's timestamp. */
  addPacket(p: StreamPacket): AlertEvent[] {
    this.buffer.push(p);
    const keepFrom = p.t - this.settings.windows.referenceMs - 60_000;
    let drop = 0;
    while (drop < this.buffer.length && this.buffer[drop]!.t < keepFrom) drop++;
    if (drop > 0) this.buffer.splice(0, drop);

    let mean5: number | null = null;
    if (!isWarmup(p, this.settings)) {
      const lvl = levelFromWindow(windowMean(this.buffer, p.t, this.settings.windows.levelMs, this.settings), this.settings);
      // Alerts use the 5-min mean once it is at least "estimado".
      mean5 = lvl.quality === 'insufficient' ? null : lvl.value;
    }
    return this.step(p.t, mean5);
  }

  /** Link lost / stale: pause alert timers so nothing fires on old data. */
  pause(t: number): AlertEvent[] {
    return this.step(t, null);
  }

  private step(t: number, mean5: number | null): AlertEvent[] {
    const r = stepAlert(this.alert, { t, mean5 }, this.settings);
    this.alert = r.state;
    return r.events;
  }

  snapshot(i: SnapshotInput): LiveSnapshot {
    const s = this.settings;
    const last = this.buffer.at(-1) ?? null;
    const short = windowMean(this.buffer, i.now, s.windows.shortMs, s);
    const level = levelFromWindow(windowMean(this.buffer, i.now, s.windows.levelMs, s), s);
    const hour = windowMean(this.buffer, i.now, s.windows.referenceMs, s);
    const flags = computeQualityFlags(
      {
        link: i.link,
        now: i.now,
        connectedAt: i.connectedAt,
        lastPacket: last && { t: last.t, uptimeS: last.uptimeS, rh: last.rh, batMv: last.batMv },
        lossPct: i.lossPct,
        reboots: i.reboots,
      },
      s,
    );

    const trend: LiveSnapshot['trend'] = [];
    const from = i.now - TREND_MS;
    let prevT: number | null = null;
    for (const p of this.buffer) {
      if (p.t <= from) continue;
      if (prevT !== null && p.t - prevT > 3 * PACKET.intervalMs) trend.push({ t: prevT + PACKET.intervalMs, v: null });
      trend.push({ t: p.t, v: p.pm25 });
      prevT = p.t;
    }

    return { last, short, level, hour, flags, alert: { active: this.alert.active, episode: this.alert.episode }, trend };
  }
}
