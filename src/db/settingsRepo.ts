import { DEFAULT_SETTINGS, mergeSettings, type Settings } from '../config/defaults';
import type { SaludAirDB } from './schema';

const KEY = 'current' as const;

/** Stored settings merged over defaults (new settings added later get their default). */
export async function loadSettings(db: SaludAirDB): Promise<Settings> {
  const row = await db.settings.get(KEY);
  return mergeSettings(row?.value);
}

export async function saveSettings(db: SaludAirDB, value: Settings, now: number = Date.now()): Promise<void> {
  await db.settings.put({ id: KEY, value, updatedAt: now });
}

export async function resetSettings(db: SaludAirDB, now: number = Date.now()): Promise<Settings> {
  await saveSettings(db, DEFAULT_SETTINGS, now);
  return DEFAULT_SETTINGS;
}
