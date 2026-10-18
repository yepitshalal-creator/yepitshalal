import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SearchView } from '@/components/SearchView';
import { runSearch } from '@/lib/search';
import type { HalalStatus } from '@/lib/types';

// Search result pages are for the person searching, not for search engines: the
// indexable versions of "halal restaurants near X" are the area pages.
export const metadata: Metadata = {
  title: 'Halal restaurants near you',
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { lat?: string; lng?: string; mode?: string; label?: string; only?: string };
}) {
  const lat = Number(searchParams.lat);
  const lng = Number(searchParams.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) redirect('/');

  const mode = searchParams.mode === 'searched_location' ? 'searched_location' : 'current_location';
  // Browse's "Fully Halal near me" opens search already filtered. Only the
  // two labels with evidence a person can act on are accepted here.
  const only: HalalStatus[] =
    searchParams.only === 'fully_halal' || searchParams.only === 'halal_options' ? [searchParams.only] : [];
  const initial = await runSearch({ lat, lng, mode, sort: 'evidence', classification: only });

  return (
    <SearchView
      // Keyed by location: moving from one search to another inside the app
      // keeps this component mounted, and its state is only seeded from these
      // props on first mount. Without the key the new place would show the
      // previous place's results under its own name.
      key={`${lat},${lng},${mode},${only.join(',')}`}
      lat={lat}
      lng={lng}
      mode={mode}
      label={searchParams.label || 'your area'}
      initial={initial}
      initialClassifications={only}
    />
  );
}
