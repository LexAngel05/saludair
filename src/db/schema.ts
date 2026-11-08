import { Dexie, type EntityTable, type Transaction } from 'dexie';
import type {
  AlertRecord,
  LinkEventRecord,
  ReadingRecord,
  ReferenceDataRecord,
  ReferenceDatasetRecord,
  SessionRecord,
  SettingsRecord,
} from './types';

export const DB_NAME = 'saludair';

/**
 * Schema history. To change the schema, APPEND a new entry (never edit an old one),
 * optionally with an `upgrade` function, and bump nothing else — DB_SCHEMA_VERSION
 * follows the last entry. Record each change in AGENTS.md → Decision log.
 */
interface SchemaVersion {
  version: number;
  stores: Record<string, string>;
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

export const SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      sessions: '++id, startedAt, endedAt, testType, *tags',
      readings: '++id, sessionId, [sessionId+t]',
      linkEvents: '++id, sessionId, [sessionId+t]',
      alerts: '++id, sessionId, startedAt, level',
      referenceDatasets: '++id, importedAt',
      referenceData: '++id, datasetId, [datasetId+t]',
      settings: 'id',
    },
  },
];

export const DB_SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1]!.version;

export class SaludAirDB extends Dexie {
  sessions!: EntityTable<SessionRecord, 'id'>;
  readings!: EntityTable<ReadingRecord, 'id'>;
  linkEvents!: EntityTable<LinkEventRecord, 'id'>;
  alerts!: EntityTable<AlertRecord, 'id'>;
  referenceDatasets!: EntityTable<ReferenceDatasetRecord, 'id'>;
  referenceData!: EntityTable<ReferenceDataRecord, 'id'>;
  settings!: EntityTable<SettingsRecord, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    for (const v of SCHEMA_VERSIONS) {
      const builder = this.version(v.version).stores(v.stores);
      if (v.upgrade) builder.upgrade(v.upgrade);
    }
  }
}

let instance: SaludAirDB | undefined;

/** App-wide database (lazy so tests can use their own instances). */
export function getDb(): SaludAirDB {
  instance ??= new SaludAirDB();
  return instance;
}
