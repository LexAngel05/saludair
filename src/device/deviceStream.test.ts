import { describe, expect, it } from 'vitest';
import { DeviceStream, type StreamPacket } from './deviceStream';
import { SimulatorSource } from './simulatorSource';
import type { DeviceSource, DeviceSourceListener, LinkState } from './types';

/** Minimal fake source: the test pushes chunks by hand. */
class FakeSource implements DeviceSource {
  readonly kind = 'ble' as const;
  readonly deviceName = 'SaludAIR-test';
  state: LinkState = 'disconnected';
  listener: DeviceSourceListener | null = null;
  async connect() {}
  async disconnect() {}
  now() {
    return 0;
  }
  setListener(l: DeviceSourceListener | null) {
    this.listener = l;
  }
}

describe('DeviceStream', () => {
  it('emits packets with arrival time and counts invalid lines without crashing', () => {
    const src = new FakeSource();
    const packets: StreamPacket[] = [];
    const stream = new DeviceStream(src, { packet: (p) => packets.push(p) });
    src.listener!.chunk('v1,1,40,1,2,3,2.0,0,50,20,3900\nv1,2,4', 1000);
    src.listener!.chunk('2,1,2,3,2.0,0,,,\ngarbage\nv9,1,2,3,4,5,6,0,,,\n', 2000);
    expect(packets.map((p) => [p.seq, p.t])).toEqual([
      [1, 1000],
      [2, 2000],
    ]);
    expect(stream.stats.invalidTotal).toBe(2);
    expect(stream.stats.invalid).toEqual({ 'field-count': 1, 'unknown-version': 1 });
    expect(stream.stats.unknownVersion).toBe('v9');
  });

  it('drops a partial line when the link goes down', () => {
    const src = new FakeSource();
    const packets: StreamPacket[] = [];
    new DeviceStream(src, { packet: (p) => packets.push(p) });
    src.listener!.chunk('v1,1,40,1,2,', 1000);
    src.listener!.link('reconnecting', 1500);
    src.listener!.chunk('v1,5,48,1,2,3,2.0,0,50,20,3900\n', 9000);
    expect(packets.map((p) => p.seq)).toEqual([5]);
  });

  it('flags reboots and loss through the sequence tracker', () => {
    const src = new FakeSource();
    const packets: StreamPacket[] = [];
    const stream = new DeviceStream(src, { packet: (p) => packets.push(p) });
    const line = (seq: number, up: number) => `v1,${seq},${up},1,2,3,2.0,0,,,\n`;
    src.listener!.chunk(line(10, 100) + line(12, 104) + line(0, 0), 1);
    expect(packets.map((p) => [p.missedBefore, p.reboot, p.bootSegment])).toEqual([
      [0, false, 0],
      [1, false, 0],
      [0, true, 1],
    ]);
    expect(stream.stats.sequence.missing).toBe(1);
  });
});

describe('SimulatorSource', () => {
  it('delivers simulated packets through the real parser, faster with speed-up', async () => {
    const tasks: (() => void)[] = [];
    const delays: number[] = [];
    const scheduler = {
      set: (fn: () => void, ms: number) => {
        tasks.push(fn);
        delays.push(ms);
        return tasks.length;
      },
      clear: () => {},
    };
    const src = new SimulatorSource({ scenario: 'limpio', seed: 1, startTime: 0, speed: 60, scheduler });
    const packets: StreamPacket[] = [];
    const states: LinkState[] = [];
    new DeviceStream(src, { packet: (p) => packets.push(p), link: (s) => states.push(s) });
    await src.connect();
    for (let i = 0; i < 30; i++) tasks.shift()!();
    expect(states[0]).toBe('connected');
    expect(packets.length).toBeGreaterThan(25);
    expect(packets[1]!.t - packets[0]!.t).toBe(2000);
    expect(delays[0]).toBeCloseTo(2000 / 60);
    expect(src.now()).toBe(31 * 2000);
    await src.disconnect();
    expect(states.at(-1)).toBe('disconnected');
  });
});
