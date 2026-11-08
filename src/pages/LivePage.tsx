import { Disclaimer } from '../components/Disclaimer';
import { PageHeader, Placeholder } from '../components/PageHeader';
import { es } from '../i18n/es';

export function LivePage() {
  const s = es.pages.live;
  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <div className="space-y-4">
        <Placeholder text={es.placeholder.comingInPhase(3)} />
        <Disclaimer />
      </div>
    </>
  );
}
