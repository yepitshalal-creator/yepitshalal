import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { adminCached } from '@/lib/admin/cache';
import { AdminPage, Panel, List, Row, Tag, SubscriptionStatusTag } from '@/components/admin/ui';
import { Card, CardLink } from '@/components/admin/dashboard';
import { ArrowUpRightIcon, CheckIcon, WarningIcon } from '@/components/icons';
import { SUPPORTER_PRICES } from '@/lib/supporterPricing';
import { supporterPaymentsReady } from '@/lib/supporterReadiness';
import { readyTopups } from '@/lib/deals/topups';
import { dealsOverview } from '@/lib/deals/admin-data';
import { moneyExact } from '@/lib/deals/rules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Money' };

// Every way money reaches YepItsHalal, on one page: supporters (Yep+), deal
// credit and fees, and paid priority checks. None of it is a paywall: search
// and every halal label stay free (the standing rule). The numbers come from
// our own database, which Stripe's webhook keeps up to date; Stripe itself
// stays the record of what was actually charged.

interface SubscriptionRow {
  id: string;
  status: string;
  plan: string | null;
  current_period_end: string | null;
  created_at: string;
  users: { email: string } | null;
}

const loadMoney = adminCached(
  async () => {
    const db = createAdminSupabase();
    const [subs, priority, refunds] = await Promise.all([
      db
        .from('subscriptions')
        .select('id, status, plan, current_period_end, created_at, users(email)')
        .order('created_at', { ascending: false }),
      db
        .from('verification_requests')
        .select('id', { count: 'exact', head: true })
        .eq('queue_type', 'priority')
        .not('stripe_payment_id', 'is', null),
      db
        .from('verification_requests')
        .select('id', { count: 'exact', head: true })
        .eq('queue_type', 'priority')
        .not('refund_status', 'is', null),
    ]);
    return {
      subscriptions: (subs.data ?? []) as unknown as SubscriptionRow[],
      priorityPaid: priority.count ?? 0,
      priorityRefunded: refunds.count ?? 0,
    };
  },
  'money-v1',
  300
);

function Ready({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <li className="flex items-start gap-2.5 px-5 py-3 text-sm">
      {ok ? (
        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-halal-fullInk" />
      ) : (
        <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-halal-partialInk" />
      )}
      <span className={ok ? 'text-ink/80' : 'text-ink'}>{ok ? yes : no}</span>
    </li>
  );
}

function Big({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-ink">{value}</p>
      {note && <p className="mt-2 text-xs text-subtle">{note}</p>}
    </div>
  );
}

export default async function AdminMoneyPage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const [m, deals, yepPlusReady, topups] = await Promise.all([
    loadMoney(),
    dealsOverview(),
    supporterPaymentsReady().catch(() => false),
    readyTopups().catch(() => [] as number[]),
  ]);

  const active = m.subscriptions.filter((s) => s.status === 'active');
  const monthly = active.filter((s) => s.plan === 'monthly').length;
  const annual = active.filter((s) => s.plan === 'annual').length;
  // What active supporters bring in a month, at the advertised prices. An
  // estimate: Stripe's own numbers win if they ever differ.
  const perMonth = monthly * SUPPORTER_PRICES.monthly.amount + Math.round((annual * SUPPORTER_PRICES.annual.amount) / 12);
  const t = deals.totals;

  return (
    <AdminPage
      title="Money"
      width="xl"
      description="Supporters, restaurant deal credit and paid checks, in one place. Search and every halal label stay free."
      action={
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink/30"
        >
          Stripe
          <ArrowUpRightIcon className="h-4 w-4" />
        </a>
      }
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Big label="Supporters" value={active.length.toLocaleString('en-GB')} note={`${monthly} monthly, ${annual} yearly`} />
        <Big label="Support a month" value={moneyExact(perMonth)} note="At the advertised prices" />
        <Big label="Deal fees this month" value={moneyExact(deals.ready ? t.feesThisMonth : 0)} note={deals.ready ? `${moneyExact(t.feesAllTime)} all time` : 'Deals are not switched on'} />
        <Big label="Deal credit we hold" value={moneyExact(deals.ready ? t.creditHeld : 0)} note="Owed to restaurants until spent" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel title="Supporters" action={<Tag>{m.subscriptions.length} in all</Tag>}>
            <List empty="Nobody has signed up to support the site yet.">
              {m.subscriptions.map((s) => (
                <Row key={s.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{s.users?.email ?? 'Unknown account'}</p>
                    <p className="truncate text-xs text-muted">
                      {s.plan === 'annual' ? 'Yearly' : s.plan === 'monthly' ? 'Monthly' : 'No plan'}
                      {s.current_period_end && ` · paid until ${new Date(s.current_period_end).toLocaleDateString('en-GB')}`}
                    </p>
                  </div>
                  <SubscriptionStatusTag status={s.status} />
                </Row>
              ))}
            </List>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Can people pay yet?" action={<Link href="/admin/setup" className="text-xs font-semibold text-accent-ink hover:underline">Setup</Link>}>
            <ul className="divide-y divide-line">
              <Ready
                ok={yepPlusReady}
                yes={`Yep+ is on: ${SUPPORTER_PRICES.monthly.label} a month and ${SUPPORTER_PRICES.annual.label} a year.`}
                no="Yep+ is off until Stripe has the £2.99 and £24 prices. Nobody can be charged the wrong amount."
              />
              <Ready
                ok={topups.length === 2}
                yes="Restaurants can top up deal credit by card."
                no={`Card top ups are off (${topups.length} of 2 packs ready). The free £10 still works.`}
              />
            </ul>
          </Panel>

          <Card title="Paid priority checks" note="Restaurants that paid to jump the queue">
            <p className="text-[28px] font-semibold leading-none tabular-nums text-ink">{m.priorityPaid}</p>
            <p className="mt-2 text-xs text-subtle">
              {m.priorityRefunded > 0 ? `${m.priorityRefunded} refunded` : 'None refunded'}
            </p>
            <div className="mt-3">
              <CardLink href="/admin/queue">Check requests</CardLink>
            </div>
          </Card>

          <Card title="Deals and credit" note="Paid in, fees and refunds">
            <p className="text-sm text-ink/85">
              {deals.ready
                ? `${moneyExact(t.paidIn)} paid in by card after refunds. ${t.uses30} uses in the last 30 days.`
                : 'Deals are not switched on yet.'}
            </p>
            <div className="mt-3">
              <CardLink href="/admin/deals">Deals and credit</CardLink>
            </div>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
