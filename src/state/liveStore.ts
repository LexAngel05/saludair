import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../config/defaults';
import type { AlertEvent, AlertLevel } from '../core/alerts';
import { LiveEngine, type LiveSnapshot } from '../core/liveEngine';
import { lossPercent } from '../core/sequence';
import { DeviceStream, type StreamPacket } from '../device/deviceStream';
import type { SimScenario } from '../device/simulator';
import { SimulatorSource } from '../device/simulatorSource';
import type { DeviceSource, LinkState, SourceKindLive } from '../device/types';
import { es } from '../i18n/es';
import { formatNumber } from '../lib/format';
import { playChime, requestNotificationPermission, showSystemNotification, vibrate } from '../platform/notify';

export interface AlertBannerState {
  level: AlertLevel;
  t: number;
  mean: number;
}

export interface LiveState {
  link: LinkState;
  kind: SourceKindLive | null;
  deviceName: string | undefined;
  connectedAt: number | null;
  /** Source clock at the last refresh. */
  now: number;
  snapshot: LiveSnapshot;
  lossPct: number;
  reboots: number;
  invalidLines: number;
  unknownVersion: string | null;
  sim: { scenario: SimScenario; speed: number };
  banner: AlertBannerState | null;
  error: string | null;
}

type Listener = () => void;
type PacketListener = (p: StreamPacket) => void;
type AlertListener = (e: AlertEvent) => void;
type LinkListener = (state: LinkState, t: number) => void;

const DISPLAY_REFRESH_MS = 1000;

/**
 * App-wide connection + live computation. One instance (`liveStore`) so the connection
 * survives page navigation. Timing comes from packet timestamps and the source clock;
 * the 1 s refresh only updates "hace N s" and staleness on screen.
 */
export class LiveStore {
  private listeners = new Set<Listener>();
  private packetListeners = new Set<PacketListener>();
  private alertListeners = new Set<AlertListener>();
  private linkListeners = new Set<LinkListener>();
  private settings: Settings = DEFAULT_SETTINGS;
  private engine = new LiveEngine(DEFAULT_SETTINGS);
  private stream: DeviceStream | null = null;
  private refreshHandle: ReturnType<typeof setInterval> | null = null;
  private state: LiveState;

  constructor() {
    this.state = {
      link: 'disconnected',
      kind: null,
      deviceName: undefined,
      connectedAt: null,
      now: Date.now(),
      snapshot: this.engine.snapshot({ now: Date.now(), link: 'disconnected', connectedAt: null, lossPct: 0, reboots: 0 }),
      lossPct: 0,
      reboots: 0,
      invalidLines: 0,
      unknownVersion: null,
      sim: { scenario: 'trafico', speed: 1 },
      banner: null,
      error: null,
    };
  }

  // --- subscription (useSyncExternalStore)
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getState = () => this.state;

  onPacket(l: PacketListener) {
    this.packetListeners.add(l);
    return () => this.packetListeners.delete(l);
  }
  onAlert(l: AlertListener) {
    this.alertListeners.add(l);
    return () => this.alertListeners.delete(l);
  }
  onLink(l: LinkListener) {
    this.linkListeners.add(l);
    return () => this.linkListeners.delete(l);
  }

  get source(): DeviceSource | null {
    return this.stream?.source ?? null;
  }

  setSettings(s: Settings) {
    this.settings = s;
    this.engine.setSettings(s);
    this.refresh();
  }

