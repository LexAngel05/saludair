import { describe, expect, it } from 'vitest';
import { initialSequenceState, lossPercent, trackSequence } from './sequence';

function run(pairs: [seq: number, uptime: number][]) {
  let state = initialSequenceState();
  const out = [];
  for (const [seq, uptimeS] of pairs) {
    const r = trackSequence(state, { seq, uptimeS });
    state = r.state;
    out.push(r);
  }
  return { state, out };
}

describe('trackSequence', () => {
  it('counts a continuous sequence with no loss', () => {
    const { state } = run([
      [0, 0],
      [1, 2],
      [2, 4],
    ]);
    expect(state).toMatchObject({ received: 3, missing: 0, reboots: 0, bootSegment: 0 });
    expect(lossPercent(state)).toBe(0);
  });

  it('counts missing seq values inside a boot segment as loss', () => {
    const { state, out } = run([
      [10, 20],
      [11, 22],
      [14, 28], // 12 and 13 missing
      [15, 30],
    ]);
    expect(out[2]?.missedBefore).toBe(2);
    expect(state.missing).toBe(2);
    expect(lossPercent(state)).toBeCloseTo((2 / 6) * 100);
  });

  it('treats seq going backwards as a reboot, not loss', () => {
    const { state, out } = run([
      [500, 1000],
      [501, 1002],
      [0, 0],
      [1, 2],
    ]);
    expect(out[2]).toMatchObject({ reboot: true, bootSegment: 1, missedBefore: 0 });
    expect(state).toMatchObject({ reboots: 1, missing: 0, bootSegment: 1 });
  });

  it('treats uptime going backwards as a reboot even if seq keeps rising', () => {
    const { out } = run([
      [3, 600],
      [4, 602],
      [5, 1], // seq happened to increase but uptime reset
    ]);
    expect(out[2]?.reboot).toBe(true);
  });

  it('first packet of a session is never loss, whatever its seq', () => {
    const { state, out } = run([[1842, 3684]]);
    expect(out[0]).toMatchObject({ reboot: false, missedBefore: 0 });
    expect(state.missing).toBe(0);
  });

  it('marks duplicate seq as duplicate without counting it again', () => {
    const { state, out } = run([
      [1, 2],
      [1, 2],
      [2, 4],
    ]);
    expect(out[1]?.duplicate).toBe(true);
    expect(state.received).toBe(2);
    expect(state.missing).toBe(0);
  });

  it('a link gap (disconnect) does not reset loss accounting within the boot', () => {
    let state = initialSequenceState();
    state = trackSequence(state, { seq: 1, uptimeS: 2 }).state;
    // ...disconnected for a while; device kept counting...
    const r = trackSequence(state, { seq: 31, uptimeS: 62 });
    expect(r.missedBefore).toBe(29);
  });

  it('lossPercent is 0 for an empty state', () => {
    expect(lossPercent(initialSequenceState())).toBe(0);
  });
});
