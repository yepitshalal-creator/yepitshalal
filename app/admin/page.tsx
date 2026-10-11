import { requireAdmin } from '@/lib/require-admin';
import Link from 'next/link';
import { AdminPage } from '@/components/admin/ui';
import {
  ActionCard,
  BarList,
  Card,
  CardLink,
  EmptyNote,
  Meter,
  SetupCard,
  StatTile,
} from '@/components/admin/dashboard';
import { LineChart } from '@/components/admin/charts/LineChart';
import { StackedColumns } from '@/components/admin/charts/StackedColumns';
import { SERIES } from '@/components/admin/charts/theme';
import { MessageRow } from '@/components/admin/inbox/parts';
import { CheckIcon, InboxIcon, ListIcon, MailIcon, PlayIcon, PlusIcon, SealCheckIcon, StarIcon, TicketIcon, UserIcon } from '@/components/icons';
import { INBOX_LABEL, loadInbox } from '@/lib/admin/inbox';
import { catalogue, messagesByDay, moneyGlance, waitingCounts } from '@/lib/admin/stats';
import { journey, posthogConfigured, topPages, totals, trafficByDay } from '@/lib/admin/posthog';
import { setupOpenCount } from '@/lib/admin/setup';
import { GearIcon, ArrowRightIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';
// The layout's "%s | Admin" template only reaches pages below it, not this one.
export const metadata = { title: { absolute: 'Overview | Admin' } };

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Pence as pounds: £0, £2.99, £1,250. */
function gbp(pence: number) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** A number with a line under it, for money and catalogue figures. */
function Figure({ label, value, note, href }: { label: string; value: string; note?: string; href: string }) {
  return (
    <Link href={href} className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-ink/25">
      <p className="text-sm font-medium text-muted">{label}</p>
      <div>
        <p className="text-[28px] font-semibold leading-none tabular-nums text-ink">{value}</p>
        {note && <p className="mt-1.5 text-xs text-subtle">{note}</p>}
      </div>
    </Link>
  );
}

const LABEL_COLOURS = {
  fullyHalal: '#1F7A45',
  halalOptions: '#A8720F',
  unverified: '#6D766F',
  worthAsking: '#C3D0D2',
};

export default async function AdminOverview() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages, and this page reads people's messages.
  await requireAdmin();
  const now = new Date();
  const [waiting, inbox, messages, cat, traffic, week, pages, setupLeft, trip, cash] = await Promise.all([
    waitingCounts(),
    loadInbox(),
    messagesByDay(30),
    catalogue(),
    trafficByDay(30),
    totals(7),
    topPages(7, 6),
    setupOpenCount().catch(() => 0),
    journey(7),
    moneyGlance(),
  ]);

  // Everything that can wait on a person. The ones with something waiting
  // are cards; the rest are one line, so the numbers below stay in view.
  const jobs = [
    { href: '/admin/inbox', short: 'Inbox', count: waiting.messages, label: 'messages to answer', clear: 'No messages to answer', Icon: InboxIcon },
    {
      href: '/admin/queue',
      short: 'Check requests',
      count: waiting.checks,
      label: 'halal check requests',
      clear: 'No check requests',
      Icon: SealCheckIcon,
      urgent: waiting.overdue > 0 ? `${waiting.overdue} paid ${waiting.overdue === 1 ? 'check is' : 'checks are'} late` : null,
    },
    { href: '/admin/submissions', short: 'New restaurants', count: waiting.submissions, label: 'new restaurants to review', clear: 'No new restaurants', Icon: PlusIcon },
    { href: '/admin/duplicates', short: 'Duplicates', count: waiting.duplicates, label: 'possible duplicates', clear: 'No duplicates', Icon: ListIcon },
    { href: '/admin/claims', short: 'Ownership claims', count: waiting.claims, label: 'ownership claims', clear: 'No ownership claims', Icon: UserIcon },
    {
      href: '/admin/outreach',
      short: 'Outreach',
      count: waiting.outreach,
      label: 'things from owners to look at',
      clear: 'Nothing from outreach',
      Icon: MailIcon,
      urgent: waiting.outreachPaused
        ? 'Sending paused itself. Look before turning it back on'
        : waiting.takeDowns > 0
          ? `${waiting.takeDowns} ${waiting.takeDowns === 1 ? 'take-down' : 'take-downs'} owed (we promise 14 days)`
          : null,
    },
    { href: '/admin/founders', short: 'Founders', count: waiting.founders, label: 'Founder sign-ups to look at', clear: 'No Founder sign-ups', Icon: StarIcon },
    { href: '/admin/reels', short: 'Reels', count: waiting.reels, label: 'reels to watch', clear: 'No reels waiting', Icon: PlayIcon },
    { href: '/admin/deals', short: 'Deals', count: waiting.deals, label: 'deals stopped by reports', clear: 'No deals stopped', Icon: TicketIcon },
  ];
  const busy = jobs.filter((j) => j.count > 0);
  const calm = jobs.filter((j) => j.count === 0);
  const jobsWaiting = busy.reduce((n, j) => n + j.count, 0);
  const taps = trip ? trip.now.directions + trip.now.calls + trip.now.websites : null;
  const tapsBefore = trip ? trip.before.directions + trip.before.calls + trip.before.websites : null;

  const labels = cat.labels;
  const listed = labels.fullyHalal + labels.halalOptions + labels.unverified + labels.worthAsking;
  const segments = [
    { key: 'fullyHalal', name: 'Fully Halal', value: labels.fullyHalal },
    { key: 'halalOptions', name: 'Halal Options', value: labels.halalOptions },
    { key: 'unverified', name: 'Unverified', value: labels.unverified },
    { key: 'worthAsking', name: 'Worth asking', value: labels.worthAsking },
  ] as const;

  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });

  return (
    <AdminPage
      title={greeting(now)}
      width="xl"
      description={`${date}. What is waiting for you, then how the site is doing.`}
    >
      {setupLeft > 0 && (
        <Link
          href="/admin/setup"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-halal-partial/25 bg-halal-partialSoft px-4 py-3 text-sm text-halal-partialInk transition hover:border-halal-partial/50"
        >
          <GearIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{setupLeft} setup {setupLeft === 1 ? 'job' : 'jobs'} left</span> before every part of
            the site is switched on, such as sign-in emails and payments.
          </span>
          <ArrowRightIcon className="h-4 w-4 shrink-0" />
        </Link>
      )}

      <section aria-labelledby="waiting">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="waiting" className="font-display text-lg font-semibold text-ink">
            Needs you
          </h2>
          <p className="text-sm text-muted">
            {jobsWaiting === 0 ? 'All clear' : `${jobsWaiting.toLocaleString('en-GB')} ${jobsWaiting === 1 ? 'thing' : 'things'} waiting`}
          </p>
        </div>
        {busy.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {busy.map(({ short: _short, ...j }) => (
              <ActionCard key={j.href} {...j} />
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm text-ink shadow-sm">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-halal-fullSoft text-halal-fullInk">
              <CheckIcon className="h-[18px] w-[18px]" />
            </span>
            Nothing is waiting on you.
          </p>
        )}
        {busy.length > 0 && calm.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm text-muted">
            <CheckIcon className="h-4 w-4 text-halal-fullInk" />
            <span className="mr-1">Nothing waiting in</span>
            {calm.map((j) => (
              <Link key={j.href} href={j.href} className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-semibold text-ink/75 hover:border-ink/30">
                {j.short}
              </Link>
            ))}
          </p>
        )}
      </section>

      <h2 className="mb-3 mt-10 font-display text-lg font-semibold text-ink">This week</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Visitors"
          value={week?.visitors ?? null}
          previous={week?.previous.visitors}
          versus="on the week before"
          trend={traffic?.slice(-14).map((d) => d.visitors)}
          hint="Connect PostHog to see this"
        />
        <StatTile
          label="Searches"
          value={week?.searches ?? null}
          previous={week?.previous.searches}
          versus="on the week before"
          hint="Connect PostHog to see this"
        />
        <StatTile
          label="Restaurant pages opened"
          value={trip?.now.placePages ?? null}
          previous={trip?.before.placePages}
          versus="on the week before"
          hint="Connect PostHog to see this"
        />
        <StatTile
          label="Taps to go and eat"
          value={taps}
          previous={tapsBefore}
          versus="on the week before"
          hint="Directions, call or website"
        />
      </div>
      {trip && (
        <p className="mt-2 text-xs text-subtle">
          Taps to go and eat: {trip.now.directions.toLocaleString('en-GB')} directions, {trip.now.calls.toLocaleString('en-GB')} calls and{' '}
          {trip.now.websites.toLocaleString('en-GB')} website or menu.
        </p>
      )}

      <h2 className="mb-3 mt-10 font-display text-lg font-semibold text-ink">Money and the catalogue</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Figure
          label="Supporters"
          value={cash.supporters.toLocaleString('en-GB')}
          note={`About ${gbp(cash.supportPerMonth)} a month`}
          href="/admin/money"
        />
        <Figure
          label="Deal fees this month"
          value={gbp(cash.dealFeesThisMonth)}
          note={`${gbp(cash.dealCreditHeld)} of credit held for restaurants`}
          href="/admin/deals"
        />
        <Figure
          label="Places with a halal label"
          value={(labels.fullyHalal + labels.halalOptions + labels.unverified).toLocaleString('en-GB')}
          note={`${labels.fullyHalal.toLocaleString('en-GB')} Fully Halal, ${labels.halalOptions.toLocaleString('en-GB')} Halal Options`}
          href="/admin/restaurants"
        />
        <Figure label="Checked by us" value={cat.checkedByUs.toLocaleString('en-GB')} note="By phone, visit or certificate" href="/admin/verify" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card
          title="Visitors"
          note="Each day, the last 30 days"
          className="xl:col-span-3"
          action={<CardLink href="/admin/analytics">Analytics</CardLink>}
        >
          {traffic ? (
            <LineChart
              days={traffic.map((d) => d.day)}
              series={[
                { name: 'Visitors', color: SERIES.one, values: traffic.map((d) => d.visitors) },
                { name: 'Pages viewed', color: SERIES.two, values: traffic.map((d) => d.pageviews) },
              ]}
              label="Visitors and pages viewed each day, last 30 days"
            />
          ) : (
            <SetupCard
              title={posthogConfigured ? 'PostHog did not answer' : 'See your visitors here'}
              body={
                posthogConfigured
                  ? 'The key is set, but the last request failed. It tries again in a few minutes.'
                  : 'PostHog already counts visits. This page needs one read-only key to show them.'
              }
              footer={!posthogConfigured && <Link href="/admin/analytics#connect" className="font-semibold text-accent-ink hover:underline">How to connect it</Link>}
            />
          )}
        </Card>

        <Card
          title="Messages"
          note="Each day, by the address they came to"
          className="xl:col-span-2"
          action={<CardLink href="/admin/inbox">Inbox</CardLink>}
        >
          {messages.total > 0 ? (
            <StackedColumns
              days={messages.days}
              series={[
                { name: `${INBOX_LABEL.hello} (hello@)`, color: SERIES.one },
                { name: `${INBOX_LABEL.info} (info@)`, color: SERIES.two },
                { name: `${INBOX_LABEL.help} (help@)`, color: SERIES.three },
              ]}
              values={messages.counts.map((c) => [c.hello, c.info, c.help])}
              label="Messages each day for the last 30 days, by inbox"
            />
          ) : (
            <EmptyNote>Nothing has come in through the forms in the last 30 days.</EmptyNote>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card
          title="Latest messages"
          className="xl:col-span-3"
          action={<CardLink href="/admin/inbox?view=all">See all</CardLink>}
        >
          {inbox.items.length === 0 ? (
            <EmptyNote>Nothing yet. Feedback, restaurants and requests will show here as they arrive.</EmptyNote>
          ) : (
            <ul className="-mx-5 -mb-5 divide-y divide-line border-t border-line">
              {inbox.items.slice(0, 6).map((item) => (
                <MessageRow key={item.key} item={item} href={`/admin/inbox?view=all&open=${encodeURIComponent(item.key)}`} />
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Most viewed pages"
          note="The last 7 days"
          className="xl:col-span-2"
          action={pages && <CardLink href="/admin/analytics">More</CardLink>}
        >
          {pages ? (
            <BarList
              rows={pages.map((p) => ({ key: p.label, label: p.label, value: p.value }))}
              empty="No page views in the last 7 days."
              valueLabel="Views"
            />
          ) : (
            <EmptyNote>Shows once PostHog is connected.</EmptyNote>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="The catalogue" note="Everything search shows, by the label a visitor sees">
          <p className="text-[28px] font-semibold leading-none text-ink">
            {listed.toLocaleString('en-GB')} <span className="text-base font-normal text-muted">places</span>
          </p>
          <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Listings by label">
            {segments.map((s) =>
              s.value > 0 ? (
                <div key={s.key} style={{ flexGrow: s.value, background: LABEL_COLOURS[s.key] }} className="h-full first:rounded-l-full last:rounded-r-full" />
              ) : null
            )}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: LABEL_COLOURS[s.key] }} />
                <span className="min-w-0 flex-1 truncate text-ink/85">{s.name}</span>
                <span className="font-semibold tabular-nums text-ink">{s.value.toLocaleString('en-GB')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
            <span className="font-semibold text-ink">{cat.checkedByUs.toLocaleString('en-GB')}</span> checked by us in
            person or on the phone.{' '}
            <Link href="/admin/verify" className="font-semibold text-accent-ink hover:underline">
              What to check next
            </Link>
          </p>
        </Card>

        <Card title="People and restaurants" note="Everyone who has signed up for something">
          <div className="space-y-5">
            <Meter value={cat.founders.claimed} max={cat.founders.cap} label="Founders Club spots taken" />
            <ul className="grid grid-cols-3 gap-3">
              {(
                [
                  ['Supporters', cat.supporters, '/admin/money'],
                  ['Waiting for their area', cat.whereNext, '/admin/demand'],
                  ['Language requests', cat.languageRequests, '/admin/demand'],
                ] as const
              ).map(([label, value, href]) => (
                <li key={label}>
                  <Link href={href} className="block h-full rounded-xl bg-sand-soft p-3 transition hover:bg-sand">
                    <span className="block text-xl font-semibold text-ink">{value.toLocaleString('en-GB')}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </AdminPage>
  );
}
