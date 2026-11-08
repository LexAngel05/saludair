import { describe, expect, it } from 'vitest';
import { toSeries } from './series';

describe('toSeries', () => {
  it('inserts a null point where the gap exceeds 3 packet intervals', () => {
    const s = toSeries([
      { t: 0, pm25: 1 },
      { t: 2000, pm25: 2 },
      { t: 6000, pm25: 3 }, // 4 s gap: fine
      { t: 20_000, pm25: 4 }, // 14 s gap: broken
    ]);
    expect(s).toEqual([
      { t: 0, v: 1 },
      { t: 2000, v: 2 },
      { t: 6000, v: 3 },
      { t: 8000, v: null },
      { t: 20_000, v: 4 },
    ]);
  });

  it('applies the correction when given', () => {
    expect(toSeries([{ t: 0, pm25: 10 }], { enabled: true, slope: 0.5, intercept: 1 })).toEqual([{ t: 0, v: 6 }]);
  });
});
