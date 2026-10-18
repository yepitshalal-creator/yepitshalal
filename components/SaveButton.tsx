'use client';

import clsx from 'clsx';
import { track } from '@/lib/analytics/posthog';
import { toggleSaved, useSaved } from '@/lib/saved';
import { HeartIcon } from './icons';

/** A heart that keeps this place in Saved, on this phone. No sign-in. */
export function SaveButton({ slug, className }: { slug: string; className?: string }) {
  const saved = useSaved().includes(slug);

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => track(toggleSaved(slug) ? 'place_saved' : 'place_unsaved', { slug })}
      className={className}
    >
      <HeartIcon filled={saved} className={clsx('h-4 w-4', saved && 'text-accent-ink')} />
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
