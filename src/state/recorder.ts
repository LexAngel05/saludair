import type { SessionTag, Settings, TestType } from '../config/defaults';
import type { AlertEvent } from '../core/alerts';
import { createSession, endSession } from '../db/sessionsRepo';
import type { SaludAirDB } from '../db/schema';
import type { ReadingRecord, SourceKind } from '../db/types';
import type { StreamPacket } from '../device/deviceStream';
import type { LinkState } from '../device/types';

/** The slice of LiveStore the recorder needs (keeps it testable). */
export interface RecorderEvents {
  onPacket(l: (p: StreamPacket) => void): () => void;
  onAlert(l: (e: AlertEvent) => void): () => void;
  onLink(l: (state: LinkState, t: number) => void): () => void;
  /** Peak 5-min mean of the alert episode still open, if any. */
  openEpisodePeak(): number | null;
}

export interface StartOptions {
  startedAt: number;
  source: SourceKind;
  deviceName?: string;
  tags: SessionTag[];
  testType: TestType;
  notes: string;
  testParams?: Record<string, number | string>;
  settings: Settings;
}

export interface RecorderState {
  activeId: number | null;
  startedAt: number | null;
  tags: SessionTag[];
  testType: TestType;
  readingCount: number;
}

interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(h: unknown): void;
}

const defaultScheduler: Scheduler = {
  set: (fn, ms) => setInterval(fn, ms),
  clear: (h) => clearInterval(h as ReturnType<typeof setInterval>),
};

/**
 * Records the live stream into IndexedDB as a session. Readings are buffered and written
 * in batches (≈1,800 packets/hour); alerts and link events are written as they happen.
 * Raw packets are stored as received — never modified.
 */
export class SessionRecorder {
  private db: SaludAirDB;
  private events: RecorderEvents;
  private scheduler: Scheduler;
  private pending: Omit<ReadingRecord, 'id'>[] = [];
  private unsubs: (() => void)[] = [];
  private flushHandle: unknown = null;
  private openAlertId: number | null = null;
  private linkDown = false;
  private listeners = new Set<() => void>();
  private writing: Promise<void> = Promise.resolve();
  private _state: RecorderState = { activeId: null, startedAt: null, tags: [], testType: 'none', readingCount: 0 };

  constructor(db: SaludAirDB, events: RecorderEvents, scheduler: Scheduler = defaultScheduler) {
    this.db = db;
    this.events = events;
    this.scheduler = scheduler;
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getState = () => this._state;

  private patch(p: Partial<RecorderState>) {
    this._state = { ...this._state, ...p };
    for (const l of this.listeners) l();
  }

  async start(o: StartOptions): Promise<number> {
    if (this._state.activeId !== null) throw new Error('A session is already running');
    const id = await createSession(this.db, {
      startedAt: o.startedAt,
      source: o.source,
      ...(o.deviceName ? { deviceName: o.deviceName } : {}),
      tags: o.tags,
      testType: o.testType,
      notes: o.notes,
      testParams: o.testParams ?? {},
      settingsSnapshot: structuredClone(o.settings),
    });
    this.openAlertId = null;
    this.linkDown = false;
    this.patch({ activeId: id, startedAt: o.startedAt, tags: o.tags, testType: o.testType, readingCount: 0 });

    this.unsubs = [
      this.events.onPacket((p) => this.onPacket(id, p)),
      this.events.onAlert((e) => this.enqueue(() => this.onAlert(id, e))),
      this.events.onLink((s, t) => this.enqueue(() => this.onLink(id, s, t))),
    ];
    this.flushHandle = this.scheduler.set(() => void this.flush(), o.settings.dbFlushIntervalMs);
    return id;
  }

  async stop(endedAt: number): Promise<void> {
    const id = this._state.activeId;
    if (id === null) return;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this.flushHandle !== null) this.scheduler.clear(this.flushHandle);
    this.flushHandle = null;
    await this.flush();
    const alertId = this.openAlertId;
    const peak = this.events.openEpisodePeak();
    await this.enqueue(async () => {
      if (alertId !== null) await this.db.alerts.update(alertId, { endedAt, ...(peak !== null ? { peak } : {}) });
      await endSession(this.db, id, endedAt);
    });
    this.openAlertId = null;
    this.patch({ activeId: null, startedAt: null, readingCount: this._state.readingCount });
  }

  /** Writes buffered readings. Safe to call any time (e.g. on pagehide). */
  flush(): Promise<void> {
    if (this.pending.length === 0) return this.writing;
    const batch = this.pending;
    this.pending = [];
    return this.enqueue(async () => {
      await this.db.readings.bulkAdd(batch as ReadingRecord[]);
    });
  }

  /** Serializes DB writes so alert updates never race their inserts. */
  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.writing = this.writing.then(fn).catch((e: unknown) => {
      console.error('SaludAIR recorder write failed', e);
    });
    return this.writing;
  }

  private onPacket(sessionId: number, p: StreamPacket) {
    this.pending.push({
      sessionId,
      t: p.t,
      bootSegment: p.bootSegment,
      seq: p.seq,
      uptimeS: p.uptimeS,
      pm1: p.pm1,
      pm25: p.pm25,
      pm10: p.pm10,
      pm25Avg: p.pm25Avg,
      lvl: p.lvl,
      rh: p.rh,
      temp: p.temp,
      batMv: p.batMv,
    });
    this.patch({ readingCount: this._state.readingCount + 1 });
  }

  private async onAlert(sessionId: number, e: AlertEvent) {
    if (e.type === 'raise') {
      if (this.openAlertId === null) {
        this.openAlertId = await this.db.alerts.add({ sessionId, level: e.level, startedAt: e.t, peak: 0 } as never);
      } else if (e.level === 'elevated') {
        await this.db.alerts.update(this.openAlertId, { level: 'elevated' });
      }
    } else if (e.type === 'end' && this.openAlertId !== null) {
      await this.db.alerts.update(this.openAlertId, { endedAt: e.t, peak: e.episode.peak, level: e.episode.level });
      this.openAlertId = null;
    }
  }

  private async onLink(sessionId: number, state: LinkState, t: number) {
    if (state === 'connected') {
      if (this.linkDown) await this.db.linkEvents.add({ sessionId, t, kind: 'reconnected' } as never);
      this.linkDown = false;
    } else if (state === 'disconnected' || state === 'reconnecting') {
      if (!this.linkDown) await this.db.linkEvents.add({ sessionId, t, kind: 'disconnected' } as never);
      this.linkDown = true;
    }
  }
}
