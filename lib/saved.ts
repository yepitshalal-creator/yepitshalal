'use client';

import { useSyncExternalStore } from 'react';

// Saved places, kept on this phone only (the 2026-10-12 plan, Step 3: the
// Account tab became Saved, so saving needs no sign-in). Nothing is sent
// anywhere: the list lives in this browser's storage, and the Saved page reads
// each place's current name and label from /api/map-places.
//
// Storage can be missing or throw (a private window, blocked site data), so
// every read and write is guarded and the list simply comes back empty.

const KEY = 'yih:saved:v1';
const EVENT = 'yih:saved-change';
const EMPTY: string[] = [];

let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(slugs: string[]) {
  cache = slugs;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slugs));
  } catch {
    // Kept for this visit only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const fromOtherTab = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', fromOtherTab);
  };
}

/** Newest first. Empty on the server and before the page has loaded. */
export function useSaved(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleSaved(slug: string): boolean {
  const now = read();
  const saved = now.includes(slug);
  write(saved ? now.filter((s) => s !== slug) : [slug, ...now]);
  return !saved;
}

export function removeSaved(slug: string) {
  write(read().filter((s) => s !== slug));
}
