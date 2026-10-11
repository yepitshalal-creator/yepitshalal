import clsx from 'clsx';
import { requireAdmin } from '@/lib/require-admin';
import { AdminPage, Tag } from '@/components/admin/ui';
import { Meter } from '@/components/admin/dashboard';
import { ArrowUpRightIcon, CheckIcon, ClockIcon, InfoIcon, WarningIcon } from '@/components/icons';
import { SETUP_GROUPS, setupItems, type SetupItem, type SetupState } from '@/lib/admin/setup';
import { markSetupItem } from '@/lib/admin/setup-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Setup' };

const STATE: Record<SetupState, { label: string; tone: 'good' | 'warn' | 'neutral' | 'accent'; Icon: typeof CheckIcon }> = {
  done: { label: 'Done', tone: 'good', Icon: CheckIcon },
  todo: { label: 'To do', tone: 'warn', Icon: WarningIcon },
  by_hand: { label: 'Tick when done', tone: 'accent', Icon: InfoIcon },
  later: { label: 'Later', tone: 'neutral', Icon: ClockIcon },
};

function Item({ item }: { item: SetupItem }) {
  const s = STATE[item.state];
  const canTick = item.state === 'by_hand' || (item.state === 'done' && item.markedAt);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <span
          aria-hidden
          className={clsx(
            'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            item.state === 'done' && 'bg-halal-fullSoft text-halal-fullInk',
            item.state === 'todo' && 'bg-halal-partialSoft text-halal-partialInk',
            item.state === 'by_hand' && 'bg-accent-soft text-accent-ink',
            item.state === 'later' && 'bg-black/[0.05] text-subtle'
          )}
        >
          <s.Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={clsx('font-semibold', item.state === 'done' ? 'text-ink/70' : 'text-ink')}>{item.title}</h3>
            <Tag tone={s.tone}>{s.label}</Tag>
            <Tag>{item.who === 'Either' ? 'You or Claude' : item.who === 'Shabir' ? 'You' : 'Claude'}</Tag>
          </div>
          {item.state !== 'done' && <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{item.why}</p>}
          {item.seen && <p className="mt-1 text-xs text-subtle">Checked just now: {item.seen}</p>}
          {item.markedAt && (
            <p className="mt-1 text-xs text-subtle">
              Ticked on {new Date(item.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.
            </p>
          )}
          {item.state !== 'done' && item.steps && (
            <details className="group mt-2">
              <summary className="inline-flex min-h-[32px] cursor-pointer list-none items-center rounded-full text-sm font-semibold text-accent-ink hover:underline">
                How to do it
              </summary>
              <ol className="mt-1 max-w-prose list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink/85">
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {item.link && item.state !== 'done' && (
            <a
              href={item.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-line bg-white px-3.5 text-xs font-semibold text-ink transition hover:border-ink/30"
            >
              {item.link.label}
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </a>
          )}
          {canTick && (
            <form action={markSetupItem.bind(null, item.id, item.state !== 'done')}>
              <button
                className={clsx(
                  'inline-flex min-h-[36px] items-center gap-1 rounded-full px-3.5 text-xs font-semibold transition',
                  item.state === 'done'
                    ? 'text-subtle hover:bg-black/[0.04]'
                    : 'bg-ink text-white hover:bg-accent-ink'
                )}
              >
                {item.state === 'done' ? 'Undo' : 'Mark done'}
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}

export default async function AdminSetupPage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const items = await setupItems();
  const done = items.filter((i) => i.state === 'done').length;
  const open = items.filter((i) => i.state === 'todo' || i.state === 'by_hand').length;

  return (
    <AdminPage
      title="Setup"
      width="lg"
      description="The small jobs that switch each part of the site on. Most are a key or a setting in another company's dashboard. The site checks the ones it can see every time you open this page; tick the others when they are done."
    >
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <Meter value={done} max={items.length} label="Setup jobs done" />
        <p className="mt-3 text-sm text-muted">
          {open === 0 ? 'Everything is switched on.' : `${open} still to do. "Later" jobs have a deadline further off.`}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {SETUP_GROUPS.map((group) => {
          const rows = items.filter((i) => i.group === group);
          const left = rows.filter((i) => i.state !== 'done').length;
          return (
            <section key={group} className="rounded-2xl border border-line bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <h2 className="font-display text-base font-semibold text-ink">{group}</h2>
                <span className="text-xs font-semibold text-subtle">{left === 0 ? 'All done' : `${left} left`}</span>
              </div>
              <ul className="divide-y divide-line">
                {/* What still needs doing first, then what is done. */}
                {[...rows]
                  .sort((a, b) => Number(a.state === 'done') - Number(b.state === 'done'))
                  .map((item) => (
                    <Item key={item.id} item={item} />
                  ))}
              </ul>
            </section>
          );
        })}
      </div>
    </AdminPage>
  );
}
