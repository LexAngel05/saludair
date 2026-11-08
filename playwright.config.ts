import { defineConfig } from '@playwright/test';

const PORT = 4174;

/**
 * E2E against the production build (what users get), driven by the Simulator.
 * Uses the locally installed Chrome (`channel: 'chrome'`); set PW_CHANNEL=chromium
 * after `npx playwright install chromium` on machines without Chrome (e.g. CI).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL ?? 'chrome',
    locale: 'es-MX',
    timezoneId: 'America/Tijuana',
    serviceWorkers: 'block',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
