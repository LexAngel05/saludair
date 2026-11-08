import { expect, test } from '@playwright/test';

/**
 * Definition-of-done flow (AGENTS.md §9 Testing):
 * connect Simulator → start session → alert appears → stop → summary → CSV export downloads.
 */
test('simulator session raises an alert and exports a CSV', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'En vivo' })).toBeVisible();
  await expect(page.getByText('SaludAIR es un prototipo educativo.')).toBeVisible();

  // Traffic scenario at ×60: the first spike starts 1 simulated minute in.
  await page.getByLabel('Escenario').selectOption('trafico');
  await page.getByRole('radio', { name: '×60' }).click();
  await page.getByRole('button', { name: 'Simulador', exact: true }).click();
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Exterior' }).click();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText('Grabando', { exact: false }).first()).toBeVisible();

  // Warm-up flag shows first, then the alert banner once the 5-min mean persists ≥ threshold for 2 min.
  const banner = page.getByRole('alert').filter({ hasText: /Precaución|Nivel Elevado/ });
  await expect(banner).toBeVisible({ timeout: 45_000 });

  await page.getByRole('button', { name: 'Detener y guardar' }).click();
  await page.getByRole('link', { name: 'Ver resumen' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Detalle de sesión' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByText('Exterior').first()).toBeVisible();
  // At least one alert recorded in the session.
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();
  await expect(page.getByText('Sin alertas en esta sesión.')).toHaveCount(0);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^saludair-sesion-\d+-\d{4}-\d{2}-\d{2}-crudo\.csv$/);
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile(path, 'utf8');
  expect(csv).toContain('# SaludAIR session export');
  expect(csv).toContain('# values,raw');
  expect(csv).toContain('# settings_snapshot,');
  expect(csv).toMatch(/# summary_alerts,[1-9]/);
  expect(csv.split('\r\n').filter((l) => /^\d{4}-\d{2}-\d{2}T/.test(l)).length).toBeGreaterThan(50);
});

// The "single isolated spike never alerts" rule is proven in src/core/alerts.test.ts;
// here we check the end-to-end path stays quiet on clean air.
test('clean air never shows an alert', async ({ page }) => {
  await page.goto('/#/');
  await page.getByLabel('Escenario').selectOption('limpio');
  await page.getByRole('radio', { name: '×60' }).click();
  await page.getByRole('button', { name: 'Simulador', exact: true }).click();
  // ~10 simulated minutes.
  await page.waitForTimeout(10_000);
  await expect(page.getByRole('alert').filter({ hasText: /Precaución|Nivel Elevado/ })).toHaveCount(0);
  await expect(page.getByText('Bajo').first()).toBeVisible();
});

test('every page loads and the disclaimer is on Live and Info', async ({ page }) => {
  for (const [hash, title] of [
    ['#/sesiones', 'Sesiones'],
    ['#/validacion', 'Validación'],
    ['#/configuracion', 'Configuración'],
    ['#/informacion', 'Información'],
  ] as const) {
    await page.goto(`/${hash}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }
  await expect(page.getByText('SaludAIR es un prototipo educativo.')).toBeVisible();
});
