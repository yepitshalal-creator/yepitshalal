import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { adminCached } from '@/lib/admin/cache';
import { AdminPage, Panel, Tag } from '@/components/admin/ui';
import { InfoIcon } from '@/components/icons';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Coverage' };

interface Counts {
  total: number;
  listed: number;
  fully_halal: number;
  halal_options: number;
  unverified: number;
  not_checked: number;
  no_evidence: number;
}

interface DistrictRow extends Counts {
  district: string;
  outward: string;
  needs_review: number;
  closed: number;
  chain_branches: number;
}

interface BoroughRow extends Counts {
  borough: string;
}

// Rough compass grouping of London postcode districts, so a gap reads as
// "we have almost nothing in the centre" rather than as a list of codes.
const REGION: Record<string, string> = {
  EC: 'Central', WC: 'Central',
  E: 'East', IG: 'East', RM: 'East',
  N: 'North', NW: 'North', EN: 'North',
  SE: 'South', SW: 'South', CR: 'South', BR: 'South', DA: 'South', SM: 'South', KT: 'South',
  W: 'West', UB: 'West', HA: 'West', TW: 'West',
};

// Fewer listed places than this in a borough is flagged as thin.
const THIN_BOROUGH = 25;

function sum<T extends Counts>(rows: T[]): Counts {
  return rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      listed: a.listed + r.listed,
      fully_halal: a.fully_halal + r.fully_halal,
      halal_options: a.halal_options + r.halal_options,
      unverified: a.unverified + r.unverified,
      not_checked: a.not_checked + r.not_checked,
      no_evidence: a.no_evidence + r.no_evidence,
    }),
    { total: 0, listed: 0, fully_halal: 0, halal_options: 0, unverified: 0, not_checked: 0, no_evidence: 0 }
  );
}

function LabelCells({ r }: { r: Counts }) {
  return (
    <>
      <td className="px-3 py-2.5 font-medium tabular-nums text-ink">{r.listed}</td>
      <td className="px-3 py-2.5 tabular-nums text-halal-fullInk">{r.fully_halal}</td>
      <td className="px-3 py-2.5 tabular-nums text-halal-partialInk">{r.halal_options}</td>
      <td className="px-3 py-2.5 tabular-nums text-muted">{r.unverified}</td>
      <td className="px-3 py-2.5 tabular-nums text-muted">{r.not_checked}</td>
      <td className="px-3 py-2.5 tabular-nums text-subtle">{r.no_evidence}</td>
    </>
  );
}

const HEAD = 'px-3 py-2.5 font-medium';

// Three views over the whole catalogue, kept ten minutes.
const loadCoverage = adminCached(
  async (month: string) => {
    const supabase = createAdminSupabase();
    const [districts, boroughs, votes] = await Promise.all([
      supabase.from('catalogue_coverage').select('*'),
      supabase.from('catalogue_borough_coverage').select('*').order('listed', { ascending: false }),
      supabase.from('area_votes').select('borough').eq('month', month),
    ]);
    return { districtData: districts.data, boroughData: boroughs.data, voteData: votes.data };
  },
  'coverage-v1',
  600
);

