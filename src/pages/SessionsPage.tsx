import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { SESSION_TAGS, TEST_TYPES, type SessionTag, type TestType } from '../config/defaults';
import { Icon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Card, Chip, EmptyState } from '../components/ui';
import { getDb } from '../db/schema';
import { listSessions, type SessionListItem } from '../db/sessionsRepo';
import { es } from '../i18n/es';
import { formatDateTime, formatDuration } from '../lib/format';
import { ROUTES } from '../routes';
import { useRecorder } from '../state/recorderInstance';

export function SessionsPage() {
  const s = es.pages.sessions;
  const l = es.sessionsList;
  const rec = useRecorder();
  const [items, setItems] = useState<SessionListItem[] | null>(null);
  const [tag, setTag] = useState<SessionTag | 'all'>('all');
  const [test, setTest] = useState<TestType | 'all'>('all');

  useEffect(() => {
    let alive = true;
    listSessions(getDb())
      .then((x) => alive && setItems(x))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [rec.activeId]);

  const filtered = useMemo(
    () => (items ?? []).filter((x) => (tag === 'all' || x.tags.includes(tag)) && (test === 'all' || x.testType === test)),
    [items, tag, test],
  );

  const select = 'rounded-[10px] border border-line bg-surface px-3 py-2 text-sm';

  return (
    <>
      <PageHeader title={s.title} intro={s.intro} />
      {items !== null && items.length === 0 ? (
        <Card>
          <EmptyState icon={<Icon name="sessions" />} title={s.emptyTitle} text={s.emptyText} />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              {l.filterTag}
              <select className={select} value={tag} onChange={(e) => setTag(e.target.value as SessionTag | 'all')}>
                <option value="all">{l.all}</option>
                {SESSION_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {es.tags[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              {l.filterTest}
              <select className={select} value={test} onChange={(e) => setTest(e.target.value as TestType | 'all')}>
                <option value="all">{l.all}</option>
                {TEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {es.testTypes[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filtered.length === 0 && items !== null ? (
            <p className="text-sm text-ink-muted">{l.noMatch}</p>
          ) : (
            <ul className="grid gap-3">
              {filtered.map((x) => (
                <li key={x.id}>
                  <Link
                    to={`${ROUTES.sessions}/${x.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand sm:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{formatDateTime(x.startedAt)}</p>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {x.endedAt ? formatDuration(x.endedAt - x.startedAt) : l.running} · {l.readings(x.readingCount)} ·{' '}
                        {es.sources[x.source]}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {x.testType !== 'none' && <Chip tone="brand">{es.testTypes[x.testType]}</Chip>}
                      {x.tags.map((t) => (
                        <Chip key={t}>{es.tags[t]}</Chip>
                      ))}
                      {!x.endedAt && <Chip tone="warn">{l.running}</Chip>}
                    </div>
                    <Icon name="trend" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
