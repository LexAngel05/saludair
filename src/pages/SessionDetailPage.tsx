import { Link } from 'react-router';
import { Icon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Card, EmptyState } from '../components/ui';
import { es } from '../i18n/es';
import { ROUTES } from '../routes';

export function SessionDetailPage() {
  const s = es.pages.sessionDetail;
  return (
    <>
      <PageHeader title={s.title}>
        <Link to={ROUTES.sessions} className="text-sm font-semibold text-brand underline">
          {s.back}
        </Link>
      </PageHeader>
      <Card>
        <EmptyState icon={<Icon name="trend" />} text={es.placeholder.comingInPhase(4)} />
      </Card>
    </>
  );
}
