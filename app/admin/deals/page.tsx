import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { dealsOverview } from '@/lib/deals/admin-data';
import { ledgerKind, signed, stateTag, when } from '@/lib/deals/admin-labels';
import { money, moneyExact } from '@/lib/deals/rules';
import { AdminPage, List, Panel, Row, Tag } from '@/components/admin/ui';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Deals and credit', robots: { index: false } };

// Every restaurant running a deal, the credit we hold for them, and what came
// in. All money moves through the deal_ledger table (0052), which nothing can
// edit or delete: these numbers are sums of it. A deal never touches a halal
// label or search rank, so nothing on this page can either.

export default async function DealsAdminPage() {
  await requireAdmin();
  const o = await dealsOverview();

  if (!o.ready) {
    return (
      <AdminPage tabs={<SectionTabs section="deals" current="/admin/deals" />} title="Deals and credit" width="xl" description="Restaurant deals, credit and fees.">
        <Panel>
          <p className="px-5 py-8 text-center text-sm text-muted">
            Deals are not switched on yet. The database change for them (0052) has not been added to the live site.
          </p>
        </Panel>
      </AdminPage>
    );
  }

  const t = o.totals;
  const paused = o.restaurants.filter((r) => r.state && r.state.state !== 'live' && r.state.state !== 'ended');
  const names = new Map(o.restaurants.map((r) => [r.id, r.name]));

  return (
    <AdminPage
      tabs={<SectionTabs section="deals" current="/admin/deals" />}
      title="Deals and credit"
      width="xl"
      description="Restaurant deals, the credit we hold for them, and the fees. A deal never changes a halal label or where a place shows in search."
    >
      <Panel>
        <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x [&>div]:border-b [&>div]:border-line sm:[&>div]:border-b-0">
          <Stat label="Credit we hold" value={moneyExact(t.creditHeld)} hint={`${money(t.welcomeGiven)} given free in total`} />
          <Stat label="Fees this month" value={moneyExact(t.feesThisMonth)} hint={`${moneyExact(t.feesAllTime)} all time`} />
          <Stat label="Paid in by card" value={moneyExact(t.paidIn)} hint="After refunds" />
          <Stat
            label="Uses, 30 days"
            value={String(t.uses30)}
            hint={`${t.newDiners30} new diners, ${t.reports30} report${t.reports30 === 1 ? '' : 's'}`}
          />
        </dl>
      </Panel>

      {paused.length > 0 && (
        <Panel title="Not running right now" className="mt-6">
          <List empty="">
            {paused.map((r) => {
              const tag = stateTag(r.state);
              return (
                <Row key={r.id}>
                  <Link href={`/admin/deals/${r.id}`} className="min-w-0 truncate font-medium text-ink hover:underline">
                    {r.name}
                  </Link>
                  <Tag tone={tag.tone}>{tag.label}</Tag>
                </Row>
              );
            })}
          </List>
        </Panel>
      )}

      <Panel title="Restaurants with a deal" className="mt-6">
        {o.restaurants.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No restaurant has started a deal yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 font-medium">Restaurant</th>
                  <th className="px-3 py-2.5 font-medium">State</th>
                  <th className="px-3 py-2.5 text-right font-medium">Credit</th>
                  <th className="px-3 py-2.5 text-right font-medium">Fees this month</th>
                  <th className="px-3 py-2.5 text-right font-medium">Uses, 30 days</th>
                  <th className="px-5 py-2.5 text-right font-medium">Reports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {o.restaurants.map((r) => {
                  const tag = stateTag(r.state);
                  return (
                    <tr key={r.id}>
                      <td className="max-w-[16rem] px-5 py-3">
                        <Link href={`/admin/deals/${r.id}`} className="block truncate font-medium text-ink hover:underline">
                          {r.name}
                        </Link>
                        {r.state?.deal && <span className="block truncate text-xs text-muted">{r.state.deal.title}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Tag tone={tag.tone}>{tag.label}</Tag>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.state ? moneyExact(r.state.balance_pence) : '?'}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.state ? `${moneyExact(r.state.month_fees_pence)} of ${money(r.state.cap_pence)}` : '?'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.uses30}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {r.reports30 > 0 ? <Tag tone="warn">{r.reports30}</Tag> : <span className="text-subtle">0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Latest reports">
          <List empty="No diner has reported a problem.">
            {o.reports.map((r) => (
              <Row key={r.code} className="items-start">
                <div className="min-w-0">
                  <Link href={`/admin/deals/${r.restaurant_id}`} className="block truncate font-medium text-ink hover:underline">
                    {names.get(r.restaurant_id) ?? 'Restaurant'}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    Code {r.code}, {when(r.reported_at)}
                  </p>
                  {r.report_note && <p className="mt-1 text-sm text-ink/80">&ldquo;{r.report_note}&rdquo;</p>}
                </div>
              </Row>
            ))}
          </List>
        </Panel>

        <Panel title="Latest money moves">
          <List empty="Nothing yet.">
            {o.recent.map((l) => (
              <Row key={l.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{names.get(l.restaurant_id) ?? 'Restaurant'}</p>
                  <p className="text-xs text-muted">
                    {ledgerKind(l)}, {when(l.created_at)}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${l.amount_pence > 0 ? 'text-halal-fullInk' : 'text-ink'}`}>
                  {signed(l.amount_pence, moneyExact)}
                </span>
              </Row>
            ))}
          </List>
        </Panel>
      </div>
    </AdminPage>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{value}</dd>
      <dd className="mt-0.5 text-xs text-subtle">{hint}</dd>
    </div>
  );
}
