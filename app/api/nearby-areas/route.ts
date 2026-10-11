import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { DEFAULT_RADIUS_METERS } from '@/lib/types';

// Suggestions for a search that found nothing: the nearest areas that do have
// places with halal evidence. See nearby_listing_areas() for why this suggests other searches
// rather than widening the current one.

export interface NearbyArea {
  label: string;
  outcode: string;
  lat: number;
  lng: number;
  distance_meters: number;
  places: number;
}

interface Row {
  outcode: string;
  lat: number;
  lng: number;
  distance_meters: number;
  places: number;
}

/** "SE6" means little to most people; "Catford South" means somewhere. */
async function neighbourhood(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes?lon=${lng}&lat=${lat}&limit=1&radius=1000`,
      { next: { revalidate: 2592000 }, signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.result?.[0]?.admin_ward ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const radius = Number(searchParams.get('radius_meters'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
    return NextResponse.json({ error: 'lat, lng and radius_meters are required' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase.rpc('nearby_listing_areas', {
    p_lat: lat,
    p_lng: lng,
    p_exclude_radius_meters: Math.round(radius),
    // Where each suggestion leads: a place search, which opens at this radius.
    p_destination_radius_meters: DEFAULT_RADIUS_METERS,
    p_limit: 3,
    p_include_candidates: false,
  });

  if (error) {
    return NextResponse.json({ areas: [] });
  }

  const areas: NearbyArea[] = await Promise.all(
    ((data ?? []) as Row[]).map(async (row) => {
      const ward = await neighbourhood(row.lat, row.lng);
      return {
        label: ward ?? row.outcode,
        outcode: row.outcode,
        lat: row.lat,
        lng: row.lng,
        distance_meters: row.distance_meters,
        places: row.places,
      };
    })
  );

  return NextResponse.json({ areas });
}
