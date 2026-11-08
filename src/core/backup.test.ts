import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { BACKUP_APP_ID, parseBackup } from './backup';

const valid = {
  app: BACKUP_APP_ID,
  schemaVersion: 1,
  exportedAt: 1,
  tables: {
    sessions: [{ id: 1, startedAt: 0, source: 'simulator', testType: 'none', tags: [], notes: '', testParams: {}, settingsSnapshot: DEFAULT_SETTINGS }],
    readings: [],
    linkEvents: [],
    alerts: [],
    referenceDatasets: [],
    referenceData: [],
    settings: [],
  },
};

describe('parseBackup', () => {
  it('accepts a well-formed backup', () => {
    const r = parseBackup(JSON.stringify(valid), 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.tables.sessions).toHaveLength(1);
  });

  it.each([
    ['not json', 'invalid-json'],
    [JSON.stringify({ app: 'other' }), 'not-saludair'],
    [JSON.stringify({ ...valid, schemaVersion: 99 }), 'newer-version'],
    [JSON.stringify({ ...valid, tables: { ...valid.tables, readings: 'x' } }), 'bad-shape'],
    [JSON.stringify({ ...valid, tables: { sessions: [] } }), 'bad-shape'],
  ])('rejects %j as %s', (text, reason) => {
    const r = parseBackup(text, 1);
    expect(r).toEqual({ ok: false, reason });
  });
});
