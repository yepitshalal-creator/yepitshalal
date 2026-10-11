'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics/posthog';
import { geocodePostcode } from '@/lib/geocode';
import { SearchIcon, CrosshairIcon } from './icons';
import { SuggestionPanel, type SuggestionItem } from './SearchSuggestions';
import { showNavPending } from './NavPending';

const FULL_POSTCODE = /^[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}$/i;

/**
 * The one search box. The owners page passes its own words, and a hash that
 * opens a picked restaurant's page at the claim box rather than its top.
 */
export function LocationSearchBar({
  placeholder = 'Postcode, area or restaurant',
  restaurantHash = '',
}: { placeholder?: string; restaurantHash?: string } = {}) {
  const router = useRouter();
  const inputId = useId();
  const listId = `${inputId}-list`;
  const errorId = `${inputId}-error`;
  const optionId = useCallback((i: number) => `${inputId}-opt-${i}`, [inputId]);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'locating' | 'searching' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<SuggestionItem[]>([]);
  // The text the current list answers. Typing moves on before the next list
  // arrives, and Enter must never act on suggestions for an older query.
  const [itemsFor, setItemsFor] = useState('');
  const [attribution, setAttribution] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSuggestions = useCallback(async (term: string, signal?: AbortSignal) => {
    const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal });
    const json = await res.json();
    const list: SuggestionItem[] = [...(json.locations ?? []), ...(json.restaurants ?? [])];
    setItems(list);
    setItemsFor(term);
    setAttribution(json.attribution ?? []);
    setActiveIndex(-1);
    setLoadingSuggestions(false);
    return list;
  }, []);

  // Debounced so a typed postcode costs one request, not seven. The previous
  // request is aborted rather than left to land out of order behind the newer
  // one, which is what makes a list flicker between stale and fresh results.
  useEffect(() => {
    const term = query.trim();
    setHint(null);
    if (term.length < 2) {
      abortRef.current?.abort();
      setItems([]);
      setItemsFor('');
      setAttribution([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      loadSuggestions(term, controller.signal).catch(() => {
        // Aborted by the next keystroke, or offline. Either way the previous
        // list stays until something better arrives.
      });
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, loadSuggestions]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (formRef.current?.contains(target as Node)) return;
      // The suggestion panel is portalled to the body, so it is outside the form
      // in the DOM while still being part of this control. Without this, the
      // pointerdown that begins a click on a suggestion tears the panel down
      // before the selection lands.
      if (target?.closest?.('[data-suggestion-panel]')) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Each move also shows the next page's grey shape at once (NavPending): a
  // search reads the database before its page can arrive.
  function go(href: string) {
    showNavPending(href);
    router.push(href);
  }

  function goToLocation(lat: number, lng: number, label: string) {
    track('location_search_submitted', { search_mode: 'location' });
    go(`/search?lat=${lat}&lng=${lng}&mode=searched_location&label=${encodeURIComponent(label)}`);
  }

  function pick(item: SuggestionItem) {
    setOpen(false);
    setHint(null);
    if (item.kind === 'restaurant') {
      // Straight to the restaurant, not a search around it: they named the place
      // they wanted.
      track('location_search_submitted', { search_mode: 'restaurant' });
      go(`/restaurant/${item.slug}${restaurantHash}`);
      return;
    }
    setQuery(item.label);
    goToLocation(item.lat, item.lng, searchLabel(item));
  }

  // The results page heading has to tell apart what the list told apart: there
  // are two Green Streets and dozens of High Streets, so the district travels
  // with the name ("Green Street, Upton Park, E7").
  function searchLabel(item: Exclude<SuggestionItem, { kind: 'restaurant' }>): string {
    if (item.kind === 'borough') return item.label;
    const where = item.sublabel.split(' · ').pop()?.trim();
    const bareType = ['Area', 'Street', 'Station', 'Landmark', 'London'].includes(where ?? '');
    return where && !bareType && where !== item.label ? `${item.label}, ${where}` : item.label;
  }

  function useCurrentLocation() {
    track('current_location_search_requested');
    setError(null);
    setOpen(false);
    setStatus('locating');
    if (!navigator.geolocation) {
      setError("This browser can't share your location. Type a postcode or area name instead.");
      setStatus('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        go(`/search?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&mode=current_location&label=Your location`);
      },
      () => {
        setError("We couldn't get your location. Type a postcode or area name instead.");
        setStatus('error');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Enter on a highlighted suggestion takes it.
    if (activeIndex >= 0 && items[activeIndex]) {
      pick(items[activeIndex]);
      return;
    }

    const term = query.trim();
    if (!term) return;

    // A full postcode is already exact, so it goes straight to the lookup.
    if (!FULL_POSTCODE.test(term)) {
      setStatus('searching');
      // Enter pressed before the debounced list arrived: fetch it now rather than
      // falling through to a place-only lookup that cannot find restaurants. The
      // pending debounced fetch is cancelled first, or it lands a moment later
      // and wipes the highlight this sets.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      abortRef.current?.abort();
      const list = itemsFor === term ? items : await loadSuggestions(term).catch(() => []);
      setStatus('idle');

      const places = list.filter((i) => i.kind !== 'restaurant');
      const restaurants = list.filter((i) => i.kind === 'restaurant');

      // The whole name of one restaurant is unambiguous.
      const exact = restaurants.find((r) => r.label.toLowerCase() === term.toLowerCase());
      if (exact) return pick(exact);

      // Otherwise a place is what pressing Search on a location box means.
      if (places[0]) return pick(places[0]);

      // Only restaurants matched. Guessing which one would be a coin toss, so
      // the list opens with the best match highlighted instead.
      if (restaurants.length > 0) {
        setOpen(true);
        setActiveIndex(list.indexOf(restaurants[0]));
        setHint('Choose a restaurant, or search a postcode, area or street.');
        return;
      }
    }

    setOpen(false);
    setStatus('searching');
    const result = await geocodePostcode(term);
    if (!result) {
      setError(`We couldn't find “${term}” in London. Try a postcode, area, street or restaurant.`);
      setStatus('error');
      return;
    }
    goToLocation(result.lat, result.lng, result.label);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!items.length) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => {
        const next = prev + (e.key === 'ArrowDown' ? 1 : -1);
        if (next < 0) return items.length - 1;
        if (next >= items.length) return 0;
        return next;
      });
    }
  }

  const busy = status === 'searching' || status === 'locating';
  const showPanel = open && query.trim().length >= 2;

  return (
    <div className="w-full max-w-xl">
      <form
        ref={formRef}
        onSubmit={handleSearch}
        role="search"
        className="ground-light flex items-center gap-1.5 rounded-full bg-white p-1.5 shadow-xl shadow-black/15 ring-1 ring-black/5 transition focus-within:ring-2 focus-within:ring-accent-onDark"
      >
        <label htmlFor={inputId} className="sr-only">
          Search by postcode, area, street or restaurant name
        </label>
        <SearchIcon className="ml-3 h-5 w-5 shrink-0 text-subtle" />
        <input
          id={inputId}
          type="text"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={showPanel && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (status === 'error') setStatus('idle');
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-invalid={status === 'error' || undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-3 pl-1.5 pr-1 text-[16px] text-ink placeholder:text-subtle focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-accent-ink active:scale-[0.98] disabled:opacity-60"
        >
          {status === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {showPanel && (
        <SuggestionPanel
          anchorRef={formRef}
          items={itemsFor ? items : []}
          activeIndex={activeIndex}
          listId={listId}
          optionId={optionId}
          loading={loadingSuggestions}
          query={query.trim()}
          attribution={attribution}
          hint={hint}
          onPick={pick}
        />
      )}

      <div className="mt-3 flex items-center justify-center sm:justify-start">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
        >
          <CrosshairIcon className="h-[18px] w-[18px]" />
          {status === 'locating' ? 'Finding you…' : 'Use my location'}
        </button>
      </div>

      {/* role="alert" so the failure is announced, not just repainted. */}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 rounded-xl bg-white/95 px-3.5 py-2.5 text-sm font-medium text-ink shadow-sm"
        >
          {error}
        </p>
      )}
    </div>
  );
}
