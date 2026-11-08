import { expect, test } from '@playwright/test';

/**
 * Regenerates the documentation screenshots (docs/screenshots/*.png).
 * Skipped by default; run with:  SCREENSHOTS=1 npx playwright test screenshots
 */
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to regenerate screenshots');

for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  test(`screenshots ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/#/');
    await page.getByLabel('Escenario').selectOption('trafico');
    await page.getByRole('radio', { name: '×60' }).click();
    await page.getByRole('button', { name: 'Simulador', exact: true }).click();
    await page.getByRole('button', { name: 'Exterior' }).click();
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Precaución|Nivel Elevado/ })).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `docs/screenshots/live-${name}.png`, fullPage: name === 'desktop' });

    await page.waitForTimeout(8000);
    await page.getByRole('button', { name: 'Detener y guardar' }).click();
    await page.getByRole('link', { name: 'Ver resumen' }).click();
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `docs/screenshots/session-${name}.png`, fullPage: name === 'desktop' });

    await page.goto('/#/validacion');
    await expect(page.getByRole('heading', { level: 1, name: 'Validación' })).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/validation-${name}.png`, fullPage: name === 'desktop' });
  });
}
