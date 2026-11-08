import { DISPLAY_TIMEZONE } from '../config/device';
import type { ReadingRecord, SessionRecord } from '../db/types';
import { applyCorrection, isWarmup } from './averaging';
import type { SessionSummary } from './stats';

const EOL = '\r\n';

/** RFC 4180 escaping + spreadsheet formula-injection guard for text values. */
export function csvEscape(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  let s = v;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// sv-SE formats as "YYYY-MM-DD HH:mm:ss" — a sortable local timestamp.
const localFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: DISPLAY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function localIso(t: number): string {
  return localFmt.format(t);
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export interface SessionCsvInput {
  session: SessionRecord;
  readings: readonly ReadingRecord[];
  summary: SessionSummary;
  corrected: boolean;
}

/** CSV for one session: `#` metadata header (session, dates, units, raw/corrected, settings snapshot, summary) + one row per reading. */
export function sessionCsv({ session, readings, summary, corrected }: SessionCsvInput): string {
  const s = session.settingsSnapshot;
  const useCorrection = corrected && s.correction.enabled;
  const meta: [string, string | number | null][] = [
    ['session_id', session.id],
    ['started_at_utc', new Date(session.startedAt).toISOString()],
    ['started_at_local', `${localIso(session.startedAt)} (${DISPLAY_TIMEZONE})`],
    ['ended_at_utc', session.endedAt ? new Date(session.endedAt).toISOString() : null],
    ['ended_at_local', session.endedAt ? `${localIso(session.endedAt)} (${DISPLAY_TIMEZONE})` : null],
    ['source', session.source],
    ['device', session.deviceName ?? null],
    ['test_type', session.testType],
    ['test_params', JSON.stringify(session.testParams)],
    ['tags', session.tags.join(';')],
    ['notes', session.notes],
    ['units', 'ug/m3'],
    [
      'values',
      useCorrection ? `corrected (pm25_value = ${s.correction.slope} × raw + ${s.correction.intercept})` : 'raw',
    ],
    ['thresholds_approved', s.thresholdsApproved ? 'yes' : 'no (provisional)'],
    ['settings_snapshot', JSON.stringify(s)],
  ];
  const sum = summary;
  const summaryRows: [string, number | null][] = [
    ['duration_min', round(sum.durationMs / 60_000)],
    ['valid_data_pct', round(sum.validPct)],
    ['n_valid', sum.values.n],
    ['mean', sum.values.mean === null ? null : round(sum.values.mean)],
    ['median', sum.values.median === null ? null : round(sum.values.median)],
    ['max', sum.values.max],
    ['p95', sum.values.p95 === null ? null : round(sum.values.p95)],
    ['sd', sum.values.sd === null ? null : round(sum.values.sd)],
    ['time_weighted_avg', sum.twa === null ? null : round(sum.twa)],
    ['minutes_low', round(sum.minutesPerLevel.low)],
    ['minutes_caution', round(sum.minutesPerLevel.caution)],
    ['minutes_elevated', round(sum.minutesPerLevel.elevated)],
    ['pct_low', round(sum.pctPerLevel.low)],
    ['pct_caution', round(sum.pctPerLevel.caution)],
    ['pct_elevated', round(sum.pctPerLevel.elevated)],
    ['minutes_unclassified', round(sum.unclassifiedMinutes)],
    ['alerts', sum.alerts],
    ['packet_loss_pct', round(sum.lossPct)],
    ['disconnects', sum.disconnects],
    ['reboots', sum.reboots],
    ['battery_start_mv', sum.batteryStartMv],
    ['battery_end_mv', sum.batteryEndMv],
    ['rh_mean', sum.rhMean === null ? null : round(sum.rhMean, 1)],
    ['rh_max', sum.rhMax],
  ];

  const lines: string[] = ['# SaludAIR session export'];
  for (const [k, v] of meta) lines.push(`# ${k},${csvEscape(v)}`);
  for (const [k, v] of summaryRows) lines.push(`# summary_${k},${csvEscape(v)}`);
  lines.push('#');
  lines.push(
    'timestamp_utc,timestamp_local,seq,uptime_s,boot_segment,warmup,pm1,pm25_raw,pm25_value,pm10,pm25_avg_device,lvl_device,rh,temp,bat_mv',
  );
  for (const r of readings) {
    const value = useCorrection ? round(applyCorrection(r.pm25, s.correction)) : r.pm25;
    lines.push(
      [
        new Date(r.t).toISOString(),
        localIso(r.t),
        r.seq,
        r.uptimeS,
        r.bootSegment,
        isWarmup(r, s),
        r.pm1,
        r.pm25,
        value,
        r.pm10,
        r.pm25Avg,
        r.lvl,
        r.rh,
        r.temp,
        r.batMv,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join(EOL) + EOL;
}
