import { describe, expect, it } from 'vitest';
import { lttb, decimateWithGaps } from './decimate';

describe('lttb', () => {
  it('returns input unchanged when below the threshold', () => {
    const pts = [
      { t: 0, v: 1 },
      { t: 1, v: 2 },
    ];
    expect(lttb(pts, 10)).toEqual(pts);
  });

  it('keeps first, last and the spike', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({ t: i, v: i === 500 ? 100 : 1 }));
    const out = lttb(pts, 50);
    expect(out).toHaveLength(50);
    expect(out[0]).toEqual(pts[0]);
    expect(out.at(-1)).toEqual(pts.at(-1));
    expect(out.some((p) => p.v === 100)).toBe(true);
  });
});

describe('decimateWithGaps', () => {
  it('decimates each segment separately and keeps the null gap markers', () => {
    const a = Array.from({ length: 500 }, (_, i) => ({ t: i, v: 1 as number | null }));
    const b = Array.from({ length: 500 }, (_, i) => ({ t: 1000 + i, v: 2 as number | null }));
    const out = decimateWithGaps([...a, { t: 600, v: null }, ...b], 100);
    expect(out.length).toBeLessThanOrEqual(102);
    expect(out.filter((p) => p.v === null)).toEqual([{ t: 600, v: null }]);
    const gapIdx = out.findIndex((p) => p.v === null);
    expect(out.slice(0, gapIdx).every((p) => p.v === 1)).toBe(true);
    expect(out.slice(gapIdx + 1).every((p) => p.v === 2)).toBe(true);
  });
});