  // --- connection
  async connect(source: DeviceSource) {
    await this.disconnect();
    void requestNotificationPermission();
    this.engine.reset();
    this.stream = new DeviceStream(source, {
      packet: (p) => this.handlePacket(p),
      link: (state, t) => this.handleLink(state, t),
      error: (err) => this.patch({ error: err.message }),
    });
    this.patch({ kind: source.kind, deviceName: source.deviceName, error: null, banner: null, link: 'connecting' });
    try {
      await source.connect();
    } catch (e) {
      this.stream.detach();
      this.stream = null;
      this.patch({ link: 'disconnected', kind: null, error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
    this.startRefresh();
  }

  async connectSimulator() {
    const { scenario, speed } = this.state.sim;
    await this.connect(new SimulatorSource({ scenario, speed, ledThresholds: this.settings.thresholds }));
  }

  setSimScenario(scenario: SimScenario) {
    this.patch({ sim: { ...this.state.sim, scenario } });
  }

  setSimSpeed(speed: number) {
    const src = this.stream?.source;
    if (src instanceof SimulatorSource) src.setSpeed(speed);
    this.patch({ sim: { ...this.state.sim, speed } });
  }

  async disconnect() {
    if (this.refreshHandle) clearInterval(this.refreshHandle);
    this.refreshHandle = null;
    const stream = this.stream;
    if (!stream) return;
    await stream.source.disconnect();
    stream.detach();
    this.stream = null;
    this.patch({ link: 'disconnected', kind: null, connectedAt: null });
    this.refresh();
  }

  dismissBanner() {
    this.patch({ banner: null });
  }

  // --- internals
  private handlePacket(p: StreamPacket) {
    const events = this.engine.addPacket(p);
    for (const l of this.packetListeners) l(p);
    for (const e of events) this.handleAlert(e);
    this.refresh(p.t);
  }

  private handleLink(state: LinkState, t: number) {
    if (state !== 'connected') for (const e of this.engine.pause(t)) this.handleAlert(e);
    this.patch({ link: state, connectedAt: state === 'connected' ? t : this.state.connectedAt });
    for (const l of this.linkListeners) l(state, t);
    this.refresh();
  }

  private handleAlert(e: AlertEvent) {
    for (const l of this.alertListeners) l(e);
    if (e.type === 'raise') {
      const mean = this.engine.snapshot(this.snapshotInput(e.t)).level.value ?? 0;
      this.patch({ banner: { level: e.level, t: e.t, mean } });
      if (e.notify) this.deliver(e.level, mean);
    } else if (e.type === 'end') {
      this.patch({ banner: null });
    } else if (e.type === 'lower' && this.state.banner) {
      this.patch({ banner: e.level === 'low' ? null : { ...this.state.banner, level: e.level } });
    }
  }

  private deliver(level: AlertLevel, mean: number) {
    const n = this.settings.notifications;
    if (!n.enabled) return;
    const v = formatNumber(mean);
    const title = level === 'elevated' ? es.alerts.titleElevated : es.alerts.titleCaution;
    const body = level === 'elevated' ? es.alerts.bodyElevated(v) : es.alerts.bodyCaution(v);
    void showSystemNotification(title, body, `saludair-${level}`);
    if (n.vibrate) vibrate(level === 'elevated' ? [300, 150, 300, 150, 300] : [250, 120, 250]);
    if (n.sound) playChime();
  }

  private snapshotInput(now: number) {
    const seq = this.stream?.stats.sequence;
    return {
      now,
      link: this.state.link,
      connectedAt: this.state.connectedAt,
      lossPct: seq ? lossPercent(seq) : 0,
      reboots: seq?.reboots ?? 0,
    };
  }

  private startRefresh() {
    if (this.refreshHandle) clearInterval(this.refreshHandle);
    this.refreshHandle = setInterval(() => this.refresh(), DISPLAY_REFRESH_MS);
  }

  private refresh(at?: number) {
    const now = at ?? this.stream?.source.now() ?? Date.now();
    const input = this.snapshotInput(now);
    const stats = this.stream?.stats;
    this.patch({
      now,
      snapshot: this.engine.snapshot(input),
      lossPct: input.lossPct,
      reboots: input.reboots,
      invalidLines: stats?.invalidTotal ?? this.state.invalidLines,
      unknownVersion: stats?.unknownVersion ?? this.state.unknownVersion,
    });
  }

  private patch(p: Partial<LiveState>) {
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }
}

export const liveStore = new LiveStore();

export function useLive(): LiveState {
  return useSyncExternalStore(liveStore.subscribe, liveStore.getState);
}
