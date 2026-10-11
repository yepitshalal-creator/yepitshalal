import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isInLondon } from '@/lib/geocode';
import { matchBoroughs } from '@/lib/londonBoroughs';
import { cleanRestaurantName } from '@/lib/restaurantName';
import type { HalalStatus } from '@/lib/types';

// Autocomplete for the one search box. Every source is free and keyless, so
// typing carries no per-keystroke billing risk:
//
//   postcodes.io   full and partial postcodes, postcode districts, towns
//   OpenStreetMap  streets, stations, landmarks, neighbourhoods, boroughs
//                  (via Photon, which is built for search-as-you-type; the
//                  Nominatim usage policy forbids autocomplete)
//   our database   restaurants, by name, from anywhere in London
//
// Restaurant matches are deliberately *not* limited by radius. Someone typing a
// restaurant's name wants that restaurant, not "that restaurant if it happens to
// be within half a mile". Picking one opens its page, which is public and free
// for everyone, so this changes no entitlement: the radius rules still govern
// browsing an area, which is what they price.

export type LocationKind = 'postcode' | 'outcode' | 'place' | 'borough' | 'street' | 'station' | 'landmark';

export interface LocationSuggestion {
  kind: LocationKind;
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
}

export interface RestaurantSuggestion {
  kind: 'restaurant';
  id: string;
  slug: string;
  label: string;
  sublabel: string;
  halal_status: HalalStatus;
  branchCount: number;
}

const POSTCODE_START = /^[a-z]{1,2}\d/i;
const OUTCODE = /^([a-z]{1,2}\d[a-z\d]?)/i;
const MAX_LOCATIONS = 5;

/** Reference data changes slowly, so each distinct query is fetched once a day at most. */
async function getJson(url: string, revalidate = 86400): Promise<unknown> {
  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Slow or unreachable. The other sources still answer.
    return null;
  }
}

const postcodesIo = (path: string) => getJson(`https://api.postcodes.io${path}`);

// Photon is a fair-use public service. It is only asked about queries that are
// not postcode-shaped, the results are cached per query, and the box debounces
// keystrokes, so one person typing one word costs a handful of cached lookups.
const LONDON_BBOX = '-0.51,51.28,0.33,51.70';
const photon = (q: string, limit: number) =>
  getJson(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&bbox=${LONDON_BBOX}&lang=en`
  );

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    postcode?: string;
    district?: string;
    city?: string;
    county?: string;
  };
}

const outcodeOf = (postcode?: string) => postcode?.trim().split(/\s+/)[0]?.toUpperCase();

/**
 * The bounding box is a rectangle, and London is not: it also takes in slices of
 * Hertfordshire, Essex, Kent and Surrey ("Green Street" in Hertsmere, "Green
 * Street Green" in Dartford). Admin fields decide instead where they exist.
 */
function photonInLondon(f: PhotonFeature): boolean {
  const [lng, lat] = f.geometry.coordinates;
  if (!isInLondon(lat, lng)) return false;
  const p = f.properties;
  return p.city === 'London' || p.county === 'Greater London';
}

function classifyPhoton(p: PhotonFeature['properties']): LocationKind | null {
  const key = p.osm_key;
  const value = p.osm_value ?? '';
  if (key === 'place' && ['suburb', 'quarter', 'neighbourhood', 'village', 'town', 'hamlet'].includes(value)) {
    return 'place';
  }
  // type 'street' is what separates a road from the bus stops named after it.
  if (key === 'highway' && p.type === 'street') return 'street';
  if (
    (key === 'railway' && (value === 'station' || value === 'halt')) ||
    (key === 'public_transport' && value === 'station') ||
    (key === 'building' && value === 'train_station')
  ) {
    return 'station';
  }
  if (
    (key === 'tourism' && (value === 'attraction' || value === 'museum')) ||
    key === 'historic' ||
    (key === 'leisure' && value === 'park') ||
    (key === 'amenity' && value === 'marketplace')
  ) {
    return 'landmark';
  }
  return null;
}

function describePhoton(kind: LocationKind, p: PhotonFeature['properties']): string {
  const outcode = outcodeOf(p.postcode);
  const where = [p.district, outcode].filter(Boolean).join(', ');
  const noun = { place: 'Area', street: 'Street', station: 'Station', landmark: 'Landmark' }[
    kind as 'place' | 'street' | 'station' | 'landmark'
  ];
  return where ? `${noun} · ${where}` : noun;
}

async function boroughSuggestions(query: string): Promise<LocationSuggestion[]> {
  const matches = matchBoroughs(query).slice(0, 2);
  const found = await Promise.all(
    matches.map(async (borough) => {
      // A boundary barely moves, so this one is cached for a month.
      const json = (await getJson(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(borough.official)}&limit=10&bbox=${LONDON_BBOX}&lang=en`,
        2592000
      )) as { features?: PhotonFeature[] } | null;
      const hit = json?.features?.find((f) => {
        const p = f.properties;
        const isArea =
          (p.osm_key === 'boundary' && p.osm_value === 'administrative') ||
          (p.osm_key === 'place' && (p.osm_value === 'borough' || p.osm_value === 'city'));
        const [lng, lat] = f.geometry.coordinates;
        return isArea && isInLondon(lat, lng) && (p.name ?? '').toLowerCase().includes(borough.name.toLowerCase().replace(/^city of /, ''));
      });
      if (!hit) return null; // No coordinate we can stand behind, so no suggestion.
      const [lng, lat] = hit.geometry.coordinates;
      return { kind: 'borough' as const, label: borough.name, sublabel: 'London borough', lat, lng };
    })
  );
  return found.filter((s): s is NonNullable<typeof s> => s !== null);
}

