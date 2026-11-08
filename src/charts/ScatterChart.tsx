import type { ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import type { Pair } from '../core/referenceAlign';
import { es } from '../i18n/es';
import { formatNumber, formatTime } from '../lib/format';
import './setup';
import { alpha, useChartTheme } from './useChartTheme';

/**
 * Device vs reference. x = reference, y = device (sensor-evaluation convention).
 * Three series → legend (HTML, below) with direct identity: points, 1:1 line, fit line.
 */
export function ScatterChart({ pairs, slope, intercept }: { pairs: Pair[]; slope: number | null; intercept: number | null }) {
  const theme = useChartTheme();
  const r = es.validation.ref;
  const max = Math.ceil(Math.max(10, ...pairs.flatMap((p) => [p.device, p.reference])) * 1.1);

  const data = useMemo(
    () => ({
      datasets: [
        {
          type: 'scatter' as const,
          label: 'Pares',
          data: pairs.map((p) => ({ x: p.reference, y: p.device, t: p.t })),
          backgroundColor: alpha(theme.brand.startsWith('#') ? theme.brand : '#0f5d5a', 0.75),
          borderColor: theme.surface,
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        {
          type: 'line' as const,
          label: r.oneToOne,
          data: [
            { x: 0, y: 0 },
            { x: max, y: max },
          ],
          borderColor: theme.muted,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
        },
        ...(slope !== null && intercept !== null
          ? [
              {
                type: 'line' as const,
                label: r.fitLine,
                data: [
                  { x: 0, y: intercept },
                  { x: max, y: slope * max + intercept },
                ],
                borderColor: theme.ink,
                borderWidth: 2,
                pointRadius: 0,
              },
            ]
          : []),
      ],
    }),
    [pairs, theme, max, slope, intercept, r.oneToOne, r.fitLine],
  );

  const options = useMemo<ChartOptions<'scatter'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max,
          title: { display: true, text: r.axisRef, color: theme.muted },
          grid: { color: alpha(theme.line.startsWith('#') ? theme.line : '#cccccc', 0.6) },
          ticks: { color: theme.muted },
        },
        y: {
          min: 0,
          max,
          title: { display: true, text: r.axisDevice, color: theme.muted },
          grid: { color: alpha(theme.line.startsWith('#') ? theme.line : '#cccccc', 0.6) },
          ticks: { color: theme.muted },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.ink,
          titleColor: theme.surface,
          bodyColor: theme.surface,
          displayColors: false,
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            title: (items) => formatTime((items[0]?.raw as { t: number }).t),
            label: (item) =>
              `${r.axisRef.split(' ')[0]}: ${formatNumber(item.parsed.x, 1)} · ${r.axisDevice.split(' ')[0]}: ${formatNumber(item.parsed.y, 1)}`,
          },
        },
      },
    }),
    [theme, max, r],
  );

  return (
    <figure>
      <div className="relative aspect-square max-h-[420px] w-full">
        <Scatter data={data as never} options={options} role="img" aria-label={r.scatterAria} />
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-brand" aria-hidden="true" />
          {r.metrics.n}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed border-ink-muted" aria-hidden="true" />
          {r.oneToOne}
        </span>
        {slope !== null && (
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-ink" aria-hidden="true" />
            {r.fitLine}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
