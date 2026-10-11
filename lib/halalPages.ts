import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { cleanRestaurantName } from './restaurantName';
import type { EvidenceStrength, HalalClassification, HalalStatus } from './types';

// The "Is it halal?" pages: one for every place in search, one for every chain
// with two or more branches we know of, and an index of chains.
//
// Since 2026-10-11 search holds only places with halal evidence (is_listed).
// Shabir took the rest, once shown as Worth asking, off search, the map and
// Google that day. A chain still counts those branches in its answer, as "no
// halal information", so it is never called halal from the few branches with
// evidence; their pages are gone, so they are counted, not linked.
//
// Shabir, 2026-09-24: "for every restaurant page we have i want you to have
// dedicated SEO pages just so that when people search if a place is halal or
// similar they come straight to US. bear in mind this all for the future ones
// we add too." So nothing here is a list anybody maintains: every page is built
// from the database on request, and the sitemap is rebuilt from it every hour,
// so a place added tomorrow has its page the moment it is in search.
//
// They say exactly what the restaurant page says, in the same words
// (halalAnswerFor, HalalEvidencePanel): a page written to be found must never
// claim more than the one written to be read.

// Public and identical for every visitor: a cookieless anonymous client.
function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

/** Two or more branches in search, or a chain page has nothing to compare. */
export const MIN_CHAIN_BRANCHES = 2;

/** A place's name as a page shows it: the chain's name and the branch, or its own. */
export function placeTitle(r: { name: string; brandName: string | null; branchLabel: string | null }): string {
  const base = cleanRestaurantName(r.brandName ?? r.name);
  return r.branchLabel ? `${base}, ${r.branchLabel}` : base;
}

/**
 * The one-line reason for a label, as shown. The database writes it from the
 * kind of evidence ("The restaurant's website mentions halal food"), which is
 * not true of a branch whose evidence is its chain's statement: there it was
 * the chain's website that said it. Evidence arrives strongest first.
 */
export function summaryFor(summary: string | null, evidence: { source_name: string; claim: string }[]): string | null {
  const lead = evidence.find((e) => e.claim !== 'not_halal');
  if (summary && lead?.source_name === "The chain's website") return summary.replace(/^The restaurant's website/, "The chain's website");
  return summary;
}

/** A label from evidence, 'unknown' for a place in the catalogue with none, or nothing. */
export function statusFor(r: { isListed: boolean; isSearchable: boolean; halal_classification: HalalClassification }): HalalStatus | null {
  if (r.isListed) return r.halal_classification;
  if (r.isSearchable) return 'unknown';
  return null;
}

export interface Branch {
  id: string;
  name: string;
  slug: string;
  branch_label: string | null;
  borough: string | null;
  address: string;
  postcode: string | null;
  status: HalalStatus;
  halal_evidence_strength: EvidenceStrength | null;
}

const BRANCH_COLUMNS = 'id, name, slug, branch_label, borough, address, postcode, halal_classification, halal_evidence_strength, is_listed, is_searchable';

type BranchRow = {
  id: string;
  name: string;
  slug: string;
  branch_label: string | null;
  borough: string | null;
  address: string;
  postcode: string | null;
  halal_classification: HalalClassification;
  halal_evidence_strength: EvidenceStrength | null;
  is_listed: boolean;
  is_searchable: boolean;
};

function toBranch(r: BranchRow): Branch {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    branch_label: r.branch_label,
    borough: r.borough,
    address: r.address,
    postcode: r.postcode,
    status: statusFor({ isListed: r.is_listed, isSearchable: r.is_searchable, halal_classification: r.halal_classification }) ?? 'unknown',
    halal_evidence_strength: r.halal_evidence_strength,
  };
}

/** The branches of a chain that are in search, strongest evidence first. */
export const getBranches = cache(async function getBranches(brandId: string): Promise<Branch[]> {
  const { data } = await publicClient()
    .from('restaurants')
    .select(BRANCH_COLUMNS)
    .eq('brand_id', brandId)
    .eq('is_searchable', true)
    .order('borough')
    .limit(500);
  const order: Record<HalalStatus, number> = { fully_halal: 0, halal_options: 1, unverified: 2, unknown: 3 };
  return ((data ?? []) as BranchRow[]).map(toBranch).sort((a, b) => order[a.status] - order[b.status] || (a.borough ?? '').localeCompare(b.borough ?? ''));
});

