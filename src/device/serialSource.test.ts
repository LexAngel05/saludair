import { describe, expect, it } from 'vitest';
import { SerialSource } from './serialSource';
import type { LinkState } from './types';

function fakeSerial(chunks: Uint8Array[]) {
  let opened: unknown = null;
  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((x) => c.enqueue(x));
      c.close();
    },
  });
  const port = {
    readable,
    open: async (o: unknown) => {
      opened = o;
    },
    close: async () => {},
  };
  const serial = {
    requestPort: async () => port,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return { serial, opened: () => opened };
}

describe('SerialSource', () => {
  it('opens at 115200 baud and streams decoded text, then reports the lost link', async () => {
    const bytes = new TextEncoder().encode('v1,1,2\nv1,µ');
    const fs = fakeSerial([bytes.slice(0, 9), bytes.slice(9)]);
    const src = new SerialSource({ serial: fs.serial as unknown as Serial, clock: () => 7 });
    let text = '';
    const states: LinkState[] = [];
    src.setListener({ chunk: (t, at) => ((text += t), expect(at).toBe(7)), link: (s) => states.push(s), error: () => {} });
    await src.connect();
    await new Promise((r) => setTimeout(r, 10));
    expect(fs.opened()).toEqual({ baudRate: 115200 });
    expect(text).toBe('v1,1,2\nv1,µ');
    expect(states).toEqual(['connecting', 'connected', 'reconnecting']); // stream ended = cable lost
  });

  it('maps a cancelled port picker to user-cancelled', async () => {
    const serial = {
      requestPort: async () => {
        throw Object.assign(new Error('No port selected by the user.'), { name: 'NotFoundError' });
      },
    };
    const src = new SerialSource({ serial: serial as unknown as Serial });
    await expect(src.connect()).rejects.toMatchObject({ code: 'user-cancelled' });
  });
});
