'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { RestaurantCard } from './RestaurantCard';
import { RestaurantCardSkeleton } from './RestaurantCardSkeleton';
import { RadiusSelector } from './RadiusSelector';
import { PlaceSheet } from './PlaceSheet';
import { ClusterSheet } from './ClusterSheet';
import { FilterSheet } from './FilterSheet';
import {
  ArrowRightIcon,
  ListIcon,
  MapIcon,
  MapPinIcon,
  SearchIcon,
  SlidersIcon,
  ClockIcon,
  HalalFullMark,
  HalalPartialMark,
  HalalUnknownMark,
  InfoIcon,
  XIcon,
} from './icons';
import { DEFAULT_RADIUS_MILES, effectiveRadiusMeters, formatRadiusMiles } from '@/lib/types';
import type { HalalStatus, SearchResultRestaurant, TierCount } from '@/lib/types';
import type { SearchResponse, SortOrder } from '@/lib/search';
import type { NearbyArea } from '@/app/api/nearby-areas/route';
import type { MapPrayerSpace } from './RestaurantMap';
import { formatMetres, walkingMinutes } from '@/lib/prayerSpaces';
import { HYGIENE_FILTERS } from '@/lib/hygiene/display';
import { PRICE_RANGES } from '@/lib/price';
import { MASK_CLASS } from '@/lib/analytics/scrub';
import { fromRow, type MapPlace, type MapPlaceRow } from '@/lib/mapPlaceShape';
import { distanceMeters } from '@/lib/geo';

const RestaurantMap = dynamic(() => import('./RestaurantMap').then((m) => m.RestaurantMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading map…</div>,
});

interface SearchViewProps {
  lat: number;
  lng: number;
  mode: 'current_location' | 'searched_location';
  label: string;
  initial: SearchResponse;
}

// Same marks the cards use, so the filter row and the map legend read in the
// one visual language rather than a second colour-coded one.
const CLASSIFICATION_FILTERS: {
  value: HalalStatus;
  label: string;
  Mark: typeof HalalFullMark;
  tone: string;
}[] = [
  { value: 'fully_halal', label: 'Fully Halal', Mark: HalalFullMark, tone: 'text-halal-full' },
  { value: 'halal_options', label: 'Halal food available', Mark: HalalPartialMark, tone: 'text-halal-partial' },
  { value: 'unverified', label: 'Unverified', Mark: HalalUnknownMark, tone: 'text-halal-unverified' },
];

// Places listed at a time. The map pins the same ones, so it never shows a
// crowd the list has not reached; each "Show more" adds the next lot to both.
// Every other place is only a small quiet dot behind them (nearby, below).
const PAGE = 30;

/**
 * Evidence first or Nearest, and Popular once enough places nearby have earned
 * it (lib/popular.ts). A choice of order, not a filter, so it sits on the page
 * beside Filters rather than inside the sheet, the way most search sites show
 * theirs. With so few orders a menu would hide one of them: all stay in view
 * and one tap switches.
 */
const SORT_LABEL: Record<SortOrder, string> = { evidence: 'Evidence first', distance: 'Nearest', popular: 'Popular' };

