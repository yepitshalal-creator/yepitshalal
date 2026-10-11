import { createClient } from '@supabase/supabase-js';
import type { HalalClassification } from './types';
import { LABEL_CODES, type MapPlaceRow } from './mapPlaceShape';

// Every place on the site, as little as a map dot needs: where it is, its
// label, and enough to open its sheet. Drawn as small quiet dots behind the
// search's own pins, so the map around a search is never empty (Shabir,
// 2026-10-11: since only places with halal signs are shown, "some of the map
// ends up looking very bare").
//
// Only listed places (is_listed): the same 2,150 the rest of the site shows.
// Nothing here is a new fact: each dot is a place that already has its own
// page and label.

type Row = {
  slug: string;
  name: string;
  location: unknown;
  halal_classification: HalalClassification;
  checked_by_us: boolean | null;
  branch_label: string | null;
  cuisine_label: string | null;
  brands: { name: string } | null;
};

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * restaurants.location is a PostGIS geography point, and PostgREST sends it as
 * hex EWKB ("0101000020E6100000" then x and y as doubles). Read straight from
 * the table there is no lat or lng column, so this reads the point itself
 * rather than adding a database function. GeoJSON is accepted too, in case the
 * API ever starts sending that. Anything else is skipped, never guessed.
 */
export function pointOf(location: unknown): { lat: number; lng: number } | null {
  if (location && typeof location === 'object') {
    const c = (location as { coordinates?: unknown }).coordinates;
    if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') return { lng: c[0], lat: c[1] };
    return null;
  }
  if (typeof location !== 'string' || !/^[0-9a-fA-F]+$/.test(location) || location.length < 42) return null;
  const buf = Buffer.from(location, 'hex');
  const le = buf[0] === 1;
  const type = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  if ((type & 0xff) !== 1) return null; // not a point
  const at = type & 0x20000000 ? 9 : 5; // skip the SRID when there is one
  if (buf.length < at + 16) return null;
  const lng = le ? buf.readDoubleLE(at) : buf.readDoubleBE(at);
  const lat = le ? buf.readDoubleLE(at + 8) : buf.readDoubleBE(at + 8);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Every listed place with a location, read 1,000 at a time (PostgREST's cap). */
export async function getMapPlaces(): Promise<MapPlaceRow[]> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const rows: MapPlaceRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('restaurants')
      .select('slug, name, location, halal_classification, checked_by_us, branch_label, cuisine_label, brands(name)')
      .eq('is_listed', true)
      .is('merged_into', null)
      .not('location', 'is', null)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as unknown as Row[]) {
      const code = LABEL_CODES.indexOf(r.halal_classification);
      const at = pointOf(r.location);
      if (code < 0 || !at) continue;
      rows.push([
        r.slug,
        round(at.lat),
        round(at.lng),
        code as 0 | 1 | 2,
        r.checked_by_us ? 1 : 0,
        r.brands?.name ?? r.name,
        r.branch_label,
        r.cuisine_label,
      ]);
    }
    if (!data || data.length < 1000) break;
  }
  return rows;
}
