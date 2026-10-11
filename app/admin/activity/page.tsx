import Link from 'next/link';
import clsx from 'clsx';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { adminCached } from '@/lib/admin/cache';
import { loadInbox } from '@/lib/admin/inbox';
import { AdminPage } from '@/components/admin/ui';
import { londonDay } from '@/lib/admin/stats';
import { longDay } from '@/lib/admin/format';
import { moneyExact } from '@/lib/deals/rules';
import { CoinsIcon, InboxIcon, ListIcon, MapIcon, ReplyIcon, SealCheckIcon, UserIcon, HeartHandIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activity' };

// One timeline of what has happened on the site, newest first: messages from
// the forms and the replies to them, checks we recorded, decisions on new
// restaurants, claims and Founders, duplicates settled, reels published, new
// supporters and every deal credit move. Built from the tables that already
// record each of these, so nothing extra is written to keep it.

type Kind = 'message' | 'reply' | 'check' | 'decision' | 'duplicate' | 'reel' | 'supporter' | 'money';

interface Event {
  at: string;
  kind: Kind;
  text: string;
  detail?: string;
  href?: string;
}

const ICON: Record<Kind, typeof InboxIcon> = {
  message: InboxIcon,
  reply: ReplyIcon,
  check: SealCheckIcon,
  decision: UserIcon,
  duplicate: ListIcon,
  reel: MapIcon,
  supporter: HeartHandIcon,
  money: CoinsIcon,
};

const TONE: Record<Kind, string> = {
  message: 'bg-spice-soft text-spice-ink',
  reply: 'bg-spice-soft text-spice-ink',
  check: 'bg-halal-fullSoft text-halal-fullInk',
  decision: 'bg-accent-soft text-accent-ink',
  duplicate: 'bg-black/[0.05] text-ink/70',
  reel: 'bg-black/[0.05] text-ink/70',
  supporter: 'bg-halal-partialSoft text-halal-partialInk',
  money: 'bg-halal-partialSoft text-halal-partialInk',
};

const OUTCOME: Record<string, string> = {
  fully_halal: 'Fully Halal',
  halal_options: 'Halal food available',
  unverified: "couldn't confirm",
  not_halal: 'told us not halal',
};

const LEDGER: Record<string, string> = {
  grant: 'Free credit given',
  topup: 'Credit bought',
  fee: 'Deal fee',
  refund: 'Refund',
  adjustment: 'Credit adjusted',
};

const DECISION: Record<string, string> = {
  approved: 'added',
  rejected: 'turned down',
  duplicate: 'already listed',
};

const N = 40;

const loadEvents = adminCached(
  async (): Promise<Event[]> => {
    const db = createAdminSupabase();
    const [inbox, checks, submissions, claims, founders, dupes, reels, subs, ledger] = await Promise.all([
      loadInbox(),
      db.from('verification_history').select('restaurant_id, classification_result, facts_snapshot, verified_at, restaurants(name)').order('verified_at', { ascending: false }).limit(N),
      db.from('restaurant_submissions').select('id, name, status, reviewed_at').not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(N),
      db.from('restaurant_ownership_claims').select('status, reviewed_at, restaurant_id, restaurants(name)').not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(N),
      db.from('founder_applications').select('business_name, status, reviewed_at').not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(N),
      db.from('catalogue_dedupe_candidates').select('status, reviewed_at').not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(N),
      db.from('restaurant_reels').select('restaurant_id, published_at, restaurants(name)').not('published_at', 'is', null).order('published_at', { ascending: false }).limit(N),
      db.from('subscriptions').select('plan, created_at').order('created_at', { ascending: false }).limit(N),
      db.from('deal_ledger').select('restaurant_id, kind, amount_pence, created_at, restaurants(name)').order('created_at', { ascending: false }).limit(N),
    ]);

    const events: Event[] = [];
    for (const item of inbox.items.slice(0, N)) {
      events.push({ at: item.createdAt, kind: 'message', text: item.title, detail: item.name ?? item.email ?? undefined, href: `/admin/inbox?view=all&open=${encodeURIComponent(item.key)}` });
      for (const r of item.replies) {
        events.push({ at: r.createdAt, kind: 'reply', text: `Answered: ${item.title}`, detail: r.channel === 'email' ? `Email to ${r.toAddress ?? 'them'}` : `By ${r.channel}`, href: `/admin/inbox?view=all&open=${encodeURIComponent(item.key)}` });
      }
    }
    type Named = { restaurants: { name: string } | null };
    for (const c of (checks.data ?? []) as unknown as ({ restaurant_id: string; classification_result: string; facts_snapshot: Record<string, unknown>; verified_at: string } & Named)[]) {
      const outcome = String(c.facts_snapshot?.outcome ?? c.classification_result);
      events.push({ at: c.verified_at, kind: 'check', text: `Checked ${c.restaurants?.name ?? 'a restaurant'}: ${OUTCOME[outcome] ?? outcome}`, href: `/admin/restaurants/${c.restaurant_id}` });
    }
    for (const s of (submissions.data ?? []) as { id: string; name: string; status: string; reviewed_at: string }[]) {
      events.push({ at: s.reviewed_at, kind: 'decision', text: `New restaurant ${DECISION[s.status] ?? s.status}: ${s.name}`, href: `/admin/submissions/${s.id}` });
    }
    for (const c of (claims.data ?? []) as unknown as ({ status: string; reviewed_at: string; restaurant_id: string } & Named)[]) {
      events.push({ at: c.reviewed_at, kind: 'decision', text: `Ownership claim ${c.status}: ${c.restaurants?.name ?? 'a restaurant'}`, href: `/admin/restaurants/${c.restaurant_id}` });
    }
    for (const f of (founders.data ?? []) as { business_name: string; status: string; reviewed_at: string }[]) {
      events.push({ at: f.reviewed_at, kind: 'decision', text: `Founder ${f.status}: ${f.business_name}`, href: '/admin/founders' });
    }
    for (const d of (dupes.data ?? []) as { status: string; reviewed_at: string }[]) {
      events.push({ at: d.reviewed_at, kind: 'duplicate', text: d.status === 'merged' ? 'Two listings merged into one' : 'Two listings kept as different places', href: '/admin/duplicates' });
    }
    for (const r of (reels.data ?? []) as unknown as ({ restaurant_id: string; published_at: string } & Named)[]) {
      events.push({ at: r.published_at, kind: 'reel', text: `Reel published for ${r.restaurants?.name ?? 'a restaurant'}`, href: '/admin/reels' });
    }
    for (const s of (subs.data ?? []) as { plan: string | null; created_at: string }[]) {
      events.push({ at: s.created_at, kind: 'supporter', text: `New supporter${s.plan ? `, ${s.plan === 'annual' ? 'yearly' : 'monthly'}` : ''}`, href: '/admin/money' });
    }
    for (const l of (ledger.data ?? []) as unknown as ({ restaurant_id: string; kind: string; amount_pence: number; created_at: string } & Named)[]) {
      events.push({ at: l.created_at, kind: 'money', text: `${LEDGER[l.kind] ?? l.kind}: ${moneyExact(l.amount_pence)}`, detail: l.restaurants?.name ?? undefined, href: `/admin/deals/${l.restaurant_id}` });
    }
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 120);
  },
  'activity-v1',
  60
);

