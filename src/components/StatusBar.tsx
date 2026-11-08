import type { QualityFlag, QualityFlagKey } from '../core/quality';
import { es } from '../i18n/es';
import { formatNumber } from '../lib/format';
import { Icon, type IconName } from './icons';

const ICON: Record<QualityFlagKey, IconName> = {
  disconnected: 'wave',
  stale: 'clock',
  'packet-loss': 'signal',
  'high-humidity': 'droplet',
  warmup: 'sun',
  reboot: 'repeat',
  'low-battery': 'battery',
};

/** Severe flags block trust in the reading; the rest are cautions. */
const SEVERE: ReadonlySet<QualityFlagKey> = new Set(['disconnected', 'stale']);

function valueText(f: QualityFlag): string | null {
  if (f.value === undefined) return null;
  switch (f.key) {
    case 'packet-loss':
      return `${formatNumber(f.value, 1)} %`;
    case 'high-humidity':
      return `${formatNumber(f.value)} %`;
    case 'warmup':
      return `${formatNumber(f.value)} s`;
    case 'low-battery':
      return `${formatNumber(f.value)} mV`;
    case 'reboot':
      return `×${f.value}`;
    default:
      return null;
  }
}

/** Always-visible data-quality status (AGENTS.md §8.4). Icon + text, never color alone. */
export function StatusBar({ flags }: { flags: QualityFlag[] }) {
  return (
    <div role="status" aria-live="polite" aria-label={es.status.statusBarLabel} className="flex flex-wrap gap-2">
      {flags.length === 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lvl-low-bg px-3 py-1.5 text-xs font-semibold text-lvl-low-fg">
          <Icon name="leaf" size={14} />
          {es.status.allGood}
        </span>
      ) : (
        flags.map((f) => {
          const tone = SEVERE.has(f.key)
            ? 'bg-lvl-elevated-bg text-lvl-elevated-fg'
            : 'bg-lvl-caution-bg text-lvl-caution-fg';
          const v = valueText(f);
          return (
            <span
              key={f.key}
              title={es.flags[f.key].detail}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}
            >
              <Icon name={ICON[f.key]} size={14} />
              {es.flags[f.key].label}
              {v && <span className="font-medium opacity-90">· {v}</span>}
            </span>
          );
        })
      )}
    </div>
  );
}
