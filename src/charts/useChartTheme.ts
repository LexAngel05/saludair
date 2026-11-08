import { useEffect, useState } from 'react';

export interface ChartTheme {
  ink: string;
  muted: string;
  faint: string;
  line: string;
  surface: string;
  brand: string;
  low: string;
  caution: string;
  elevated: string;
}

function read(): ChartTheme {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    ink: v('--ink'),
    muted: v('--ink-muted'),
    faint: v('--ink-faint'),
    line: v('--line'),
    surface: v('--surface'),
    brand: v('--brand'),
    low: v('--lvl-low-solid'),
    caution: v('--lvl-caution-solid'),
    elevated: v('--lvl-elevated-solid'),
  };
}

/** Canvas can't use CSS variables, so read the tokens and re-read on theme changes. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const update = () => setTheme(read());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      mo.disconnect();
    };
  }, []);
  return theme;
}

/** Hex (#rrggbb) → rgba with alpha. */
export function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${a})`;
}
