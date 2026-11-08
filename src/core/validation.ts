import type { Settings } from '../config/defaults';
import { LEVEL_INDEX } from '../config/defaults';
import { classifyLevel } from './levels';
import { describeValues } from './stats';

// --- Repeatability -----------------------------------------------------------

export interface RunStats {
  id: number;
  n: number;
  mean: number | null;
  sd: number | null;
  cv: number | null;
}

export interface RepeatabilityResult {
  runs: RunStats[];
  /** Statistics of the run means. */
  across: { mean: number | null; sd: number | null; cv: number | null };
  /** Protocol asks for ≥ 3 runs. */
  enoughRuns: boolean;
}

export function repeatability(runs: readonly { id: number; values: readonly number[] }[]): RepeatabilityResult {
  const stats = runs.map((r) => {
    const d = describeValues(r.values);
    return { id: r.id, n: d.n, mean: d.mean, sd: d.sd, cv: d.cv };
  });
  const means = stats.map((s) => s.mean).filter((m): m is number => m !== null);
  const a = describeValues(means);
  return { runs: stats, across: { mean: a.mean, sd: a.sd, cv: a.cv }, enoughRuns: runs.length >= 3 };
}

// --- Battery -----------------------------------------------------------------

export interface BatteryResult {
  /** uptime_s at the last packet of the last boot segment. */
  runtimeFromUptimeS: number | null;
  /** Last packet − first packet. */
  runtimeFromPacketsMs: number | null;
  startMv: number | null;
  endMv: number | null;
  curve: { t: number; v: number }[];
  /** If the device rebooted, uptime-based runtime only covers the last boot. */
  rebootedDuringTest: boolean;
}

export function batteryResult(readings: readonly { t: number; uptimeS: number; batMv: number | null; bootSegment: number }[]): BatteryResult {
  if (readings.length === 0) {
    return { runtimeFromUptimeS: null, runtimeFromPacketsMs: null, startMv: null, endMv: null, curve: [], rebootedDuringTest: false };
  }
  const last = readings.at(-1)!;
  const segments = new Set(readings.map((r) => r.bootSegment));
  const curve = readings.filter((r) => r.batMv !== null).map((r) => ({ t: r.t, v: r.batMv! }));
  return {
    runtimeFromUptimeS: last.uptimeS,
    runtimeFromPacketsMs: last.t - readings[0]!.t,
    startMv: curve[0]?.v ?? null,
    endMv: curve.at(-1)?.v ?? null,
    curve,
    rebootedDuringTest: segments.size > 1,
  };
}

// --- BLE range & reconnect ----------------------------------------------------

export function reconnectTimes(events: readonly { t: number; kind: 'connected' | 'disconnected' | 'reconnected' }[]): {
  times: number[];
  unresolved: number;
} {
  const times: number[] = [];
  let downAt: number | null = null;
  for (const e of events) {
    if (e.kind === 'disconnected') downAt ??= e.t;
    else if (e.kind === 'reconnected' && downAt !== null) {
      times.push(e.t - downAt);
      downAt = null;
    }
  }
  return { times, unresolved: downAt === null ? 0 : 1 };
}

export interface BleRangeRun {
  distanceM: number;
  lossPct: number;
  disconnects: number;
  reconnectMs: number[];
}

export interface BleRangeRow {
  distanceM: number;
  runs: number;
  lossPct: number;
  disconnects: number;
  meanReconnectMs: number | null;
}

export function bleRangeRows(runs: readonly BleRangeRun[]): BleRangeRow[] {
  const by = new Map<number, BleRangeRun[]>();
  for (const r of runs) by.set(r.distanceM, [...(by.get(r.distanceM) ?? []), r]);
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([distanceM, rs]) => {
      const rec = rs.flatMap((r) => r.reconnectMs);
      return {
        distanceM,
        runs: rs.length,
        lossPct: rs.reduce((a, r) => a + r.lossPct, 0) / rs.length,
        disconnects: rs.reduce((a, r) => a + r.disconnects, 0),
        meanReconnectMs: rec.length ? rec.reduce((a, b) => a + b, 0) / rec.length : null,
      };
    });
}

// --- LED vs dashboard ----------------------------------------------------------

/** % of packets whose device `lvl` differs from the dashboard thresholds applied to `pm25_avg`. */
export function ledMismatch(readings: readonly { pm25Avg: number; lvl: number }[], thresholds: Settings['thresholds']) {
  let mismatches = 0;
  for (const r of readings) if (LEVEL_INDEX[classifyLevel(r.pm25Avg, thresholds)] !== r.lvl) mismatches++;
  const n = readings.length;
  return { n, mismatches, pct: n === 0 ? 0 : (mismatches / n) * 100 };
}
