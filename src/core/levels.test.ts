import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { classifyLevel, levelFromWindow } from './levels';

const S = DEFAULT_SETTINGS;

describe('classifyLevel', () => {
  it.each([
    [0, 'low'],
    [14.99, 'low'],
    [15, 'caution'],
    [34.9, 'caution'],
    [35, 'elevated'],
    [400, 'elevated'],
  ] as const)('%d µg/m³ → %s', (v, lvl) => {
    expect(classifyLevel(v, S.thresholds)).toBe(lvl);
  });

  it('uses configured thresholds, not constants', () => {
    expect(classifyLevel(12, { caution: 10, elevated: 25 })).toBe('caution');
  });
});

describe('levelFromWindow', () => {
  it('complete 5-min window → level, quality "complete"', () => {
    const w = { mean: 40, count: 150, expected: 150, completeness: 1, complete: true, coveredMs: 300_000 };
    expect(levelFromWindow(w, S)).toEqual({ level: 'elevated', quality: 'complete', value: 40 });
  });

  it('incomplete but ≥ 1 min of valid data → "estimado"', () => {
    const w = { mean: 20, count: 30, expected: 150, completeness: 0.2, complete: false, coveredMs: 60_000 };
    expect(levelFromWindow(w, S)).toEqual({ level: 'caution', quality: 'estimated', value: 20 });
  });

  it('less than 1 min of valid data → "datos insuficientes" with no level', () => {
    const w = { mean: 20, count: 29, expected: 150, completeness: 0.19, complete: false, coveredMs: 58_000 };
    expect(levelFromWindow(w, S)).toEqual({ level: null, quality: 'insufficient', value: 20 });
  });
});
