import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { describeValues, percentile, summarizeSession, timeWeightedAverage, type StatsReading } from './stats';

const S = DEFAULT_SETTINGS;

describe('percentile (linear interpolation, type 7)', () => {
  it('matches hand-computed values', () => {
    expect(percentile([10, 20, 30, 40], 0.95)).toBeCloseTo(38.5); // h = 2.85
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([], 0.5)).toBeNull();
  });
  it('does not depend on input order', () => {
    expect(percentile([40, 10, 30, 20], 0.5)).toBe(25);
  });
});

describe('describeValues', () => {
  it('computes n, mean, median, max, P95 and sample SD', () => {
    const d = describeValues([10, 20, 30, 40]);
    expect(d.n).toBe(4);
    expect(d.mean).toBe(25);
    expect(d.median).toBe(25);
    expect(d.max).toBe(40);
    expect(d.min).toBe(10);
    expect(d.p95).toBeCloseTo(38.5);
    expect(d.sd).toBeCloseTo(12.909944, 5); // sqrt(500/3)
    expect(d.cv).toBeCloseTo(51.639777, 4);
  });
  it('SD and CV are null for n < 2; everything null for n = 0', () => {
    expect(describeValues([5])).toMatchObject({ n: 1, mean: 5, sd: null, cv: null });
    expect(describeValues([])).toMatchObject({ n: 0, mean: null, max: null });
  });
});

describe('timeWeightedAverage', () => {
  it('weights each value by the time to the next one (last gets one interval)', () => {
    // weights 4000, 2000, 2000 → (40000 + 40000 + 80000) / 8000 = 20
    expect(
      timeWeightedAverage([
        { t: 0, v: 10 },
        { t: 4000, v: 20 },
        { t: 6000, v: 40 },
      ]),
    ).toBe(20);
  });
  it('caps long gaps (missing data) at one interval instead of stretching the value', () => {
    // gap 60 s > 3 × 2 s → weight 2000; uniform → 25
    expect(
      timeWeightedAverage([
        { t: 0, v: 10 },
        { t: 2000, v: 20 },
        { t: 4000, v: 30 },
        { t: 64_000, v: 40 },
      ]),
    ).toBe(25);
  });
});

function reading(i: number, pm25: number, extra: Partial<StatsReading> = {}): StatsReading {
  return { t: i * 2000, pm25, uptimeS: 100 + i * 2, seq: i, bootSegment: 0, rh: 50, batMv: 4000 - i, ...extra };
}

describe('summarizeSession', () => {
  it('constant 20 µg/m³ for 10 min → all classified time is Precaución', () => {
    const readings = Array.from({ length: 300 }, (_, i) => reading(i, 20));
    const s = summarizeSession({ readings, startedAt: 0, endedAt: 600_000, alerts: 0, disconnects: 0, settings: S });
    expect(s.durationMs).toBe(600_000);
    expect(s.values.mean).toBe(20);
    expect(s.twa).toBe(20);
    // First 29 readings have < 1 min of data in the 5-min window → unclassified.
    expect(s.minutesPerLevel.caution).toBeCloseTo((271 * 2) / 60);
    expect(s.minutesPerLevel.low).toBe(0);
    expect(s.pctPerLevel.caution).toBe(100);
    expect(s.unclassifiedMinutes).toBeCloseTo((29 * 2) / 60);
    expect(s.validPct).toBe(100);
    expect(s.batteryStartMv).toBe(4000);
    expect(s.batteryEndMv).toBe(3701);
    expect(s.rhMean).toBe(50);
    expect(s.corrected).toBe(false);
  });

  it('excludes warm-up readings and reports loss and reboots', () => {
    const readings = [
      reading(0, 999, { uptimeS: 0 }),
      reading(1, 999, { uptimeS: 2 }),
      reading(2, 10, { uptimeS: 40 }),
      reading(4, 20, { uptimeS: 44, seq: 4 }), // seq 3 missing
      reading(5, 30, { uptimeS: 0, seq: 0, bootSegment: 1 }), // reboot → warm-up again
      reading(6, 30, { uptimeS: 40, seq: 1, bootSegment: 1 }),
    ];
    const s = summarizeSession({ readings, startedAt: 0, endedAt: 14_000, alerts: 2, disconnects: 1, settings: S });
    expect(s.values.n).toBe(3);
    expect(s.values.max).toBe(30);
    expect(s.reboots).toBe(1);
    expect(s.lossPct).toBeCloseTo((1 / 7) * 100); // 6 received + 1 missing
    expect(s.alerts).toBe(2);
    expect(s.disconnects).toBe(1);
    expect(s.validPct).toBeCloseTo((3 / 7) * 100);
  });

  it('applies the correction factor only when asked, and says so', () => {
    const readings = Array.from({ length: 10 }, (_, i) => reading(i, 20));
    const settings = { ...S, correction: { enabled: true, slope: 0.5, intercept: 1 } };
    expect(summarizeSession({ readings, startedAt: 0, endedAt: 20_000, alerts: 0, disconnects: 0, settings }).values.mean).toBe(20);
    const c = summarizeSession({ readings, startedAt: 0, endedAt: 20_000, alerts: 0, disconnects: 0, settings, corrected: true });
    expect(c.values.mean).toBe(11);
    expect(c.corrected).toBe(true);
  });

  it('handles an empty session', () => {
    const s = summarizeSession({ readings: [], startedAt: 0, endedAt: 0, alerts: 0, disconnects: 0, settings: S });
    expect(s.values.n).toBe(0);
    expect(s.twa).toBeNull();
    expect(s.batteryStartMv).toBeNull();
    expect(s.validPct).toBe(0);
  });
});
