import { createAdminSupabase } from '@/lib/supabase/admin';
import { adminCached } from './cache';
import type { HalalClassification, HalalStatus } from '@/lib/types';

// The catalogue as the admin browses it: every record, searchable and
// filtered on the server, a page at a time. The old list asked for every row
// at once and Supabase quietly stopped at 1,000 of 12,000.
//
// "Shows as" is what a visitor sees, worked out the way search does it
// (is_searchable, migration 0031, and statusOf in lib/types.ts): the three
// evidence labels, "No evidence, not shown" for a place with no evidence yet
// (shown as Worth asking until 2026-10-11, when Shabir took those off the
// site), and "Hidden" for anything else search leaves out.

export const PAGE_SIZE = 50;

export const SHOWS = ['all', 'fully_halal', 'halal_options', 'unverified', 'unknown', 'hidden'] as const;
export type Shows = (typeof SHOWS)[number];

export const SHOWS_LABEL: Record<Shows, string> = {
  all: 'Everything',
  fully_halal: 'Fully Halal',
  halal_options: 'Halal food available',
  unverified: 'Unverified',
  unknown: 'No evidence, not shown',
  hidden: 'Hidden',
};

export const STATUSES = ['open', 'temporarily_closed', 'permanently_closed', 'needs_review', 'merged'] as const;
export type CatalogueFilterStatus = (typeof STATUSES)[number] | 'any';

export const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  open: 'Open',
  temporarily_closed: 'Closed for now',
  permanently_closed: 'Closed for good',
  needs_review: 'Needs a look',
  merged: 'Merged duplicate',
};

export const SORTS = ['newest', 'name', 'checked'] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABEL: Record<Sort, string> = {
  newest: 'Newest first',
  name: 'A to Z',
  checked: 'Last checked',
};

export interface CatalogueFilters {
  q: string;
  shows: Shows;
  status: CatalogueFilterStatus;
  borough: string;
  checked: boolean;
  owned: boolean;
  sort: Sort;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function readFilters(params: Params): CatalogueFilters {
  const shows = one(params.shows) as Shows;
  const status = one(params.status) as CatalogueFilterStatus;
  const sort = one(params.sort) as Sort;
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(params.page), 10) || 1));
  return {
    q: cleanQuery(one(params.q)),
    shows: SHOWS.includes(shows) ? shows : 'all',
    status: (STATUSES as readonly string[]).includes(status) ? status : 'any',
    borough: one(params.borough).slice(0, 60),
    checked: one(params.checked) === '1',
    owned: one(params.owned) === '1',
    sort: SORTS.includes(sort) ? sort : 'newest',
    page,
  };
}

/** The same filters as a query string, with one or more changed. Defaults are left out. */
export function filterHref(f: CatalogueFilters, change: Partial<CatalogueFilters> = {}): string {
  const next = { ...f, page: 1, ...change };
  const sp = new URLSearchParams();
  if (next.q) sp.set('q', next.q);
  if (next.shows !== 'all') sp.set('shows', next.shows);
  if (next.status !== 'any') sp.set('status', next.status);
  if (next.borough) sp.set('borough', next.borough);
  if (next.checked) sp.set('checked', '1');
  if (next.owned) sp.set('owned', '1');
  if (next.sort !== 'newest') sp.set('sort', next.sort);
  if (next.page > 1) sp.set('page', String(next.page));
  const s = sp.toString();
  return s ? `/admin/restaurants?${s}` : '/admin/restaurants';
}

/**
 * Typed words, made safe to put inside a PostgREST `or=(...)` filter: its
 * commas, brackets and wildcards are syntax there, not text.
 */
