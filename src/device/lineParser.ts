import { FIELD_RANGES, PACKET } from '../config/device';

/** One packet as sent by the device (AGENTS.md §5). Optional sensors are null when empty. */
export interface Packet {
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

export type InvalidReason =
  | 'empty'
  | 'unknown-version'
  | 'field-count'
  | 'not-a-number'
  | 'not-an-integer'
  | 'out-of-range';

export type ParseResult =
  | { ok: true; packet: Packet }
  | { ok: false; reason: 'unknown-version'; version: string; line: string }
  | { ok: false; reason: Exclude<InvalidReason, 'unknown-version'>; line: string };

type FieldName = (typeof PACKET.fields)[number];

const INTEGER_FIELDS: ReadonlySet<FieldName> = new Set(['seq', 'uptimeS', 'lvl']);
const OPTIONAL_FIELDS: ReadonlySet<FieldName> = new Set(PACKET.optionalFields);
// Plain decimal only: rejects "0x10", "1e3", "Infinity", "".
const DECIMAL = /^-?\d+(\.\d+)?$/;

/** Parses one line. Never throws; invalid input is reported, not raised. */
export function parseLine(raw: string): ParseResult {
  const line = raw.trim();
  if (line === '') return { ok: false, reason: 'empty', line };

  const parts = line.split(PACKET.fieldSeparator);
  const version = parts[0] ?? '';
  if (parts.length === PACKET.fields.length + 1 && version !== PACKET.protocolVersion && /^v\d+$/.test(version)) {
    return { ok: false, reason: 'unknown-version', version, line };
  }
  if (parts.length !== PACKET.fields.length + 1 || version !== PACKET.protocolVersion) {
    return { ok: false, reason: 'field-count', line };
  }

  const values: Partial<Record<FieldName, number | null>> = {};
  for (let i = 0; i < PACKET.fields.length; i++) {
    const name = PACKET.fields[i]!;
    const text = (parts[i + 1] ?? '').trim();
    if (text === '' && OPTIONAL_FIELDS.has(name)) {
      values[name] = null;
      continue;
    }
    if (!DECIMAL.test(text)) return { ok: false, reason: 'not-a-number', line };
    const n = Number(text);
    if (INTEGER_FIELDS.has(name) && !Number.isInteger(n)) return { ok: false, reason: 'not-an-integer', line };
    const range = FIELD_RANGES[name];
    if (n < range.min || n > range.max) return { ok: false, reason: 'out-of-range', line };
    values[name] = n;
  }

  return {
    ok: true,
    packet: {
      seq: values.seq!,
      uptimeS: values.uptimeS!,
      pm1: values.pm1!,
      pm25: values.pm25!,
      pm10: values.pm10!,
      pm25Avg: values.pm25Avg!,
      lvl: values.lvl as 0 | 1 | 2,
      rh: values.rh ?? null,
      temp: values.temp ?? null,
      batMv: values.batMv ?? null,
    },
  };
}

/**
 * Accumulates text chunks (BLE notifications can split a line anywhere) and returns
 * complete, non-empty lines. A line longer than `maxLength` without a terminator is
 * discarded up to the next terminator and counted in `overflowCount`.
 */
export class LineBuffer {
  private partial = '';
  private discarding = false;
  overflowCount = 0;

  private readonly maxLength: number;

  constructor(maxLength: number = PACKET.maxLineLength) {
    this.maxLength = maxLength;
  }

  push(chunk: string): string[] {
    const lines: string[] = [];
    const pieces = (this.partial + chunk).split(PACKET.lineTerminator);
    this.partial = pieces.pop() ?? '';
    for (const piece of pieces) {
      if (this.discarding) {
        this.discarding = false;
        continue;
      }
      const line = piece.replace(/\r$/, '');
      if (line.trim() !== '') lines.push(line);
    }
    if (this.partial.length > this.maxLength) {
      if (!this.discarding) this.overflowCount++;
      this.discarding = true;
      this.partial = '';
    }
    return lines;
  }

  reset(): void {
    this.partial = '';
    this.discarding = false;
  }
}
