import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { initialAlertState, stepAlert, type AlertEvent, type AlertState } from './alerts';

const S = DEFAULT_SETTINGS; // 15 / 35, persistence 2 min, hysteresis 0.9, clear 2 min, cooldown 10 min
const SEC = 1000;
const MIN = 60 * SEC;

/** Feed (t, mean5) samples every 2 s; mean5 = null pauses (warm-up / stale / disconnected). */
function feed(samples: [t: number, mean: number | null][], start: AlertState = initialAlertState()) {
  let state = start;
  const events: AlertEvent[] = [];
  for (const [t, mean5] of samples) {
    const r = stepAlert(state, { t, mean5 }, S);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

/** Constant value from t0 for `durationMs`, every 2 s. */
function hold(t0: number, durationMs: number, value: number | null): [number, number | null][] {
  const out: [number, number | null][] = [];
  for (let t = t0; t < t0 + durationMs; t += 2 * SEC) out.push([t, value]);
  return out;
}

describe('stepAlert — firing', () => {
  it('does not fire before the mean has stayed above the threshold for 2 min', () => {
    const { events, state } = feed(hold(0, 2 * MIN - 2 * SEC, 20));
    expect(events).toEqual([]);
    expect(state.active).toBe('low');
  });

  it('fires Precaución once the 5-min mean stays ≥ 15 for 2 min', () => {
    const { events, state } = feed(hold(0, 2 * MIN + 2 * SEC, 20));
    expect(events).toEqual([{ type: 'raise', level: 'caution', t: 2 * MIN, notify: true }]);
    expect(state.active).toBe('caution');
  });

  it('a single spike never alerts', () => {
    const samples = [...hold(0, 1 * MIN, 8), [60 * SEC, 80] as [number, number], ...hold(62 * SEC, 5 * MIN, 8)];
    expect(feed(samples).events).toEqual([]);
  });

  it('a dip below the threshold restarts the persistence timer', () => {
    const samples = [...hold(0, 90 * SEC, 20), [90 * SEC, 10] as [number, number], ...hold(92 * SEC, 90 * SEC, 20)];
    expect(feed(samples).events).toEqual([]);
  });

  it('fires Elevado directly when ≥ 35 for 2 min (no need to pass through Precaución first)', () => {
    const { events } = feed(hold(0, 2 * MIN + 2 * SEC, 50));
    expect(events.filter((e) => e.type === 'raise').map((e) => e.type === 'raise' && e.level)).toEqual([
      'caution',
      'elevated',
    ]);
    // Both conditions become true at the same instant; caution is reported first, then escalation.
    expect(events.every((e) => e.t === 2 * MIN)).toBe(true);
  });

  it('escalates immediately from Precaución to Elevado once Elevado’s condition is met', () => {
    const samples = [...hold(0, 3 * MIN, 20), ...hold(3 * MIN, 2 * MIN + 2 * SEC, 40)];
    const { events, state } = feed(samples);
    expect(events).toEqual([
      { type: 'raise', level: 'caution', t: 2 * MIN, notify: true },
      { type: 'raise', level: 'elevated', t: 5 * MIN, notify: true },
    ]);
    expect(state.active).toBe('elevated');
  });
});

describe('stepAlert — clearing with hysteresis', () => {
  it('stays active while the mean is below the threshold but above threshold × 0.9', () => {
    const samples = [...hold(0, 2 * MIN + 2 * SEC, 20), ...hold(2 * MIN + 2 * SEC, 10 * MIN, 14)]; // 14 ≥ 13.5
    const { state } = feed(samples);
    expect(state.active).toBe('caution');
  });

  it('clears after 2 min below threshold × 0.9 and ends the episode with its peak', () => {
    const samples = [...hold(0, 2 * MIN + 2 * SEC, 22), ...hold(2 * MIN + 2 * SEC, 3 * MIN, 10)];
    const { events, state } = feed(samples);
    expect(events.at(-1)).toEqual({
      type: 'end',
      t: 2 * MIN + 2 * SEC + 2 * MIN,
      episode: { level: 'caution', startedAt: 2 * MIN, endedAt: 4 * MIN + 2 * SEC, peak: 22 },
    });
    expect(state.active).toBe('low');
    expect(state.episode).toBeNull();
  });

  it('de-escalates one level at a time (Elevado → Precaución → Bajo), each needing 2 min', () => {
    const fall = 2 * MIN + 2 * SEC;
    const samples = [...hold(0, fall, 50), ...hold(fall, 6 * MIN, 5)];
    const { events } = feed(samples);
    const after = events.filter((e) => e.t >= fall);
    expect(after.map((e) => e.type)).toEqual(['lower', 'end']);
    expect(after[0]).toMatchObject({ type: 'lower', level: 'caution', t: fall + 2 * MIN });
    expect(after[1]).toMatchObject({ type: 'end', t: fall + 4 * MIN });
  });
});

describe('stepAlert — cooldown', () => {
  it('does not notify the same level again within 10 min', () => {
    const cycle = (t0: number) => [...hold(t0, 2 * MIN + 2 * SEC, 20), ...hold(t0 + 2 * MIN + 2 * SEC, 2 * MIN + 2 * SEC, 5)];
    const { events } = feed([...cycle(0), ...cycle(5 * MIN)]);
    const raises = events.filter((e) => e.type === 'raise');
    expect(raises).toHaveLength(2);
    expect(raises.map((e) => e.type === 'raise' && e.notify)).toEqual([true, false]);
  });

  it('notifies again after the cooldown has passed', () => {
    const cycle = (t0: number) => [...hold(t0, 2 * MIN + 2 * SEC, 20), ...hold(t0 + 2 * MIN + 2 * SEC, 2 * MIN + 2 * SEC, 5)];
    const { events } = feed([...cycle(0), ...cycle(13 * MIN)]);
    const raises = events.filter((e) => e.type === 'raise');
    expect(raises.map((e) => e.type === 'raise' && e.notify)).toEqual([true, true]);
  });
});

describe('stepAlert — pause', () => {
  it('pauses on null input and restarts persistence afterwards (never fires on old data)', () => {
    const samples = [...hold(0, 100 * SEC, 20), ...hold(100 * SEC, 30 * SEC, null), ...hold(130 * SEC, 30 * SEC, 20)];
    expect(feed(samples).events).toEqual([]);
  });

  it('a gap in timestamps longer than the stale timeout also restarts persistence', () => {
    const samples = [...hold(0, 100 * SEC, 20), ...hold(160 * SEC, 30 * SEC, 20)];
    expect(feed(samples).events).toEqual([]);
  });

  it('keeps an active alert during a pause and does not clear it on stale data', () => {
    const samples = [...hold(0, 2 * MIN + 2 * SEC, 20), ...hold(2 * MIN + 2 * SEC, 5 * MIN, null)];
    const { state, events } = feed(samples);
    expect(state.active).toBe('caution');
    expect(events.filter((e) => e.type === 'end')).toEqual([]);
  });

  it('tracks the peak 5-min mean of the episode', () => {
    const samples = [...hold(0, 2 * MIN + 2 * SEC, 20), ...hold(2 * MIN + 2 * SEC, 30 * SEC, 31), ...hold(2 * MIN + 32 * SEC, 30 * SEC, 18)];
    expect(feed(samples).state.episode?.peak).toBe(31);
  });
});