export default async function AdminActivityPage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const events = await loadEvents();

  const days: { day: string; events: Event[] }[] = [];
  for (const e of events) {
    const day = londonDay(new Date(e.at));
    const last = days[days.length - 1];
    if (last?.day === day) last.events.push(e);
    else days.push({ day, events: [e] });
  }

  return (
    <AdminPage title="Activity" width="lg" description="Everything that has happened on the site, newest first: messages, replies, checks, decisions and money.">
      {days.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-5 py-12 text-center text-sm text-muted shadow-sm">
          Nothing has happened yet. Messages, checks and decisions will show here as they come.
        </p>
      ) : (
        <div className="space-y-6">
          {days.map(({ day, events: dayEvents }) => (
            <section key={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-subtle">{longDay(day)}</h2>
              <ol className="divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
                {dayEvents.map((e, i) => {
                  const Icon = ICON[e.kind];
                  const body = (
                    <>
                      <span className={clsx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full', TONE[e.kind])}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{e.text}</span>
                        {e.detail && <span className="block truncate text-xs text-muted">{e.detail}</span>}
                      </span>
                      <time dateTime={e.at} className="shrink-0 text-xs tabular-nums text-subtle">
                        {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
                      </time>
                    </>
                  );
                  return (
                    <li key={`${e.at}-${i}`}>
                      {e.href ? (
                        <Link href={e.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sand-soft/60">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
