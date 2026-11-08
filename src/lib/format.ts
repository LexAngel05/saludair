import { DISPLAY_TIMEZONE } from '../config/device';

const LOCALE = 'es-MX';

const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: DISPLAY_TIMEZONE, hour: '2-digit', minute: '2-digit' });
const timeSecFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DISPLAY_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DISPLAY_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Times are stored as UTC epoch ms and always displayed in America/Tijuana. */
export const formatTime = (t: number) => timeFmt.format(t);
export const formatTimeSec = (t: number) => timeSecFmt.format(t);
export const formatDateTime = (t: number) => dateTimeFmt.format(t);

export function formatNumber(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, '0')} min`;
}