export function cleanQuery(raw: string): string {
  return raw.replace(/[,()*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export interface CatalogueRow {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  postcode: string | null;
  borough: string | null;
  cuisine_label: string | null;
  halal_classification: HalalClassification;
  halal_evidence_strength: 'strong' | 'moderate' | 'weak' | null;
  is_searchable: boolean;
  has_negative_evidence: boolean;
  catalogue_status: 'active' | 'temporarily_closed' | 'permanently_closed' | 'needs_review';
  merged_into: string | null;
  checked_by_us: boolean;
  owner_id: string | null;
  halal_checked_at: string | null;
  created_at: string;
  brands: { name: string } | null;
}

export const CATALOGUE_COLUMNS =
  'id, name, slug, address, postcode, borough, cuisine_label, halal_classification, halal_evidence_strength, is_searchable, has_negative_evidence, catalogue_status, merged_into, checked_by_us, owner_id, halal_checked_at, created_at, brands(name)';

/** What a visitor sees for this record, or why they see nothing. */
export function showsAs(r: Pick<CatalogueRow, 'is_searchable' | 'halal_evidence_strength' | 'halal_classification'>): HalalStatus | 'hidden' {
  if (!r.is_searchable) return 'hidden';
  return r.halal_evidence_strength ? r.halal_classification : 'unknown';
}

/** Why search leaves a record out, in a few words. */
export function hiddenReason(r: Pick<CatalogueRow, 'merged_into' | 'catalogue_status' | 'has_negative_evidence' | 'halal_evidence_strength'>): string {
  if (r.merged_into) return 'Merged into another listing';
  if (r.catalogue_status === 'permanently_closed') return 'Closed for good';
  if (r.catalogue_status === 'temporarily_closed') return 'Closed for now';
  if (r.catalogue_status === 'needs_review') return 'Waiting for a look';
  if (r.has_negative_evidence) return 'Evidence says not halal';
  if (!r.halal_evidence_strength) return 'No sign of halal food';
  return 'Hidden';
}

// supabase-js builders are deeply generic; this keeps the filter code readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

function applyShows(qb: Builder, shows: Shows): Builder {
  switch (shows) {
    case 'fully_halal':
    case 'halal_options':
    case 'unverified':
      return qb.eq('is_searchable', true).not('halal_evidence_strength', 'is', null).eq('halal_classification', shows);
    case 'unknown':
      return qb.eq('is_searchable', true).is('halal_evidence_strength', null);
    case 'hidden':
      return qb.eq('is_searchable', false);
    default:
      return qb;
  }
}

function applyRest(qb: Builder, f: CatalogueFilters): Builder {
  if (f.q) {
    const like = `%${f.q}%`;
    qb = qb.or(`name.ilike.${like},postcode.ilike.${like},address.ilike.${like}`);
  }
  if (f.status === 'merged') qb = qb.not('merged_into', 'is', null);
  else {
    // A merged record is a duplicate kept only for its history: out of the
    // way unless asked for.
    qb = qb.is('merged_into', null);
    if (f.status === 'open') qb = qb.eq('catalogue_status', 'active');
    else if (f.status !== 'any') qb = qb.eq('catalogue_status', f.status);
  }
  if (f.borough) qb = qb.eq('borough', f.borough);
  if (f.checked) qb = qb.eq('checked_by_us', true);
  if (f.owned) qb = qb.not('owner_id', 'is', null);
  return qb;
}

export interface CataloguePage {
  rows: CatalogueRow[];
  total: number;
  pages: number;
  /** How many records each "Shows as" tab would hold with the other filters as they are. */
  facets: Record<Shows, number>;
  boroughs: string[];
}

async function buildCatalogue(f: CatalogueFilters): Promise<CataloguePage> {
  const db = createAdminSupabase();
  const from = (f.page - 1) * PAGE_SIZE;

  let main = applyShows(applyRest(db.from('restaurants').select(CATALOGUE_COLUMNS, { count: 'exact' }), f), f.shows);
  if (f.sort === 'name') main = main.order('name', { ascending: true });
  else if (f.sort === 'checked') main = main.order('halal_checked_at', { ascending: false, nullsFirst: false });
  else main = main.order('created_at', { ascending: false });
  main = main.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);

  const facetQuery = (shows: Shows) =>
    applyShows(applyRest(db.from('restaurants').select('id', { count: 'exact', head: true }), f), shows);

  const [result, boroughs, ...facetResults] = await Promise.all([
    main,
    db.from('catalogue_borough_coverage').select('borough').order('borough'),
    ...SHOWS.map((s) => facetQuery(s)),
  ]);

  const facets = Object.fromEntries(SHOWS.map((s, i) => [s, facetResults[i]?.count ?? 0])) as Record<Shows, number>;
  const total = result.count ?? 0;
  return {
    rows: (result.data ?? []) as CatalogueRow[],
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    facets,
    boroughs: ((boroughs.data ?? []) as { borough: string | null }[])
      .map((b) => b.borough)
      .filter((b): b is string => Boolean(b) && b !== 'Unknown'),
  };
}

// Seven counts and a page of rows: kept two minutes per view, cleared by any
// admin change (revalidateAdminPath).
export const loadCatalogue = adminCached(buildCatalogue, 'catalogue-v1', 120);