async function getLocations(query: string): Promise<{ locations: LocationSuggestion[]; usedOsm: boolean }> {
  const out: LocationSuggestion[] = [];
  const has = (label: string) => out.some((s) => s.label.toLowerCase() === label.toLowerCase());

  if (POSTCODE_START.test(query)) {
    const outcode = query.match(OUTCODE)?.[1];
    // Individual postcodes are only offered once the query is specific enough to
    // mean one. For a bare "SE23" they are just the alphabetically first few in
    // the district, which is noise next to the district itself.
    const specific = query.replace(/\s+/g, '').length >= 5;

    const [outcodeRes, postcodeRes] = await Promise.all([
      outcode ? postcodesIo(`/outcodes/${encodeURIComponent(outcode)}`) : null,
      specific ? postcodesIo(`/postcodes?q=${encodeURIComponent(query)}&limit=4`) : null,
    ]);

    const oc = (outcodeRes as { result?: { outcode: string; latitude: number; longitude: number; admin_district?: string[]; admin_ward?: string[] } } | null)?.result;
    if (oc && typeof oc.latitude === 'number' && isInLondon(oc.latitude, oc.longitude)) {
      // Name the neighbourhood at the district's centre rather than listing its
      // wards alphabetically, which put "Crofton Park, Dulwich Hill" ahead of
      // "Forest Hill" for SE23.
      const centre = (await postcodesIo(
        `/postcodes?lon=${oc.longitude}&lat=${oc.latitude}&limit=1&radius=2000`
      )) as { result?: { admin_ward?: string }[] } | null;
      const ward = centre?.result?.[0]?.admin_ward;
      const district = oc.admin_district?.[0];
      out.push({
        kind: 'outcode',
        label: oc.outcode,
        sublabel: [ward ? `Around ${ward}` : null, district].filter(Boolean).join(' · ') || 'London',
        lat: oc.latitude,
        lng: oc.longitude,
      });
    }

    const postcodes = (postcodeRes as { result?: { postcode: string; latitude: number; longitude: number; admin_district?: string; region?: string }[] } | null)?.result ?? [];
    for (const p of postcodes) {
      if (p.region !== 'London' || !isInLondon(p.latitude, p.longitude)) continue;
      out.push({
        kind: 'postcode',
        label: p.postcode,
        sublabel: `Postcode · ${p.admin_district ?? 'London'}`,
        lat: p.latitude,
        lng: p.longitude,
      });
    }

    return { locations: out.slice(0, MAX_LOCATIONS), usedOsm: false };
  }

  const [boroughs, placeRes, photonRes] = await Promise.all([
    boroughSuggestions(query),
    postcodesIo(`/places?q=${encodeURIComponent(query)}&limit=10`),
    photon(query, 15),
  ]);

  let usedOsm = boroughs.length > 0;

  // Towns and neighbourhoods first: they are what most people mean by "where".
  const places = (placeRes as { result?: { name_1: string; latitude: number; longitude: number; region?: string; district_borough?: string }[] } | null)?.result ?? [];
  for (const p of places) {
    if (p.region !== 'London' || !isInLondon(p.latitude, p.longitude)) continue;
    const label = p.name_1.replace(/\b[a-z]/g, (c) => c.toUpperCase());
    if (has(label)) continue;
    out.push({
      kind: 'place',
      label,
      sublabel: p.district_borough ? `Area · ${p.district_borough}` : 'Area',
      lat: p.latitude,
      lng: p.longitude,
    });
  }

  for (const b of boroughs) {
    // Most boroughs share a name with their main town, which is already listed.
    // Both stay, because they are different places to start a search from, but
    // the borough is marked as one.
    out.push(b);
  }

  // Streets repeat once per road segment. Two segments of one name survive only
  // when they are in different postcode districts, which is how a "High Street"
  // in E6 is told apart from one in Harlesden.
  const streetDistricts = new Map<string, Set<string>>();
  let landmarks = 0;
  const features = (photonRes as { features?: PhotonFeature[] } | null)?.features ?? [];
  for (const f of features) {
    if (!photonInLondon(f)) continue;
    const p = f.properties;
    const kind = classifyPhoton(p);
    if (!kind || !p.name) continue;
    // Station entrances are mapped as stations of their own; the station is enough.
    if (/\bentrance\b/i.test(p.name)) continue;
    // Landmarks help ("Brick Lane Market") but fuzzy matching finds a lot of
    // them, so they cannot be allowed to crowd out streets and areas.
    if (kind === 'landmark' && landmarks >= 2) continue;
    if (kind === 'landmark') landmarks++;
    const [lng, lat] = f.geometry.coordinates;

    if (kind === 'street') {
      const key = p.name.toLowerCase();
      const districts = streetDistricts.get(key) ?? new Set<string>();
      const outcode = outcodeOf(p.postcode) ?? '';
      if (districts.has(outcode) || districts.size >= 2) continue;
      districts.add(outcode);
      streetDistricts.set(key, districts);
    } else if (has(p.name)) {
      continue;
    }

    out.push({ kind, label: p.name, sublabel: describePhoton(kind, p), lat, lng });
    usedOsm = true;
  }

  return { locations: out.slice(0, MAX_LOCATIONS), usedOsm };
}

