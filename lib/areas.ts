import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { EvidenceStrength, HalalClassification } from './types';

// Area pages are public and identical for every visitor, so they read with a
// cookieless anonymous client and can be cached, unlike search.
function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

/**
 * Fewer listed places than this and a borough gets no page: a page with a
 * handful of entries helps nobody searching and reads as filler to a search
 * engine. Those boroughs are still fully searchable.
 */
export const MIN_AREA_LISTINGS = 12;

export interface AreaSummary {
  borough: string;
  slug: string;
  listed: number;
  fully_halal: number;
  halal_options: number;
  unverified: number;
  anchor_lat: number;
  anchor_lng: number;
  last_checked_at: string | null;
  /** Places in the borough nobody has checked yet. */
  not_checked: number;
}

export interface AreaListing {
  id: string;
  name: string;
  slug: string;
  address: string;
  postcode: string | null;
  halal_classification: HalalClassification;
  halal_evidence_strength: EvidenceStrength | null;
  halal_summary: string | null;
  halal_checked_at: string | null;
  cuisine_label: string | null;
  brand_name: string | null;
  branch_label: string | null;
  lat: number;
  lng: number;
}

export function boroughSlug(borough: string): string {
  return borough.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// listing_boroughs finds where each borough's "search this area" link should
// land by counting, for every listed place, the listed places within half a
// mile. That is 250 ms warm and up to 3 seconds at a busy moment, and until
// 2026-10-11 it ran on every page that lists boroughs, each of the 11,800
// "Is it halal?" pages included: the database's biggest single cost, about 5
// hours of its time between 2026-09-03 and 2026-10-11. The answer only changes
// when a place is listed or unlisted, so it is kept for an hour, as long as
// the area pages keep themselves.
//
// A failure is thrown, not returned, so an empty list is never kept.
const fetchAreas = unstable_cache(
  async () => {
    const { data, error } = await publicClient().rpc('listing_boroughs');
    if (error || !data) throw new Error(error?.message ?? 'listing_boroughs returned nothing');
    return data as Omit<AreaSummary, 'slug'>[];
  },
  ['listing-boroughs-v1'],
  { revalidate: 3600 }
);

export const getAreas = cache(async function getAreas(): Promise<AreaSummary[]> {
  try {
    return (await fetchAreas()).map((a) => ({ ...a, slug: boroughSlug(a.borough) }));
  } catch {
    return [];
  }
});

/** Boroughs with enough listed places to deserve a page. */
export async function getAreasWithPages(): Promise<AreaSummary[]> {
  return (await getAreas()).filter((a) => a.listed >= MIN_AREA_LISTINGS);
}

export const getAreaBySlug = cache(async function getAreaBySlug(slug: string) {
  const area = (await getAreasWithPages()).find((a) => a.slug === slug);
  if (!area) return null;
  const { data } = await publicClient().rpc('borough_listings', { p_borough: area.borough });
  return { area, listings: (data ?? []) as AreaListing[] };
});
