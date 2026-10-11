import { cache } from 'react';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { adminCached } from './cache';
import { FOUNDERS_CAP } from '@/lib/founders';
import type { Inbox } from '@/lib/site';
import { loadInbox, statusOf } from './inbox';
import { SUPPORTER_PRICES } from '@/lib/supporterPricing';
import { dealsOverview } from '@/lib/deals/admin-data';

// The admin's own numbers, from the database: what is waiting on somebody,
// and the shape of the catalogue. Head-only counts, so nothing but the number
// crosses the wire.

export interface Waiting {
  messages: number;
  submissions: number;
  checks: number;
  claims: number;
  /** Deals paused by diners' reports, which only an admin can restart. */
  deals: number;
  /** Pairs of records that may be one restaurant (scripts/find-duplicates.mjs). */
  duplicates: number;
  /** Founder and standard sign-ups nobody has looked at yet. */
  founders: number;
  /** Owners' reels waiting to be watched before they go live. */
  reels: number;
  /** Paid priority checks past the time we promised. */
  overdue: number;
}

/** What is waiting on a person. The sidebar badges and the overview's first row.
 *  Asked on every admin page, so kept for 30 seconds: a new message from a
 *  form shows within half a minute, and your own changes at once. */
export const waitingCounts = cache(adminCached(async (): Promise<Waiting> => {
  const db = createAdminSupabase();
  const open = ['awaiting_slot', 'queued', 'in_review', 'pending_qc'];
  const [inbox, submissions, checks, claims, deals, duplicates, founders, reels, overdue] = await Promise.all([
    loadInbox(),
    db.from('restaurant_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db
      .from('verification_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', open),
    db.from('restaurant_ownership_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'paused').eq('paused_reason', 'reports'),
    db.from('catalogue_dedupe_candidates').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('founder_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('restaurant_reels').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    db
      .from('verification_requests')
      .select('id', { count: 'exact', head: true })
      .eq('queue_type', 'priority')
      .in('status', open)
      .lt('sla_due_at', new Date().toISOString()),
  ]);
  return {
    messages: inbox.items.filter((i) => statusOf(i) === 'to_answer').length,
    submissions: submissions.count ?? 0,
    checks: checks.count ?? 0,
    claims: claims.count ?? 0,
    deals: deals.count ?? 0,
    duplicates: duplicates.count ?? 0,
    founders: founders.count ?? 0,
    reels: reels.count ?? 0,
    overdue: overdue.count ?? 0,
  };
}, 'waiting-v2', 30));

export interface Catalogue {
  /** The four labels a visitor can see, in the order the site shows them. */
  labels: { fullyHalal: number; halalOptions: number; unverified: number; worthAsking: number };
  checkedByUs: number;
  founders: { claimed: number; cap: number };
  supporters: number;
  whereNext: number;
  languageRequests: number;
}

/** Nine counts over the whole catalogue, kept ten minutes. */
export const catalogue = adminCached(async (): Promise<Catalogue> => {
  const db = createAdminSupabase();
  // Everything search can show (is_searchable, migration 0031). It counted
  // is_listed until 2026-10-10, which leaves out every Worth asking place:
  // the card said 0 of those while search showed about 9,600.
  const listed = () =>
    db.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_searchable', true);

  // A listing with no evidence at all shows as "Worth asking" whatever its
  // stored classification says (statusOf in lib/types.ts), so the three
  // evidence labels only count places that have evidence.
  const [full, options, unverified, worthAsking, checked, founders, supporters, whereNext, languages] =
    await Promise.all([
      listed().not('halal_evidence_strength', 'is', null).eq('halal_classification', 'fully_halal'),
      listed().not('halal_evidence_strength', 'is', null).eq('halal_classification', 'halal_options'),
      listed().not('halal_evidence_strength', 'is', null).eq('halal_classification', 'unverified'),
      listed().is('halal_evidence_strength', null),
      listed().eq('checked_by_us', true),
      db
        .from('founder_applications')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'founder')
        .neq('status', 'rejected'),
      db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('language_requests').select('id', { count: 'exact', head: true }),
    ]);

  return {
    labels: {
      fullyHalal: full.count ?? 0,
      halalOptions: options.count ?? 0,
      unverified: unverified.count ?? 0,
      worthAsking: worthAsking.count ?? 0,
    },
    checkedByUs: checked.count ?? 0,
    founders: { claimed: founders.count ?? 0, cap: FOUNDERS_CAP },
    supporters: supporters.count ?? 0,
    whereNext: whereNext.count ?? 0,
    languageRequests: languages.count ?? 0,
  };
}, 'catalogue-stats-v1', 600);

/** A calendar day in London, as YYYY-MM-DD, so a message at 00:30 BST lands on the right day. */
export function londonDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(date);
}

export function lastDays(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) out.push(londonDay(new Date(now - i * 86_400_000)));
  return out;
}

export interface MessagesByDay {
  days: string[];
  /** Per day, per address: General (hello@), Business (info@), Support (help@). */
  counts: Record<Inbox, number>[];
  total: number;
  previousTotal: number;
}

/** Messages that arrived each day, split by the address they went to. */
export async function messagesByDay(days: number): Promise<MessagesByDay> {
  const { items } = await loadInbox();
  const range = lastDays(days);
  const index = new Map(range.map((d, i) => [d, i]));
  const counts = range.map(() => ({ hello: 0, info: 0, help: 0 }));
  const start = Date.now() - days * 86_400_000;
  let previousTotal = 0;
  for (const item of items) {
    const at = new Date(item.createdAt);
    const i = index.get(londonDay(at));
    if (i !== undefined) counts[i][item.inbox]++;
    else if (at.getTime() < start && at.getTime() >= start - days * 86_400_000) previousTotal++;
  }
  const total = counts.reduce((sum, c) => sum + c.hello + c.info + c.help, 0);
  return { days: range, counts, total, previousTotal };
}

export interface MoneyGlance {
  supporters: number;
  /** What active supporters bring in a month at the advertised prices, in pence. */
  supportPerMonth: number;
  dealFeesThisMonth: number;
  dealCreditHeld: number;
}

/** The money row on the overview, kept five minutes. An estimate from our
 *  own records, which Stripe's webhook keeps; Stripe is the record of what
 *  was actually charged. */
export const moneyGlance = adminCached(async (): Promise<MoneyGlance> => {
  const [subs, deals] = await Promise.all([
    createAdminSupabase().from('subscriptions').select('plan').eq('status', 'active'),
    dealsOverview().catch(() => null),
  ]);
  const plans = (subs.data ?? []) as { plan: string | null }[];
  const monthly = plans.filter((p) => p.plan === 'monthly').length;
  const annual = plans.filter((p) => p.plan === 'annual').length;
  return {
    supporters: plans.length,
    supportPerMonth: monthly * SUPPORTER_PRICES.monthly.amount + Math.round((annual * SUPPORTER_PRICES.annual.amount) / 12),
    dealFeesThisMonth: deals?.totals.feesThisMonth ?? 0,
    dealCreditHeld: deals?.totals.creditHeld ?? 0,
  };
}, 'money-glance-v1', 300);
