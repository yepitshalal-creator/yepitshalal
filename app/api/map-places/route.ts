import { NextResponse } from 'next/server';
import { getMapPlaces } from '@/lib/mapPlaces';

// Every place on the site as map dots (lib/mapPlaces.ts). The same for
// everyone and slow to change, so the edge keeps it for an hour: the database
// is asked about once an hour, not once a search.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const places = await getMapPlaces();
    return NextResponse.json(
      { places },
      { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch (err) {
    // No dots is fine: the search's own pins never depend on this. Logged so
    // a broken read shows in the function logs instead of a quietly bare map.
    console.error('map-places', err);
    return NextResponse.json({ places: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
