import type { Level, Settings } from '../config/defaults';

/**
 * Alert state machine (AGENTS.md §8.3). Pure: feed one sample per packet.
 *
 * - Raise a level when the 5-min mean stays ≥ its threshold for `persistenceMs`.
 *   Elevado raises immediately when its own condition is met (escalation).
 * - Lower one level at a time when the mean stays < threshold × hysteresisFactor
 *   for `clearPersistenceMs`; the next level's clear timer restarts at that moment.
 * - Notify a level only if it was not notified within `cooldownMs`.
 * - `mean5 === null` (warm-up, stale, disconnected, insufficient data) pauses: timers
 *   reset so nothing fires on old data; an active alert is kept, not cleared.
 * - A gap between samples longer than `staleTimeoutMs` is treated as a pause too.
 *
 * An "episode" is one continuous period with an active alert; its level is the
 * highest level reached and its peak the highest 5-min mean.
 */

export type AlertLevel = Exclude<Level, 'low'>;
const ALERT_LEVELS: readonly AlertLevel[] = ['caution', 'elevated'];
const RANK: Record<Level, number> = { low: 0, caution: 1, elevated: 2 };

export interface AlertEpisode {
  level: AlertLevel;
  startedAt: number;
  peak: number;
}

export interface AlertState {
  active: Level;
  aboveSince: Record<AlertLevel, number | null>;
  belowSince: Record<AlertLevel, number | null>;
  lastNotified: Record<AlertLevel, number | null>;
  episode: AlertEpisode | null;
  lastT: number | null;
}

export type AlertEvent =
  | { type: 'raise'; level: AlertLevel; t: number; notify: boolean }
  | { type: 'lower'; level: Level; t: number }
  | { type: 'end'; t: number; episode: AlertEpisode & { endedAt: number } };

export interface AlertSample {
  t: number;
  /** 5-min mean, or null when it must not be used. */
  mean5: number | null;
}

type AlertSettings = Pick<Settings, 'thresholds' | 'alerts' | 'staleTimeoutMs'>;

export function initialAlertState(): AlertState {
  return {
    active: 'low',
    aboveSince: { caution: null, elevated: null },
    belowSince: { caution: null, elevated: null },
    lastNotified: { caution: null, elevated: null },
    episode: null,
    lastT: null,
  };
}

const lower = (l: AlertLevel): Level => (l === 'elevated' ? 'caution' : 'low');

export function stepAlert(prev: AlertState, sample: AlertSample, s: AlertSettings): { state: AlertState; events: AlertEvent[] } {
  const { t, mean5 } = sample;
  const events: AlertEvent[] = [];
  const st: AlertState = {
    ...prev,
    aboveSince: { ...prev.aboveSince },
    belowSince: { ...prev.belowSince },
    lastNotified: { ...prev.lastNotified },
    episode: prev.episode ? { ...prev.episode } : null,
  };

  const gap = prev.lastT !== null && t - prev.lastT > s.staleTimeoutMs;
  if (mean5 === null || gap) {
    st.aboveSince = { caution: null, elevated: null };
    st.belowSince = { caution: null, elevated: null };
  }
  st.lastT = t;
  if (mean5 === null) return { state: st, events };

  // Update persistence timers.
  for (const lvl of ALERT_LEVELS) {
    const threshold = s.thresholds[lvl];
    if (mean5 >= threshold) st.aboveSince[lvl] ??= t;
    else st.aboveSince[lvl] = null;
    if (mean5 < threshold * s.alerts.hysteresisFactor) st.belowSince[lvl] ??= t;
    else st.belowSince[lvl] = null;
  }

  // Raise (and escalate) — lowest level first, so a direct jump reports caution then elevated.
  let raised = false;
  for (const lvl of ALERT_LEVELS) {
    const since = st.aboveSince[lvl];
    if (RANK[st.active] >= RANK[lvl] || since === null || t - since < s.alerts.persistenceMs) continue;
    const last = st.lastNotified[lvl];
    const notify = last === null || t - last >= s.alerts.cooldownMs;
    if (notify) st.lastNotified[lvl] = t;
    st.active = lvl;
    if (st.episode) st.episode.level = RANK[lvl] > RANK[st.episode.level] ? lvl : st.episode.level;
    else st.episode = { level: lvl, startedAt: t, peak: mean5 };
    events.push({ type: 'raise', level: lvl, t, notify });
    raised = true;
  }

  if (st.episode) st.episode.peak = Math.max(st.episode.peak, mean5);

  // Lower one level at a time.
  if (!raised && st.active !== 'low') {
    const lvl = st.active;
    const since = st.belowSince[lvl];
    if (since !== null && t - since >= s.alerts.clearPersistenceMs) {
      const next = lower(lvl);
      st.active = next;
      if (next === 'low') {
        const ep = st.episode!;
        events.push({ type: 'end', t, episode: { ...ep, endedAt: t } });
        st.episode = null;
      } else {
        events.push({ type: 'lower', level: next, t });
        // The next level must hold its own clear condition for the full time from now.
        if (st.belowSince[next] !== null) st.belowSince[next] = t;
      }
    }
  }

  return { state: st, events };
}
