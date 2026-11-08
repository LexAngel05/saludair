import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { batteryResult, bleRangeRows, ledMismatch, reconnectTimes, repeatability } from './validation';

describe('repeatability', () => {
  it('per-run mean/SD/CV and across-run mean, SD and CV of run means', () => {
    const r = repeatability([
      { id: 1, values: [10, 12, 14] }, // mean 12, sd 2
      { id: 2, values: [11, 13, 15] }, // mean 13, sd 2
      { id: 3, values: [13, 14, 15] }, // mean 14, sd 1
    ]);
    expect(r.runs.map((x) => [x.id, x.mean, x.sd])).toEqual([
      [1, 12, 2],
      [2, 13, 2],
      [3, 14, 1],
    ]);
    expect(r.runs[0]!.cv).toBeCloseTo((2 / 12) * 100);
    expect(r.across.mean).toBe(13);
    expect(r.across.sd).toBe(1);
    expect(r.across.cv).toBeCloseTo((1 / 13) * 100);
    expect(r.enoughRuns).toBe(true);
  });

  it('flags fewer than 3 runs', () => {
    expect(repeatability([{ id: 1, values: [1, 2] }]).enoughRuns).toBe(false);
  });
});

describe('batteryResult', () => {
  it('runtime from uptime of the last boot and from first→last packet; mV curve', () => {
    const readings = [
      { t: 0, uptimeS: 0, batMv: 4150, bootSegment: 0 },
      { t: 3_600_000, uptimeS: 3600, batMv: 3900, bootSegment: 0 },
      { t: 7_200_000, uptimeS: 7200, batMv: 3400, bootSegment: 0 },
    ];
    const b = batteryResult(readings);
    expect(b.runtimeFromUptimeS).toBe(7200);
    expect(b.runtimeFromPacketsMs).toBe(7_200_000);
    expect(b.startMv).toBe(4150);
    expect(b.endMv).toBe(3400);
    expect(b.curve).toHaveLength(3);
    expect(b.rebootedDuringTest).toBe(false);
  });
});

describe('reconnectTimes', () => {
  it('pairs each disconnect with the next reconnect', () => {
    expect(
      reconnectTimes([
        { t: 100, kind: 'disconnected' },
        { t: 1600, kind: 'reconnected' },
        { t: 5000, kind: 'disconnected' }, // never reconnected
      ]),
    ).toEqual({ times: [1500], unresolved: 1 });
  });
});

describe('bleRangeRows', () => {
  it('groups runs by distance, sorted', () => {
    const rows = bleRangeRows([
      { distanceM: 3, lossPct: 5, disconnects: 1, reconnectMs: [2000] },
      { distanceM: 1, lossPct: 0, disconnects: 0, reconnectMs: [] },
      { distanceM: 3, lossPct: 7, disconnects: 2, reconnectMs: [1000, 3000] },
    ]);
    expect(rows).toEqual([
      { distanceM: 1, runs: 1, lossPct: 0, disconnects: 0, meanReconnectMs: null },
      { distanceM: 3, runs: 2, lossPct: 6, disconnects: 3, meanReconnectMs: 2000 },
    ]);
  });
});

describe('ledMismatch', () => {
  it('counts packets where the device lvl disagrees with dashboard thresholds applied to pm25_avg', () => {
    const r = ledMismatch(
      [
        { pm25Avg: 10, lvl: 0 },
        { pm25Avg: 20, lvl: 1 },
        { pm25Avg: 20, lvl: 0 }, // firmware still thinks Bajo → mismatch
        { pm25Avg: 40, lvl: 2 },
      ],
      DEFAULT_SETTINGS.thresholds,
    );
    expect(r).toEqual({ n: 4, mismatches: 1, pct: 25 });
  });
});
