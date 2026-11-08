import { BACKUP_APP_ID, BACKUP_TABLES, type Backup } from '../core/backup';
import { DB_SCHEMA_VERSION, type SaludAirDB } from './schema';
import type { AlertRecord, LinkEventRecord, ReadingRecord, SessionRecord } from './types';

export interface SessionBundle {
  session: SessionRecord;
  readings: ReadingRecord[];
  alerts: AlertRecord[];
  linkEvents: LinkEventRecord[];
}

export interface SessionListItem extends SessionRecord {
  readingCount: number;
}

export async function createSession(db: SaludAirDB, s: Omit<SessionRecord, 'id'>): Promise<number> {
  return db.sessions.add(s as SessionRecord);
}

export async function endSession(db: SaludAirDB, id: number, endedAt: number): Promise<void> {
  await db.sessions.update(id, { endedAt });
}

export async function getSessionBundle(db: SaludAirDB, id: number): Promise<SessionBundle | null> {
  const session = await db.sessions.get(id);
  if (!session) return null;
  const range = [
    [id, -Infinity],
    [id, Infinity],
  ] as const;
  const [readings, alerts, linkEvents] = await Promise.all([
    db.readings.where('[sessionId+t]').between(range[0], range[1]).toArray(),
    db.alerts.where('sessionId').equals(id).sortBy('startedAt'),
    db.linkEvents.where('[sessionId+t]').between(range[0], range[1]).toArray(),
  ]);
  return { session, readings, alerts, linkEvents };
}

export async function listSessions(db: SaludAirDB): Promise<SessionListItem[]> {
  const sessions = await db.sessions.orderBy('startedAt').reverse().toArray();
  return Promise.all(
    sessions.map(async (s) => ({ ...s, readingCount: await db.readings.where('sessionId').equals(s.id).count() })),
  );
}

export async function deleteSession(db: SaludAirDB, id: number): Promise<void> {
  await db.transaction('rw', [db.sessions, db.readings, db.alerts, db.linkEvents], async () => {
    await db.readings.where('sessionId').equals(id).delete();
    await db.alerts.where('sessionId').equals(id).delete();
    await db.linkEvents.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

export async function exportBackup(db: SaludAirDB, now: number = Date.now()): Promise<Backup> {
  const [sessions, readings, linkEvents, alerts, referenceDatasets, referenceData, settings] = await Promise.all([
    db.sessions.toArray(),
    db.readings.toArray(),
    db.linkEvents.toArray(),
    db.alerts.toArray(),
    db.referenceDatasets.toArray(),
    db.referenceData.toArray(),
    db.settings.toArray(),
  ]);
  return {
    app: BACKUP_APP_ID,
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: now,
    tables: { sessions, readings, linkEvents, alerts, referenceDatasets, referenceData, settings },
  };
}

/** Replaces ALL data with the backup's content (atomic). */
export async function restoreBackup(db: SaludAirDB, backup: Backup): Promise<void> {
  const tables = BACKUP_TABLES.map((n) => db.table(n));
  await db.transaction('rw', tables, async () => {
    for (const name of BACKUP_TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(backup.tables[name] as unknown[]);
    }
  });
}

/** Deletes measurements and reference data. Settings are kept. */
export async function resetAllData(db: SaludAirDB): Promise<void> {
  const names = BACKUP_TABLES.filter((n) => n !== 'settings');
  await db.transaction('rw', names.map((n) => db.table(n)), async () => {
    for (const n of names) await db.table(n).clear();
  });
}
