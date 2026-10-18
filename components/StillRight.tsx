'use client';

import Link from 'next/link';
import { useState } from 'react';
import { track } from '@/lib/analytics/posthog';

// "Is this still right?", one tap, under the halal label (the 2026-10-12 plan,
// Step 2). Stale listings are the top complaint about every halal finder, so
// the question sits beside the answer, not in the page's small print.
//
// Yes is counted (PostHog) and thanked. Something changed, and It has closed,
// open the same edit form as before, the second with the note filled in, so
// the report reaches the admin like every other suggestion. Nothing here
// changes a label: a person checks first.

const PILL =
  'inline-flex min-h-[36px] items-center rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink transition hover:border-ink/30 active:scale-[0.98]';

export function StillRight({ slug }: { slug: string }) {
  const [thanked, setThanked] = useState(false);

  if (thanked) {
    return (
      <p role="status" className="text-sm text-muted">
        Thanks. That helps the next person.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-semibold text-ink">Is this still right?</span>
      <button
        type="button"
        className={PILL}
        onClick={() => {
          track('place_still_right', { slug, answer: 'yes' });
          setThanked(true);
        }}
      >
        Yes
      </button>
      <Link
        href={`/submit-restaurant?update=${slug}`}
        className={PILL}
        onClick={() => track('place_still_right', { slug, answer: 'changed' })}
      >
        Something changed
      </Link>
      <Link
        href={`/submit-restaurant?update=${slug}&closed=1`}
        className={PILL}
        onClick={() => track('place_still_right', { slug, answer: 'closed' })}
      >
        It has closed
      </Link>
    </div>
  );
}
