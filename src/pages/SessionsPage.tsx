import { PageHeader, Placeholder } from '../components/PageHeader';
import { es } from '../i18n/es';

export function SessionsPage() {
  const s = es.pages.sessions;
  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <Placeholder text={es.placeholder.comingInPhase(4)} />
    </>
  );
}
