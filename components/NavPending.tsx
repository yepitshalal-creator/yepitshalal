'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  AreaPageSkeleton,
  QuestionPageSkeleton,
  RestaurantPageSkeleton,
  SearchPageSkeleton,
} from './PageSkeletons';

// The moment a link to a page that reads the database is tapped, the shape of
// that page appears, in grey, until the page itself arrives. Before this a tap
// on a search result did nothing at all for half a second or more, which is
// what made moving around the site feel stuck (Shabir, 2026-10-11: "not as
// smooth going through it").
//
// Why not loading.tsx, which is Next's way of doing this: it streams, so the
// server has already answered 200 before the page knows whether the place
// exists. Measured on a production build on 2026-10-11, even for Googlebot, a
// place that is not on the site answered 200 instead of 404 and a merged one
// 200 instead of 308. This lives only in the browser and changes nothing the
// server sends.

function skeletonFor(pathname: string) {
  if (pathname === '/search') return SearchPageSkeleton;
  if (/^\/restaurant\/[^/]+$/.test(pathname)) return RestaurantPageSkeleton;
  if (/^\/is-it-halal\/(chain\/)?[^/]+$/.test(pathname)) return QuestionPageSkeleton;
  if (/^\/halal-restaurants\/(cuisine\/)?[^/]+$/.test(pathname) && pathname !== '/halal-restaurants/cuisine') {
    return AreaPageSkeleton;
  }
  return null;
}

/** The path a click is about to open in this tab, if it is one of ours. */
function destination(e: MouseEvent): string | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a || a.hasAttribute('download') || (a.target && a.target !== '_self')) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Only a move to another page: a new search on the search page, or a link
  // to a heading on this one, is handled where it happens.
  if (url.pathname === window.location.pathname) return null;
  return url.pathname;
}

export function NavPending() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  // The new page has arrived, or the visitor went back: let go.
  useEffect(() => setPending(null), [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = destination(e);
      if (path && skeletonFor(path)) setPending(path);
    };
    const clear = () => setPending(null);
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', clear);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', clear);
    };
  }, []);

  // Never left on screen if a move fails without changing the address.
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(null), 10000);
    return () => window.clearTimeout(t);
  }, [pending]);

  const Skeleton = pending ? skeletonFor(pending) : null;
  if (!Skeleton) return null;
  // Under the header and over the page being left. Above a page's own fixed
  // bars (z-30), under the phone's tab bar (z-40). Fades in after a beat, so a
  // page that arrives at once never flashes grey.
  return (
    <div className="nav-pending fixed inset-x-0 bottom-0 top-14 z-[35] overflow-hidden bg-sand-soft">
      <Skeleton />
    </div>
  );
}
