import { Icon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Card, EmptyState } from '../components/ui';
import { es } from '../i18n/es';

export function SessionsPage() {
  const s = es.pages.sessions;
  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <Card>
        <EmptyState icon={<Icon name="sessions" />} title={s.emptyTitle} text={s.emptyText} />
      </Card>
    </>
  );
}
