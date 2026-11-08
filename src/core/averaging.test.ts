import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { applyCorrection, isWarmup, rollingMeans, windowMean } from './averaging';
import type { CoreReading } from './types';

const S = DEFAULT_SETTINGS;
const I = 2000;

/** n readings every 2 s ending at `end`, all past warm-up, with value f(i). */
function series(n: number, f: (i: number) => number, end = 600_000, uptimeStart = 100): CoreReading[] {
  return Array.from({ length: n }, (_, i) => ({ t: end - (n - 1 - i) * I, pm25: f(i), uptimeS: uptimeStart + i * 2 }));
}

describe('isWarmup', () => {
  it('flags uptime below the configured warm-up', () => {
    expect(isWarmup({ uptimeS: 29 }, S)).toBe(true);
    expect(isWarmup({ uptimeS: 30 }, S)).toBe(false);
  });
});

describe('windowMean', () => {
  it('averages readings in (end − window, end] and is complete with 30/30 samples', () => {
    const r = series(30, (i) => i); // 0..29 → mean 14.5
    const w = windowMean(r, 600_000, 60_000, S);
    expect(w).toMatchObject({ count: 30, expected: 30, complete: true });
    expect(w.mean).toBeCloseTo(14.5);
  });

  it('excludes readings outside the window', () => {
    const r = series(60, (i) => (i < 30 ? 100 : 10)); // older half = 100
    expect(windowMean(r, 600_000, 60_000, S).mean).toBe(10);
  });

  it('is complete at exactly 75 % of expected samples and incomplete below', () => {
    const r23 = series(23, () => 5); // 23/30 = 76.7 %
    const r22 = series(22, () => 5); // 73.3 %
    expect(windowMean(r23, 600_000, 60_000, S).complete).toBe(true);
    expect(windowMean(r22, 600_000, 60_000, S).complete).toBe(false);
  });

  it('excludes warm-up readings from the mean and the count', () => {
    const r: CoreReading[] = [
      { t: 598_000, pm25: 500, uptimeS: 10 },
      { t: 600_000, pm25: 8, uptimeS: 32 },
    ];
    expect(windowMean(r, 600_000, 60_000, S)).toMatchObject({ mean: 8, count: 1 });
  });

  it('returns a null mean when there is no valid data', () => {
    expect(windowMean([], 600_000, 60_000, S)).toMatchObject({ mean: null, count: 0, complete: false, coveredMs: 0 });
  });

  it('reports covered time as count × interval', () => {
    expect(windowMean(series(45, () => 1), 600_000, 300_000, S).coveredMs).toBe(90_000);
  });
});

describe('rollingMeans', () => {
  it('matches windowMean at every reading', () => {
    const r = series(400, (i) => (i * 7) % 23);
    const rolled = rollingMeans(r, 300_000, S);
    for (const idx of [0, 10, 149, 150, 151, 399]) {
      const w = windowMean(r, r[idx]!.t, 300_000, S);
      expect(rolled[idx]!.mean).toBeCloseTo(w.mean!);
      expect(rolled[idx]!.complete).toBe(w.complete);
    }
  });
});

describe('applyCorrection', () => {
  it('is identity when disabled and linear when enabled, never negative', () => {
    expect(applyCorrection(20, { enabled: false, slope: 0.5, intercept: 2 })).toBe(20);
    expect(applyCorrection(20, { enabled: true, slope: 0.5, intercept: 2 })).toBe(12);
    expect(applyCorrection(1, { enabled: true, slope: 1, intercept: -5 })).toBe(0);
  });
});
