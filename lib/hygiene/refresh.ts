import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Keeps restaurant_hygiene (migration 0053) in step with the Food Standards
// Agency. Run weekly by /api/cron/hygiene-weekly.
//
// The FSA publishes one free file per council, under the Open Government
// Licence. London is councils 501 to 533: the 32 boroughs and the City. Each
// place already carries its FSA registration number in restaurant_source_links,
// so this is a lookup, never a guess by name or address.
//
// It reads every file before it writes anything. If one council's file fails,
// nothing changes: a missing file must never read as "this place has no
// rating" and wipe a real one.

const LONDON_COUNCILS = Array.from({ length: 33 }, (_, i) => 501 + i);
const fileUrl = (code: number) => `https://ratings.food.gov.uk/api/open-data-files/FHRS${code}en-GB.json`;
const PAGE = 1000;

interface FsaEstablishment {
  FHRSID: number;
  RatingValue: string | number;
  RatingDate?: string | null;
  NewRatingPending?: boolean | string;
  LocalAuthorityName?: string;
}

export interface HygieneRow {
  restaurant_id: string;
  fhrs_id: number;
  rating_label: string;
  rating: number | null;
  rating_date: string | null;
  new_rating_pending: boolean;
  local_authority: string | null;
}

export interface HygieneSummary {
  dryRun: boolean;
  councils: number;
  linkedPlaces: number;
  found: number;
  byRating: Record<string, number>;
  changed: number;
  removed: number;
  /** Listed places among the removed, flagged for a person (in a dry run, that would be). */
  flagged: number;
  /** Set when flagging failed. The ratings were still updated. */
  flagError?: string;
}

/** The service role client, with every request sent fresh: Next 14 would
 *  otherwise keep fetch() answers in a GET route (see lib/deals/db.ts). */
function db(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}

/** Every row of a select, a page at a time: PostgREST stops at 1,000. */
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

function toRow(restaurantId: string, e: FsaEstablishment): HygieneRow {
  const label = String(e.RatingValue);
  const n = /^[0-5]$/.test(label) ? Number(label) : null;
  return {
    restaurant_id: restaurantId,
    fhrs_id: Number(e.FHRSID),
    rating_label: label,
    rating: n,
    rating_date: e.RatingDate ? String(e.RatingDate).slice(0, 10) : null,
    new_rating_pending: e.NewRatingPending === true || e.NewRatingPending === 'true',
    local_authority: e.LocalAuthorityName ?? null,
  };
}

/** Of a place's registrations, the one to show: a number beats no number,
 *  then the newest inspection. */
function better(a: HygieneRow, b: HygieneRow): HygieneRow {
  if ((a.rating === null) !== (b.rating === null)) return a.rating !== null ? a : b;
  return (b.rating_date ?? '') > (a.rating_date ?? '') ? b : a;
}

const same = (a: HygieneRow, b: HygieneRow) =>
  a.fhrs_id === b.fhrs_id &&
  a.rating_label === b.rating_label &&
  a.rating_date === b.rating_date &&
  a.new_rating_pending === b.new_rating_pending &&
  a.local_authority === b.local_authority;

/**
 * A listed place whose registration has left the FSA's files may have closed.
 * It is flagged for a person (place_flags, migration 0055) and never changed:
 * the listing and its label stay as they are until someone looks. A place that
 * already has an open flag is not flagged again.
 */
