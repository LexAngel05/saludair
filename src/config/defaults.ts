/**
 * Default measurement settings (AGENTS.md §8). Every number here is user-configurable
 * in Settings and snapshotted into each session. Components must read thresholds
 * from Settings, never from literals.
 */

export const LEVELS = ['low', 'caution', 'elevated'] as const;
export type Level = (typeof LEVELS)[number];

/** Numeric level as sent by the device in the `lvl` field. */
export const LEVEL_INDEX: Record<Level, 0 | 1 | 2> = { low: 0, caution: 1, elevated: 2 };

export const SESSION_TAGS = ['interior', 'exterior', 'fuente-controlada', 'recorrido'] as const;
export type SessionTag = (typeof SESSION_TAGS)[number];

export const TEST_TYPES = [
  'none',
  'environment',
  'repeatability',
  'reference',
  'battery',
  'ble-range',
  'led-vs-dashboard',
] as const;
export type TestType = (typeof TEST_TYPES)[number];

export interface Settings {
  /** Lower bounds (µg/m³) of the 5-min mean for each level above "low". */
  thresholds: { caution: number; elevated: number };
  /** False → UI shows "umbrales provisionales". */
  thresholdsApproved: boolean;
  windows: {
    /** Big number on Live ("Ahora, promedio 1 min"). */
    shortMs: number;
    /** Level badge + alerts ("Nivel, promedio 5 min"). */
    levelMs: number;
    /** Reference comparison. */
    referenceMs: number;
  };
  /** Fraction of expected samples needed for a window to count as complete. */
  windowCompleteness: number;
  /** Minimum valid data before showing an "estimado" level. */
  minEstimateDataMs: number;
  alerts: {
    /** Continuous time above a threshold before firing. */
    persistenceMs: number;
    /** De-escalate when mean < threshold × factor … */
    hysteresisFactor: number;
    /** … for at least this long. */
    clearPersistenceMs: number;
    /** No repeat notification for the same level within this time. */
    cooldownMs: number;
  };
  /** Connected but no packet for longer than this → "Lectura desactualizada". */
  staleTimeoutMs: number;
  /** Readings with uptime_s below this are warm-up. */
  warmupS: number;
  /** RH above this → "Humedad alta". */
  highHumidityPct: number;
  /** bat_mv below this → "Batería baja". */
  lowBatteryMv: number;
  /** Optional linear correction applied at read time: corrected = slope × raw + intercept. */
  correction: { enabled: boolean; slope: number; intercept: number };
  notifications: { enabled: boolean; sound: boolean; vibrate: boolean };
  /** Batch interval for IndexedDB writes. */
  dbFlushIntervalMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  thresholds: { caution: 15, elevated: 35 },
  thresholdsApproved: false,
  windows: { shortMs: 60_000, levelMs: 5 * 60_000, referenceMs: 60 * 60_000 },
  windowCompleteness: 0.75,
  minEstimateDataMs: 60_000,
  alerts: {
    persistenceMs: 2 * 60_000,
    hysteresisFactor: 0.9,
    clearPersistenceMs: 2 * 60_000,
    cooldownMs: 10 * 60_000,
  },
  staleTimeoutMs: 10_000,
  warmupS: 30,
  highHumidityPct: 80,
  lowBatteryMv: 3500,
  correction: { enabled: false, slope: 1, intercept: 0 },
  notifications: { enabled: true, sound: false, vibrate: true },
  dbFlushIntervalMs: 5_000,
};

/** Deep-merges a partial (possibly older) stored settings object over defaults. */
export function mergeSettings(stored: unknown, defaults: Settings = DEFAULT_SETTINGS): Settings {
  return deepMerge(defaults, stored) as Settings;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (!isPlainObject(base)) {
    // Only accept an override of the same primitive type; ignore junk.
    return typeof over === typeof base && over !== null ? over : base;
  }
  const out: Record<string, unknown> = { ...base };
  if (!isPlainObject(over)) return out;
  for (const key of Object.keys(base)) {
    if (key in over) out[key] = deepMerge(base[key], over[key]);
  }
  return out;
}

/** Returns a list of human-independent validation problems (keys), empty when valid. */
export function validateSettings(s: Settings): string[] {
  const errors: string[] = [];
  if (!(s.thresholds.caution > 0)) errors.push('thresholds.caution');
  if (!(s.thresholds.elevated > s.thresholds.caution)) errors.push('thresholds.elevated');
  if (!(s.windowCompleteness > 0 && s.windowCompleteness <= 1)) errors.push('windowCompleteness');
  if (!(s.alerts.hysteresisFactor > 0 && s.alerts.hysteresisFactor <= 1)) errors.push('alerts.hysteresisFactor');
  if (!(s.windows.shortMs > 0 && s.windows.levelMs >= s.windows.shortMs)) errors.push('windows');
  if (!(s.minEstimateDataMs <= s.windows.levelMs)) errors.push('minEstimateDataMs');
  if (!(s.correction.slope > 0)) errors.push('correction.slope');
  return errors;
}
