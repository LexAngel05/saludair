import { Link } from 'react-router';
import { PageHeader, Placeholder } from '../components/PageHeader';
import { es } from '../i18n/es';
import { ROUTES } from '../routes';

export function SessionDetailPage() {
  const s = es.pages.sessionDetail;
  return (
    <>
      <PageHeader title={s.title}>
        <Link to={ROUTES.sessions} className="text-brand underline">
          {s.back}
        </Link>
      </PageHeader>
      <Placeholder text={es.placeholder.comingInPhase(4)} />
    </>
  );
}
