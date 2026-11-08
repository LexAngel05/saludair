import type { Settings } from '../config/defaults';
import { PACKET } from '../config/device';
import { isWarmup } from './averaging';

// ---------------------------------------------------------------------------
// Time zones (no library: Intl gives the offset of any IANA zone at any instant)

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function tzOffsetMs(t: number, tz: string): number {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(t).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** Wall-clock time in `tz` → UTC epoch ms (DST-aware). Month is 1-based. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off = tzOffsetMs(guess, tz);
  let t = guess - off;
  const off2 = tzOffsetMs(t, tz);
  if (off2 !== off) t = guess - off2;
  return t;
}

// ---------------------------------------------------------------------------
// Reference CSV import

export interface RefRow {
  /** Start of the measurement interval, UTC epoch ms. */
  t: number;
  pm25: number;
}

export interface RefParseOptions {
  timezone: string;
  /** Whether timestamps mark the start or the end of each interval. */
  hourMarks: 'start' | 'end';
}

export interface RefParseResult {
  rows: RefRow[];
  rejected: number;
  /** Median spacing between timestamps (1 h for hourly stations). */
  resolutionMs: number;
}

const ISO_LOCAL = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const DMY_LOCAL = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;
const NUMBER = /^\d+(\.\d+)?$/;

function parseTimestamp(s: string, tz: string): number | null {
  if (HAS_OFFSET.test(s) && /\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  let m = ISO_LOCAL.exec(s);
  let parts: number[] | null = null;
  if (m) parts = [+m[1]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0)];
  m = parts ? null : DMY_LOCAL.exec(s);
  if (m) parts = [+m[3]!, +m[2]!, +m[1]!, +m[4]!, +m[5]!, +(m[6] ?? 0)]; // DD/MM/YYYY (Mexican convention)
  if (!parts) return null;
  const [y, mo, d, h, mi, sec] = parts as [number, number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 24 || mi > 59 || sec > 59) return null;
  // Some stations write the last hour of the day as 24:00.
  if (h === 24) return zonedToUtc(y, mo, d, 0, mi, sec, tz) + 86_400_000;
  return zonedToUtc(y, mo, d, h, mi, sec, tz);
}

function medianDiff(ts: number[]): number {
  const sorted = [...new Set(ts)].sort((a, b) => a - b);
  const diffs = sorted.slice(1).map((t, i) => t - sorted[i]!);
  if (diffs.length === 0) return 3_600_000;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)]!;
}

/** Parses `timestamp,pm25` CSV (`,` or `;`, decimal `.` or `,` with `;`). Never throws. */
export function parseReferenceCsv(text: string, o: RefParseOptions): RefParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { rows: [], rejected: 0, resolutionMs: 3_600_000 };
  const sep = lines[0]!.includes(';') && !lines[0]!.includes(',') ? ';' : ',';
  const split = (l: string) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
  const first = split(lines[0]!);
  const hasHeader = !NUMBER.test((first[1] ?? '').replace(',', '.'));
  const body = hasHeader ? lines.slice(1) : lines;

  const rows: RefRow[] = [];
  let rejected = 0;
  for (const line of body) {
    const [ts, raw] = split(line);
    const v = (raw ?? '').replace(',', '.');
    const t = ts ? parseTimestamp(ts, o.timezone) : null;
    if (t === null || !NUMBER.test(v) || Number(v) > 1000) {
      rejected++;
      continue;
    }
    rows.push({ t, pm25: Number(v) });
  }
  const resolutionMs = medianDiff(rows.map((r) => r.t));
  if (o.hourMarks === 'end') for (const r of rows) r.t -= resolutionMs;
  return { rows, rejected, resolutionMs };
}

// ---------------------------------------------------------------------------
// Alignment

export interface Pair {
  /** Bin start, UTC epoch ms. */
  t: number;
  device: number;
  reference: number;
}