async function flagLeavers(
  supabase: SupabaseClient,
  removedIds: string[],
  held: Map<string, HygieneRow>,
  dryRun: boolean
): Promise<number> {
  const listed: string[] = [];
  for (let i = 0; i < removedIds.length; i += 200) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id')
      .in('id', removedIds.slice(i, i + 200))
      .eq('is_listed', true);
    if (error) throw new Error(error.message);
    listed.push(...((data ?? []) as { id: string }[]).map((r) => r.id));
  }
  if (dryRun || listed.length === 0) return listed.length;

  const open = new Set<string>();
  for (let i = 0; i < listed.length; i += 200) {
    const { data, error } = await supabase
      .from('place_flags')
      .select('restaurant_id')
      .eq('reason', 'left_fsa_register')
      .is('resolved_at', null)
      .in('restaurant_id', listed.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { restaurant_id: string }[]) open.add(r.restaurant_id);
  }

  const rows = listed
    .filter((id) => !open.has(id))
    .map((id) => {
      const h = held.get(id);
      const where = h?.local_authority ? ` (${h.local_authority})` : '';
      const when = h?.rating_date ? ` on ${h.rating_date}` : '';
      return {
        restaurant_id: id,
        reason: 'left_fsa_register',
        detail: h ? `FSA registration ${h.fhrs_id}${where}, last rated ${h.rating_label}${when}, was not in this week's files.` : null,
      };
    });
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('place_flags').insert(rows.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

export async function refreshHygiene({ dryRun }: { dryRun: boolean }): Promise<HygieneSummary> {
  const supabase = db();

  const links = await readAll<{ restaurant_id: string; source_id: string }>((from, to) =>
    supabase.from('restaurant_source_links').select('restaurant_id, source_id').eq('source', 'fsa').order('source_id').range(from, to)
  );
  const placesByFhrs = new Map<string, string[]>();
  for (const l of links) placesByFhrs.set(l.source_id, [...(placesByFhrs.get(l.source_id) ?? []), l.restaurant_id]);

  // Every council first. Any failure throws before a single write.
  const best = new Map<string, HygieneRow>();
  for (const code of LONDON_COUNCILS) {
    const res = await fetch(fileUrl(code), { cache: 'no-store' });
    if (!res.ok) throw new Error(`FSA file for council ${code} answered ${res.status}.`);
    const json = (await res.json()) as { FHRSEstablishment?: { EstablishmentCollection?: FsaEstablishment[] } };
    const list = json.FHRSEstablishment?.EstablishmentCollection;
    if (!Array.isArray(list) || list.length === 0) throw new Error(`FSA file for council ${code} had no businesses in it.`);
    for (const e of list) {
      for (const restaurantId of placesByFhrs.get(String(e.FHRSID)) ?? []) {
        const row = toRow(restaurantId, e);
        const held = best.get(restaurantId);
        best.set(restaurantId, held ? better(held, row) : row);
      }
    }
  }

  const readCurrent = () =>
    readAll<HygieneRow>((from, to) =>
      supabase
        .from('restaurant_hygiene')
        .select('restaurant_id, fhrs_id, rating_label, rating, rating_date, new_rating_pending, local_authority')
        .order('restaurant_id')
        .range(from, to)
    );
  // A dry run may come before migration 0053, when there is no table to read.
  const current = dryRun ? await readCurrent().catch(() => []) : await readCurrent();
  const held = new Map(current.map((r) => [r.restaurant_id, { ...r, fhrs_id: Number(r.fhrs_id) }]));

  const changed = [...best.values()].filter((r) => {
    const h = held.get(r.restaurant_id);
    return !h || !same(h, r);
  });
  // A place whose registration has left the FSA's files (closed, or moved
  // council) no longer has a published rating, so it goes back to not known.
  const removed = [...held.keys()].filter((id) => !best.has(id));

  // Flagged before the old ratings are removed, so each flag can say what the
  // place was last rated. A failure here is reported, not thrown: this week's
  // ratings still go in.
  let flagged = 0;
  let flagError: string | undefined;
  try {
    flagged = await flagLeavers(supabase, removed, held, dryRun);
  } catch (e) {
    flagError = (e as Error).message;
    console.error('[hygiene] flagging', flagError);
  }

  const byRating: Record<string, number> = {};
  for (const r of best.values()) byRating[r.rating_label] = (byRating[r.rating_label] ?? 0) + 1;

  if (!dryRun) {
    const now = new Date().toISOString();
    for (let i = 0; i < changed.length; i += 500) {
      const { error } = await supabase
        .from('restaurant_hygiene')
        .upsert(changed.slice(i, i + 500).map((r) => ({ ...r, changed_at: now })), { onConflict: 'restaurant_id' });
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < removed.length; i += 200) {
      const { error } = await supabase.from('restaurant_hygiene').delete().in('restaurant_id', removed.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
  }

  return {
    dryRun,
    councils: LONDON_COUNCILS.length,
    linkedPlaces: new Set(links.map((l) => l.restaurant_id)).size,
    found: best.size,
    byRating,
    changed: changed.length,
    removed: removed.length,
    flagged,
    ...(flagError ? { flagError } : {}),
  };
}
