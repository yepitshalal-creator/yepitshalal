import { cache } from 'react';
import { createServerSupabase } from './supabase/server';
import type { HygieneRecord } from './hygiene/display';
import type {
  EvidenceStrength,
  HalalEvidence,
  HalalFactsPublic,
  OpeningHour,
  RestaurantPhoto,
  RestaurantVideo,
} from './types';

export interface SourceLink {
  source: 'fsa' | 'overture' | 'osm' | 'owner_submission';
  source_id: string;
  licence: string | null;
  last_seen_at: string;
}

export interface FullRestaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  postcode: string | null;
  borough: string | null;
  phone: string | null;
  website_url: string | null;
  menu_url: string | null;
  socials: string[];
  halal_classification: 'fully_halal' | 'halal_options' | 'unverified';
  /** Null when there is no current evidence at all. */
  halal_evidence_strength: EvidenceStrength | null;
  halal_summary: string | null;
  halal_checked_at: string | null;
  isListed: boolean;
  /** Shown in search: listed with evidence, or a place not checked yet. */
  isSearchable: boolean;
  isCandidate: boolean;
  catalogueStatus: 'active' | 'temporarily_closed' | 'permanently_closed' | 'needs_review';
  lat: number;
  lng: number;
  cuisines: string[];
  cuisineLabel: string | null;
  brandName: string | null;
  /** For the chain's "Is it halal?" page, when the place belongs to one. */
  brandId: string | null;
  brandSlug: string | null;
  branchLabel: string | null;
  /** Somewhere to pray at the restaurant itself. null is 'nobody has told us'. */
  prayerFacility: 'prayer_room' | 'space' | 'none' | null;
  prayerFacilityNote: string | null;
  prayerFacilitySource: 'owner' | 'staff' | 'customer' | 'yepitshalal' | null;
  prayerFacilityAt: string | null;
  photos: RestaurantPhoto[];
  videos: RestaurantVideo[];
  openingHours: (OpeningHour & { source?: string | null; checked_at?: string | null })[];
  halalFacts: HalalFactsPublic | null;
  evidence: HalalEvidence[];
  sources: SourceLink[];
  /** The FSA food hygiene rating (migration 0053). Null: not known. */
  hygiene: HygieneRecord | null;
  /** Price a head from the owner, 1 to 3 (lib/price.ts). Null: not known. */
  priceRange: number | null;
  offers: {
    id: string;
    title: string;
    description: string | null;
    yep_plus_only: boolean;
    is_early_access: boolean;
    voucher_code: string | null;
  }[];
}

// Strongest and most direct first, so the page can lead with what matters.
const STRENGTH_ORDER: Record<EvidenceStrength, number> = { strong: 0, moderate: 1, weak: 2 };
const KIND_ORDER: Record<string, number> = {
  yepitshalal_check: 0, certification: 1, first_party_statement: 2, certification_claim: 3,
  business_name: 4, community_tag: 5, directory_category: 6, owner_submission: 7, public_submission: 8,
};

