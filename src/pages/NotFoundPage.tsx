import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { es } from '../i18n/es';
import { ROUTES } from '../routes';

export function NotFoundPage() {
  const s = es.pages.notFound;
  return (
    <PageHeader title={s.title}>
      <Link to={ROUTES.live} className="text-brand underline">
        {s.back}
      </Link>
    </PageHeader>
  );
}
