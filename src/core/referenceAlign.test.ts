import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { alignToBins, compareMetrics, correctionFromFit, parseReferenceCsv, zonedToUtc } from './referenceAlign';

const H = 3_600_000;

describe('zonedToUtc', () => {
  it('handles PST (UTC−8) and PDT (UTC−7) in America/Tijuana', () => {
    expect(zonedToUtc(2026, 11, 8, 12, 0, 0, 'America/Tijuana')).toBe(Date.UTC(2026, 10, 8, 20));
    expect(zonedToUtc(2026, 7, 1, 12, 0, 0, 'America/Tijuana')).toBe(Date.UTC(2026, 6, 1, 19));
  });
  it('works for UTC and Mexico City (no DST since 2022)', () => {
    expect(zonedToUtc(2026, 7, 1, 12, 0, 0, 'UTC')).toBe(Date.UTC(2026, 6, 1, 12));
    expect(zonedToUtc(2026, 7, 1, 12, 0, 0, 'America/Mexico_City')).toBe(Date.UTC(2026, 6, 1, 18));
  });
});

describe('parseReferenceCsv', () => {
  const csv = [
    'timestamp,pm25',
    '2026-11-08 10:00,12.5',
    '2026-11-08 11:00,14',
    '08/11/2026 12:00,9', // DD/MM/YYYY
    '2026-11-08T13:00:00Z,7', // explicit UTC wins over the chosen zone
    'garbage,1',
    '2026-11-08 14:00,',
    '2026-11-08 15:00,-3',
    '2026-11-08 16:00,NA',
  ].join('\n');

  it('parses local times in the chosen zone, accepts DD/MM/YYYY and explicit UTC, counts rejects', () => {
    const r = parseReferenceCsv(csv, { timezone: 'America/Tijuana', hourMarks: 'start' });
    expect(r.rows).toEqual([
      { t: Date.UTC(2026, 10, 8, 18), pm25: 12.5 },
      { t: Date.UTC(2026, 10, 8, 19), pm25: 14 },
      { t: Date.UTC(2026, 10, 8, 20), pm25: 9 },
      { t: Date.UTC(2026, 10, 8, 13), pm25: 7 },
    ]);
    expect(r.rejected).toBe(4);
    expect(r.resolutionMs).toBe(H);
  });

  it('shifts end-of-hour stamps back one interval so t is the start of the hour', () => {
    const r = parseReferenceCsv('timestamp,pm25\n2026-11-08 11:00,12.5\n2026-11-08 12:00,10', { timezone: 'America/Tijuana', hourMarks: 'end' });
    expect(r.rows[0]!.t).toBe(Date.UTC(2026, 10, 8, 18)); // 11:00 end → 10:00 start local = 18:00Z
  });

  it('accepts semicolon separators and decimal commas', () => {
    const r = parseReferenceCsv('fecha;pm25\n2026-11-08 10:00;12,5', { timezone: 'UTC', hourMarks: 'start' });
    expect(r.rows).toEqual([{ t: Date.UTC(2026, 10, 8, 10), pm25: 12.5 }]);
  });
});

describe('alignToBins', () => {
  const S = DEFAULT_SETTINGS;
  const t0 = Date.UTC(2026, 10, 8, 18);
  // Device: 2 h of readings every 2 s (1800/h): hour 1 value 10, hour 2 value 20 but only 50 % present.
  const device = [
    ...Array.from({ length: 1800 }, (_, i) => ({ t: t0 + i * 2000, pm25: 10, uptimeS: 100 })),
    ...Array.from({ length: 900 }, (_, i) => ({ t: t0 + H + i * 2000, pm25: 20, uptimeS: 100 })),
  ];
  const reference = [
    { t: t0, pm25: 8 },
    { t: t0 + H, pm25: 18 },
  ];

  it('pairs hourly means only where the device hour is ≥ 75 % complete', () => {
    const r = alignToBins(device, reference, { binMs: H, refResolutionMs: H, settings: S });
    expect(r.pairs).toEqual([{ t: t0, device: 10, reference: 8 }]);
    expect(r.skippedIncomplete).toBe(1);
  });

  it('averages finer reference data into the bin (10-min reference → hourly)', () => {
    const ref10 = Array.from({ length: 6 }, (_, i) => ({ t: t0 + i * 600_000, pm25: i < 3 ? 6 : 10 }));
    const r = alignToBins(device, ref10, { binMs: H, refResolutionMs: 600_000, settings: S });
    expect(r.pairs[0]).toEqual({ t: t0, device: 10, reference: 8 });
  });
});

describe('compareMetrics', () => {
  it('matches hand-computed values', () => {
    // device = 2 × ref + 1 exactly
    const pairs = [1, 2, 3, 4, 5].map((x, i) => ({ t: i, reference: x, device: 2 * x + 1 }));
    const m = compareMetrics(pairs);
    expect(m.n).toBe(5);
    expect(m.meanDevice).toBe(7);
    expect(m.meanReference).toBe(3);
    expect(m.bias).toBe(4);
    expect(m.mae).toBe(4); // |d−r| = x+1 → 2..6, mean 4
    expect(m.rmse).toBeCloseTo(Math.sqrt((4 + 9 + 16 + 25 + 36) / 5));
    expect(m.r).toBeCloseTo(1);
    expect(m.r2).toBeCloseTo(1);
    expect(m.slope).toBeCloseTo(2); // device = slope × reference + intercept
    expect(m.intercept).toBeCloseTo(1);
    expect(m.sufficient).toBe(false); // n < 10
  });

  it('returns nulls for r and fit when there is no spread', () => {
    const m = compareMetrics([
      { t: 0, reference: 5, device: 5 },
      { t: 1, reference: 5, device: 6 },
    ]);
    expect(m.r).toBeNull();
    expect(m.slope).toBeNull();
  });
});

describe('correctionFromFit', () => {
  it('inverts device = m·ref + b into corrected = (raw − b)/m', () => {
    expect(correctionFromFit(2, 1)).toEqual({ slope: 0.5, intercept: -0.5 });
  });
});
