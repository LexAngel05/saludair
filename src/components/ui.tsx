import type { ReactNode } from 'react';

/** Base surface. Radius hierarchy: cards 16px (rounded-2xl only here), controls 10px, chips full. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{children}</p>;
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'warn' }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-muted',
    brand: 'bg-brand-soft text-brand',
    warn: 'bg-lvl-caution-bg text-lvl-caution-fg',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, text }: { icon: ReactNode; title?: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-brand-soft text-brand">{icon}</div>
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      <p className="mt-1 max-w-md text-sm text-ink-muted">{text}</p>
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-muted">{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-muted">{label}</p>
        <p className="text-lg leading-tight font-semibold">
          {value}
          {unit && <span className="ml-1 text-xs font-medium text-ink-muted">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
