import type { ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { Settings } from '../config/defaults';
import { decimateWithGaps } from '../core/decimate';
import { es } from '../i18n/es';
import { formatNumber, formatTime, formatTimeSec } from '../lib/format';
import './setup';
import { alpha, useChartTheme } from './useChartTheme';

export interface ChartAlertSpan {
  startedAt: number;
  endedAt?: number;
  level: 'caution' | 'elevated';
}

interface Props {
  points: { t: number; v: number | null }[];
  thresholds: Settings['thresholds'];
  xMin?: number;
  xMax?: number;
  height?: number;
  ariaLabel: string;
  alerts?: ChartAlertSpan[];
  /** Max points drawn (LTTB per gap-free segment). */
  maxPoints?: number;
  /** Series label in the tooltip, e.g. "PM2.5 (crudo)". */
  seriesLabel?: string;
}

/**
 * PM2.5 over time: single series (no legend; the card title names it), level bands from
 * the configured thresholds with text labels, gaps drawn as gaps, crosshair tooltip.
 */
export function TimeSeriesChart({
  points,
  thresholds,
  xMin,
  xMax,
  height = 220,
  ariaLabel,
  alerts = [],
  maxPoints = 1500,
  seriesLabel = 'PM2.5',
}: Props) {
  const theme = useChartTheme();
  const data = useMemo(() => decimateWithGaps(points, maxPoints), [points, maxPoints]);
  const dataMax = data.reduce((m, p) => (p.v !== null && p.v > m ? p.v : m), 0);
  const yMax = Math.ceil(Math.max(thresholds.elevated * 1.4, dataMax * 1.1) / 5) * 5;

  const options = useMemo<ChartOptions<'line'>>(() => {
    const band = (yMin: number, yMaxB: number, color: string, label: string): AnnotationOptions<'box'> => ({
      type: 'box',
      yMin,
      yMax: yMaxB,
      backgroundColor: alpha(color, 0.1),
      borderWidth: 0,
      drawTime: 'beforeDatasetsDraw',
      label: {
        display: true,
        content: label,
        position: { x: 'start', y: 'start' },
        color: theme.muted,
        font: { size: 11, weight: 600 },
        padding: 4,
      },
    });
    const alertBoxes: AnnotationOptions<'box'>[] = alerts.map((a) => ({
      type: 'box',
      xMin: a.startedAt,
      xMax: a.endedAt ?? xMax ?? data.at(-1)?.t ?? a.startedAt,
      yMin: 0,
      yMax,
      backgroundColor: 'transparent',
      borderColor: a.level === 'elevated' ? theme.elevated : theme.caution,
      borderWidth: 1.5,
      borderDash: [4, 3],
      drawTime: 'afterDatasetsDraw',
      label: {
        display: true,
        content: `${es.levels[a.level]}`,
        position: { x: 'start', y: 'end' },
        color: theme.ink,
        backgroundColor: alpha(theme.surface.startsWith('#') ? theme.surface : '#ffffff', 0.85),
        font: { size: 11, weight: 700 },
        padding: 3,
      },
    }));

    return {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      normalized: true,
      spanGaps: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      layout: { padding: { top: 4, right: 4 } },
      scales: {
        x: {
          type: 'linear',
          ...(xMin !== undefined ? { min: xMin } : {}),
          ...(xMax !== undefined ? { max: xMax } : {}),
          grid: { display: false },
          border: { color: theme.line },
          ticks: {
            color: theme.muted,
            maxTicksLimit: 6,
            maxRotation: 0,
            callback: (v) => formatTime(Number(v)),
          },
        },
        y: {
          min: 0,
          max: yMax,
          grid: { color: alpha(theme.line.startsWith('#') ? theme.line : '#cccccc', 0.6) },
          border: { display: false },
          ticks: { color: theme.muted, maxTicksLimit: 5 },
          title: { display: true, text: es.units.pm, color: theme.muted, font: { size: 11 } },
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
            label: (item) => `${seriesLabel}: ${formatNumber(item.parsed.y)} ${es.units.pm}`,
          },
        },
        annotation: {
          annotations: [
            band(0, thresholds.caution, theme.low, es.levels.low),
            band(thresholds.caution, thresholds.elevated, theme.caution, es.levels.caution),
            band(thresholds.elevated, yMax, theme.elevated, es.levels.elevated),
            ...alertBoxes,
          ],
        },
      },
    };
  }, [theme, thresholds, yMax, xMin, xMax, alerts, data, seriesLabel]);

  const chartData = useMemo(
    () => ({
      datasets: [
        {
          label: seriesLabel,
          data: data.map((p) => ({ x: p.t, y: p.v })),
          borderColor: theme.brand,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: theme.surface,
          pointHoverBackgroundColor: theme.brand,
          tension: 0.25,
        },
      ],
    }),
    [data, theme, seriesLabel],
  );

  return (
    <div style={{ height }} className="relative">
      <Line data={chartData} options={options} role="img" aria-label={ariaLabel} />
    </div>
  );
}
