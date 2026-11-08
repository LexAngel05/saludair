import type { Settings } from '../config/defaults';
import { PACKET } from '../config/device';
import { applyCorrection } from './averaging';

/**
 * Chart series from readings: gaps longer than `maxGapIntervals` packets become a null
 * point so the line breaks (gaps are drawn as gaps, never bridged).
 */
export function toSeries(
  readings: readonly { t: number; pm25: number }[],
  correction?: Settings['correction'],
  maxGapIntervals = 3,
  intervalMs: number = PACKET.intervalMs,
): { t: number; v: number | null }[] {
  const out: { t: number; v: number | null }[] = [];
  let prev: number | null = null;
  for (const r of readings) {
    if (prev !== null && r.t - prev > maxGapIntervals * intervalMs) out.push({ t: prev + intervalMs, v: null });
    out.push({ t: r.t, v: correction ? applyCorrection(r.pm25, correction) : r.pm25 });
    prev = r.t;
  }
  return out;
}
