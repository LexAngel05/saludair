// WCAG 2.1 contrast check for the text/background token pairs used in the UI.
// Usage: node scripts/check-contrast.mjs   (exit code 1 if any pair < 4.5:1)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

function block(selector) {
  const i = css.indexOf(selector);
  const start = css.indexOf('{', i);
  let depth = 0;
  for (let j = start; j < css.length; j++) {
    if (css[j] === '{') depth++;
    if (css[j] === '}' && --depth === 0) return css.slice(start, j);
  }
  return '';
}
const vars = (src) => Object.fromEntries([...src.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const PAIRS = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink-muted', 'bg'], ['ink-muted', 'surface'], ['ink-muted', 'surface-2'],
  ['ink-faint', 'surface'], ['ink-faint', 'bg'], ['brand', 'surface'], ['brand', 'brand-soft'], ['brand-ink', 'brand'],
  ['lvl-low-fg', 'lvl-low-bg'], ['lvl-caution-fg', 'lvl-caution-bg'], ['lvl-elevated-fg', 'lvl-elevated-bg'], ['lvl-none-fg', 'lvl-none-bg'],
];

let fail = false;
for (const [name, sel] of [['light', ':root {'], ['dark', ":root[data-theme='dark']"]]) {
  const v = vars(block(sel));
  console.log(`\n${name}`);
  for (const [fg, bg] of PAIRS) {
    const r = ratio(v[fg], v[bg]);
    const ok = r >= 4.5;
    if (!ok) fail = true;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}  ${fg} on ${bg}`);
  }
}
process.exit(fail ? 1 : 0);
