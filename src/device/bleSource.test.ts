import { describe, expect, it } from 'vitest';
import { BLE } from '../config/device';
import { BleSource } from './bleSource';
import type { LinkState } from './types';

/** Minimal fake of the Web Bluetooth objects BleSource touches. */
function fakeBluetooth(opts: { failConnects?: number } = {}) {
  let failsLeft = opts.failConnects ?? 0;
  const charListeners: ((e: Event) => void)[] = [];
  const devListeners: (() => void)[] = [];
  const characteristic = {
    startNotifications: async () => characteristic,
    addEventListener: (_: string, l: (e: Event) => void) => charListeners.push(l),
    removeEventListener: () => {},
  };
  const server = {
    connected: false,
    getPrimaryService: async (uuid: string) => {
      expect(uuid).toBe(BLE.serviceUuid);
      return { getCharacteristic: async (c: string) => (expect(c).toBe(BLE.txCharacteristicUuid), characteristic) };
    },
  };
  const gatt = {
    connected: false,
    connect: async () => {
      if (failsLeft > 0) {
        failsLeft--;
        throw new Error('GATT error');
      }
      gatt.connected = true;
      return server;
    },
    disconnect: () => {
      gatt.connected = false;
      devListeners.forEach((l) => l());
    },
  };
  const device = {
    name: 'SaludAIR-01',
    gatt,
    addEventListener: (_: string, l: () => void) => devListeners.push(l),
    removeEventListener: () => {},
  };
  const requests: unknown[] = [];
  const bluetooth = {
    requestDevice: async (o: unknown) => {
      requests.push(o);
      return device;
    },
  };
  const notifyBytes = (bytes: Uint8Array) => {
    const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    charListeners.forEach((l) => l({ target: { value } } as unknown as Event));
  };
  const notify = (text: string) => notifyBytes(new TextEncoder().encode(text));
  const drop = () => {
    gatt.connected = false;
    devListeners.forEach((l) => l());
  };
  return { bluetooth, device, notify, notifyBytes, drop, requests };
}

function manualScheduler() {
  const tasks: { fn: () => void; ms: number }[] = [];
  return {
    tasks,
    set: (fn: () => void, ms: number) => tasks.push({ fn, ms }),
    clear: () => {},
    runNext: async () => {
      tasks.shift()!.fn();
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

describe('BleSource', () => {
  it('asks for SaludAIR devices with the NUS service, then streams text chunks', async () => {
    const fb = fakeBluetooth();
    const src = new BleSource({ bluetooth: fb.bluetooth as unknown as Bluetooth, clock: () => 42 });
    const chunks: [string, number][] = [];
    const states: LinkState[] = [];
    src.setListener({ chunk: (t, at) => chunks.push([t, at]), link: (s) => states.push(s), error: () => {} });
    await src.connect();
    expect(fb.requests[0]).toEqual({ filters: [{ namePrefix: 'SaludAIR' }], optionalServices: [BLE.serviceUuid] });
    fb.notify('v1,1,2,');
    fb.notify('3,4\n');
    expect(chunks).toEqual([
      ['v1,1,2,', 42],
      ['3,4\n', 42],
    ]);
    expect(states).toEqual(['connecting', 'connected']);
    expect(src.deviceName).toBe('SaludAIR-01');
  });

  it('decodes a UTF-8 character split across two notifications', async () => {
    const fb = fakeBluetooth();
    const src = new BleSource({ bluetooth: fb.bluetooth as unknown as Bluetooth });
    let text = '';
    src.setListener({ chunk: (t) => (text += t), link: () => {}, error: () => {} });
    await src.connect();
    const bytes = new TextEncoder().encode('aµb'); // µ is 2 bytes: [0xC2, 0xB5]
    fb.notifyBytes(bytes.slice(0, 2)); // "a" + first half of µ
    fb.notifyBytes(bytes.slice(2)); // second half + "b"
    expect(text).toBe('aµb');
  });

  it('reconnects to the same device with backoff after an unexpected drop', async () => {
    const fb = fakeBluetooth();
    const sched = manualScheduler();
    const src = new BleSource({ bluetooth: fb.bluetooth as unknown as Bluetooth, scheduler: sched });
    const states: LinkState[] = [];
    src.setListener({ chunk: () => {}, link: (s) => states.push(s), error: () => {} });
    await src.connect();
    fb.drop();
    expect(states.at(-1)).toBe('reconnecting');
    expect(sched.tasks[0]?.ms).toBe(1000);
    await sched.runNext();
    expect(states.at(-1)).toBe('connected');
    expect(fb.requests).toHaveLength(1); // no new chooser
  });

  it('backs off exponentially while reconnects fail', async () => {
    const fb = fakeBluetooth();
    const sched = manualScheduler();
    const src = new BleSource({ bluetooth: fb.bluetooth as unknown as Bluetooth, scheduler: sched });
    src.setListener({ chunk: () => {}, link: () => {}, error: () => {} });
    await src.connect();
    fb.drop();
    // make the next two attempts fail
    const gatt = fb.device.gatt;
    const realConnect = gatt.connect;
    let fails = 2;
    gatt.connect = async () => {
      if (fails-- > 0) throw new Error('nope');
      return realConnect();
    };
    await sched.runNext(); // 1 s → fail
    expect(sched.tasks[0]?.ms).toBe(2000);
    await sched.runNext(); // 2 s → fail
    expect(sched.tasks[0]?.ms).toBe(4000);
    await sched.runNext(); // 4 s → ok
    expect(src.state).toBe('connected');
  });

  it('does not reconnect after the user disconnects', async () => {
    const fb = fakeBluetooth();
    const sched = manualScheduler();
    const src = new BleSource({ bluetooth: fb.bluetooth as unknown as Bluetooth, scheduler: sched });
    const states: LinkState[] = [];
    src.setListener({ chunk: () => {}, link: (s) => states.push(s), error: () => {} });
    await src.connect();
    await src.disconnect();
    expect(states.at(-1)).toBe('disconnected');
    expect(sched.tasks).toHaveLength(0);
  });

  it('maps a cancelled chooser to a user-cancelled DeviceError', async () => {
    const bluetooth = {
      requestDevice: async () => {
        throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError');
      },
    };
    const src = new BleSource({ bluetooth: bluetooth as unknown as Bluetooth });
    await expect(src.connect()).rejects.toMatchObject({ code: 'user-cancelled' });
  });
});
