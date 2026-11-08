import { SERIAL } from '../config/device';
import { DeviceError, type DeviceSource, type DeviceSourceListener, type LinkState } from './types';

export interface SerialSourceOptions {
  serial?: Serial;
  clock?: () => number;
}

/**
 * Web Serial source for bench tests over USB (desktop Chrome/Edge only).
 * Same line format as BLE. If the cable is unplugged and plugged back in, the port
 * is reopened automatically (the browser keeps the permission for this page).
 */
export class SerialSource implements DeviceSource {
  readonly kind = 'serial' as const;
  readonly deviceName = 'USB';
  private serial: Serial | undefined;
  private clock: () => number;
  private listener: DeviceSourceListener | null = null;
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private _state: LinkState = 'disconnected';
  private userDisconnect = false;

  constructor(opts: SerialSourceOptions = {}) {
    this.serial = opts.serial ?? (typeof navigator !== 'undefined' ? navigator.serial : undefined);
    this.clock = opts.clock ?? Date.now;
  }

  get state(): LinkState {
    return this._state;
  }

  now(): number {
    return this.clock();
  }

  setListener(l: DeviceSourceListener | null): void {
    this.listener = l;
  }

  async connect(): Promise<void> {
    if (!this.serial) throw new DeviceError('unsupported');
    this.userDisconnect = false;
    this.setState('connecting');
    try {
      this.port = await this.serial.requestPort();
      await this.open();
      this.serial.addEventListener('connect', this.onPlug);
      this.serial.addEventListener('disconnect', this.onUnplug);
    } catch (e) {
      this.setState('disconnected');
      const name = e instanceof Error ? e.name : '';
      if (name === 'NotFoundError') throw new DeviceError('user-cancelled', String(e));
      if (name === 'SecurityError') throw new DeviceError('permission-denied', String(e));
      throw new DeviceError('connection-failed', e instanceof Error ? e.message : String(e));
    }
  }

  async disconnect(): Promise<void> {
    this.userDisconnect = true;
    this.serial?.removeEventListener('connect', this.onPlug);
    this.serial?.removeEventListener('disconnect', this.onUnplug);
    try {
      await this.reader?.cancel();
    } catch {
      // already closed
    }
    try {
      await this.port?.close();
    } catch {
      // already closed
    }
    this.setState('disconnected');
  }

  private async open() {
    await this.port!.open({ baudRate: SERIAL.baudRate });
    this.setState('connected');
    void this.readLoop();
  }

  private async readLoop() {
    const port = this.port;
    if (!port?.readable) return;
    const decoder = new TextDecoder('utf-8');
    this.reader = port.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (text) this.listener?.chunk(text, this.clock());
      }
    } catch {
      // Device lost (unplugged) — handled by the disconnect event or below.
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
    }
    if (!this.userDisconnect && this._state === 'connected') this.setState('reconnecting');
  }

  private onUnplug = (e: Event) => {
    if (e.target === this.port && !this.userDisconnect) this.setState('reconnecting');
  };

  private onPlug = (e: Event) => {
    if (e.target === this.port && !this.userDisconnect) void this.open().catch(() => this.setState('reconnecting'));
  };

  private setState(s: LinkState) {
    this._state = s;
    this.listener?.link(s, this.clock());
  }
}
