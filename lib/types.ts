export type HalalClassification = 'fully_halal' | 'halal_options' | 'unverified';

/**
 * What a visitor is told about a place. The three labels come from evidence;
 * 'unknown' is a place nobody has checked yet, shown because its name or cuisine
 * makes it worth checking. It is never a halal claim.
 */
export type HalalStatus = HalalClassification | 'unknown';

export const HALAL_STATUSES: HalalStatus[] = ['fully_halal', 'halal_options', 'unverified', 'unknown'];

/**
 * The labels a visitor can see. Since 2026-10-11 places with no halal evidence
 * ('unknown') are off the public site, so search can't be filtered to them.
 */
export const PUBLIC_STATUSES: HalalClassification[] = ['fully_halal', 'halal_options', 'unverified'];

/** A place with no evidence at all is 'unknown', whatever its stored default label says. */
export function statusOf(r: { halal_status?: HalalStatus | null; halal_evidence_strength?: string | null; halal_classification: HalalClassification }): HalalStatus {
  if (r.halal_status) return r.halal_status;
  return r.halal_evidence_strength ? r.halal_classification : 'unknown';
}

export type TriState = boolean | null;

/** What kind of source an evidence record comes from. See migration 0023. */
export type EvidenceKind =
  | 'yepitshalal_check'
  | 'certification'
  | 'first_party_statement'
  | 'certification_claim'
  | 'business_name'
  | 'community_tag'
  | 'directory_category'
  | 'owner_submission'
  | 'public_submission';

export type EvidenceClaim = 'fully_halal' | 'halal_options' | 'halal_mentioned' | 'not_halal';

export type EvidenceStrength = 'strong' | 'moderate' | 'weak';

export interface HalalEvidence {
  id: string;
  kind: EvidenceKind;
  claim: EvidenceClaim;
  strength: EvidenceStrength;
  source_name: string;
  source_url: string | null;
  excerpt: string | null;
  notes: string | null;
  checked_at: string;
}

export interface SearchResultRestaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  lat: number;
  lng: number;
  halal_classification: HalalClassification;
  distance_meters: number;
  primary_photo_path: string | null;
  cuisines: string[] | null;
  effective_radius_meters: number;
  is_yep_plus: boolean;
  /** Set when this location belongs to a multi-branch brand. */
  brand_name: string | null;
  /** The neighbourhood or street that distinguishes this branch. */
  branch_label: string | null;
  halal_evidence_strength: EvidenceStrength | null;
  /** One line saying why the label is what it is, derived from evidence. */
  halal_summary: string | null;
  cuisine_label: string | null;
  opening_hours: OpeningHour[] | null;
  /** Every match within the searched radius, not just the rows returned. */
  total_count: number;
  halal_status: HalalStatus;
  postcode: string | null;
  /** Somebody from YepItsHalal visited, phoned, or saw the documents. */
  checked_by_us: boolean;
  /** The FSA food hygiene rating, 0 to 5. Null or missing: not known. */
  hygiene_rating?: number | null;
  hygiene_rating_date?: string | null;
  /** Price a head from the owner: 1 under £10, 2 £10 to £20, 3 over £20. */
  price_range?: number | null;
  /** Earned from our own visit numbers (lib/popular.ts), never set by hand. */
  popular?: boolean;
}

/** How many places the same search finds at one radius tier. */
export interface TierCount {
  miles: number;
  meters: number;
  places: number;
  /** Of those, how many have halal evidence (any label but Worth asking). */
  withEvidence: number;
}

export interface RestaurantDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  postcode: string | null;
  phone: string | null;
  website_url: string | null;
  menu_url: string | null;
  halal_classification: HalalClassification;
  lat: number;
  lng: number;
}

export interface HalalFactsPublic {
  restaurant_id: string;
  all_meat_halal: TriState;
  halal_meat_types: string[] | null;
  serves_non_halal_meat: TriState;
  serves_pork: TriState;
  serves_alcohol: TriState;
  has_certification: TriState;
  certification_body: string | null;
  verified_at: string | null;
  last_verified_at: string | null;
  next_review_due_at: string | null;
  last_outcome: 'verified' | 'unable_to_verify' | null;
  verification_state: 'current' | 'due' | 'overdue' | 'unable_to_verify' | 'never_verified';
}

export interface RestaurantPhoto {
  id: string;
  storage_path: string;
  type: 'exterior' | 'interior' | 'food' | 'menu';
  is_primary: boolean;
  /** The business's own mark rather than a photograph. Shown whole, not cropped. */
  is_logo?: boolean;
  /** The page it was published on, for credit and for takedown requests. */
  source_url?: string | null;
  source_site?: string | null;
}

export interface RestaurantVideo {
  id: string;
  provider: 'instagram' | 'tiktok' | 'youtube';
  embed_url: string;
  caption: string | null;
}

export interface OpeningHour {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

// Five miles is the far end on purpose. Past it a London map is a blur of
// clusters, the 500 row cap starts truncating, and "halal food near me" stops
// meaning anything. Places further out are found by searching there instead.
export const RADIUS_OPTIONS_MILES = [0.5, 1, 2, 5] as const;

/** "½ mi" reads better than "0.5 mi" in a chip that has to stay narrow. */
export function formatRadiusLabel(miles: number): string {
  return miles === 0.5 ? '½ mi' : `${miles} mi`;
}

/** Where every search opens before anyone touches the radius. */
export const DEFAULT_RADIUS_MILES = 1;
export const DEFAULT_RADIUS_METERS = 1609;

/**
 * Ceiling for any search, and only a guard: the selector stops at 5 miles.
 * Mirrors the clamp in search_restaurants(), which is what actually enforces it.
 */
export const MAX_RADIUS_METERS = 80467;

export type SearchMode = 'current_location' | 'searched_location';

export function milesToMeters(miles: number): number {
  return Math.round(miles * 1609.34);
}

/**
 * The radius the search actually used, which is not always the one requested.
 *
 * search_restaurants() clamps every request to a 50 mile ceiling, so the client
 * applies the same clamp to know what the map should draw. It matters most in
 * the case where the map has the most to say: a search that found nothing,
 * where there is no result row to read the real radius from.
 */
export function effectiveRadiusMeters(requestedMiles: number | null): number {
  if (requestedMiles === null) return DEFAULT_RADIUS_METERS;
  return Math.min(milesToMeters(requestedMiles), MAX_RADIUS_METERS);
}

/** "0.5 mi" / "50 mi". Used for the radius chips and the map's coverage label. */
export function formatRadiusMiles(meters: number): string {
  const miles = meters / 1609.34;
  const rounded = miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles);
  return `${rounded} mi`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Real uploads live in Supabase Storage. An Unsplash URL, or anything under
// representative/, is a picture of the kind of food, not the restaurant's own
// photo, and the UI says so wherever one is shown.
export function isStockPhoto(url: string): boolean {
  return url.includes('images.unsplash.com') || url.includes('/representative/');
}

// A business's own mark, taken from its website. Shown whole on a plain
// background: cropping a logo to fill a card makes it look like a photograph
// of the food, which it is not. The prefix is set by
// scripts/catalogue/publish-business-images.mjs.
export function isBusinessLogo(url: string): boolean {
  return url.includes('/business-logo/');
}
