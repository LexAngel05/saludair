import { PageHeader, Placeholder } from '../components/PageHeader';
import { es } from '../i18n/es';

export function SettingsPage() {
  const s = es.pages.settings;
  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      <Placeholder text={es.placeholder.comingInPhase(4)} />
    </>
  );
}
