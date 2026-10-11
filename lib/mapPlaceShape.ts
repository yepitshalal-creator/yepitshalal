import type { HalalClassification } from './types';

// The shape of a map dot (lib/mapPlaces.ts), kept apart from the database
// code so the browser can read it without loading the Supabase client.

/**
 * [slug, lat, lng, label, checked by us, name, branch, cuisine]. Arrays, not
 * objects: a third of the bytes. No id: the slug is unique already, and a
 * UUID on 2,150 rows was a third of the download.
 */
export type MapPlaceRow = [string, number, number, 0 | 1 | 2, 0 | 1, string, string | null, string | null];

export const LABEL_CODES: HalalClassification[] = ['fully_halal', 'halal_options', 'unverified'];

export interface MapPlace {
  slug: string;
  lat: number;
  lng: number;
  classification: HalalClassification;
  checkedByUs: boolean;
  name: string;
  branchLabel: string | null;
  cuisineLabel: string | null;
}

export function fromRow(r: MapPlaceRow): MapPlace {
  return {
    slug: r[0],
    lat: r[1],
    lng: r[2],
    classification: LABEL_CODES[r[3]] ?? 'unverified',
    checkedByUs: r[4] === 1,
    name: r[5],
    branchLabel: r[6],
    cuisineLabel: r[7],
  };
}
