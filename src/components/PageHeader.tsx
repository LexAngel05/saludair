import type { ReactNode } from 'react';

export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 text-ink-muted">{intro}</p>}
      </div>
      {children}
    </header>
  );
}

export function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center text-ink-muted">
      {text}
    </div>
  );
}
