import { PageHeader, Placeholder } from '../components/PageHeader';
import { es } from '../i18n/es';

export function ValidationPage() {
  const s = es.pages.validation;
  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <Placeholder text={es.placeholder.comingInPhase(6)} />
    </>
  );
}
