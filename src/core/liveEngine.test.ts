import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import type { StreamPacket } from '../device/deviceStream';
import { LiveEngine } from './liveEngine';

const S = DEFAULT_SETTINGS;

function pkt(i: number, pm25: number, over: Partial<StreamPacket> = {}): StreamPacket {
  return {
    seq: i,
    uptimeS: 100 + i * 2,
    pm1: pm25,
    pm25,
    pm10: pm25,
    pm25Avg: pm25,
    lvl: 0,
    rh: 40,
    temp: 25,
    batMv: 3900,
    t: i * 2000,
    bootSegment: 0,
    reboot: false,
    missedBefore: 0,
    ...over,
  };
}

const conn = { link: 'connected' as const, connectedAt: 0, lossPct: 0, reboots: 0 };

describe('LiveEngine', () => {
  it('reports "datos insuficientes" before 1 min of valid data, then "estimado", then complete', () => {
    const e = new LiveEngine(S);
    for (let i = 0; i < 20; i++) e.addPacket(pkt(i, 10));
    expect(e.snapshot({ ...conn, now: 19 * 2000 }).level.quality).toBe('insufficient');
    for (let i = 20; i < 40; i++) e.addPacket(pkt(i, 10));
    expect(e.snapshot({ ...conn, now: 39 * 2000 }).level).toMatchObject({ quality: 'estimated', level: 'low' });
    for (let i = 40; i < 150; i++) e.addPacket(pkt(i, 10));
    expect(e.snapshot({ ...conn, now: 149 * 2000 }).level.quality).toBe('complete');
  });

  it('big number is the 1-min mean, badge is the 5-min mean (can differ)', () => {
    const e = new LiveEngine(S);
    for (let i = 0; i < 150; i++) e.addPacket(pkt(i, i < 120 ? 10 : 40));
    const snap = e.snapshot({ ...conn, now: 149 * 2000 });
    expect(snap.short.mean).toBe(40);
    expect(snap.level.level).toBe('caution'); // (120×10 + 30×40)/150 = 16
  });

  it('fires an alert from packet timestamps and pauses during warm-up', () => {
    const e = new LiveEngine(S);
    const events = [];
    for (let i = 0; i < 300; i++) events.push(...e.addPacket(pkt(i, 50)));
    expect(events.some((ev) => ev.type === 'raise' && ev.level === 'elevated')).toBe(true);

    const w = new LiveEngine(S);
    const warm = [];
    for (let i = 0; i < 300; i++) warm.push(...w.addPacket(pkt(i, 50, { uptimeS: 5 })));
    expect(warm).toEqual([]);
  });

  it('flags staleness from the source clock and pauses alerts on link loss', () => {
    const e = new LiveEngine(S);
    for (let i = 0; i < 10; i++) e.addPacket(pkt(i, 10));
    expect(e.snapshot({ ...conn, now: 9 * 2000 + 11_000 }).flags.map((f) => f.key)).toContain('stale');
    expect(e.snapshot({ ...conn, link: 'reconnecting', now: 0 }).flags.map((f) => f.key)).toContain('disconnected');
  });

  it('trend has the last 10 minutes with null gaps where data is missing', () => {
    const e = new LiveEngine(S);
    for (let i = 0; i < 400; i++) if (i < 300 || i > 320) e.addPacket(pkt(i, 10));
    const trend = e.snapshot({ ...conn, now: 399 * 2000 }).trend;
    expect(trend[0]!.t).toBeGreaterThan(399 * 2000 - 600_000);
    expect(trend.some((p) => p.v === null)).toBe(true);
  });

  it('keeps only about an hour of readings in memory', () => {
    const e = new LiveEngine(S);
    for (let i = 0; i < 4000; i++) e.addPacket(pkt(i, 10));
    expect(e.bufferSize).toBeLessThanOrEqual(1800 + 60);
  });
});
