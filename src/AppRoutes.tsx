import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { LivePage } from './pages/LivePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ROUTES } from './routes';

// Live is the entry page; the rest load on demand (all are precached for offline use).
const SessionsPage = lazy(() => import('./pages/SessionsPage').then((m) => ({ default: m.SessionsPage })));
const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage').then((m) => ({ default: m.SessionDetailPage })));
const ValidationPage = lazy(() => import('./pages/ValidationPage').then((m) => ({ default: m.ValidationPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const InfoPage = lazy(() => import('./pages/InfoPage').then((m) => ({ default: m.InfoPage })));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LivePage />} />
          <Route path={ROUTES.sessions} element={<SessionsPage />} />
          <Route path={`${ROUTES.sessions}/:id`} element={<SessionDetailPage />} />
          <Route path={ROUTES.validation} element={<ValidationPage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          <Route path={ROUTES.info} element={<InfoPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
