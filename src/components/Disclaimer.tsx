import { es } from '../i18n/es';

/** Mandatory disclaimer (AGENTS.md §2) — shown on Live and Info. */
export function Disclaimer() {
  return (
    <aside
      aria-label={es.app.disclaimerLabel}
      className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-muted"
    >
      {es.disclaimer}
    </aside>
  );
}
