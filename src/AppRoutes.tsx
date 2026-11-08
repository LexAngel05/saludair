import { Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { LivePage } from './pages/LivePage';
import { SessionsPage } from './pages/SessionsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { ValidationPage } from './pages/ValidationPage';
import { SettingsPage } from './pages/SettingsPage';
import { InfoPage } from './pages/InfoPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ROUTES } from './routes';

export function AppRoutes() {
  return (
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
  );
}
