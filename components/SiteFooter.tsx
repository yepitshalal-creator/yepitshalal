'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoBadge, LogoWordmark } from './Logo';
import { HeartHandIcon } from './icons';
import { FeedbackBox } from './FeedbackBox';

// Hidden on the two routes that own the full viewport: the Discover feed is a
// snap-scrolling column, and admin has its own chrome.
const HIDDEN_ON = ['/admin'];

export function SiteFooter() {
  const pathname = usePathname() ?? '/';
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <footer className="mt-16 border-t border-sand-line bg-sand-soft">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Before the sitemap, not after it: the moment somebody notices
            something wrong is the moment they will say so. */}
        <div className="mb-10">
          <FeedbackBox />
        </div>

        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="flex max-w-sm items-start gap-4">
            {/* The whole logo: the one place on every page with room for it.
                The wordmark beside it carries the name, so the logo itself is
                decorative here. */}
            <LogoBadge size={88} decorative className="h-[88px] w-[88px] shrink-0 drop-shadow-[0_8px_14px_rgba(11,47,58,0.22)]" />
            <div className="pt-2">
              <LogoWordmark tone="light" className="h-4 w-auto" />
              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                Clear halal information for London: what we know, how we know it, and what we
                haven&apos;t checked yet.
              </p>
            </div>
          </div>

          {/* The column gap narrows from 640 to 767px: at the full 48px the
              third column ran 1px past the window at 640px. */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-6 text-sm sm:grid-cols-3 sm:gap-x-8 md:gap-x-12">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Explore</h2>
              <ul className="mt-2 space-y-0.5 sm:mt-3 sm:space-y-2">
                <li>
                  <Link href="/" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Search
                  </Link>
                </li>
                <li>
                  <Link href="/halal-restaurants" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Browse by borough
                  </Link>
                </li>
                <li>
                  <Link href="/how-we-check" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    How we label places
                  </Link>
                </li>
                <li>
                  <Link href="/halal-restaurants/cuisine" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    By kind of food
                  </Link>
                </li>
                <li>
                  <Link href="/is-it-halal" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Is it halal? Chains A to Z
                  </Link>
                </li>
                <li>
                  <Link href="/prayer-spaces" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Prayer spaces
                  </Link>
                </li>
                <li>
                  <Link href="/image-credits" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Image credits
                  </Link>
                </li>
                <li>
                  <Link href="/discover" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Discover
                  </Link>
                </li>
                <li>
                  <Link href="/yep-plus" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Support us
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                For restaurants
              </h2>
              <ul className="mt-2 space-y-0.5 sm:mt-3 sm:space-y-2">
                <li>
                  <Link href="/submit-restaurant" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Add your restaurant
                  </Link>
                </li>
                <li>
                  <Link href="/account" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    My account
                  </Link>
                </li>
                {/* Owners look here first when something about their own place
                    is wrong, so the route out of a bad label sits with them. */}
                <li>
                  <Link href="/corrections" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Something wrong?
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Legal</h2>
              <ul className="mt-2 space-y-0.5 sm:mt-3 sm:space-y-2">
                <li>
                  <Link href="/privacy" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Privacy
                  </Link>
                </li>
                {/* Saying no to a recording has to be as easy as saying yes, so
                    the answer can be changed from every page. */}
                <li>
                  <Link href="/privacy#recordings" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Recordings
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/corrections" className="inline-flex min-h-[40px] items-center text-muted transition-colors hover:text-ink sm:min-h-[32px]">
                    Corrections
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* The language used to be chosen here. Since 2026-09-24 it is in the
            header, and in the bottom bar on a phone (components/LanguageMenu):
            at the foot of the page it was too hard to find. */}
        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} YepItsHalal · Made in London</p>
          {/* One sentence that wraps as a sentence. As an inline-flex row the
              link became its own column and floated away from its words. */}
          <p className="flex items-start gap-1.5">
            <HeartHandIcon className="mt-px h-4 w-4 shrink-0 text-accent-ink" />
            <span>
              We donate a meal for every month of support, through{' '}
              <a
                href="https://sharethemeal.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-ink underline underline-offset-2"
              >
                ShareTheMeal
              </a>
            </span>
          </p>
        </div>
      </div>
      {/* The tab bar is fixed over the bottom of a phone screen. Main already
          leaves room for it, but the footer comes after main, so without this
          its last line sat underneath the bar. */}
      <div aria-hidden="true" className="h-[calc(3.5rem+env(safe-area-inset-bottom))] sm:hidden" />
    </footer>
  );
}
