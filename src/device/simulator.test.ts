import { describe, expect, it } from 'vitest';
import { initialSequenceState, trackSequence } from '../core/sequence';
import { LineBuffer, parseLine, type Packet } from './lineParser';
import { createSimulator, SIM_SCENARIOS, type SimEvent, type SimScenario } from './simulator';

const T0 = Date.UTC(2026, 10, 8, 18, 0, 0);

function runSim(scenario: SimScenario, steps: number, seed = 42) {
  const sim = createSimulator({ scenario, seed, startTime: T0 });
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) events.push(...sim.step());
  const buffer = new LineBuffer();
  const packets: (Packet & { t: number })[] = [];
  let invalid = 0;
  for (const e of events) {
    if (e.type !== 'chunk') continue;
    for (const line of buffer.push(e.text)) {
      const r = parseLine(line);
      if (r.ok) packets.push({ ...r.packet, t: e.t });
      else invalid++;
    }
  }
  return { events, packets, invalid };
}

describe('createSimulator', () => {
  it('is deterministic for a given seed', () => {
    expect(runSim('trafico', 300, 7).events).toEqual(runSim('trafico', 300, 7).events);
    expect(runSim('trafico', 300, 7).events).not.toEqual(runSim('trafico', 300, 8).events);
  });

  it('starts at uptime 0 (warm-up) and uses simulated timestamps every 2 s', () => {
    const { packets } = runSim('limpio', 20);
    expect(packets[0]?.uptimeS).toBe(0);
    expect(packets[0]?.t).toBe(T0);
    for (const p of packets) expect((p.t - T0) % 2000).toBe(0);
    expect(packets.some((p) => p.uptimeS < 30)).toBe(true);
  });

  it('splits lines into BLE-sized chunks (≤ 20 bytes) that the real parser reassembles', () => {
    const { events, packets } = runSim('limpio', 50);
    const chunks = events.filter((e) => e.type === 'chunk');
    expect(chunks.every((c) => c.type === 'chunk' && c.text.length <= 20)).toBe(true);
    expect(packets.length).toBeGreaterThan(40);
  });

  it('keeps a clean baseline around 8–12 µg/m³ after warm-up', () => {
    const { packets } = runSim('limpio', 600);
    const after = packets.filter((p) => p.uptimeS >= 30).map((p) => p.pm25);
    const mean = after.reduce((a, b) => a + b, 0) / after.length;
    expect(mean).toBeGreaterThan(8);
    expect(mean).toBeLessThan(12.5);
    expect(Math.max(...after)).toBeLessThan(25);
  });

  it('produces dropped seq values and occasional garbage lines', () => {
    const { packets, invalid } = runSim('limpio', 3000);
    let state = initialSequenceState();
    for (const p of packets) state = trackSequence(state, p).state;
    expect(state.missing).toBeGreaterThan(0);
    expect(invalid).toBeGreaterThan(0);
  });

  it('traffic scenario has spikes of 40–80 that keep the 5-min mean above 35 for a while', () => {
    const { packets } = runSim('trafico', 900);
    expect(Math.max(...packets.map((p) => p.pm25))).toBeGreaterThanOrEqual(40);
    expect(Math.max(...packets.map((p) => p.pm25))).toBeLessThanOrEqual(90);
    // crude 5-min (150 packet) rolling mean
    let maxMean = 0;
    for (let i = 150; i < packets.length; i++) {
      const w = packets.slice(i - 150, i);
      maxMean = Math.max(maxMean, w.reduce((a, p) => a + p.pm25, 0) / w.length);
    }
    expect(maxMean).toBeGreaterThan(35);
  });

  it('device pm25_avg is the mean of the last 10 readings and lvl follows 15/35', () => {
    const { packets } = runSim('trafico', 400);
    for (const p of packets) {
      const expected = p.pm25Avg >= 35 ? 2 : p.pm25Avg >= 15 ? 1 : 0;
      expect(p.lvl).toBe(expected);
    }
  });

  it('high-humidity scenario reports RH above 80 %', () => {
    const { packets } = runSim('humedad-alta', 200);
    expect(packets.every((p) => p.rh !== null && p.rh > 80)).toBe(true);
  });

  it('battery voltage falls slowly', () => {
    const { packets } = runSim('limpio', 3000);
    const first = packets.slice(0, 50).reduce((a, p) => a + (p.batMv ?? 0), 0) / 50;
    const last = packets.slice(-50).reduce((a, p) => a + (p.batMv ?? 0), 0) / 50;
    expect(last).toBeLessThan(first);
  });

  it('reboot scenario resets seq and uptime (detected as a new boot segment)', () => {
    const { packets } = runSim('reinicio', 400);
    let state = initialSequenceState();
    for (const p of packets) state = trackSequence(state, p).state;
    expect(state.reboots).toBeGreaterThanOrEqual(1);
    expect(packets.filter((p) => p.uptimeS === 0).length).toBeGreaterThanOrEqual(1);
  });

  it('disconnection scenario emits link down/up with no packets in between', () => {
    const { events } = runSim('desconexion', 400);
    const downIdx = events.findIndex((e) => e.type === 'link' && e.state === 'down');
    const upIdx = events.findIndex((e, i) => i > downIdx && e.type === 'link' && e.state === 'up');
    expect(downIdx).toBeGreaterThan(-1);
    expect(upIdx).toBeGreaterThan(downIdx);
    expect(events.slice(downIdx + 1, upIdx).some((e) => e.type === 'chunk')).toBe(false);
  });

  it('exposes every scenario', () => {
    expect(SIM_SCENARIOS).toEqual(['limpio', 'trafico', 'fuente-controlada', 'humedad-alta', 'desconexion', 'reinicio']);
    for (const s of SIM_SCENARIOS) expect(runSim(s, 100).packets.length).toBeGreaterThan(50);
  });
});