function SortToggle({
  value,
  onChange,
  popular,
  className,
}: {
  value: SortOrder;
  onChange: (sort: SortOrder) => void;
  /** Offer Popular: enough places here have earned it, or it is already on. */
  popular: boolean;
  className?: string;
}) {
  const orders: SortOrder[] = popular ? ['evidence', 'popular', 'distance'] : ['evidence', 'distance'];
  return (
    <div
      role="group"
      aria-label="Sort results"
      className={clsx(
        'flex items-center gap-0.5 rounded-full bg-white p-[3px] shadow-[0_1px_2px_rgba(15,37,43,0.04),0_6px_16px_-10px_rgba(15,37,43,0.18)]',
        className
      )}
    >
      {/* The up and down arrows most sites use for "order". Dropped on the
          narrowest phones, where the two words need the room. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="ml-2 mr-0.5 hidden h-4 w-4 shrink-0 text-subtle min-[360px]:block"
      >
        <path d="M8 19V5M4 9l4-4 4 4M16 5v14M12 15l4 4 4-4" />
      </svg>
      {orders.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={clsx(
            'min-h-[36px] flex-auto whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold transition sm:flex-none sm:px-3',
            value === s ? 'bg-ink text-white' : 'text-ink/55 hover:text-ink'
          )}
        >
          {SORT_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export function SearchView({ lat, lng, mode, label, initial }: SearchViewProps) {
  const [results, setResults] = useState<SearchResultRestaurant[]>(initial.results);
  const [totalCount, setTotalCount] = useState(initial.totalCount);
  const [tierCounts, setTierCounts] = useState<TierCount[]>(initial.tierCounts);
  const [popularReady, setPopularReady] = useState(initial.popularReady);
  // Places a hygiene, open now or price filter left out, so the page can say so.
  const [hiddenByFilters, setHiddenByFilters] = useState<number | null>(initial.hiddenByFilters ?? null);
  // One mile to start: near enough to walk to, and the chip for it is selected.
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [classifications, setClassifications] = useState<HalalStatus[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  // Lowest FSA food hygiene rating to show, or null for any (and unrated).
  const [minHygiene, setMinHygiene] = useState<number | null>(null);
  // Only places whose own hours say open. Places with no hours drop out.
  const [openNow, setOpenNow] = useState(false);
  // Price a head, any of these (lib/price.ts). Empty means any price, or none known.
  const [prices, setPrices] = useState<number[]>([]);
  // Evidence first by default: someone looking for halal food wants the places
  // with a reason to believe first, nearest first within each label.
  const [sort, setSort] = useState<SortOrder>('evidence');
  const [visible, setVisible] = useState(PAGE);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<SearchResultRestaurant | null>(null);
  // Places stacked on one point, offered as a list when the map cannot separate them.
  const [cluster, setCluster] = useState<SearchResultRestaurant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // The radius the server reports it actually used. Null while a search is in
  // flight, when the locally derived value (same clamp) is the honest answer.
  const [serverRadiusMeters, setServerRadiusMeters] = useState<number | null>(initial.effectiveRadiusMeters);
  const [nearbyAreas, setNearbyAreas] = useState<NearbyArea[] | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  // Places to pray, on the same map, off until asked for. They are a different
  // question from the food and must never look like an answer about it.
  const [showPrayer, setShowPrayer] = useState(false);
  const [prayerSpaces, setPrayerSpaces] = useState<MapPrayerSpace[]>([]);
  const [prayerPick, setPrayerPick] = useState<MapPrayerSpace | null>(null);
  // Every place on the site, for the quiet dots round the pins (lib/mapPlaces).
  // Fetched once, a moment after the page is up, and kept at the edge for an hour.
  const [mapPlaces, setMapPlaces] = useState<MapPlace[] | null>(null);
  // Set when the radius was widened automatically, so the page can say so.
  const [expandedFrom, setExpandedFrom] = useState<number | null>(null);
  const userChoseRadius = useRef(false);

  const coverageMeters = serverRadiusMeters ?? effectiveRadiusMeters(radiusMiles);
  const activeFilterCount =
    classifications.length + (query ? 1 : 0) + (minHygiene !== null ? 1 : 0) + (openNow ? 1 : 0) + (prices.length ? 1 : 0);
  const filtered = activeFilterCount > 0;

  const run = useCallback(
    async (miles: number, filters: HalalStatus[], q: string, s: SortOrder, hygiene: number | null, open: boolean, price: number[]) => {
      setLoading(true);
      setFailed(false);
      setServerRadiusMeters(null);
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), mode, radius_miles: String(miles), sort: s });
      if (filters.length) params.set('classification', filters.join(','));
      if (q) params.set('q', q);
      if (hygiene !== null) params.set('hygiene', String(hygiene));
      if (open) params.set('open', '1');
      if (price.length) params.set('price', price.join(','));
      try {
        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) throw new Error();
        const json: SearchResponse = await res.json();
        setResults(json.results);
        setTotalCount(json.totalCount);
        setTierCounts(json.tierCounts);
        setPopularReady(json.popularReady);
        setHiddenByFilters(json.hiddenByFilters ?? null);
        setServerRadiusMeters(json.effectiveRadiusMeters);
        setVisible(PAGE);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [lat, lng, mode]
  );

  // The first view was rendered on the server. Re-running it on mount would only
  // flash skeletons over results already on screen.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    run(radiusMiles, classifications, query, sort, minHygiene, openNow, prices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusMiles, classifications, query, sort, minHygiene, openNow, prices]);

  // Typing filters after a pause, not on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), 350);
    return () => clearTimeout(t);
  }, [queryInput]);

  // Thin area: widen to the nearest radius that has something, and say so.
  // Nobody gets an empty page when there is food a mile further out.
  useEffect(() => {
    if (loading || userChoseRadius.current || filtered || totalCount > 0) return;
    const next = tierCounts.find((t) => t.meters > coverageMeters && t.places > 0);
    if (!next) return;
    setExpandedFrom(radiusMiles);
    setRadiusMiles(next.miles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, totalCount, tierCounts]);

  // Nearby areas for a search that found nothing and was not narrowed by filters.
  const emptyAndUnfiltered = !loading && totalCount === 0 && !filtered;
  useEffect(() => {
    if (!emptyAndUnfiltered) {
      setNearbyAreas(null);
      return;
    }
    let cancelled = false;
    setNearbyAreas(null);
    fetch(`/api/nearby-areas?lat=${lat}&lng=${lng}&radius_meters=${coverageMeters}`)
      .then((res) => res.json())
      .then((json) => !cancelled && setNearbyAreas(json.areas ?? []))
      .catch(() => !cancelled && setNearbyAreas([]));
    return () => {
      cancelled = true;
    };
  }, [emptyAndUnfiltered, lat, lng, coverageMeters]);

  useEffect(() => {
    if (!showPrayer) {
      setPrayerSpaces([]);
      setPrayerPick(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/prayer-spaces?lat=${lat}&lng=${lng}&radius_meters=${Math.round(coverageMeters)}`)
      .then((res) => res.json())
      .then((json) => !cancelled && setPrayerSpaces(json.spaces ?? []))
      .catch(() => !cancelled && setPrayerSpaces([]));
    return () => {
      cancelled = true;
    };
  }, [showPrayer, lat, lng, coverageMeters]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetch('/api/map-places')
        .then((res) => (res.ok ? res.json() : { places: [] }))
        .then((json: { places?: MapPlaceRow[] }) => !cancelled && setMapPlaces((json.places ?? []).map(fromRow)))
        .catch(() => !cancelled && setMapPlaces([]));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // A map that was display:none while MapLibre initialised has a zero-height
  // canvas; it has to re-measure the moment the mobile toggle reveals it.
  const [resizeSignal, setResizeSignal] = useState(0);
  useEffect(() => {
    if (mobileView === 'map') setResizeSignal((n) => n + 1);
  }, [mobileView]);

  useEffect(() => {
    if (!selected && !cluster) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSelected(null);
      setCluster(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, cluster]);

  function toggleClassification(value: HalalStatus) {
    setSelected(null);
    setClassifications((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function clearFilters() {
    setClassifications([]);
    setMinHygiene(null);
    setOpenNow(false);
    setPrices([]);
    setQueryInput('');
    setQuery('');
  }

  const radiusLabel = formatRadiusMiles(coverageMeters);
  const skeletonCount = Math.min(Math.max(results.length, 3), 6);
  const shown = useMemo(() => results.slice(0, visible), [results, visible]);

  // The quiet dots: every other place on the site, so the map round a search
  // is never bare (Shabir, 2026-10-11). A label filter applies to them too. A
  // name, hygiene, open now or price filter hides them, because the dots
  // cannot be checked against those, and a filtered map must show only what
  // matches.
  const dotsFiltered = Boolean(query) || minHygiene !== null || openNow || prices.length > 0;
  const nearby = useMemo(() => {
    if (!mapPlaces || dotsFiltered) return [];
    const pinned = new Set(shown.map((r) => r.slug));
    return mapPlaces.filter(
      (p) => !pinned.has(p.slug) && (classifications.length === 0 || classifications.includes(p.classification))
    );
  }, [mapPlaces, dotsFiltered, shown, classifications]);

  /** A dot opens the same sheet as a pin, filled in from the place's own page data. */
  function openDot(p: MapPlace) {
    setCluster(null);
    setPrayerPick(null);
    setSelected({
      // The dots carry no id (lib/mapPlaceShape.ts). The slug is unique too,
      // and the sheet only uses this to know a new place was opened.
      id: p.slug,
      name: p.name,
      slug: p.slug,
      address: '',
      lat: p.lat,
      lng: p.lng,
      halal_classification: p.classification,
      halal_status: p.classification,
      distance_meters: distanceMeters({ lat, lng }, p),
      primary_photo_path: null,
      cuisines: null,
      effective_radius_meters: coverageMeters,
      is_yep_plus: false,
      brand_name: null,
      branch_label: p.branchLabel,
      halal_evidence_strength: null,
      halal_summary: null,
      cuisine_label: p.cuisineLabel,
      opening_hours: null,
      total_count: 0,
      postcode: null,
      checked_by_us: p.checkedByUs,
    });
  }
  const moreToShow = results.length > visible ? Math.min(PAGE, results.length - visible) : 0;
  const showMore = () => setVisible((v) => v + PAGE);

  const countLine = loading
    ? 'Searching…'
    : failed
      ? "Search didn't load. Try again."
      : `${totalCount} ${totalCount === 1 ? 'place' : 'places'} within ${radiusLabel}${
          hiddenByFilters ? `. ${hiddenByFilters} more hidden by your filters` : ''
        }`;

  const statusFilters = (
    <div role="group" aria-label="Filter by halal status" className="flex flex-wrap gap-2">
      {CLASSIFICATION_FILTERS.map((f) => {
        const on = classifications.includes(f.value);
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => toggleClassification(f.value)}
            aria-pressed={on}
            className={clsx(
              'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition active:scale-[0.98]',
              on
                ? 'bg-ink text-white shadow-[0_6px_16px_-10px_rgba(15,37,43,0.5)]'
                : 'bg-white text-ink/75 shadow-[0_1px_2px_rgba(15,37,43,0.04)] hover:text-ink hover:shadow-[0_4px_12px_-8px_rgba(15,37,43,0.25)]'
            )}
          >
            <f.Mark className={clsx('h-4 w-4 shrink-0', on ? 'text-white' : f.tone)} aria-hidden="true" />
            {f.label}
          </button>
        );
      })}
    </div>
  );

  const chipClass = (on: boolean) =>
    clsx(
      'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition active:scale-[0.98]',
      on
        ? 'bg-ink text-white shadow-[0_6px_16px_-10px_rgba(15,37,43,0.5)]'
        : 'bg-white text-ink/75 shadow-[0_1px_2px_rgba(15,37,43,0.04)] hover:text-ink hover:shadow-[0_4px_12px_-8px_rgba(15,37,43,0.25)]'
    );

  // One choice at a time, so "Any" is a choice too: the way back is in view.
  const hygieneFilters = (
    <div role="group" aria-label="Filter by food hygiene rating" className="flex flex-wrap gap-2">
      {[{ min: null, label: 'Any' }, ...HYGIENE_FILTERS].map((f) => {
        const on = minHygiene === f.min;
        return (
          <button
            key={f.label}
            type="button"
            onClick={() => {
              setSelected(null);
              setMinHygiene(f.min);
            }}
            aria-pressed={on}
            className={chipClass(on)}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  const openNowFilter = (
    <button
      type="button"
      onClick={() => {
        setSelected(null);
        setOpenNow((v) => !v);
      }}
      aria-pressed={openNow}
      className={chipClass(openNow)}
    >
      <ClockIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      Open now
    </button>
  );

  // Prices come only from owners, and today almost none have told us. A chip
  // that always empties the page is worse than no chip, so this waits until
  // the places in this search carry enough prices to choose between.
  const pricedHere = results.filter((r) => r.price_range).length;
  const showPrice = pricedHere >= 3 || prices.length > 0;
  const priceFilters = (
    <div role="group" aria-label="Filter by price a head" className="flex flex-wrap gap-2">
      {PRICE_RANGES.map((p) => {
        const on = prices.includes(p.value);
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              setSelected(null);
              setPrices((prev) => (on ? prev.filter((v) => v !== p.value) : [...prev, p.value].sort()));
            }}
            aria-pressed={on}
            title={p.words}
            className={chipClass(on)}
          >
            <span aria-hidden="true">{p.signs}</span>
            <span className="sr-only">{p.words}</span>
          </button>
        );
      })}
    </div>
  );

  const nameField = (
    <label className="relative block">
      <span className="sr-only">Filter these results by name or cuisine</span>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
      <input
        type="search"
        value={queryInput}
        onChange={(e) => setQueryInput(e.target.value)}
        placeholder="Name or cuisine"
        className="min-h-[44px] w-full rounded-full border border-line bg-white py-1.5 pl-9 pr-3 text-[16px] text-ink placeholder:text-subtle focus:border-accent-ink focus:outline-none focus:ring-2 focus:ring-accent-ink/20 sm:min-h-[38px] sm:text-[13px]"
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl sm:px-6 sm:py-4">
      {/* Three rows on a phone: where, how far, then the order beside Filters.
          Everything else is one tap away in the sheet, because results matter
          more than controls. */}
      <div className="sticky top-14 z-20 bg-sand-soft/92 px-4 pb-3 pt-2.5 backdrop-blur-md after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-5 after:bg-gradient-to-b after:from-sand-soft/85 after:to-transparent sm:static sm:rounded-[22px] sm:px-5 sm:py-4 sm:shadow-[0_1px_2px_rgba(15,37,43,0.03),0_10px_28px_-18px_rgba(15,37,43,0.18)] sm:after:hidden">
        <div className="flex items-center gap-2">
          {/* The place being searched near is whatever the visitor typed, so
              recordings blank it and autocapture never reads it (MASK_CLASS).
              Screen readers get it from the text, not an aria-label, because
              autocapture keeps attributes. */}
          <Link
            href="/"
            className={`${MASK_CLASS} flex min-h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-3.5 text-left max-[359px]:gap-2 max-[359px]:px-3 shadow-[0_1px_2px_rgba(15,37,43,0.04),0_6px_16px_-10px_rgba(15,37,43,0.18)] transition active:scale-[0.99] hover:shadow-[0_2px_4px_rgba(15,37,43,0.05),0_10px_22px_-12px_rgba(15,37,43,0.24)] sm:flex-none sm:pr-4`}
          >
            <MapPinIcon className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase leading-none tracking-wide text-subtle">
                Halal food near
              </span>
              <span className="mt-0.5 block truncate text-[15px] font-semibold leading-tight text-ink">{label}</span>
              <span className="sr-only">. Change location</span>
            </span>
            <SearchIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          </Link>

          <div role="group" aria-label="Result view" className="flex shrink-0 rounded-full bg-white p-[3px] shadow-[0_1px_2px_rgba(15,37,43,0.04),0_6px_16px_-10px_rgba(15,37,43,0.18)] sm:hidden">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMobileView(v)}
                aria-pressed={mobileView === v}
                className={clsx(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold capitalize transition',
                  mobileView === v ? 'bg-ink text-white' : 'text-ink/55 hover:text-ink'
                )}
              >
                {/* Under 360px the words alone, so the place's name beside
                    them has room ("Whitechapel" was cut at 320px). */}
                {v === 'list' ? (
                  <ListIcon className="h-4 w-4 max-[359px]:hidden" aria-hidden="true" />
                ) : (
                  <MapIcon className="h-4 w-4 max-[359px]:hidden" aria-hidden="true" />
                )}
                {v}
              </button>
            ))}
          </div>

          {/* Desktop keeps the name field up here, where there is room for it. */}
          <div className="hidden sm:ml-auto sm:block sm:w-56">{nameField}</div>
        </div>

        <div className="mt-2 flex items-center gap-2 sm:mt-3">
          <RadiusSelector
            selectedMiles={radiusMiles}
            onSelect={(miles) => {
              userChoseRadius.current = true;
              setExpandedFrom(null);
              setRadiusMiles(miles);
            }}
            className="flex-1 sm:max-w-xs sm:flex-none"
          />

          <SortToggle value={sort} onChange={setSort} popular={popularReady || sort === 'popular'} className="ml-auto hidden sm:flex" />
        </div>

        {/* On a phone the order sits beside Filters, as Sort and Filter do on
            most search sites, so changing it never means opening the sheet. */}
        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <SortToggle value={sort} onChange={setSort} popular={popularReady || sort === 'popular'} className="min-w-0 flex-1" />

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={clsx(
              'inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-[0_1px_2px_rgba(15,37,43,0.04),0_6px_16px_-10px_rgba(15,37,43,0.18)] transition active:scale-[0.98]',
              activeFilterCount > 0 ? 'bg-ink text-white' : 'bg-white text-ink/75'
            )}
          >
            <SlidersIcon className="h-4 w-4" aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-ink">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop shows the filters inline: the room is there. */}
        <div className="mt-3 hidden flex-wrap items-center gap-x-5 gap-y-2 sm:flex">
          {statusFilters}
          <span className="flex items-center gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Food hygiene</span>
            {hygieneFilters}
          </span>
          {openNowFilter}
          {showPrice && priceFilters}
        </div>
      </div>

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-line px-4 text-sm font-semibold text-ink transition active:scale-[0.98]"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              {loading ? 'Show results' : `Show ${totalCount} ${totalCount === 1 ? 'place' : 'places'}`}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Halal status</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Pick none to see everything. Nothing here is a judgement on a place we haven&apos;t checked.
            </p>
            <div className="mt-3">{statusFilters}</div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Food hygiene</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              From council food safety checks. Places with no rating are hidden while this is on.
            </p>
            <div className="mt-3">{hygieneFilters}</div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Opening hours</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Most places have not told us their hours yet. While this is on, we only show places we know are open.
            </p>
            <div className="mt-3">{openNowFilter}</div>
          </div>
          {showPrice && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Price a head</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                £ is under £10, ££ is £10 to £20, £££ is over £20. The owner told us.
              </p>
              <div className="mt-3">{priceFilters}</div>
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Name or cuisine</h3>
            <div className="mt-2">{nameField}</div>
          </div>
        </div>
      </FilterSheet>

      {expandedFrom !== null && (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-ink sm:mx-0">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Nothing within {formatRadiusMiles(effectiveRadiusMeters(expandedFrom))}, so we&apos;re showing places within{' '}
            {radiusLabel}.
          </span>
        </p>
      )}

      {/* The count belongs with the results in a list; on the map it moves into
          the map itself, where the rest of the controls are. */}
      <div
        className={clsx(
          'flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3 sm:px-0',
          mobileView === 'map' && 'hidden sm:flex'
        )}
      >
        <p role="status" aria-live="polite" className="text-[13px] font-medium text-ink/75">
          {countLine}
        </p>
        <span className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-black/[0.055] px-2.5 text-xs font-semibold text-ink/75 transition hover:text-ink"
            >
              <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </button>
          )}
          {/* The other half of eating out, offered where the count is rather
              than on a line of its own. It makes no claim about the food.
              A pill rather than a text link: it is an action, and as an
              underlined phrase it read as a footnote about the results. */}
          {!loading && !failed && totalCount > 0 && (
            <Link
              href={`/prayer-spaces?lat=${lat}&lng=${lng}&label=${encodeURIComponent(label)}`}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-ink shadow-[0_1px_2px_rgba(15,37,43,0.04),0_6px_16px_-10px_rgba(15,37,43,0.18)] transition hover:text-accent-ink active:scale-[0.97]"
            >
              <span aria-hidden="true" className="text-[13px] leading-none">
                &#1645;
              </span>
              Nearest mosque
            </Link>
          )}
        </span>
      </div>

      {/* The most important sentence on the page while it is still true. Every
          label here comes from what a restaurant publishes about itself; none
          of these places has been checked by anybody from YepItsHalal. It
          disappears on its own, per result set, as that stops being the case. */}
      {!loading && !failed && totalCount > 0 && !results.some((r) => r.checked_by_us) && (
        <p
          className={clsx(
            'mx-4 mt-2 flex items-start gap-2 text-[12.5px] leading-relaxed text-subtle sm:mx-0',
            mobileView === 'map' && 'hidden sm:flex'
          )}
        >
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/25" aria-hidden="true" />
          <span>
            Nobody from YepItsHalal has visited these yet: every label comes from what the place
            publishes about itself.{' '}
            <Link href="/how-we-check" className="font-medium text-ink/70 underline decoration-black/15 underline-offset-2 hover:text-ink">
              How we label places
            </Link>
          </span>
        </p>
      )}

      <div className="mt-2.5 grid grid-cols-1 gap-4 sm:mt-4 sm:grid-cols-[minmax(0,1fr)_1.1fr]">
        <div
          aria-busy={loading}
          className={clsx('flex flex-col gap-3 px-4 sm:px-0', mobileView === 'map' && 'hidden sm:flex')}
        >
          <h2 className="sr-only">Results</h2>

          {loading && Array.from({ length: skeletonCount }).map((_, i) => <RestaurantCardSkeleton key={i} />)}

          {!loading && totalCount === 0 && filtered && (
            <div className="rounded-2xl border border-dashed border-black/10 px-6 py-12 text-center">
              <MapPinIcon className="mx-auto h-8 w-8 text-subtle" aria-hidden="true" />
              <p className={`${MASK_CLASS} mt-3 font-display text-base font-semibold text-ink`}>
                {query ? `Nothing matching “${query}” within ${radiusLabel}` : 'No matches for these filters'}
              </p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
                Clear the filters, or try a wider radius.
              </p>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-accent-ink active:scale-[0.98]"
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}

          {/* Not a dead end: the nearest areas that do have places, each an
              ordinary search at the usual radius, with the count a visitor will
              see when they get there. */}
          {!loading && totalCount === 0 && !filtered && (
            <div className="rounded-2xl border border-dashed border-black/10 px-5 py-8 sm:px-6">
              <div className="text-center">
                <MapPinIcon className="mx-auto h-8 w-8 text-subtle" aria-hidden="true" />
                <p className="mt-3 font-display text-base font-semibold text-ink">No places found within {radiusLabel} yet</p>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
                  {nearbyAreas && nearbyAreas.length === 0
                    ? "We don't know of any places near here yet."
                    : 'These areas nearby have places to eat.'}
                </p>
              </div>
              {nearbyAreas === null && (
                <ul aria-hidden="true" className="mt-5 space-y-2">
                  {[0, 1, 2].map((n) => (
                    <li key={n} className="h-[58px] animate-pulse rounded-xl bg-black/[0.04]" />
                  ))}
                </ul>
              )}
              {nearbyAreas && nearbyAreas.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {nearbyAreas.map((area) => {
                    const where = `${area.label}, ${area.outcode}`;
                    return (
                      <li key={area.outcode}>
                        <Link
                          href={`/search?lat=${area.lat}&lng=${area.lng}&mode=searched_location&label=${encodeURIComponent(where)}`}
                          className="group flex min-h-[58px] items-center gap-3 rounded-xl border border-line bg-white px-4 py-2.5 transition hover:border-ink/25 hover:shadow-sm"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                            <MapPinIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">{area.label}</span>
                            <span className="block truncate text-xs text-muted">
                              {area.outcode} · {area.places} {area.places === 1 ? 'place' : 'places'} ·{' '}
                              <span className={MASK_CLASS}>{(area.distance_meters / 1609.34).toFixed(1)} mi away</span>
                            </span>
                          </span>
                          <ArrowRightIcon className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-5 text-center text-sm text-muted">
                Know somewhere halal around here?{' '}
                <Link href="/submit-restaurant" className="font-semibold text-accent-ink underline underline-offset-2">
                  Add it
                </Link>
              </p>
            </div>
          )}

          {!loading && shown.map((r, i) => <RestaurantCard key={r.id} restaurant={r} priority={i < 2} layout="tile" />)}

          {!loading && moreToShow > 0 && (
            <button
              type="button"
              onClick={showMore}
              className="mt-1 inline-flex min-h-[44px] items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/30 active:scale-[0.99]"
            >
              Show {moreToShow} more of {totalCount}
            </button>
          )}
          {!loading && totalCount > results.length && results.length <= visible && (
            <p className="text-center text-xs text-muted">
              Showing {results.length} of {totalCount}. Narrow the radius or add a filter to see the rest.
            </p>
          )}
        </div>

        {/* On a phone the map is the whole screen under the controls, minus the
            tab bar. 100dvh rather than vh so the browser's own chrome sliding
            away doesn't leave a strip of dead space. */}
        <div
          className={clsx(
            'relative h-[calc(100dvh-16.875rem)] min-h-[360px] overflow-hidden bg-halal-unverifiedSoft sm:sticky sm:top-[4.5rem] sm:h-[calc(100vh-6rem)] sm:min-h-0 sm:rounded-2xl',
            mobileView === 'list' && 'hidden sm:block'
          )}
        >
          <RestaurantMap
            center={{ lat, lng }}
            restaurants={shown}
            selectedId={selected?.id ?? null}
            onSelect={(r) => {
              setCluster(null);
              setSelected(r);
            }}
            onSelectCluster={(rs) => {
              setSelected(null);
              setCluster(rs);
            }}
            resizeSignal={resizeSignal}
            coverageRadiusMeters={coverageMeters}
            prayerSpaces={showPrayer ? prayerSpaces : []}
            onSelectPrayerSpace={(space) => {
              setSelected(null);
              setCluster(null);
              setPrayerPick(space);
            }}
            nearby={nearby}
            onSelectNearby={openDot}
          />

          {/* One small pill, not a panel: the map is the content, and the key is
              a reference you open when a colour puzzles you. */}
          <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-5rem)]">
            <button
              type="button"
              onClick={() => setLegendOpen((v) => !v)}
              aria-expanded={legendOpen}
              className="flex min-h-[36px] max-w-full items-center gap-2 rounded-full bg-white/95 px-3 text-xs font-semibold text-ink shadow-md ring-1 ring-black/5 backdrop-blur transition active:scale-[0.98]"
            >
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border-2 border-halal-full bg-halal-full/15" />
              <span className="truncate">
                {loading
                  ? 'Searching…'
                  : shown.length < totalCount
                    ? `${shown.length} of ${totalCount} within ${radiusLabel}`
                    : `${totalCount} within ${radiusLabel}`}
              </span>
              <span className="shrink-0 font-medium text-subtle">{legendOpen ? 'Hide' : 'Key'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPrayer((v) => !v)}
              aria-pressed={showPrayer}
              className={clsx(
                'mt-1.5 flex min-h-[36px] items-center gap-2 rounded-full px-3 text-xs font-semibold shadow-md ring-1 ring-black/5 backdrop-blur transition active:scale-[0.98]',
                showPrayer ? 'bg-ink text-white' : 'bg-white/95 text-ink'
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold leading-none',
                  showPrayer ? 'bg-white text-ink' : 'bg-ink text-white'
                )}
              >
                &#1645;
              </span>
              Prayer spaces
              {showPrayer && prayerSpaces.length > 0 && (
                <span className={showPrayer ? 'text-white/70' : 'text-subtle'}>{prayerSpaces.length}</span>
              )}
            </button>
            {legendOpen && (
              <ul className="mt-1.5 w-max rounded-xl bg-white/95 p-2.5 text-xs font-medium text-ink shadow-md ring-1 ring-black/5 backdrop-blur">
                {CLASSIFICATION_FILTERS.map((f) => (
                  <li key={f.value} className="flex items-center gap-1.5 py-0.5">
                    <f.Mark className={clsx('h-4 w-4 shrink-0', f.tone)} aria-hidden="true" />
                    {f.label}
                  </li>
                ))}
                {nearby.length > 0 && (
                  <li className="mt-1 flex items-center gap-1.5 border-t border-line pt-1.5">
                    <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
                      <span className="h-2 w-2 rounded-full bg-halal-full/60 ring-1 ring-white" />
                    </span>
                    Small dots: more places with halal signs
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* On a phone the list and its button are hidden behind the map, so
              the map offers the next places itself. */}
          {!loading && moreToShow > 0 && !selected && !cluster && !prayerPick && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
              <button
                type="button"
                onClick={showMore}
                className="pointer-events-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10 transition hover:bg-accent-ink active:scale-[0.98]"
              >
                <MapPinIcon className="h-4 w-4" aria-hidden="true" />
                Show {moreToShow} more on the map
              </button>
            </div>
          )}

          {selected && <PlaceSheet restaurant={selected} onClose={() => setSelected(null)} />}
          {prayerPick && !selected && (
            <div
              role="dialog"
              aria-label={`${prayerPick.name}, a place to pray`}
              className="absolute inset-x-3 bottom-3 z-30 animate-sheet-up rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10 sm:inset-x-auto sm:left-4 sm:w-80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Somewhere to pray</p>
                  <p className="mt-0.5 font-display text-base font-semibold text-ink">{prayerPick.name}</p>
                  <p className={`${MASK_CLASS} mt-0.5 text-[13px] text-muted`}>
                    {formatMetres(prayerPick.distance_meters)} from the middle of this search · about{' '}
                    {walkingMinutes(prayerPick.distance_meters)} min walk
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrayerPick(null)}
                  aria-label="Close"
                  className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-black/[0.05]"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${prayerPick.lat},${prayerPick.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent-ink hover:underline"
                >
                  Directions
                </a>
                <Link href="/prayer-spaces" className="font-medium text-muted hover:text-ink hover:underline">
                  All prayer spaces
                </Link>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-subtle">
                From OpenStreetMap, not checked by us. Nothing about this place says anything about
                the food nearby.
              </p>
            </div>
          )}

          {!selected && cluster && cluster.length > 0 && (
            <ClusterSheet
              places={cluster}
              onPick={(r) => {
                setCluster(null);
                setSelected(r);
              }}
              onClose={() => setCluster(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
