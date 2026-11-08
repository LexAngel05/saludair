import type { ReactNode } from 'react';

export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {intro && <p className="mt-2 text-ink-muted">{intro}</p>}
      </div>
      {children}
    </header>
  );
}
