import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import type { ReadingRecord, SessionRecord } from '../db/types';
import { csvEscape, localIso, sessionCsv } from './exportCsv';
import { summarizeSession } from './stats';

const session: SessionRecord = {
  id: 7,
  startedAt: Date.UTC(2026, 10, 8, 20, 0, 0), // 12:00 in Tijuana (UTC−8 in November)
  endedAt: Date.UTC(2026, 10, 8, 20, 0, 6),
  source: 'simulator',
  testType: 'environment',
  tags: ['interior', 'recorrido'],
  notes: 'Cocina, ventana "abierta", sin gente',
  testParams: {},
  settingsSnapshot: { ...DEFAULT_SETTINGS, correction: { enabled: true, slope: 0.5, intercept: 1 } },
};

const r = (i: number, pm25: number, over: Partial<ReadingRecord> = {}): ReadingRecord => ({
  id: i + 1,
  sessionId: 7,
  t: session.startedAt + i * 2000,
  bootSegment: 0,
  seq: i,
  uptimeS: 28 + i * 2,
  pm1: 1,
  pm25,
  pm10: 3,
  pm25Avg: 2.5,
  lvl: 0,
  rh: null,
  temp: 25.5,
  batMv: 3900,
  ...over,
});

describe('csvEscape', () => {
  it('quotes fields with commas, quotes or newlines', () => {
    expect(csvEscape('a')).toBe('a');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('l1\nl2')).toBe('"l1\nl2"');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(3.5)).toBe('3.5');
  });

  it('neutralizes spreadsheet formulas in text', () => {
    expect(csvEscape('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvEscape('+1')).toBe("'+1");
  });
});

describe('localIso', () => {
  it('formats in America/Tijuana', () => {
    expect(localIso(session.startedAt)).toBe('2026-11-08 12:00:00');
  });
});

describe('sessionCsv', () => {
  const readings = [r(0, 10), r(1, 20), r(2, 30, { rh: 85 })];
  const summary = summarizeSession({
    readings,
    startedAt: session.startedAt,
    endedAt: session.endedAt!,
    alerts: 1,
    disconnects: 0,
    settings: session.settingsSnapshot,
  });

  it('starts with a metadata header and states raw values', () => {
    const csv = sessionCsv({ session, readings, summary, corrected: false });
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('# SaludAIR session export');
    expect(csv).toContain('# session_id,7');
    expect(csv).toContain('# started_at_utc,2026-11-08T20:00:00.000Z');
    expect(csv).toContain('# started_at_local,2026-11-08 12:00:00 (America/Tijuana)');
    expect(csv).toContain('# values,raw');
    expect(csv).toContain('# units,ug/m3');
    expect(csv).toContain('# tags,interior;recorrido');
    expect(csv).toContain('# notes,"Cocina, ventana ""abierta"", sin gente"');
    expect(csv).toMatch(/# settings_snapshot,".*""thresholds"":\{""caution"":15,""elevated"":35\}/);
    expect(csv).toContain('# summary_alerts,1');
  });

  it('has one row per reading with raw pm25 always present and empty optional fields', () => {
    const csv = sessionCsv({ session, readings, summary, corrected: false });
    const rows = csv.split('\r\n').filter((l) => l && !l.startsWith('#'));
    expect(rows[0]).toBe(
      'timestamp_utc,timestamp_local,seq,uptime_s,boot_segment,warmup,pm1,pm25_raw,pm25_value,pm10,pm25_avg_device,lvl_device,rh,temp,bat_mv',
    );
    expect(rows).toHaveLength(4);
    expect(rows[1]).toBe('2026-11-08T20:00:00.000Z,2026-11-08 12:00:00,0,28,0,1,1,10,10,3,2.5,0,,25.5,3900');
    expect(rows[3]).toContain(',85,');
  });

  it('applies the snapshot correction to pm25_value only when exporting corrected', () => {
    const csv = sessionCsv({ session, readings, summary, corrected: true });
    expect(csv).toContain('# values,corrected (pm25_value = 0.5 × raw + 1)');
    const row = csv.split('\r\n').find((l) => l.startsWith('2026-11-08T20:00:02'))!;
    expect(row.split(',')[7]).toBe('20'); // raw unchanged
    expect(row.split(',')[8]).toBe('11'); // corrected
  });
});
