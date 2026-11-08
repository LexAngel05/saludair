import type { RefRow } from '../core/referenceAlign';
import type { SaludAirDB } from './schema';
import type { ReferenceDataRecord, ReferenceDatasetRecord } from './types';

export async function saveReferenceDataset(
  db: SaludAirDB,
  meta: Omit<ReferenceDatasetRecord, 'id'>,
  rows: readonly RefRow[],
): Promise<number> {
  return db.transaction('rw', [db.referenceDatasets, db.referenceData], async () => {
    const id = await db.referenceDatasets.add(meta as ReferenceDatasetRecord);
    await db.referenceData.bulkAdd(rows.map((r) => ({ datasetId: id, t: r.t, pm25: r.pm25 })) as ReferenceDataRecord[]);
    return id;
  });
}

export function listReferenceDatasets(db: SaludAirDB): Promise<ReferenceDatasetRecord[]> {
  return db.referenceDatasets.orderBy('importedAt').reverse().toArray();
}

export function getReferenceRows(db: SaludAirDB, datasetId: number): Promise<ReferenceDataRecord[]> {
  return db.referenceData.where('[datasetId+t]').between([datasetId, -Infinity], [datasetId, Infinity]).toArray();
}

export async function deleteReferenceDataset(db: SaludAirDB, id: number): Promise<void> {
  await db.transaction('rw', [db.referenceDatasets, db.referenceData], async () => {
    await db.referenceData.where('datasetId').equals(id).delete();
    await db.referenceDatasets.delete(id);
  });
}
