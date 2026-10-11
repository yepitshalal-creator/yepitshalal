import { dealsDb } from '@/lib/deals/db';
import type { DealState } from './rules';

/**
 * The numbers behind /admin/deals. Read with the service role, every page of
 * the ledger and of the last 30 days' claims. Fine at the size Deals starts
 * at; when the ledger runs to tens of thousands of rows these sums belong in
 * a database view.
 */

export interface LedgerRow {
  id: number;
  restaurant_id: string;
  kind: 'grant' | 'topup' | 'fee' | 'refund' | 'adjustment';
  amount_pence: number;
  reference: string;
  claim_id: string | null;
  note: string | null;
  created_at: string;
}

export interface DealsOverview {
  ready: boolean;
  totals: {
    creditHeld: number;
    feesThisMonth: number;
    feesAllTime: number;
    paidIn: number;
    welcomeGiven: number;
    uses30: number;
    newDiners30: number;
    reports30: number;
  };
  restaurants: {
    id: string;
    name: string;
    slug: string;
    state: DealState | null;
    uses30: number;
    reports30: number;
  }[];
  reports: { code: string; restaurant_id: string; reported_at: string; report_note: string | null }[];
  recent: LedgerRow[];
}

export function londonMonthStart(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  // Midnight on the 1st in London, which is 23:00 or 00:00 UTC.
  const utcGuess = new Date(Date.UTC(y, m - 1, 1));
  const londonHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(utcGuess)
  );
  return new Date(utcGuess.getTime() - (londonHour % 24) * 3_600_000);
}

const isFeeBack = (l: LedgerRow) => l.kind === 'adjustment' && !!l.claim_id;

/**
 * Every row a query returns, a page at a time. The API answers at most 1,000
 * rows a request whatever the limit says, so one read would quietly drop the
 * rest and the totals would be short. `page` must ask for a stable order.
 */
async function everyRow<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  const SIZE = 1000;
  const out: T[] = [];
  for (let from = 0; from < 200 * SIZE; from += SIZE) {
    const { data, error } = await page(from, from + SIZE - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if ((data ?? []).length < SIZE) break;
  }
  return { data: out, error: null };
}

export async function dealsOverview(): Promise<DealsOverview> {
  const db = dealsDb();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [ledgerRes, dealsRes, claimsRes, reportsRes] = await Promise.all([
    everyRow<LedgerRow>((from, to) => db.from('deal_ledger').select('*').order('id', { ascending: false }).range(from, to)),
    db.from('deals').select('restaurant_id, status, ended_at').order('created_at', { ascending: false }),
    everyRow<{ restaurant_id: string; status: string; fee_kind: string | null; reported_at: string | null }>((from, to) =>
      db
        .from('deal_claims')
        .select('restaurant_id, status, fee_kind, reported_at')
        .gte('created_at', since30)
        .order('id')
        .range(from, to)
    ),
    db
      .from('deal_claims')
      .select('code, restaurant_id, reported_at, report_note')
      .not('reported_at', 'is', null)
      .order('reported_at', { ascending: false })
      .limit(10),
  ]);

  const empty: DealsOverview = {
    ready: false,
    totals: { creditHeld: 0, feesThisMonth: 0, feesAllTime: 0, paidIn: 0, welcomeGiven: 0, uses30: 0, newDiners30: 0, reports30: 0 },
    restaurants: [],
    reports: [],
    recent: [],
  };
  if (ledgerRes.error || dealsRes.error) return empty;

  const ledger = ledgerRes.data;
  const monthStart = londonMonthStart().getTime();
  const fees = (rows: LedgerRow[]) =>
    -rows.filter((l) => l.kind === 'fee').reduce((a, l) => a + l.amount_pence, 0) -
    rows.filter(isFeeBack).reduce((a, l) => a + l.amount_pence, 0);
  const thisMonth = ledger.filter((l) => new Date(l.created_at).getTime() >= monthStart);

  const claims = claimsRes.data ?? [];
  const ids = [...new Set((dealsRes.data ?? []).map((d) => d.restaurant_id as string))];
  const names = ids.length
    ? (await db.from('restaurants').select('id, name, slug, branch_label').in('id', ids)).data ?? []
    : [];
  const states = await Promise.all(
    ids.map(async (id) => {
      const { data } = await db.rpc('deal_state', { p_restaurant_id: id });
      return [id, (data as DealState | null) ?? null] as const;
    })
  );
  const stateOf = new Map(states);

  return {
    ready: true,
    totals: {
      creditHeld: ledger.reduce((a, l) => a + l.amount_pence, 0),
      feesThisMonth: fees(thisMonth),
      feesAllTime: fees(ledger),
      paidIn:
        ledger.filter((l) => l.kind === 'topup').reduce((a, l) => a + l.amount_pence, 0) +
        ledger.filter((l) => l.kind === 'refund').reduce((a, l) => a + l.amount_pence, 0),
      welcomeGiven: ledger.filter((l) => l.kind === 'grant').reduce((a, l) => a + l.amount_pence, 0),
      uses30: claims.filter((c) => c.status === 'redeemed').length,
      newDiners30: claims.filter((c) => c.fee_kind === 'new').length,
      reports30: claims.filter((c) => c.reported_at).length,
    },
    restaurants: ids
      .map((id) => {
        const r = names.find((n) => n.id === id);
        return {
          id,
          name: r ? (r.branch_label ? `${r.name}, ${r.branch_label}` : r.name) : 'Unknown restaurant',
          slug: r?.slug ?? '',
          state: stateOf.get(id) ?? null,
          uses30: claims.filter((c) => c.restaurant_id === id && c.status === 'redeemed').length,
          reports30: claims.filter((c) => c.restaurant_id === id && c.reported_at).length,
        };
      })
      .sort((a, b) => b.uses30 - a.uses30 || a.name.localeCompare(b.name)),
    reports: (reportsRes.data ?? []) as DealsOverview['reports'],
    recent: ledger.slice(0, 25),
  };
}
