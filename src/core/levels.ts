import type { Level, Settings } from '../config/defaults';
import type { WindowMean } from './averaging';

export function classifyLevel(value: number, t: Settings['thresholds']): Level {
  if (value >= t.elevated) return 'elevated';
  if (value >= t.caution) return 'caution';
  return 'low';
}

export type LevelQuality = 'complete' | 'estimated' | 'insufficient';

export interface LevelStatus {
  /** null when there isn't enough data to show a level. */
  level: Level | null;
  quality: LevelQuality;
  value: number | null;
}

/** Level badge from the 5-min window (AGENTS.md §8.1). */
export function levelFromWindow(w: WindowMean, s: Pick<Settings, 'thresholds' | 'minEstimateDataMs'>): LevelStatus {
  if (w.mean === null) return { level: null, quality: 'insufficient', value: null };
  if (w.complete) return { level: classifyLevel(w.mean, s.thresholds), quality: 'complete', value: w.mean };
  if (w.coveredMs >= s.minEstimateDataMs) {
    return { level: classifyLevel(w.mean, s.thresholds), quality: 'estimated', value: w.mean };
  }
  return { level: null, quality: 'insufficient', value: w.mean };
}
