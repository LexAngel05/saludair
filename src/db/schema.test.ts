import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { DB_SCHEMA_VERSION, SaludAirDB } from './schema';
import { loadSettings, resetSettings, saveSettings } from './settingsRepo';

let db: SaludAirDB;
let counter = 0;

function freshDb() {
  db = new SaludAirDB(`test-${Date.now()}-${counter++}`);
  return db;
}

afterEach(async () => {
  await db?.delete();
});

describe('SaludAirDB schema v1', () => {
  it('opens with all tables', async () => {
    const d = freshDb();
    await d.open();
    expect(d.verno).toBe(DB_SCHEMA_VERSION);
    expect(d.tables.map((t) => t.name).sort()).toEqual(
      ['alerts', 'linkEvents', 'readings', 'referenceData', 'referenceDatasets', 'sessions', 'settings'].sort(),
    );
  });

  it('stores a session with its settings snapshot and queries readings by session and time', async () => {
    const d = freshDb();
    const sessionId = await d.sessions.add({
      startedAt: 1_000,
      source: 'simulator',
      testType: 'none',
      tags: ['interior'],
      notes: '',
      testParams: {},
      settingsSnapshot: DEFAULT_SETTINGS,
    });
    const base = {
      sessionId,
      bootSegment: 0,
      uptimeS: 40,
      pm1: 5,
      pm10: 12,
      pm25Avg: 9,
      lvl: 0 as const,
      rh: null,
      temp: null,
      batMv: 3900,
    };
    await d.readings.bulkAdd([
      { ...base, t: 2_000, seq: 1, pm25: 9 },
      { ...base, t: 4_000, seq: 2, pm25: 10 },
      { ...base, t: 6_000, seq: 3, pm25: 11 },
    ]);
    const inRange = await d.readings
      .where('[sessionId+t]')
      .between([sessionId, 3_000], [sessionId, 10_000])
      .toArray();
    expect(inRange.map((r) => r.seq)).toEqual([2, 3]);

    const byTag = await d.sessions.where('tags').equals('interior').toArray();
    expect(byTag[0]?.settingsSnapshot.thresholds.elevated).toBe(35);
  });
});

describe('settingsRepo', () => {
  it('returns defaults when nothing is stored, then persists changes', async () => {
    const d = freshDb();
    expect(await loadSettings(d)).toEqual(DEFAULT_SETTINGS);

    await saveSettings(d, { ...DEFAULT_SETTINGS, warmupS: 60, thresholdsApproved: true });
    const loaded = await loadSettings(d);
    expect(loaded.warmupS).toBe(60);
    expect(loaded.thresholdsApproved).toBe(true);

    expect(await resetSettings(d)).toEqual(DEFAULT_SETTINGS);
    expect(await loadSettings(d)).toEqual(DEFAULT_SETTINGS);
  });
});
