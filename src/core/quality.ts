import type { Settings } from '../config/defaults';
import type { LinkState } from '../device/types';

/** Data-quality flags (AGENTS.md §8.4), in display order. */
export type QualityFlagKey =
  | 'disconnected'
  | 'stale'
  | 'packet-loss'
  | 'high-humidity'
  | 'warmup'
  | 'reboot'
  | 'low-battery';

export interface QualityFlag {
  key: QualityFlagKey;
  value?: number;
}

export interface QualityInput {
  link: LinkState;
  /** Source clock (simulated for the Simulator). */
  now: number;
  /** When the current connection was established (stale counts from here if no packet yet). */
  connectedAt: number | null;
  lastPacket: { t: number; uptimeS: number; rh: number | null; batMv: number | null } | null;
  /** Session packet loss %. */
  lossPct: number;
  /** Device reboots during the session. */
  reboots: number;
}

type QualitySettings = Pick<Settings, 'staleTimeoutMs' | 'highHumidityPct' | 'warmupS' | 'lowBatteryMv'>;

export function computeQualityFlags(i: QualityInput, s: QualitySettings): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const connected = i.link === 'connected';
  if (!connected) flags.push({ key: 'disconnected' });

  if (connected) {
    const lastActivity = i.lastPacket?.t ?? i.connectedAt;
    if (lastActivity !== null && i.now - lastActivity > s.staleTimeoutMs) flags.push({ key: 'stale' });
  }
  if (i.lossPct > 0) flags.push({ key: 'packet-loss', value: i.lossPct });

  const p = i.lastPacket;
  if (connected && p) {
    if (p.rh !== null && p.rh > s.highHumidityPct) flags.push({ key: 'high-humidity', value: p.rh });
    if (p.uptimeS < s.warmupS) flags.push({ key: 'warmup', value: p.uptimeS });
  }
  if (i.reboots > 0) flags.push({ key: 'reboot', value: i.reboots });
  if (p && p.batMv !== null && p.batMv < s.lowBatteryMv) flags.push({ key: 'low-battery', value: p.batMv });
  return flags;
}

const PAUSING: ReadonlySet<QualityFlagKey> = new Set(['disconnected', 'stale', 'warmup']);

/** Alerts pause while disconnected, stale or warming up (AGENTS.md §8.3). */
export function isAlertPaused(flags: readonly QualityFlag[]): boolean {
  return flags.some((f) => PAUSING.has(f.key));
}
