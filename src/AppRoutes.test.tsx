import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './AppRoutes';
import { es } from './i18n/es';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('shows the Live page with the disclaimer at /', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: es.pages.live.title })).toBeInTheDocument();
    expect(screen.getByText(es.disclaimer)).toBeInTheDocument();
  });

  it('shows the disclaimer on Info', async () => {
    renderAt('/informacion');
    expect(await screen.findByRole('heading', { level: 1, name: es.pages.info.title })).toBeInTheDocument();
    expect(screen.getByText(es.disclaimer)).toBeInTheDocument();
  });

  it.each([
    ['/sesiones', es.pages.sessions.title],
    ['/sesiones/3', es.pages.sessionDetail.title],
    ['/validacion', es.pages.validation.title],
    ['/configuracion', es.pages.settings.title],
    ['/no-existe', es.pages.notFound.title],
  ])('routes %s', async (path, title) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('renders all five nav entries', async () => {
    renderAt('/');
    await screen.findByRole('heading', { level: 1, name: es.pages.live.title });
    expect(screen.getAllByRole('navigation', { name: es.app.mainNav }).length).toBeGreaterThan(0);
    for (const label of Object.values(es.nav)) {
      expect(screen.getAllByRole('link', { name: new RegExp(label) }).length).toBeGreaterThan(0);
    }
  });
});