export interface Chain {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
  branches: Branch[];
  /** What the chain itself says, as quoted on its branches' evidence, if anything. */
  statement: { excerpt: string; source_url: string | null; checked_at: string } | null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export const getChain = cache(async function getChain(slug: string): Promise<Chain | null> {
  const client = publicClient();
  const { data: brand } = await client.from('brands').select('id, name, slug, website_url').eq('slug', slug).maybeSingle();
  if (!brand) return null;
  const branches = await getBranches(brand.id);
  if (branches.length < MIN_CHAIN_BRANCHES || !branches.some((b) => b.status !== 'unknown')) return null;

  // The chain's own words: a statement quoted from the chain's website on any
  // of its branches. The most repeated one, which is the one it makes for all.
  const chainHost = hostOf(brand.website_url);
  const { data: evidence } = await client
    .from('restaurant_halal_evidence')
    .select('kind, claim, source_name, source_url, excerpt, checked_at')
    .in('restaurant_id', branches.map((b) => b.id))
    .eq('is_current', true)
    .in('kind', ['first_party_statement', 'certification_claim']);
  const tally = new Map<string, { excerpt: string; source_url: string | null; checked_at: string; n: number }>();
  for (const e of (evidence ?? []) as { claim: string; source_name: string; source_url: string | null; excerpt: string | null; checked_at: string }[]) {
    if (!e.excerpt || e.claim === 'not_halal') continue;
    const fromChain = e.source_name === "The chain's website" || (chainHost && hostOf(e.source_url) === chainHost);
    if (!fromChain) continue;
    const key = e.excerpt;
    const t = tally.get(key) ?? { excerpt: e.excerpt, source_url: e.source_url, checked_at: e.checked_at, n: 0 };
    t.n += 1;
    tally.set(key, t);
  }
  const best = [...tally.values()].sort((a, b) => b.n - a.n)[0] ?? null;

  return {
    id: brand.id,
    name: cleanRestaurantName(brand.name),
    slug: brand.slug,
    website_url: brand.website_url,
    branches,
    statement: best ? { excerpt: best.excerpt, source_url: best.source_url, checked_at: best.checked_at } : null,
  };
});

export interface ChainSummary {
  name: string;
  slug: string;
  branches: number;
  counts: Record<HalalStatus, number>;
}

/** Every chain with enough branches for a page of its own, and at least one with evidence. */
export const getChainIndex = cache(async function getChainIndex(): Promise<ChainSummary[]> {
  const client = publicClient();
  const rows: { brand_id: string; halal_classification: HalalClassification; halal_evidence_strength: EvidenceStrength | null; is_listed: boolean; is_searchable: boolean }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('restaurants')
      .select('brand_id, halal_classification, halal_evidence_strength, is_listed, is_searchable')
      .not('brand_id', 'is', null)
      .eq('is_searchable', true)
      .range(from, from + 999);
    if (error || !data) break;
    rows.push(...(data as typeof rows));
    if (data.length < 1000) break;
  }
  const byBrand = new Map<string, Record<HalalStatus, number>>();
  for (const r of rows) {
    const counts = byBrand.get(r.brand_id) ?? { fully_halal: 0, halal_options: 0, unverified: 0, unknown: 0 };
    counts[statusFor({ isListed: r.is_listed, isSearchable: r.is_searchable, halal_classification: r.halal_classification }) ?? 'unknown'] += 1;
    byBrand.set(r.brand_id, counts);
  }
  const ids = [...byBrand.entries()]
    .filter(([, c]) => Object.values(c).reduce((a, b) => a + b, 0) >= MIN_CHAIN_BRANCHES && c.unknown < Object.values(c).reduce((a, b) => a + b, 0))
    .map(([id]) => id);
  if (!ids.length) return [];
  const { data: brands } = await client.from('brands').select('id, name, slug').in('id', ids);
  return ((brands ?? []) as { id: string; name: string; slug: string | null }[])
    .filter((b) => b.slug)
    .map((b) => {
      const counts = byBrand.get(b.id)!;
      return { name: cleanRestaurantName(b.name), slug: b.slug!, branches: Object.values(counts).reduce((a, n) => a + n, 0), counts };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
});

/** Every place in search, for the sitemap: one question page each. */
export async function getListedSlugs(): Promise<{ slug: string; updated: string | null }[]> {
  const client = publicClient();
  const rows: { slug: string; updated: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('restaurants')
      .select('slug, halal_checked_at')
      .eq('is_listed', true)
      .order('slug')
      .range(from, from + 999);
    if (error || !data) break;
    rows.push(...data.map((r) => ({ slug: r.slug as string, updated: (r.halal_checked_at as string | null) ?? null })));
    if (data.length < 1000) break;
  }
  return rows;
}

/**
 * The answer about a chain, from its branches' labels and nothing else. A chain
 * is only called halal where every branch we know of carries that label; when
 * the branches differ, the answer says so and counts them.
 */
export function chainAnswer(name: string, branches: Branch[]): { verdict: string; detail: string; sentence: string } {
  const n = branches.length;
  const count = (s: HalalStatus) => branches.filter((b) => b.status === s).length;
  const all = (s: HalalStatus) => count(s) === n;
  const where = `the ${n} ${name} branches in London we know of`;
  const answer = (verdict: string, detail: string) => ({ verdict, detail, sentence: `${verdict}. ${detail}` });
  if (all('fully_halal')) {
    return answer('Yes', `At all ${where}, there is strong evidence that all the meat served is halal. Confirm it with the branch when you order.`);
  }
  if (all('halal_options')) {
    return answer('Partly', `At all ${where}, halal food is available, but not everything on the menu is halal. Ask which items are halal when you order.`);
  }
  if (all('unverified')) {
    return answer('Not confirmed', `There are signs ${where} are halal, but we haven't checked. Ask the branch before you order. Unverified never means not halal.`);
  }
  if (all('unknown')) {
    return answer('Not known', `We have no halal information for any of ${where}. Ask the branch before you order.`);
  }
  const parts = [
    count('fully_halal') && `${count('fully_halal')} Fully Halal`,
    count('halal_options') && `${count('halal_options')} with halal food available`,
    count('unverified') && `${count('unverified')} unverified`,
    count('unknown') && `${count('unknown')} we have no halal information for`,
  ].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  // What varies is what we know, which is not the same as what they serve.
  const pages = count('unknown') ? 'Each branch with evidence has a page that shows it.' : "Each branch's page shows its own evidence.";
  return answer('Varies by branch', `What we know differs from branch to branch. Of ${where}: ${list}. ${pages}`);
}
