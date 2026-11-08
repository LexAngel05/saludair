import { es } from '../i18n/es';
import { Icon } from './icons';

/** Mandatory disclaimer (AGENTS.md §2) — shown on Live and Info. */
export function Disclaimer() {
  return (
    <aside
      aria-label={es.app.disclaimerLabel}
      className="flex gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5 text-sm leading-relaxed text-ink-muted"
    >
      <span className="mt-0.5 shrink-0 text-ink-faint">
        <Icon name="info" size={18} />
      </span>
      <p>{es.disclaimer}</p>
    </aside>
  );
}