// Wrapped in React cache so generateMetadata and the page body share one
// round-trip instead of querying Supabase twice per request.
export const getRestaurantBySlug = cache(async function getRestaurantBySlug(
  slug: string
): Promise<FullRestaurant | null> {
  const supabase = createServerSupabase();

  const { data: restaurant } = await supabase
    .from('restaurants_with_coords')
    .select(
      'id, name, slug, description, address, postcode, borough, phone, website_url, menu_url, socials, halal_classification, halal_evidence_strength, halal_summary, halal_checked_at, is_listed, is_searchable, is_candidate, catalogue_status, lat, lng, branch_label, cuisine_label, brand_id, prayer_facility, prayer_facility_note, prayer_facility_source, prayer_facility_at'
    )
    .eq('slug', slug)
    .maybeSingle();

  if (!restaurant) return null;

  const [
    { data: brand },
    { data: cuisineRows },
    { data: photos },
    { data: videos },
    { data: hours },
    { data: facts },
    { data: offers },
    { data: evidence },
    { data: sources },
    { data: hygiene },
    { data: price },
  ] = await Promise.all([
    restaurant.brand_id
      ? supabase.from('brands').select('name, slug').eq('id', restaurant.brand_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('restaurant_cuisines').select('cuisines(name)').eq('restaurant_id', restaurant.id),
    supabase
      .from('restaurant_photos')
      .select('id, storage_path, type, is_primary, is_logo, source_url, source_site')
      .eq('restaurant_id', restaurant.id)
      .order('is_primary', { ascending: false }),
    supabase.from('restaurant_videos').select('id, provider, embed_url, caption').eq('restaurant_id', restaurant.id),
    supabase
      .from('opening_hours')
      .select('day_of_week, open_time, close_time, is_closed, source, checked_at')
      .eq('restaurant_id', restaurant.id)
      .order('day_of_week', { ascending: true })
      .order('open_time', { ascending: true }),
    supabase.from('restaurant_halal_facts_public').select('*').eq('restaurant_id', restaurant.id).maybeSingle(),
    supabase
      .from('offers_public')
      .select('id, title, description, yep_plus_only, is_early_access, voucher_code')
      .eq('restaurant_id', restaurant.id),
    supabase
      .from('restaurant_halal_evidence')
      .select('id, kind, claim, strength, source_name, source_url, excerpt, notes, checked_at')
      .eq('restaurant_id', restaurant.id)
      .eq('is_current', true),
    supabase
      .from('restaurant_source_links')
      .select('source, source_id, licence, last_seen_at')
      .eq('restaurant_id', restaurant.id),
    supabase
      .from('restaurant_hygiene')
      .select('fhrs_id, rating_label, rating, rating_date, new_rating_pending, local_authority')
      .eq('restaurant_id', restaurant.id)
      .maybeSingle(),
    // On its own, not in the select above: until migration 0053 the column
    // does not exist, and this fails alone instead of taking the page with it.
    supabase.from('restaurants').select('price_range').eq('id', restaurant.id).maybeSingle(),
  ]);

  const sortedEvidence = ((evidence ?? []) as HalalEvidence[]).sort(
    (a, b) =>
      STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
      (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
      b.checked_at.localeCompare(a.checked_at)
  );

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    description: restaurant.description,
    address: restaurant.address,
    postcode: restaurant.postcode,
    borough: restaurant.borough ?? null,
    phone: restaurant.phone,
    website_url: restaurant.website_url,
    menu_url: restaurant.menu_url,
    socials: restaurant.socials ?? [],
    halal_classification: restaurant.halal_classification,
    halal_evidence_strength: restaurant.halal_evidence_strength ?? null,
    halal_summary: restaurant.halal_summary ?? null,
    halal_checked_at: restaurant.halal_checked_at ?? null,
    isListed: Boolean(restaurant.is_listed),
    isSearchable: Boolean(restaurant.is_searchable),
    isCandidate: Boolean(restaurant.is_candidate),
    catalogueStatus: restaurant.catalogue_status,
    brandName: (brand as { name: string } | null)?.name ?? null,
    brandId: restaurant.brand_id ?? null,
    brandSlug: (brand as { slug: string | null } | null)?.slug ?? null,
    branchLabel: restaurant.branch_label ?? null,
    prayerFacility: restaurant.prayer_facility ?? null,
    prayerFacilityNote: restaurant.prayer_facility_note ?? null,
    prayerFacilitySource: restaurant.prayer_facility_source ?? null,
    prayerFacilityAt: restaurant.prayer_facility_at ?? null,
    lat: restaurant.lat,
    lng: restaurant.lng,
    cuisines: (cuisineRows ?? [])
      .map((r: { cuisines: { name: string } | { name: string }[] }) =>
        Array.isArray(r.cuisines) ? r.cuisines[0]?.name : r.cuisines?.name
      )
      .filter(Boolean),
    cuisineLabel: restaurant.cuisine_label ?? null,
    photos: photos ?? [],
    videos: videos ?? [],
    openingHours: hours ?? [],
    halalFacts: facts ?? null,
    evidence: sortedEvidence,
    sources: (sources ?? []) as SourceLink[],
    hygiene: (hygiene as HygieneRecord | null) ?? null,
    priceRange: (price as { price_range: number | null } | null)?.price_range ?? null,
    offers: offers ?? [],
  };
});

export interface NearbyPlace {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  branch_label: string | null;
  halal_classification: 'fully_halal' | 'halal_options' | 'unverified';
  halal_status: 'fully_halal' | 'halal_options' | 'unverified' | 'unknown';
  halal_summary: string | null;
  halal_evidence_strength: EvidenceStrength | null;
  distance_meters: number;
  cuisine_label: string | null;
  cuisines: string[] | null;
  primary_photo_path: string | null;
  address: string;
  lat: number;
  lng: number;
  effective_radius_meters: number;
  is_yep_plus: boolean;
  opening_hours: null;
  total_count: number;
  postcode: string | null;
}

/**
 * Places with halal evidence within half a mile, strongest first. The same
 * search, and the same half-mile a visitor gets from a searched place, so this
 * shows nothing search would not.
 */
export const getNearbyWithEvidence = cache(async function getNearbyWithEvidence(
  restaurant: { id: string; lat: number; lng: number },
  limit = 6
): Promise<NearbyPlace[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase.rpc('search_restaurants', {
    p_lat: restaurant.lat,
    p_lng: restaurant.lng,
    p_radius_meters: 805,
    p_mode: 'searched_location',
    p_classification: ['fully_halal', 'halal_options', 'unverified'],
    p_cuisine_ids: null,
    p_query: null,
    p_limit: limit + 1,
    p_offset: 0,
    p_sort: 'evidence',
    p_include_candidates: false,
  });
  return ((data ?? []) as NearbyPlace[]).filter((r) => r.id !== restaurant.id).slice(0, limit);
});
