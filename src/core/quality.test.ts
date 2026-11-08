import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { computeQualityFlags, isAlertPaused } from './quality';

const S = DEFAULT_SETTINGS;
const ok = { t: 100_000, uptimeS: 500, rh: 40, batMv: 3900 };
const keys = (f: { key: string }[]) => f.map((x) => x.key);

describe('computeQualityFlags', () => {
  it('no flags when connected, fresh, warm and healthy', () => {
    expect(computeQualityFlags({ link: 'connected', now: 101_000, connectedAt: 0, lastPacket: ok, lossPct: 0, reboots: 0 }, S)).toEqual([]);
  });

  it('Desconectado when there is no link', () => {
    const f = computeQualityFlags({ link: 'disconnected', now: 0, connectedAt: null, lastPacket: null, lossPct: 0, reboots: 0 }, S);
    expect(keys(f)).toEqual(['disconnected']);
  });

  it('reconnecting counts as disconnected', () => {
    const f = computeQualityFlags({ link: 'reconnecting', now: 0, connectedAt: null, lastPacket: ok, lossPct: 0, reboots: 0 }, S);
    expect(keys(f)).toContain('disconnected');
  });

  it('Lectura desactualizada after more than 10 s without a packet while connected', () => {
    const base = { link: 'connected' as const, connectedAt: 0, lastPacket: ok, lossPct: 0, reboots: 0 };
    expect(keys(computeQualityFlags({ ...base, now: 110_000 }, S))).toEqual([]);
    expect(keys(computeQualityFlags({ ...base, now: 110_001 }, S))).toEqual(['stale']);
  });

  it('stale counts from the connection time when no packet has arrived yet', () => {
    const f = computeQualityFlags({ link: 'connected', now: 20_000, connectedAt: 5_000, lastPacket: null, lossPct: 0, reboots: 0 }, S);
    expect(keys(f)).toEqual(['stale']);
  });

  it('packet loss, high humidity, warm-up, reboot and low battery carry their values', () => {
    const f = computeQualityFlags(
      {
        link: 'connected',
        now: 100_500,
        connectedAt: 0,
        lastPacket: { t: 100_000, uptimeS: 12, rh: 86, batMv: 3400 },
        lossPct: 2.5,
        reboots: 1,
      },
      S,
    );
    expect(f).toEqual([
      { key: 'packet-loss', value: 2.5 },
      { key: 'high-humidity', value: 86 },
      { key: 'warmup', value: 12 },
      { key: 'reboot', value: 1 },
      { key: 'low-battery', value: 3400 },
    ]);
  });

  it('missing optional sensors never raise humidity or battery flags', () => {
    const f = computeQualityFlags(
      { link: 'connected', now: 100_500, connectedAt: 0, lastPacket: { t: 100_000, uptimeS: 99, rh: null, batMv: null }, lossPct: 0, reboots: 0 },
      S,
    );
    expect(f).toEqual([]);
  });
});

describe('isAlertPaused', () => {
  it('pauses alerts on disconnected, stale or warm-up only', () => {
    expect(isAlertPaused([{ key: 'stale' }])).toBe(true);
    expect(isAlertPaused([{ key: 'warmup', value: 3 }])).toBe(true);
    expect(isAlertPaused([{ key: 'disconnected' }])).toBe(true);
    expect(isAlertPaused([{ key: 'high-humidity', value: 90 }, { key: 'packet-loss', value: 1 }])).toBe(false);
  });
});
