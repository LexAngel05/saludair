import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, validateSettings } from './defaults';
import { BLE, PACKET } from './device';

describe('DEFAULT_SETTINGS', () => {
  it('matches the methodology in AGENTS.md §8', () => {
    expect(DEFAULT_SETTINGS.thresholds).toEqual({ caution: 15, elevated: 35 });
    expect(DEFAULT_SETTINGS.thresholdsApproved).toBe(false);
    expect(DEFAULT_SETTINGS.windows).toEqual({ shortMs: 60_000, levelMs: 300_000, referenceMs: 3_600_000 });
    expect(DEFAULT_SETTINGS.windowCompleteness).toBe(0.75);
    expect(DEFAULT_SETTINGS.minEstimateDataMs).toBe(60_000);
    expect(DEFAULT_SETTINGS.alerts).toEqual({
      persistenceMs: 120_000,
      hysteresisFactor: 0.9,
      clearPersistenceMs: 120_000,
      cooldownMs: 600_000,
    });
    expect(DEFAULT_SETTINGS.staleTimeoutMs).toBe(10_000);
    expect(DEFAULT_SETTINGS.warmupS).toBe(30);
    expect(DEFAULT_SETTINGS.highHumidityPct).toBe(80);
    expect(DEFAULT_SETTINGS.correction.enabled).toBe(false);
  });

  it('is valid', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
  });
});

describe('mergeSettings', () => {
  it('returns defaults for missing or junk input', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps stored values and fills keys added in newer versions', () => {
    const merged = mergeSettings({ thresholds: { caution: 12 }, warmupS: 45 });
    expect(merged.thresholds).toEqual({ caution: 12, elevated: 35 });
    expect(merged.warmupS).toBe(45);
    expect(merged.alerts).toEqual(DEFAULT_SETTINGS.alerts);
  });

  it('ignores wrongly-typed and unknown fields', () => {
    const merged = mergeSettings({ warmupS: 'thirty', unknownKey: 1, thresholdsApproved: 'yes' });
    expect(merged.warmupS).toBe(30);
    expect(merged.thresholdsApproved).toBe(false);
    expect(merged).not.toHaveProperty('unknownKey');
  });

  it('does not mutate defaults', () => {
    const merged = mergeSettings({ thresholds: { caution: 5 } });
    merged.thresholds.elevated = 99;
    expect(DEFAULT_SETTINGS.thresholds).toEqual({ caution: 15, elevated: 35 });
  });
});

describe('validateSettings', () => {
  it('rejects elevated ≤ caution and out-of-range factors', () => {
    const bad = mergeSettings({
      thresholds: { caution: 30, elevated: 20 },
      windowCompleteness: 1.5,
      alerts: { hysteresisFactor: 0 },
    });
    expect(validateSettings(bad)).toEqual(
      expect.arrayContaining(['thresholds.elevated', 'windowCompleteness', 'alerts.hysteresisFactor']),
    );
  });
});

describe('device contract', () => {
  it('uses Nordic UART Service UUIDs and the v1 line format', () => {
    expect(BLE.serviceUuid).toBe('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
    expect(BLE.txCharacteristicUuid).toBe('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
    expect(BLE.rxCharacteristicUuid).toBe('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
    expect(PACKET.protocolVersion).toBe('v1');
    expect(PACKET.fields).toHaveLength(10);
    expect(PACKET.intervalMs).toBe(2000);
  });
});
