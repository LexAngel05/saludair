import { LEVELS, type Level, type Settings } from '../config/defaults';
import { PACKET } from '../config/device';
import { applyCorrection, isWarmup, rollingMeans } from './averaging';
import { levelFromWindow } from './levels';
import { initialSequenceState, lossPercent, trackSequence } from './sequence';
import type { CoreReading } from './types';

/** Gaps longer than this many intervals are missing data, not a held value. */
const MAX_GAP_INTERVALS = 3;

/** Percentile with linear interpolation between order statistics (R type 7 / Excel PERCENTILE.INC). */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

export interface Descriptive {
  n: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  p95: number | null;
  /** Sample standard deviation (n − 1). */
  sd: number | null;
  /** Coefficient of variation, % (inflates at very low means — always show SD too). */
  cv: number | null;
}

export function describeValues(values: readonly number[]): Descriptive {
  const n = values.length;
  if (n === 0) return { n, mean: null, median: null, min: null, max: null, p95: null, sd: null, cv: null };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let sd: number | null = null;
  if (n >= 2) sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1));
  return {
    n,
    mean,
    median: percentile(values, 0.5),
    // reduce, not spread: long sessions can exceed the engine's argument limit.
    min: values.reduce((a, b) => (b < a ? b : a), Infinity),
    max: values.reduce((a, b) => (b > a ? b : a), -Infinity),
    p95: percentile(values, 0.95),
    sd,
    cv: sd !== null && mean !== 0 ? (sd / mean) * 100 : null,
  };
}

/** Weight of each point: time to the next point, capped; the last point gets one interval. */
function weights(ts: readonly number[], intervalMs: number): number[] {
  return ts.map((t, i) => {
    const next = ts[i + 1];
    if (next === undefined) return intervalMs;
    const dt = next - t;
    return dt > MAX_GAP_INTERVALS * intervalMs ? intervalMs : dt;
  });
}

export function timeWeightedAverage(points: readonly { t: number; v: number }[], intervalMs: number = PACKET.intervalMs): number | null {
  if (points.length === 0) return null;
  const w = weights(
    points.map((p) => p.t),
    intervalMs,
  );
  let num = 0;
  let den = 0;
  points.forEach((p, i) => {
    num += p.v * w[i]!;
    den += w[i]!;
  });
  return num / den;
}

export interface StatsReading extends CoreReading {
  seq: number;
  bootSegment: number;
}

export interface SessionSummaryInput {
  /** Sorted by t. */
  readings: readonly StatsReading[];
  startedAt: number;
  endedAt: number;
  alerts: number;
  disconnects: number;
  /** The session's settings snapshot. */
  settings: Settings;
  /** Apply the snapshot's correction factor (if enabled). Default: raw. */
  corrected?: boolean;
}

export interface SessionSummary {
  durationMs: number;
  /** Valid (post-warm-up) readings / readings expected over the duration, %. */
  validPct: number;
  values: Descriptive;
  twa: number | null;
  minutesPerLevel: Record<Level, number>;
  /** % of classified time per level. */
  pctPerLevel: Record<Level, number>;
  /** Valid time without enough data in the 5-min window to classify. */
  unclassifiedMinutes: number;
  alerts: number;
  lossPct: number;
  disconnects: number;
  reboots: number;
  batteryStartMv: number | null;
  batteryEndMv: number | null;
  rhMean: number | null;
  rhMax: number | null;
  corrected: boolean;
}

/** Session summary (AGENTS.md §8.6). Pure; computed from raw readings + settings snapshot. */
export function summarizeSession(input: SessionSummaryInput, intervalMs: number = PACKET.intervalMs): SessionSummary {
  const s = input.settings;
  const corrected = Boolean(input.corrected && s.correction.enabled);
  const all = corrected
    ? input.readings.map((r) => ({ ...r, pm25: applyCorrection(r.pm25, s.correction) }))
    : input.readings;

  const valid = all.filter((r) => !isWarmup(r, s));
  const durationMs = Math.max(0, input.endedAt - input.startedAt);
  const expected = durationMs / intervalMs;
  const validPct = expected > 0 ? Math.min(100, (valid.length / expected) * 100) : 0;

  // Level time from the rolling 5-min mean (same rule as the Live badge).
  const rolled = rollingMeans(all, s.windows.levelMs, s, intervalMs);
  const w = weights(
    all.map((r) => r.t),
    intervalMs,
  );
  const ms: Record<Level, number> = { low: 0, caution: 0, elevated: 0 };
  let unclassifiedMs = 0;
  all.forEach((r, i) => {
    if (isWarmup(r, s)) return;
    const lvl = levelFromWindow(rolled[i]!, s).level;
    if (lvl) ms[lvl] += w[i]!;
    else unclassifiedMs += w[i]!;
  });
  const classifiedMs = ms.low + ms.caution + ms.elevated;
  const minutesPerLevel = Object.fromEntries(LEVELS.map((l) => [l, ms[l] / 60_000])) as Record<Level, number>;
  const pctPerLevel = Object.fromEntries(
    LEVELS.map((l) => [l, classifiedMs > 0 ? (ms[l] / classifiedMs) * 100 : 0]),
  ) as Record<Level, number>;

  let seq = initialSequenceState();
  for (const r of input.readings) seq = trackSequence(seq, r).state;

  const bats = input.readings.map((r) => r.batMv).filter((v): v is number => v != null);
  const rhs = input.readings.map((r) => r.rh).filter((v): v is number => v != null);

  return {
    durationMs,
    validPct,
    values: describeValues(valid.map((r) => r.pm25)),
    twa: timeWeightedAverage(
      valid.map((r) => ({ t: r.t, v: r.pm25 })),
      intervalMs,
    ),
    minutesPerLevel,
    pctPerLevel,
    unclassifiedMinutes: unclassifiedMs / 60_000,
    alerts: input.alerts,
    lossPct: lossPercent(seq),
    disconnects: input.disconnects,
    reboots: seq.reboots,
    batteryStartMv: bats[0] ?? null,
    batteryEndMv: bats.at(-1) ?? null,
    rhMean: rhs.length ? rhs.reduce((a, b) => a + b, 0) / rhs.length : null,
    rhMax: rhs.length ? rhs.reduce((a, b) => (b > a ? b : a), -Infinity) : null,
    corrected,
  };
}
