import { createServerSupabase } from './supabase/server';
import { placeActivityQuick, rankPopular } from './popular';
import {
  DEFAULT_RADIUS_METERS,
  RADIUS_OPTIONS_MILES,
  effectiveRadiusMeters,
  milesToMeters,
  type HalalStatus,
  type SearchMode,
  type SearchResultRestaurant,
  type TierCount,
} from './types';

// The one place the app runs a search. The results page renders its first view
// through this and /api/search answers every later change through it, so the
// first paint and every refresh are the same query.
//
// Behind it, in the database, search_restaurants() and search_radius_counts()
// both call search_candidates(). That is why the list, the count and the map
// ring always agree: they are one definition of a match.
//
// Search is the same for everyone. There is no radius entitlement: anybody can
// look anywhere in London, signed in or not. See migration 0033.
//
// Search includes places nobody has checked yet ("Worth asking"), alongside
// places with halal evidence. Each result carries halal_status to tell them apart,
// and each radius count says how many of its places have evidence.

/** Every radius the selector offers, smallest first. */
export const TIER_MILES: number[] = [...RADIUS_OPTIONS_MILES].sort((a, b) => a - b);

export interface SearchParams {
  lat: number;
  lng: number;
  mode: SearchMode;
  radiusMiles?: number | null;
  classification?: HalalStatus[] | null;
  query?: string | null;
  /** Popular: nearest from the database, then put in order by lib/popular.ts. */
  sort?: SortOrder;
  /** Only places with an FSA food hygiene rating of at least this (3 to 5). */
  minHygiene?: number | null;
  /** Only places whose opening hours say they are open right now. */
  openNow?: boolean;
  /** Only places whose owner told us one of these prices (lib/price.ts). */
  price?: number[] | null;
}

export type SortOrder = 'distance' | 'evidence' | 'popular';

export interface SearchResponse {
  results: SearchResultRestaurant[];
  totalCount: number;
  effectiveRadiusMeters: number;
  tierCounts: TierCount[];
  /** Enough places here have earned "Popular" for the order to mean something. */
  popularReady: boolean;
  /** With a hygiene, open now or price filter on: how many places in range it
   *  left out, mostly because we do not know that about them yet. Else null. */
  hiddenByFilters: number | null;
}

export async function runSearch(params: SearchParams): Promise<SearchResponse> {
  const supabase = createServerSupabase();
  const classification = params.classification?.length ? params.classification : null;
  const query = params.query?.trim() ? params.query.trim().slice(0, 80) : null;
  const requested = params.radiusMiles ? milesToMeters(params.radiusMiles) : DEFAULT_RADIUS_METERS;
  // Sent only when set: before migration 0053 the database functions have no
  // such arguments, and a search without them must keep working.
  const filters = {
    ...(params.minHygiene ? { p_min_hygiene: params.minHygiene } : {}),
    ...(params.openNow ? { p_open_now: true } : {}),
    ...(params.price?.length ? { p_price: params.price } : {}),
  };

  const narrowed = Object.keys(filters).length > 0;
  const [{ data, error }, { data: counts }, activity, { data: unfiltered }] = await Promise.all([
    supabase.rpc('search_restaurants', {
      p_lat: params.lat,
      p_lng: params.lng,
      p_radius_meters: requested,
      p_mode: params.mode,
      p_classification: classification,
      p_cuisine_ids: null,
      p_query: query,
      p_limit: 500,
      p_offset: 0,
      p_sort: params.sort === 'evidence' ? 'evidence' : 'distance',
      p_include_candidates: true,
      ...filters,
    }),
    supabase.rpc('search_radius_counts', {
      p_lat: params.lat,
      p_lng: params.lng,
      p_radii: TIER_MILES.map(milesToMeters),
      p_classification: classification,
      p_cuisine_ids: null,
      p_query: query,
      p_include_candidates: true,
      ...filters,
    }),
    placeActivityQuick(),
    // The same search without those three filters, at this radius only, so
    // the page can say how many places they hid.
    narrowed
      ? supabase.rpc('search_radius_counts', {
          p_lat: params.lat,
          p_lng: params.lng,
          p_radii: [requested],
          p_classification: classification,
          p_cuisine_ids: null,
          p_query: query,
          p_include_candidates: true,
        })
      : Promise.resolve({ data: null }),
  ]);

  if (error) throw new Error(error.message);

  const popular = rankPopular((data ?? []) as SearchResultRestaurant[], activity, params.sort === 'popular');
  const results = popular.results;
  const byMeters = new Map(
    ((counts ?? []) as { radius_meters: number; places: number; with_evidence: number }[]).map((c) => [c.radius_meters, c])
  );
  const tierCounts: TierCount[] = TIER_MILES.map((miles) => {
    const c = byMeters.get(milesToMeters(miles));
    return { miles, meters: milesToMeters(miles), places: Number(c?.places ?? 0), withEvidence: Number(c?.with_evidence ?? 0) };
  });

  // The server reports the radius it actually used on every row. With no rows,
  // the same clamp the database applies gives the same answer.
  const radius = results[0]?.effective_radius_meters ?? effectiveRadiusMeters(params.radiusMiles ?? null);

  const totalCount = Number(results[0]?.total_count ?? 0);
  const before = (unfiltered as { places: number }[] | null)?.[0]?.places;

  return {
    results,
    totalCount,
    effectiveRadiusMeters: radius,
    tierCounts,
    popularReady: popular.ready,
    hiddenByFilters: narrowed && before !== undefined ? Math.max(0, Number(before) - totalCount) : null,
  };
}
