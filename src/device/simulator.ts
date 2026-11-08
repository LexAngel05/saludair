import { DEFAULT_SETTINGS } from '../config/defaults';
import { PACKET } from '../config/device';
import { SIMULATOR } from '../config/simulator';

/**
 * Pure, seeded device simulator. Emits the exact §5 line format, split into BLE-sized
 * chunks, with simulated timestamps (start + k × interval) so speed-up never depends
 * on wall-clock timers.
 */

export const SIM_SCENARIOS = [
  'limpio',
  'trafico',
  'fuente-controlada',
  'humedad-alta',
  'desconexion',
  'reinicio',
] as const;
export type SimScenario = (typeof SIM_SCENARIOS)[number];

export type SimEvent =
  | { type: 'chunk'; text: string; t: number }
  | { type: 'link'; state: 'down' | 'up'; t: number };

export interface SimOptions {
  scenario: SimScenario;
  startTime: number;
  seed?: number;
  intervalMs?: number;
  /** Thresholds the simulated firmware uses for its LED (`lvl`). */
  ledThresholds?: { caution: number; elevated: number };
}

export interface Simulator {
  /** Advances one packet interval and returns what the link delivered. */
  step(): SimEvent[];
  /** Simulated time of the next step. */
  readonly now: number;
}

/** mulberry32 PRNG — small, fast, deterministic. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Episode {
  start: number;
  rise: number;
  hold: number;
  decay: number;
  peak: number;
}

function episodeLevel(e: Episode, tick: number): number {
  const k = tick - e.start;
  if (k < 0) return 0;
  if (k < e.rise) return e.peak * (k / e.rise);
  if (k < e.rise + e.hold) return e.peak;
  const d = k - e.rise - e.hold;
  return e.peak * Math.exp(-d / e.decay);
}

export function createSimulator(opts: SimOptions): Simulator {
  const rand = prng(opts.seed ?? Date.now());
  const interval = opts.intervalMs ?? PACKET.intervalMs;
  const led = opts.ledThresholds ?? DEFAULT_SETTINGS.thresholds;
  const cfg = SIMULATOR;
  const ticksPerMin = 60_000 / interval;

  const gauss = () => {
    const u = Math.max(rand(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const between = (a: number, b: number) => a + (b - a) * rand();

  // Device-side state
  let tick = 0;
  let seq = 0;
  let uptimeTicks = 0;
  let rebootPauseLeft = 0;
  let hasRebooted = false;
  let linkDown = false;
  const history: number[] = [];
  let batMv = cfg.batteryStartMv;
  const episodes: Episode[] = [];

  // Scenario set-up: deterministic first episode so alerts are always reachable.
  if (opts.scenario === 'trafico') {
    episodes.push({ start: 1 * ticksPerMin, rise: 15, hold: 4 * ticksPerMin, decay: 20, peak: between(45, 60) });
  }
  if (opts.scenario === 'fuente-controlada') {
    episodes.push({ start: 1 * ticksPerMin, rise: 2 * ticksPerMin, hold: 3 * ticksPerMin, decay: 2 * ticksPerMin, peak: 120 });
  }

  function chunks(line: string, t: number): SimEvent[] {
    const out: SimEvent[] = [];
    for (let i = 0; i < line.length; i += cfg.chunkSize) out.push({ type: 'chunk', text: line.slice(i, i + cfg.chunkSize), t });
    return out;
  }

  function step(): SimEvent[] {
    const t = opts.startTime + tick * interval;
    const events: SimEvent[] = [];
    const minute = tick / ticksPerMin;

    // --- link disconnections (scenario "desconexion")
    if (opts.scenario === 'desconexion') {
      const phase = tick % cfg.disconnectEveryTicks;
      const shouldBeDown = tick > 0 && phase < cfg.disconnectForTicks;
      if (shouldBeDown && !linkDown) events.push({ type: 'link', state: 'down', t });
      if (!shouldBeDown && linkDown) events.push({ type: 'link', state: 'up', t });
      linkDown = shouldBeDown;
    }

    // --- device reboot (scenario "reinicio"): a few silent ticks, then seq/uptime from 0
    if (opts.scenario === 'reinicio' && !hasRebooted && tick === cfg.rebootAtTick) {
      hasRebooted = true;
      rebootPauseLeft = cfg.rebootPauseTicks;
    }
    if (rebootPauseLeft > 0) {
      rebootPauseLeft--;
      if (rebootPauseLeft === 0) {
        seq = 0;
        uptimeTicks = 0;
        history.length = 0;
      }
      tick++;
      return events;
    }

    // --- random traffic spikes
    if (opts.scenario === 'trafico' && rand() < 1 / (cfg.trafficSpikeEveryMin * ticksPerMin)) {
      episodes.push({
        start: tick,
        rise: Math.round(between(5, 20)),
        hold: Math.round(between(0.5, 3) * ticksPerMin),
        decay: between(10, 30),
        // Added on top of the ~10 µg/m³ baseline → readings of roughly 40–80.
        peak: between(30, 70),
      });
    }

    // --- pm model
    const humid = opts.scenario === 'humedad-alta';
    let pm25 = cfg.baselineMean + Math.sin((2 * Math.PI * minute) / 23) * 1.2 + gauss() * cfg.baselineNoise;
    // Overlapping episodes don't stack (a second car doesn't double the plume).
    const episode = episodes.reduce((m, e) => Math.max(m, episodeLevel(e, tick)), 0);
    pm25 += episode * (1 + gauss() * 0.06);
    if (humid) pm25 *= cfg.humidityInflation;
    const uptimeS = Math.round((uptimeTicks * interval) / 1000);
    if (uptimeS < 30) pm25 *= 0.4 + 0.6 * (uptimeS / 30); // laser/fan settling
    pm25 = Math.max(0, Math.round(pm25));
    const pm1 = Math.max(0, Math.round(pm25 * 0.68 + gauss() * 0.5));
    const pm10 = Math.max(pm25, Math.round(pm25 * 1.35 + Math.abs(gauss()) * 1.5));

    history.push(pm25);
    if (history.length > 10) history.shift();
    const pm25Avg = Math.round((history.reduce((a, b) => a + b, 0) / history.length) * 10) / 10;
    const lvl = pm25Avg >= led.elevated ? 2 : pm25Avg >= led.caution ? 1 : 0;

    const rhBase = humid ? 88 : 40;
    const rh = Math.min(humid ? 97 : 79, Math.max(humid ? 81 : 15, rhBase + Math.sin((2 * Math.PI * minute) / 30) * 6 + gauss() * 0.6));
    const temp = 27 + Math.sin((2 * Math.PI * minute) / 45) * 1.5 + gauss() * 0.1;
    batMv -= cfg.batteryDropPerTick;
    const bat = Math.round(batMv + gauss() * 4);

    const line = `${PACKET.protocolVersion},${seq},${uptimeS},${pm1},${pm25},${pm10},${pm25Avg.toFixed(1)},${lvl},${rh.toFixed(1)},${temp.toFixed(1)},${bat}`;

    const dropped = rand() < cfg.dropProbability;
    if (!linkDown) {
      if (rand() < cfg.garbageProbability) {
        const garbage = cfg.garbageLines[Math.floor(rand() * cfg.garbageLines.length)]!;
        events.push(...chunks(garbage + PACKET.lineTerminator, t));
      }
      if (!dropped) events.push(...chunks(line + PACKET.lineTerminator, t));
    }

    seq++;
    uptimeTicks++;
    tick++;
    return events;
  }

  return {
    step,
    get now() {
      return opts.startTime + tick * interval;
    },
  };
}
