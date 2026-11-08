import type { Settings } from '../config/defaults';
import { PACKET } from '../config/device';
import type { CoreReading } from './types';

export interface WindowMean {
  mean: number | null;
  /** Valid (post-warm-up) samples in the window. */
  count: number;
  /** Samples expected at the nominal interval. */
  expected: number;
  completeness: number;
  /** completeness ≥ settings.windowCompleteness */
  complete: boolean;
  /** Valid data time in the window (count × interval). */
  coveredMs: number;
}

type AvgSettings = Pick<Settings, 'warmupS' | 'windowCompleteness'>;

export function isWarmup(r: Pick<CoreReading, 'uptimeS'>, s: Pick<Settings, 'warmupS'>): boolean {
  return r.uptimeS < s.warmupS;
}

function makeWindow(sum: number, count: number, windowMs: number, s: AvgSettings, intervalMs: number): WindowMean {
  const expected = Math.round(windowMs / intervalMs);
  const completeness = expected === 0 ? 0 : count / expected;
  return {
    mean: count === 0 ? null : sum / count,
    count,
    expected,
    completeness,
    complete: completeness >= s.windowCompleteness,
    coveredMs: count * intervalMs,
  };
}

/**
 * Time-based mean of raw pm25 over (endT − windowMs, endT], excluding warm-up readings.
 * Timestamps drive everything — never timers (background tabs throttle them).
 */
export function windowMean(
  readings: readonly CoreReading[],
  endT: number,
  windowMs: number,
  s: AvgSettings,
  intervalMs: number = PACKET.intervalMs,
): WindowMean {
  let sum = 0;
  let count = 0;
  const start = endT - windowMs;
  for (const r of readings) {
    if (r.t <= start || r.t > endT || isWarmup(r, s)) continue;
    sum += r.pm25;
    count++;
  }
  return makeWindow(sum, count, windowMs, s, intervalMs);
}

/** windowMean ending at each reading's timestamp, O(n). Readings must be sorted by t. */
export function rollingMeans(
  readings: readonly CoreReading[],
  windowMs: number,
  s: AvgSettings,
  intervalMs: number = PACKET.intervalMs,
): WindowMean[] {
  const out: WindowMean[] = [];
  let lo = 0;
  let sum = 0;
  let count = 0;
  for (let hi = 0; hi < readings.length; hi++) {
    const r = readings[hi]!;
    if (!isWarmup(r, s)) {
      sum += r.pm25;
      count++;
    }
    while (lo <= hi && readings[lo]!.t <= r.t - windowMs) {
      const old = readings[lo]!;
      if (!isWarmup(old, s)) {
        sum -= old.pm25;
        count--;
      }
      lo++;
    }
    out.push(makeWindow(sum, count, windowMs, s, intervalMs));
  }
  return out;
}

/** Read-time calibration (raw data is never modified). */
export function applyCorrection(value: number, c: Settings['correction']): number {
  if (!c.enabled) return value;
  return Math.max(0, c.slope * value + c.intercept);
}
