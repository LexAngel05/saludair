import { BLE } from '../config/device';
import { DeviceError, type DeviceSource, type DeviceSourceListener, type LinkState } from './types';

interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(h: unknown): void;
}

export interface BleSourceOptions {
  bluetooth?: Bluetooth;
  scheduler?: Scheduler;
  clock?: () => number;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

const defaultScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

function toDeviceError(e: unknown): DeviceError {
  if (e instanceof DeviceError) return e;
  const name = e instanceof DOMException || e instanceof Error ? e.name : '';
  const msg = e instanceof Error ? e.message : String(e);
  if (name === 'NotFoundError' && /cancel/i.test(msg)) return new DeviceError('user-cancelled', msg);
  if (name === 'NotFoundError') return new DeviceError('not-found', msg);
  if (name === 'SecurityError' || name === 'NotAllowedError') return new DeviceError('permission-denied', msg);
  return new DeviceError('connection-failed', msg);
}

/**
 * Web Bluetooth source (Nordic UART Service). Chrome/Edge desktop and Chrome Android.
 * - First connect opens the browser chooser (must run inside a user gesture).
 * - Unexpected drops reconnect to the SAME BluetoothDevice with exponential backoff
 *   (no new chooser), and immediately when the page becomes visible again.
 * - After a full page reload the browser forgets the device: the user taps Connect once.
 */
export class BleSource implements DeviceSource {
  readonly kind = 'ble' as const;
  private bluetooth: Bluetooth | undefined;
  private scheduler: Scheduler;
  private clock: () => number;
  private listener: DeviceSourceListener | null = null;
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private decoder = new TextDecoder('utf-8');
  private _state: LinkState = 'disconnected';
  private userDisconnect = false;
  private retryHandle: unknown = null;
  private retryDelay = RECONNECT_BASE_MS;

  constructor(opts: BleSourceOptions = {}) {
    this.bluetooth = opts.bluetooth ?? (typeof navigator !== 'undefined' ? navigator.bluetooth : undefined);
    this.scheduler = opts.scheduler ?? defaultScheduler;
    this.clock = opts.clock ?? Date.now;
  }

  get state(): LinkState {
    return this._state;
  }

  get deviceName(): string | undefined {
    return this.device?.name ?? undefined;
  }

  now(): number {
    return this.clock();
  }

  setListener(l: DeviceSourceListener | null): void {
    this.listener = l;
  }

  async connect(): Promise<void> {
    if (!this.bluetooth) throw new DeviceError('unsupported');
    this.userDisconnect = false;
    this.setState('connecting');
    try {
      this.device = await this.bluetooth.requestDevice({
        filters: [{ namePrefix: BLE.namePrefix }],
        optionalServices: [BLE.serviceUuid],
      });
      this.device.addEventListener('gattserverdisconnected', this.onGattDisconnected);
      await this.openGatt();
      this.setState('connected');
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible);
    } catch (e) {
      this.setState('disconnected');
      throw toDeviceError(e);
    }
  }

  async disconnect(): Promise<void> {
    this.userDisconnect = true;
    this.cancelRetry();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible);
    this.characteristic?.removeEventListener('characteristicvaluechanged', this.onValue);
    this.characteristic = null;
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.device?.removeEventListener('gattserverdisconnected', this.onGattDisconnected);
    this.setState('disconnected');
  }

  private async openGatt() {
    const server = await this.device!.gatt!.connect();
    const service = await server.getPrimaryService(BLE.serviceUuid);
    const ch = await service.getCharacteristic(BLE.txCharacteristicUuid);
    this.characteristic?.removeEventListener('characteristicvaluechanged', this.onValue);
    this.characteristic = ch;
    this.decoder = new TextDecoder('utf-8');
    ch.addEventListener('characteristicvaluechanged', this.onValue);
    await ch.startNotifications();
  }

  private onValue = (e: Event) => {
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    // stream: true keeps a multi-byte character split across notifications intact.
    const text = this.decoder.decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), { stream: true });
    if (text) this.listener?.chunk(text, this.clock());
  };

  private onGattDisconnected = () => {
    if (this.userDisconnect) return;
    this.setState('reconnecting');
    this.retryDelay = RECONNECT_BASE_MS;
    this.scheduleRetry();
  };

  /** Android may drop BLE when the screen turns off; retry right away when visible. */
  private onVisible = () => {
    if (document.visibilityState === 'visible' && this._state === 'reconnecting') {
      this.cancelRetry();
      void this.tryReconnect();
    }
  };

  private scheduleRetry() {
    this.cancelRetry();
    this.retryHandle = this.scheduler.set(() => void this.tryReconnect(), this.retryDelay);
  }

  private cancelRetry() {
    if (this.retryHandle !== null) this.scheduler.clear(this.retryHandle);
    this.retryHandle = null;
  }

  private async tryReconnect() {
    this.retryHandle = null;
    if (this.userDisconnect || !this.device) return;
    try {
      await this.openGatt();
      this.setState('connected');
    } catch {
      this.retryDelay = Math.min(this.retryDelay * 2, RECONNECT_MAX_MS);
      this.scheduleRetry();
    }
  }

  private setState(s: LinkState) {
    this._state = s;
    this.listener?.link(s, this.clock());
  }
}
