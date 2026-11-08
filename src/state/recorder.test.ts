import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import type { AlertEvent } from '../core/alerts';
import { SaludAirDB } from '../db/schema';
import { deleteSession, exportBackup, getSessionBundle, listSessions, resetAllData, restoreBackup } from '../db/sessionsRepo';
import type { StreamPacket } from '../device/deviceStream';
import type { LinkState } from '../device/types';
import { SessionRecorder, type RecorderEvents } from './recorder';

let db: SaludAirDB;
let n = 0;
afterEach(async () => db?.delete());

class FakeEvents implements RecorderEvents {
  packet = new Set<(p: StreamPacket) => void>();
  alert = new Set<(e: AlertEvent) => void>();
  link = new Set<(s: LinkState, t: number) => void>();
  openEpisodePeak = (): number | null => null;
  onPacket(l: (p: StreamPacket) => void) {
    this.packet.add(l);
    return () => this.packet.delete(l);
  }
  onAlert(l: (e: AlertEvent) => void) {
    this.alert.add(l);
    return () => this.alert.delete(l);
  }
  onLink(l: (s: LinkState, t: number) => void) {
    this.link.add(l);
    return () => this.link.delete(l);
  }
}

const noTimer = { set: () => 0, clear: () => {} };

function pkt(i: number): StreamPacket {
  return {
    seq: i,
    uptimeS: 40 + i * 2,
    pm1: 1,
    pm25: 10 + i,
    pm10: 3,
    pm25Avg: 10,
    lvl: 0,
    rh: null,
    temp: null,
    batMv: 3900,
    t: 1000 + i * 2000,
    bootSegment: 0,
    reboot: false,
    missedBefore: 0,
  };
}

describe('SessionRecorder', () => {
  it('records raw packets in batches, alert episodes and link gaps, with a settings snapshot', async () => {
    db = new SaludAirDB(`rec-${n++}`);
    const ev = new FakeEvents();
    const rec = new SessionRecorder(db, ev, noTimer);
    const settings = { ...DEFAULT_SETTINGS, warmupS: 45 };
    const id = await rec.start({ startedAt: 1000, source: 'simulator', tags: ['interior'], testType: 'environment', notes: '', settings });

    for (let i = 0; i < 5; i++) for (const l of ev.packet) l(pkt(i));
    expect(await db.readings.count()).toBe(0); // buffered, not yet written
    await rec.flush();
    expect(await db.readings.count()).toBe(5);

    for (const l of ev.alert) l({ type: 'raise', level: 'caution', t: 5000, notify: true });
    for (const l of ev.alert) l({ type: 'raise', level: 'elevated', t: 6000, notify: true });
    for (const l of ev.link) l('reconnecting', 7000);
    for (const l of ev.link) l('connected', 9000);
    for (const l of ev.alert) l({ type: 'end', t: 10_000, episode: { level: 'elevated', startedAt: 5000, endedAt: 10_000, peak: 44 } });
    for (const l of ev.packet) l(pkt(5));
    await rec.stop(12_000);

    const b = (await getSessionBundle(db, id))!;
    expect(b.session.endedAt).toBe(12_000);
    expect(b.session.settingsSnapshot.warmupS).toBe(45);
    expect(b.readings.map((r) => r.pm25)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(b.alerts).toEqual([expect.objectContaining({ level: 'elevated', startedAt: 5000, endedAt: 10_000, peak: 44 })]);
    expect(b.linkEvents.map((e) => e.kind)).toEqual(['disconnected', 'reconnected']);

    // No longer listening after stop.
    for (const l of ev.packet) l(pkt(9));
    expect(ev.packet.size).toBe(0);
  });

  it('closes an alert still open when the session stops, with its peak so far', async () => {
    db = new SaludAirDB(`rec-${n++}`);
    const ev = new FakeEvents();
    ev.openEpisodePeak = () => 27.5;
    const rec = new SessionRecorder(db, ev, noTimer);
    const id = await rec.start({ startedAt: 0, source: 'ble', tags: [], testType: 'none', notes: '', settings: DEFAULT_SETTINGS });
    for (const l of ev.alert) l({ type: 'raise', level: 'caution', t: 100, notify: true });
    await rec.stop(500);
    const b = (await getSessionBundle(db, id))!;
    expect(b.alerts[0]).toMatchObject({ endedAt: 500, peak: 27.5 });
  });
});

describe('sessionsRepo', () => {
  it('lists, deletes, backs up, restores and resets', async () => {
    db = new SaludAirDB(`repo-${n++}`);
    const ev = new FakeEvents();
    const rec = new SessionRecorder(db, ev, noTimer);
    const a = await rec.start({ startedAt: 0, source: 'simulator', tags: [], testType: 'none', notes: '', settings: DEFAULT_SETTINGS });
    for (const l of ev.packet) l(pkt(0));
    await rec.stop(10);
    const b = await rec.start({ startedAt: 100, source: 'simulator', tags: ['exterior'], testType: 'none', notes: '', settings: DEFAULT_SETTINGS });
    await rec.stop(200);

    const list = await listSessions(db);
    expect(list.map((s) => [s.id, s.readingCount])).toEqual([
      [b, 0],
      [a, 1],
    ]);

    const backup = await exportBackup(db);
    await deleteSession(db, a);
    expect(await db.readings.count()).toBe(0);
    await restoreBackup(db, backup);
    expect(await db.readings.count()).toBe(1);
    expect(await db.sessions.count()).toBe(2);

    await db.settings.put({ id: 'current', value: DEFAULT_SETTINGS, updatedAt: 1 });
    await resetAllData(db);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.settings.count()).toBe(1);
  });
});
