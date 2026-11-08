import { LEVELS, type Level, type Settings } from '../config/defaults';
import { es } from '../i18n/es';
import { LEVEL_STYLES, LevelGlyph } from './LevelBadge';

/**
 * Horizontal 3-segment scale built from the configured thresholds.
 * Optional marker shows where a value falls. Each segment is labelled with text + range.
 */
export function LevelScale({ thresholds, value }: { thresholds: Settings['thresholds']; value?: number | null }) {
  const { caution, elevated } = thresholds;
  // Show the top segment as wide as the middle one, so the scale stays readable.
  const max = elevated + (elevated - caution);
  const bounds: Record<Level, [number, number]> = {
    low: [0, caution],
    caution: [caution, elevated],
    elevated: [elevated, max],
  };
  const ranges: Record<Level, string> = {
    low: es.levels.rangeBelow(caution),
    caution: es.levels.rangeBetween(caution, elevated),
    elevated: es.levels.rangeAbove(elevated),
  };
  const markerPct = value == null ? null : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <figure aria-label={es.levels.scaleLabel}>
      <div className="relative">
        <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">
          {LEVELS.map((lvl) => {
            const [a, b] = bounds[lvl];
            return <div key={lvl} className={LEVEL_STYLES[lvl].solid} style={{ flexGrow: b - a }} />;
          })}
        </div>
        {markerPct != null && (
          <div
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ink shadow-card"
            style={{ left: `${markerPct}%` }}
          />
        )}
      </div>
      <figcaption className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {LEVELS.map((lvl) => (
          <div key={lvl}>
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <span className={LEVEL_STYLES[lvl].text}>
                <LevelGlyph level={lvl} size={10} />
              </span>
              {es.levels[lvl]}
            </p>
            <p className="mt-0.5 text-ink-muted">
              {ranges[lvl]} {es.units.pm}
            </p>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
