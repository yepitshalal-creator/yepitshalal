import { createServerSupabase } from './supabase/server';
import type { EvidenceStrength, OpeningHour } from './types';

/**
 * Everything worth showing about a place without opening its page.
 *
 * Tapping a pin on the map used to give a name and one line. It now opens the
 * information we actually hold, which means fetching the handful of fields that
 * are too big to carry on all 500 search rows: the address, how to contact it,
 * this week's hours and what the halal label rests on.
 *
 * Deliberately three queries and no joins beyond them. This runs on a tap, so
 * it has to be quick, and nothing here is worth a second of waiting.
 */

export interface PlacePreview {
  slug: string;
  address: string;
  postcode: string | null;
  borough: string | null;
  phone: string | null;
  website_url: string | null;
  menu_url: string | null;
  description: string | null;
  halal_summary: string | null;
  halal_evidence_strength: EvidenceStrength | null;
  halal_checked_at: string | null;
  /** How many current pieces of evidence sit behind the label. */
  evidence_count: number;
  /** The single most direct one, for a one-line "because". */
  lead_evidence: { kind: string; excerpt: string | null; source_name: string } | null;
  opening_hours: OpeningHour[];
  /** The listing's own photo, as search returns it; null for none. */
  photo_path: string | null;
  /** Set when the listing photo came from the restaurant's own website. */
  photo_source_site: string | null;
  photo_source_url: string | null;
}

const KIND_ORDER: Record<string, number> = {
  yepitshalal_check: 0,
  certification: 1,
  first_party_statement: 2,
  certification_claim: 3,
  owner_submission: 4,
  public_submission: 5,
  business_name: 6,
  community_tag: 7,
  directory_category: 8,
};

export async function getPlacePreview(slug: string): Promise<PlacePreview | null> {
  const supabase = createServerSupabase();

  const { data: place } = await supabase
    .from('restaurants')
    .select(
      'id, slug, address, postcode, borough, phone, website_url, menu_url, description, halal_summary, halal_evidence_strength, halal_checked_at'
    )
    .eq('slug', slug)
    .is('merged_into', null)
    .maybeSingle();

  if (!place) return null;

  const [{ data: hours }, { data: evidence }, { data: photo }] = await Promise.all([
    supabase
      .from('opening_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('restaurant_id', place.id)
      .order('day_of_week', { ascending: true })
      .order('open_time', { ascending: true }),
    supabase
      .from('restaurant_halal_evidence')
      .select('kind, excerpt, source_name, claim')
      .eq('restaurant_id', place.id)
      .eq('is_current', true),
    supabase
      .from('restaurant_photos')
      .select('storage_path, source_site, source_url')
      .eq('restaurant_id', place.id)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle(),
  ]);

  const positive = ((evidence ?? []) as { kind: string; excerpt: string | null; source_name: string; claim: string }[])
    .filter((e) => e.claim !== 'not_halal')
    .sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));

  return {
    slug: place.slug,
    address: place.address,
    postcode: place.postcode,
    borough: place.borough,
    phone: place.phone,
    website_url: place.website_url,
    menu_url: place.menu_url,
    description: place.description,
    halal_summary: place.halal_summary,
    halal_evidence_strength: place.halal_evidence_strength as EvidenceStrength | null,
    halal_checked_at: place.halal_checked_at,
    evidence_count: positive.length,
    lead_evidence: positive[0]
      ? { kind: positive[0].kind, excerpt: positive[0].excerpt, source_name: positive[0].source_name }
      : null,
    opening_hours: (hours ?? []) as OpeningHour[],
    photo_path: photo?.storage_path ?? null,
    photo_source_site: photo?.source_site ?? null,
    photo_source_url: photo?.source_url ?? null,
  };
}
