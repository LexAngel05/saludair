import { Disclaimer } from '../components/Disclaimer';
import { PageHeader, Placeholder } from '../components/PageHeader';
import { es } from '../i18n/es';

export function InfoPage() {
  const s = es.pages.info;
  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <div className="space-y-4">
        <Placeholder text={es.placeholder.comingInPhase(7)} />
        <Disclaimer />
      </div>
    </>
  );
}
