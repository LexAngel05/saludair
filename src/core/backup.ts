import type {
  AlertRecord,
  LinkEventRecord,
  ReadingRecord,
  ReferenceDataRecord,
  ReferenceDatasetRecord,
  SessionRecord,
  SettingsRecord,
} from '../db/types';

export const BACKUP_APP_ID = 'saludair';

export const BACKUP_TABLES = [
  'sessions',
  'readings',
  'linkEvents',
  'alerts',
  'referenceDatasets',
  'referenceData',
  'settings',
] as const;

export interface Backup {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: number;
  tables: {
    sessions: SessionRecord[];
    readings: ReadingRecord[];
    linkEvents: LinkEventRecord[];
    alerts: AlertRecord[];
    referenceDatasets: ReferenceDatasetRecord[];
    referenceData: ReferenceDataRecord[];
    settings: SettingsRecord[];
  };
}

export type BackupError = 'invalid-json' | 'not-saludair' | 'newer-version' | 'bad-shape';

/** Validates a backup file before anything is written. */
export function parseBackup(text: string, currentSchemaVersion: number): { ok: true; backup: Backup } | { ok: false; reason: BackupError } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  if (typeof data !== 'object' || data === null || (data as { app?: unknown }).app !== BACKUP_APP_ID) {
    return { ok: false, reason: 'not-saludair' };
  }
  const d = data as Record<string, unknown>;
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > currentSchemaVersion) return { ok: false, reason: 'newer-version' };
  const tables = d.tables as Record<string, unknown> | undefined;
  if (typeof tables !== 'object' || tables === null) return { ok: false, reason: 'bad-shape' };
  for (const name of BACKUP_TABLES) {
    const rows = tables[name];
    if (!Array.isArray(rows) || !rows.every((r) => typeof r === 'object' && r !== null)) return { ok: false, reason: 'bad-shape' };
  }
  return { ok: true, backup: data as Backup };
}
