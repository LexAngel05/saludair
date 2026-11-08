/**
 * Common interface for every way of getting packets: Web Bluetooth, Web Serial and the
 * Simulator. Sources only move text; parsing/sequencing happens once in DeviceStream.
 */

export type SourceKindLive = 'ble' | 'serial' | 'simulator';

export type LinkState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type DeviceErrorCode =
  | 'unsupported'
  | 'user-cancelled'
  | 'not-found'
  | 'permission-denied'
  | 'connection-failed'
  | 'link-lost';

export class DeviceError extends Error {
  readonly code: DeviceErrorCode;
  constructor(code: DeviceErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DeviceError';
    this.code = code;
  }
}

export interface DeviceSourceListener {
  /** Raw text received, with its arrival time (UTC epoch ms; simulated for the Simulator). */
  chunk(text: string, t: number): void;
  link(state: LinkState, t: number): void;
  error(err: DeviceError): void;
}

export interface DeviceSource {
  readonly kind: SourceKindLive;
  /** Device name if known (e.g. "SaludAIR-01"). */
  readonly deviceName: string | undefined;
  readonly state: LinkState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Source clock. Real devices: Date.now(). Simulator: simulated time (speed-up). */
  now(): number;
  setListener(listener: DeviceSourceListener | null): void;
}
