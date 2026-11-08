import type { ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { decimateWithGaps } from '../core/decimate';
import { formatNumber, formatTime, formatTimeSec } from '../lib/format';
import './setup';
import { alpha, useChartTheme } from './useChartTheme';

/** Single-series time line without level bands (e.g. battery mV). */
export function SimpleLineChart({
  points,
  unit,
  ariaLabel,
  height = 220,
}: {
  points: { t: number; v: number }[];
  unit: string;
  ariaLabel: string;
  height?: number;
}) {
  const theme = useChartTheme();
  const data = useMemo(() => decimateWithGaps(points, 800), [points]);
  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { type: 'linear', grid: { display: false }, ticks: { color: theme.muted, maxTicksLimit: 6, callback: (v) => formatTime(Number(v)) } },
        y: {
          grid: { color: alpha(theme.line.startsWith('#') ? theme.line : '#cccccc', 0.6) },
          ticks: { color: theme.muted },
          title: { display: true, text: unit, color: theme.muted },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.ink,
          titleColor: theme.surface,
          bodyColor: theme.surface,
          displayColors: false,
          callbacks: {
            title: (items) => formatTimeSec(Number(items[0]?.parsed.x)),
            label: (item) => `${formatNumber(item.parsed.y)} ${unit}`,
          },
        },
      },
    }),
    [theme, unit],
  );
  return (
    <div style={{ height }} className="relative">
      <Line
        data={{ datasets: [{ data: data.map((p) => ({ x: p.t, y: p.v })), borderColor: theme.brand, borderWidth: 2, pointRadius: 0, tension: 0.2 }] }}
        options={options}
        role="img"
        aria-label={ariaLabel}
      />
    </div>
  );
}