interface SuggestRow {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  branch_label: string | null;
  address: string;
  postcode: string | null;
  halal_status: HalalStatus;
  cuisines: string[] | null;
  brand_branch_count: number;
}

/** "Whitechapel · Turkish": what tells one result from another at a glance. */
function describe(row: SuggestRow): string {
  const area = row.branch_label || outcodeOf(row.postcode ?? undefined) || row.address.split(',').slice(-2)[0]?.trim();
  const cuisine = row.cuisines?.[0];
  return [area, cuisine].filter(Boolean).join(' · ') || 'London';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim().slice(0, 80);

  // Two characters is where suggestions start being about something rather than
  // just the alphabet.
  if (query.length < 2) {
    return NextResponse.json({ locations: [], restaurants: [], attribution: [] });
  }

  const supabase = createServerSupabase();

  const [{ locations, usedOsm }, { data: rows }] = await Promise.all([
    getLocations(query),
    supabase.rpc('suggest_restaurants', { p_query: query, p_limit: 8, p_include_candidates: false }),
  ]);

  const seen = new Set<string>();
  // Capped by displayed name, not by brand id: one chain can hold several brand
  // rows under slightly different spellings, and capping per id lets all of them
  // through as what looks like the same name over and over.
  const perLabel = new Map<string, number>();
  const restaurants: RestaurantSuggestion[] = [];
  for (const row of (rows ?? []) as SuggestRow[]) {
    const label = cleanRestaurantName(row.brand_name ?? row.name);
    const sublabel = describe(row);
    const key = `${label.toLowerCase()}|${sublabel.toLowerCase()}`;
    if (seen.has(key)) continue;
    const count = perLabel.get(label.toLowerCase()) ?? 0;
    if (count >= 2) continue;
    perLabel.set(label.toLowerCase(), count + 1);
    seen.add(key);
    restaurants.push({
      kind: 'restaurant',
      id: row.id,
      slug: row.slug,
      label,
      sublabel,
      halal_status: row.halal_status,
      branchCount: row.brand_branch_count,
    });
    if (restaurants.length >= 5) break;
  }

  return NextResponse.json({
    locations,
    restaurants,
    // OpenStreetMap data is ODbL: it has to be credited wherever it is shown.
    attribution: usedOsm ? ['© OpenStreetMap contributors'] : [],
  });
}
