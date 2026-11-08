import { Chart, LinearScale, LineController, LineElement, PointElement, ScatterController, Tooltip } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

// Register only what we use (keeps the bundle small). Decimation is done in
// core/decimate.ts (LTTB per gap-free segment) so gaps survive downsampling.
Chart.register(LineController, ScatterController, LineElement, PointElement, LinearScale, Tooltip, annotationPlugin);

Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'system-ui';
Chart.defaults.animation = false;
