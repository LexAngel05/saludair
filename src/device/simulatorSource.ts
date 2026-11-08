import { PACKET } from '../config/device';
import { createSimulator, type SimScenario, type Simulator } from './simulator';
import type { DeviceSource, DeviceSourceListener, LinkState } from './types';

export interface SimulatorSourceOptions {
  scenario: SimScenario;
  /** ×1, ×10, ×60 — compresses simulated time; timestamps stay simulated. */
  speed?: number;
  seed?: number;
  /** Start of simulated time; defaults to wall-clock now. */
  startTime?: number;
  ledThresholds?: { caution: number; elevated: number };
  /** Injected for tests. */
  scheduler?: { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void };
}

const defaultScheduler = {
  set: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clear: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/**
 * Drives the pure simulator on a timer. The timer only paces delivery; every timestamp
 * comes from the simulator, so background-tab throttling just slows the simulation down.
 */
export class SimulatorSource implements DeviceSource {
  readonly kind = 'simulator' as const;
  readonly deviceName = 'Simulador';
  private listener: DeviceSourceListener | null = null;
  private sim: Simulator | null = null;
  private handle: unknown = null;
  private speed: number;
  private _state: LinkState = 'disconnected';
  private readonly scheduler;

  private readonly opts: SimulatorSourceOptions;

  constructor(opts: SimulatorSourceOptions) {
    this.opts = opts;
    this.speed = opts.speed ?? 1;
    this.scheduler = opts.scheduler ?? defaultScheduler;
  }

  get state(): LinkState {
    return this._state;
  }

  get currentSpeed(): number {
    return this.speed;
  }

  setListener(listener: DeviceSourceListener | null): void {
    this.listener = listener;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  now(): number {
    return this.sim?.now ?? this.opts.startTime ?? Date.now();
  }

  async connect(): Promise<void> {
    if (this._state === 'connected') return;
    this.sim = createSimulator({
      scenario: this.opts.scenario,
      startTime: this.opts.startTime ?? Date.now(),
      ...(this.opts.seed !== undefined ? { seed: this.opts.seed } : {}),
      ...(this.opts.ledThresholds ? { ledThresholds: this.opts.ledThresholds } : {}),
    });
    this.setState('connected', this.sim.now);
    this.tick();
  }

  async disconnect(): Promise<void> {
    if (this.handle !== null) this.scheduler.clear(this.handle);
    this.handle = null;
    if (this._state !== 'disconnected') this.setState('disconnected', this.now());
  }

  private setState(state: LinkState, t: number) {
    this._state = state;
    this.listener?.link(state, t);
  }

  private tick = () => {
    if (!this.sim) return;
    for (const e of this.sim.step()) {
      if (e.type === 'chunk') this.listener?.chunk(e.text, e.t);
      else this.setState(e.state === 'down' ? 'reconnecting' : 'connected', e.t);
    }
    this.handle = this.scheduler.set(this.tick, PACKET.intervalMs / this.speed);
  };
}