export interface AlignOptions {
  /** 1 h (default) or 10 min when the reference has finer resolution. */
  binMs: number;
  refResolutionMs: number;
  settings: Pick<Settings, 'warmupS' | 'windowCompleteness'>;
  intervalMs?: number;
}

/**
 * Bins device readings (warm-up excluded) and reference rows into the same intervals.
 * A bin is used only if BOTH sides are ≥ completeness (75 %) of their expected samples.
 */
export function alignToBins(
  device: readonly { t: number; pm25: number; uptimeS: number }[],
  reference: readonly RefRow[],
  o: AlignOptions,
): { pairs: Pair[]; skippedIncomplete: number } {
  const interval = o.intervalMs ?? PACKET.intervalMs;
  const bin = (t: number) => Math.floor(t / o.binMs) * o.binMs;
  const acc = (m: Map<number, { s: number; n: number }>, k: number, v: number) => {
    const e = m.get(k) ?? { s: 0, n: 0 };
    e.s += v;
    e.n++;
    m.set(k, e);
  };
  const dev = new Map<number, { s: number; n: number }>();
  for (const r of device) if (!isWarmup(r, o.settings)) acc(dev, bin(r.t), r.pm25);
  const ref = new Map<number, { s: number; n: number }>();
  for (const r of reference) acc(ref, bin(r.t), r.pm25);

  const devExpected = o.binMs / interval;
  const refExpected = Math.max(1, o.binMs / o.refResolutionMs);
  const pairs: Pair[] = [];
  let skippedIncomplete = 0;
  for (const [k, d] of [...dev].sort((a, b) => a[0] - b[0])) {
    const r = ref.get(k);
    if (!r) continue;
    if (d.n / devExpected < o.settings.windowCompleteness || r.n / refExpected < o.settings.windowCompleteness) {
      skippedIncomplete++;
      continue;
    }
    pairs.push({ t: k, device: d.s / d.n, reference: r.s / r.n });
  }
  return { pairs, skippedIncomplete };
}

// ---------------------------------------------------------------------------
// Metrics

export interface CompareMetrics {
  n: number;
  meanDevice: number | null;
  meanReference: number | null;
  /** mean(device − reference) */
  bias: number | null;
  mae: number | null;
  rmse: number | null;
  r: number | null;
  r2: number | null;
  /** OLS fit device = slope × reference + intercept (EPA sensor-evaluation convention). */
  slope: number | null;
  intercept: number | null;
  /** n ≥ 10 — otherwise "muestra insuficiente para conclusiones". */
  sufficient: boolean;
}

export const MIN_PAIRS = 10;

export function compareMetrics(pairs: readonly Pair[]): CompareMetrics {
  const n = pairs.length;
  if (n === 0) {
    return { n, meanDevice: null, meanReference: null, bias: null, mae: null, rmse: null, r: null, r2: null, slope: null, intercept: null, sufficient: false };
  }
  const mean = (f: (p: Pair) => number) => pairs.reduce((a, p) => a + f(p), 0) / n;
  const md = mean((p) => p.device);
  const mr = mean((p) => p.reference);
  const bias = mean((p) => p.device - p.reference);
  const mae = mean((p) => Math.abs(p.device - p.reference));
  const rmse = Math.sqrt(mean((p) => (p.device - p.reference) ** 2));
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pairs) {
    sxx += (p.reference - mr) ** 2;
    syy += (p.device - md) ** 2;
    sxy += (p.reference - mr) * (p.device - md);
  }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  const slope = sxx > 0 ? sxy / sxx : null;
  return {
    n,
    meanDevice: md,
    meanReference: mr,
    bias,
    mae,
    rmse,
    r,
    r2: r === null ? null : r * r,
    slope,
    intercept: slope === null ? null : md - slope * mr,
    sufficient: n >= MIN_PAIRS,
  };
}

/** Inverts device = m·ref + b into a read-time correction: corrected = (raw − b) / m. */
export function correctionFromFit(slope: number, intercept: number): { slope: number; intercept: number } {
  return { slope: 1 / slope, intercept: -intercept / slope };
}
