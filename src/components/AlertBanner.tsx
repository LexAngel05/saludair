import { es } from '../i18n/es';
import { formatNumber, formatTime } from '../lib/format';
import type { AlertBannerState } from '../state/liveStore';
import { LevelGlyph } from './LevelBadge';

/** In-page alert: the channel that always works (notifications may be blocked). */
export function AlertBanner({ banner, onDismiss }: { banner: AlertBannerState; onDismiss: () => void }) {
  const elevated = banner.level === 'elevated';
  const v = formatNumber(banner.mean);
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-start gap-4 rounded-2xl border-2 p-4 sm:p-5 ${
        elevated
          ? 'border-lvl-elevated-solid bg-lvl-elevated-bg text-lvl-elevated-fg'
          : 'border-lvl-caution-solid bg-lvl-caution-bg text-lvl-caution-fg'
      }`}
    >
      <span className="mt-0.5">
        <LevelGlyph level={banner.level} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">{elevated ? es.alerts.titleElevated : es.alerts.titleCaution}</p>
        <p className="mt-1 text-sm">{elevated ? es.alerts.bodyElevated(v) : es.alerts.bodyCaution(v)}</p>
        <p className="mt-1 text-xs font-medium opacity-80">{es.alerts.since(formatTime(banner.t))}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-[10px] px-3 py-1.5 text-sm font-semibold underline underline-offset-2"
      >
        {es.alerts.dismiss}
      </button>
    </div>
  );
}
