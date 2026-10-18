'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HalalBadge } from './HalalBadge';
import { ArrowRightIcon, HeartIcon } from './icons';
import { ctaPrimary } from './cta';
import { ruledList } from './prose';
import { removeSaved, useSaved } from '@/lib/saved';
import { fromRow, type MapPlace, type MapPlaceRow } from '@/lib/mapPlaceShape';
import { track } from '@/lib/analytics/posthog';

// The places saved on this phone, each with its label as it stands today.
// Names and labels come from /api/map-places, the list the map's dots use: one
// request the edge already holds, and a place that has left the site drops out
// of it, so it is shown as no longer listed rather than with an old label.

export function SavedList() {
  const saved = useSaved();
  const [ready, setReady] = useState(false);
  const [places, setPlaces] = useState<Map<string, MapPlace> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => setReady(true), []);

  const wanted = saved.length > 0;
  useEffect(() => {
    if (!wanted || places) return;
    let live = true;
    fetch('/api/map-places')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { places: MapPlaceRow[] }) => {
        if (live) setPlaces(new Map(json.places.map((row) => [row[0], fromRow(row)])));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [wanted, places]);

  if (!ready || (wanted && !places && !failed)) {
    return (
      <ul className={ruledList} aria-busy="true" aria-label="Loading your saved places">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center justify-between gap-4 py-4">
            <span className="h-4 w-48 animate-pulse rounded-full bg-black/[0.06]" />
            <span className="h-4 w-20 animate-pulse rounded-full bg-black/[0.06]" />
          </li>
        ))}
      </ul>
    );
  }

  if (!wanted) {
    return (
      <div className="max-w-md">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <HeartIcon className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-display text-xl font-semibold text-ink">Nothing saved yet</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
          Tap Save on any place and it will show up here. Your list stays on this phone, so you do not need to sign in.
        </p>
        <Link href="/" className={`${ctaPrimary} mt-5`}>
          Find a place
          <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    );
  }

  if (failed) {
    return (
      <p role="alert" className="text-[15px] text-muted">
        We could not load your saved places just now. Please try again in a minute.
      </p>
    );
  }

  return (
    <ul className={`${ruledList} max-w-2xl`}>
      {saved.map((slug) => {
        const p = places!.get(slug);
        return (
          <li key={slug} className="flex items-center gap-3 py-3.5">
            {p ? (
              <Link href={`/restaurant/${slug}`} className="group min-w-0 flex-1">
                <span className="block truncate font-display text-[17px] font-semibold text-ink group-hover:text-accent-ink">
                  {p.name}
                  {p.branchLabel && <span className="font-sans text-sm font-normal text-muted"> · {p.branchLabel}</span>}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <HalalBadge classification={p.classification} size="sm" />
                  {p.cuisineLabel && <span className="text-xs text-muted">{p.cuisineLabel}</span>}
                </span>
              </Link>
            ) : (
              <span className="min-w-0 flex-1 text-sm text-muted">This place is no longer on the site.</span>
            )}
            <button
              type="button"
              onClick={() => {
                removeSaved(slug);
                track('place_unsaved', { slug, from: 'saved_page' });
              }}
              className="inline-flex min-h-[40px] shrink-0 items-center rounded-full px-3 text-sm font-semibold text-muted transition hover:bg-black/[0.05] hover:text-ink"
              aria-label={p ? `Remove ${p.name}` : 'Remove'}
            >
              Remove
            </button>
          </li>
        );
      })}
    </ul>
  );
}
