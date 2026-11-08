import type { Level, SessionTag, Settings, TestType } from '../config/defaults';

/** Source a session was recorded from. */
export type SourceKind = 'ble' | 'serial' | 'simulator' | 'import';

export interface SessionRecord {
  id: number;
  /** UTC epoch ms. */
  startedAt: number;
  /** UTC epoch ms; undefined while the session is running. */
  endedAt?: number;
  source: SourceKind;
  testType: TestType;
  tags: SessionTag[];
  notes: string;
  /** Free-form test parameters (e.g. distance in metres for BLE range runs). */
  testParams: Record<string, number | string>;
  /** Settings in effect when the session started (AGENTS.md §6). */
  settingsSnapshot: Settings;
  /** Device name if known (BLE). */
  deviceName?: string;
}

/**
 * One parsed packet, exactly as received. Never modified after insert.
 * Optional sensor fields are null when the device sent them empty.
 */
export interface ReadingRecord {
  id: number;
  sessionId: number;
  /** Arrival time, UTC epoch ms (device has no RTC). */
  t: number;
  /** Increments each time seq/uptime goes backwards (device reboot). */
  bootSegment: number;
  seq: number;
  uptimeS: number;
  pm1: number;
  pm25: number;
  pm10: number;
  pm25Avg: number;
  lvl: 0 | 1 | 2;
  rh: number | null;
  temp: number | null;
  batMv: number | null;
}

/** Link events, so gaps are shown as gaps and counted as disconnections. */
export interface LinkEventRecord {
  id: number;
  sessionId: number;
  t: number;
  kind: 'connected' | 'disconnected' | 'reconnected';
}

export interface AlertRecord {
  id: number;
  sessionId: number;
  level: Exclude<Level, 'low'>;
  startedAt: number;
  endedAt?: number;
  /** Peak 5-min mean during the alert, µg/m³. */
  peak: number;
}

export interface ReferenceDatasetRecord {
  id: number;
  name: string;
  importedAt: number;
  /** IANA timezone the file's timestamps were interpreted in. */
  timezone: string;
  /** Whether hourly timestamps mark the start or end of the hour. */
  hourMarks: 'start' | 'end';
  rejectedRows: number;
}

export interface ReferenceDataRecord {
  id: number;
  datasetId: number;
  /** Start of the interval, UTC epoch ms (normalized on import). */
  t: number;
  pm25: number;
}

export interface SettingsRecord {
  id: 'current';
  value: Settings;
  updatedAt: number;
}
