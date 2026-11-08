import type { Level } from '../config/defaults';
import { es } from '../i18n/es';

// Full class names (not built dynamically) so Tailwind can detect them.
export const LEVEL_STYLES: Record<Level | 'none', { badge: string; solid: string; text: string }> = {
  low: { badge: 'bg-lvl-low-bg text-lvl-low-fg', solid: 'bg-lvl-low-solid', text: 'text-lvl-low-fg' },
  caution: { badge: 'bg-lvl-caution-bg text-lvl-caution-fg', solid: 'bg-lvl-caution-solid', text: 'text-lvl-caution-fg' },
  elevated: {
    badge: 'bg-lvl-elevated-bg text-lvl-elevated-fg',
    solid: 'bg-lvl-elevated-solid',
    text: 'text-lvl-elevated-fg',
  },
  none: { badge: 'bg-lvl-none-bg text-lvl-none-fg', solid: 'bg-lvl-none-solid', text: 'text-lvl-none-fg' },
};

/** Distinct shape per level so the badge reads without color (circle / triangle / square / dash). */
export function LevelGlyph({ level, size = 12 }: { level: Level | 'none'; size?: number }) {
  const shape = {
    low: <circle cx="6" cy="6" r="5" fill="currentColor" />,
    caution: <path d="M6 1 11 10.5H1Z" fill="currentColor" />,
    elevated: <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="currentColor" />,
    none: <rect x="1" y="5" width="10" height="2" rx="1" fill="currentColor" />,
  }[level];
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {shape}
    </svg>
  );
}

export function LevelBadge({
  level,
  qualifier,
  size = 'md',
}: {
  level: Level | null;
  qualifier?: string;
  size?: 'md' | 'lg';
}) {
  const key = level ?? 'none';
  const text = level ? es.levels[level] : es.levels.none;
  const sizing = size === 'lg' ? 'px-4 py-2 text-base gap-2' : 'px-3 py-1 text-sm gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizing} ${LEVEL_STYLES[key].badge}`}>
      <LevelGlyph level={key} size={size === 'lg' ? 14 : 12} />
      {text}
      {qualifier && <span className="font-medium opacity-80">· {qualifier}</span>}
    </span>
  );
}
