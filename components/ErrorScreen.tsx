'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { reportError } from '@/lib/analytics/posthog';
import { ctaPrimary, ctaSecondary } from './cta';
import { PageHero } from './PageHero';
import { pageShell } from './prose';

// What a visitor sees when a page fails to load, in place of Next's black
// "Application error" screen. Most failures here are the database being slow
// for a few seconds (see lib/search.ts), so the one thing to offer is another
// go, in words a child could follow.
//
// "Try again" asks the server for the page again before redrawing it. On its
// own, reset() would only redraw what the browser already has, which is the
// error.
export function ErrorScreen({
  error,
  reset,
  title,
  lede,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  lede: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <>
      <PageHero tone="sand" title={title} lede={lede} />
      <div className={`${pageShell} pb-8 pt-8`}>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={ctaPrimary}
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
          >
            {pending ? 'Trying again…' : 'Try again'}
          </button>
          <Link href="/" className={ctaSecondary}>
            Go to the home page
          </Link>
        </div>
      </div>
    </>
  );
}
