'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { SearchIcon, MapIcon, StoreIcon, UserIcon } from './icons';
import { LanguageTab } from './LanguageMenu';

// Mobile-only tab bar. The header hides its links below sm, which previously
// left those routes unreachable on a phone, so this is where they live now.
// "For owners" took the place of "Add" on 2026-10-11, so a restaurant can see
// where to put its details in; adding a place is one tap on from there, and in
// the footer. Four destinations and, since 2026-09-24, the language:
// five, the ceiling that keeps a tab bar scannable. On a phone the header has
// no room left for it, and down here it is always in view and in reach.
const TABS = [
  { href: '/', label: 'Search', Icon: SearchIcon, match: (p: string) => p === '/' || p.startsWith('/search') },
  { href: '/discover', label: 'Discover', Icon: MapIcon, match: (p: string) => p.startsWith('/discover') },
  {
    href: '/owners',
    label: 'For owners',
    Icon: StoreIcon,
    match: (p: string) => p.startsWith('/owners') || p.startsWith('/submit-restaurant') || p.startsWith('/manage'),
  },
  { href: '/account', label: 'Account', Icon: UserIcon, match: (p: string) => p.startsWith('/account') || p.startsWith('/sign-in') },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';

  // Admin runs its own chrome and is desktop-oriented. /founders is a private
  // invitation with one job, and its own bar at the bottom of a phone screen
  // (the way to claim a spot) takes this one's place.
  if (pathname.startsWith('/admin') || pathname.startsWith('/founders')) return null;

  return (
    <nav
      aria-label="Main"
      className="ground-dark fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-forest-deep/95 pb-safe backdrop-blur sm:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              {/* The tabs fill the bar edge to edge, so the focus ring is
                  drawn inside each one: outside, half of it would sit on the
                  page above the bar, off the teal it is coloured for. */}
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors focus-visible:[outline-offset:-4px]',
                  active ? 'text-accent-onDark' : 'text-white/75 hover:text-white'
                )}
              >
                <Icon className={clsx('h-[22px] w-[22px]', active && 'stroke-[2]')} />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1 min-w-0">
          <LanguageTab />
        </li>
      </ul>
    </nav>
  );
}