export default async function AdminCoveragePage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const month = monthStart.toISOString().slice(0, 10);

  const { districtData, boroughData, voteData } = await loadCoverage(month);

  // What supporters asked for this month. Votes are one per person and can be
  // changed until the month ends, so this is a live standing, not a result.
  const voteTally = new Map<string, number>();
  for (const v of (voteData ?? []) as { borough: string }[]) {
    voteTally.set(v.borough, (voteTally.get(v.borough) ?? 0) + 1);
  }
  const votes = [...voteTally.entries()].sort((a, b) => b[1] - a[1]);

  const boroughs = (boroughData ?? []) as BoroughRow[];

  const byDistrict = new Map<string, DistrictRow>();
  for (const r of (districtData ?? []) as DistrictRow[]) {
    const cur = byDistrict.get(r.district);
    byDistrict.set(
      r.district,
      cur
        ? {
            ...cur,
            ...sum([cur, r]),
            needs_review: cur.needs_review + r.needs_review,
            closed: cur.closed + r.closed,
            chain_branches: cur.chain_branches + r.chain_branches,
          }
        : { ...r }
    );
  }
  const districts = [...byDistrict.values()].sort((a, b) => b.listed - a.listed);
  const totals = sum(boroughs);

  const byRegion = new Map<string, number>();
  for (const d of districts) {
    const region = REGION[d.district] ?? 'Other';
    byRegion.set(region, (byRegion.get(region) ?? 0) + d.listed);
  }

  return (
    <AdminPage
      tabs={<SectionTabs section="restaurants" current="/admin/coverage" />}
      title="Coverage"
      width="lg"
      description={`${(totals.listed + totals.not_checked).toLocaleString()} places in search (${totals.listed.toLocaleString()} with evidence), out of ${totals.total.toLocaleString()} records. Use it to see where the gaps are before looking for more places.`}
    >
      <div className="space-y-5">
        <Panel
          title="Supporters' vote this month"
          action={<Tag>{(voteData ?? []).length} {(voteData ?? []).length === 1 ? 'vote' : 'votes'}</Tag>}
        >
          {votes.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">
              No votes yet this month. Supporters vote from their account page.
            </p>
          ) : (
            <ol className="divide-y divide-line">
              {votes.map(([borough, n], i) => {
                const b = boroughs.find((r) => r.borough === borough);
                return (
                  <li key={borough} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm">
                    <span className={i === 0 ? 'font-semibold text-ink' : 'text-ink/80'}>
                      {i + 1}. {borough}
                    </span>
                    <span className="tabular-nums text-muted">{n} {n === 1 ? 'vote' : 'votes'}</span>
                    {b && (
                      <span className="ml-auto text-xs text-subtle">
                        {b.not_checked.toLocaleString()} not checked yet · {b.listed.toLocaleString()} with evidence
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel title="In search, by label">
          <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-5">
            {[
              ['Fully Halal', totals.fully_halal],
              ['Halal Options', totals.halal_options],
              ['Unverified', totals.unverified],
              ['Worth asking', totals.not_checked],
              ['Hidden', totals.no_evidence],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl border border-line px-3.5 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
                <p className="mt-0.5 font-display text-xl font-semibold text-ink">{Number(n).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="By region">
          <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-3">
            {['Central', 'East', 'North', 'South', 'West', 'Other'].map((region) => {
              const n = byRegion.get(region) ?? 0;
              return (
                <div key={region} className="rounded-xl border border-line px-3.5 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-subtle">{region}</p>
                  <p className="mt-0.5 font-display text-xl font-semibold text-ink">{n}</p>
                  {n < totals.listed * 0.05 && (
                    <p className="mt-1 text-[11px] font-medium text-halal-partialInk">Thin coverage</p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="By borough" action={<Tag>{boroughs.length}</Tag>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-5 py-2.5 font-medium">Borough</th>
                  <th className={HEAD}>Listed</th>
                  <th className={HEAD}>Fully Halal</th>
                  <th className={HEAD}>Options</th>
                  <th className={HEAD}>Unverified</th>
                  <th className={HEAD}>Not checked</th>
                  <th className={HEAD}>Hidden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {boroughs.map((b) => (
                  <tr key={b.borough}>
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-ink">{b.borough}</span>
                      {b.listed < THIN_BOROUGH && (
                        <span className="ml-2 text-[11px] font-medium text-halal-partialInk">Thin</span>
                      )}
                    </td>
                    <LabelCells r={b} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="By postcode district" action={<Tag>{districts.length}</Tag>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="px-5 py-2.5 font-medium">District</th>
                  <th className={HEAD}>Listed</th>
                  <th className={HEAD}>Fully Halal</th>
                  <th className={HEAD}>Options</th>
                  <th className={HEAD}>Unverified</th>
                  <th className={HEAD}>Not checked</th>
                  <th className={HEAD}>Hidden</th>
                  <th className={HEAD}>Needs review</th>
                  <th className={HEAD}>Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {districts.map((d) => (
                  <tr key={d.district}>
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-ink">{d.district}</span>
                      <span className="ml-2 text-xs text-subtle">{REGION[d.district] ?? 'Other'}</span>
                    </td>
                    <LabelCells r={d} />
                    <td className="px-3 py-2.5 tabular-nums text-muted">{d.needs_review}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">{d.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
          Listed means shown in search with at least some evidence of halal food. Not checked counts
          places shown as Worth asking. Hidden counts active records we hold but do not show. Districts come
          from each record&apos;s postcode, so records without one group under ??.
        </p>
      </div>
    </AdminPage>
  );
}
