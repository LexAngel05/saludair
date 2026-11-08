import { describe, expect, it } from 'vitest';
import { LineBuffer, parseLine } from './lineParser';

describe('parseLine', () => {
  it('parses the reference example from the contract', () => {
    const r = parseLine('v1,1842,3684,9,14,18,13.6,0,41.2,27.8,3910');
    expect(r).toEqual({
      ok: true,
      packet: {
        seq: 1842,
        uptimeS: 3684,
        pm1: 9,
        pm25: 14,
        pm10: 18,
        pm25Avg: 13.6,
        lvl: 0,
        rh: 41.2,
        temp: 27.8,
        batMv: 3910,
      },
    });
  });

  it('accepts empty optional fields (rh, temp, bat_mv) as null', () => {
    const r = parseLine('v1,5,12,3,4,6,4.2,0,,,');
    expect(r.ok && r.packet).toMatchObject({ rh: null, temp: null, batMv: null, pm25: 4 });
  });

  it('tolerates a trailing carriage return and surrounding spaces', () => {
    const r = parseLine(' v1,1,40,1,2,3,2.0,0,50,20,3900\r');
    expect(r.ok).toBe(true);
  });

  it('reports an unknown protocol version with the version found', () => {
    expect(parseLine('v2,1,40,1,2,3,2,0,50,20,3900')).toEqual({
      ok: false,
      reason: 'unknown-version',
      version: 'v2',
      line: 'v2,1,40,1,2,3,2,0,50,20,3900',
    });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['hello world', 'field-count'],
    ['v1,1,2,3', 'field-count'],
    ['v1,1,40,1,2,3,2,0,50,20,3900,99', 'field-count'],
    ['v1,abc,40,1,2,3,2,0,50,20,3900', 'not-a-number'],
    ['v1,1,40,1,,3,2,0,50,20,3900', 'not-a-number'],
    ['v1,1.5,40,1,2,3,2,0,50,20,3900', 'not-an-integer'],
    ['v1,1,40,1,2,3,2,1.5,50,20,3900', 'not-an-integer'],
    ['v1,1,40,1,-2,3,2,0,50,20,3900', 'out-of-range'],
    ['v1,1,40,1,2000,3,2,0,50,20,3900', 'out-of-range'],
    ['v1,1,40,1,2,3,2,3,50,20,3900', 'out-of-range'],
    ['v1,1,40,1,2,3,2,0,120,20,3900', 'out-of-range'],
    ['v1,1,40,1,2,3,2,0,50,20,99999', 'out-of-range'],
    ['v1,1,40,1,2,3,2,0,50,20,Infinity', 'not-a-number'],
    ['v1,1,40,1,2,3,2,0,50,20,0x10', 'not-a-number'],
  ])('rejects %j as %s', (line, reason) => {
    const r = parseLine(line);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  });

  it('never throws on binary garbage', () => {
    expect(() => parseLine('\u0000\u0001�,,,\u0007')).not.toThrow();
    expect(parseLine('\u0000\u0001�,,,\u0007').ok).toBe(false);
  });
});

describe('LineBuffer', () => {
  it('reassembles a line split across BLE chunks', () => {
    const b = new LineBuffer();
    expect(b.push('v1,1842,3684,9,')).toEqual([]);
    expect(b.push('14,18,13.6,0,41.')).toEqual([]);
    expect(b.push('2,27.8,3910\n')).toEqual(['v1,1842,3684,9,14,18,13.6,0,41.2,27.8,3910']);
  });

  it('returns several lines from one chunk and keeps the remainder', () => {
    const b = new LineBuffer();
    expect(b.push('a\nb\r\nc')).toEqual(['a', 'b']);
    expect(b.push('d\n')).toEqual(['cd']);
  });

  it('drops an overlong line without a terminator and reports it once', () => {
    const b = new LineBuffer(10);
    expect(b.push('x'.repeat(15))).toEqual([]);
    expect(b.overflowCount).toBe(1);
    // The rest of the runaway line is discarded up to the next terminator.
    expect(b.push('yyy\nok\n')).toEqual(['ok']);
    expect(b.overflowCount).toBe(1);
  });

  it('skips empty lines', () => {
    const b = new LineBuffer();
    expect(b.push('\n\n\r\nx\n')).toEqual(['x']);
  });

  it('reset clears a partial line (e.g. after a disconnect)', () => {
    const b = new LineBuffer();
    b.push('v1,1,2');
    b.reset();
    expect(b.push(',3\n')).toEqual([',3']);
  });
});
