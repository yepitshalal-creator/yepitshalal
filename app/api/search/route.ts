import { NextResponse } from 'next/server';
import { runSearch } from '@/lib/search';
import { PUBLIC_STATUSES, type HalalStatus } from '@/lib/types';
import { isHygieneMin } from '@/lib/hygiene/display';
import { parsePriceList } from '@/lib/price';

// A thin pass-through to runSearch(). Search is the same for everyone: no
// entitlement check here or in the database function behind it.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const classification = (searchParams.get('classification') ?? '')
    .split(',')
    .filter((c): c is HalalStatus => (PUBLIC_STATUSES as string[]).includes(c));
  const hygiene = Number(searchParams.get('hygiene'));

  try {
    const response = await runSearch({
      lat,
      lng,
      mode: searchParams.get('mode') === 'searched_location' ? 'searched_location' : 'current_location',
      radiusMiles: Number(searchParams.get('radius_miles')) || null,
      classification,
      query: searchParams.get('q'),
      sort: (['evidence', 'popular'] as const).find((s) => s === searchParams.get('sort')) ?? 'distance',
      minHygiene: isHygieneMin(hygiene) ? hygiene : null,
      openNow: searchParams.get('open') === '1',
      price: parsePriceList(searchParams.get('price')),
    });
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
