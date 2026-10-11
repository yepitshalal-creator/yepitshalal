'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { LogoLockup, LogoMark } from '../Logo';
import {
  SealCheckIcon,
  ForkKnifeIcon,
  UserIcon,
  GridIcon,
  InboxIcon,
  ChartIcon,
  MenuIcon,
  XIcon,
  TicketIcon,
  UsersIcon,
  CoinsIcon,
  PulseIcon,
  GearIcon,
  ArrowUpRightIcon,
} from '../icons';
import { SECTIONS, onTab, type CountKey, type SectionId } from '@/lib/admin/sections';

// The admin's own chrome since 2026-10-10: a teal sidebar on a laptop and a
// teal bar with a menu on a phone, in place of the public site's header. The
// sections sit in groups that say what each is for. The numbers are what is
// waiting on somebody, counted on the server by lib/admin/stats.ts; Setup's
// number is what is still to switch on (lib/admin/setup.ts). Pages that do one
// job share an item and show as tabs on each other (lib/admin/sections.ts).
// Setup is pinned to the sidebar's foot, where its number stays in view.

export type NavCounts = Record<CountKey, number>;

type Item = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** The numbers added up on this item's badge. */
  counts?: CountKey[];
  /** Other addresses that belong to this item: a section's other tabs. */
  match?: string[];
  exact?: boolean;
};

/** One sidebar item for a whole section: its first tab's address, every tab's numbers. */
function section(id: SectionId, Icon: Item['Icon']): Item {
  const tabs = SECTIONS[id].tabs;
  return {
    href: tabs[0].href,
    label: SECTIONS[id].label,
    Icon,
    match: tabs.map((t) => t.href),
    counts: tabs.flatMap((t) => (t.count ? [t.count] : [])),
  };
}

const GROUPS: { title: string | null; items: Item[] }[] = [
  {
    title: null,
    items: [
      { href: '/admin', label: 'Overview', Icon: GridIcon, exact: true },
      { href: '/admin/inbox', label: 'Inbox', Icon: InboxIcon, counts: ['messages'] },
      { href: '/admin/activity', label: 'Activity', Icon: PulseIcon },
      section('analytics', ChartIcon),
    ],
  },
  {
    title: 'Running the site',
    items: [
      section('restaurants', ForkKnifeIcon),
      section('checks', SealCheckIcon),
      section('partners', UserIcon),
      section('deals', TicketIcon),
    ],
  },
  {
    title: 'People and money',
    items: [
      { href: '/admin/people', label: 'People', Icon: UsersIcon },
      { href: '/admin/money', label: 'Money', Icon: CoinsIcon },
    ],
  },
];

const SETUP: Item = { href: '/admin/setup', label: 'Setup', Icon: GearIcon, counts: ['setup'] };

const ALL = [...GROUPS.flatMap((g) => g.items), SETUP];

// Pages that live under another section's address without their own nav item.
const ALIASES: Record<string, string> = {
  '/admin/subscriptions': '/admin/money',
};

function isActive(item: Item, pathname: string) {
  const path = Object.entries(ALIASES).find(([from]) => pathname.startsWith(from))?.[1] ?? pathname;
  if (item.exact) return path === item.href;
  return [item.href, ...(item.match ?? [])].some((href) => onTab(path, href));
}

function Badge({ n, active }: { n: number; active: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={clsx(
        'ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums',
        active ? 'bg-forest-deep text-accent-onDark' : 'bg-accent text-forest-deep'
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

function NavLink({ item, counts, pathname, onPick }: { item: Item; counts: NavCounts; pathname: string; onPick?: () => void }) {
  const active = isActive(item, pathname);
  const n = (item.counts ?? []).reduce((sum, key) => sum + (counts[key] ?? 0), 0);
  return (
    <Link
      href={item.href}
      onClick={onPick}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex min-h-[32px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors',
        active ? 'bg-white text-ink' : 'text-white/80 hover:bg-white/10 hover:text-white'
      )}
    >
      <item.Icon className={clsx('h-[18px] w-[18px] shrink-0', active ? 'text-accent-ink' : 'text-white/55')} />
      <span className="truncate">{item.label}</span>
      <Badge n={n} active={active} />
    </Link>
  );
}

function Links({ counts, pathname, onPick, withSetup }: { counts: NavCounts; pathname: string; onPick?: () => void; withSetup?: boolean }) {
  const groups = withSetup ? [...GROUPS, { title: 'System', items: [SETUP] }] : GROUPS;
  return (
    <div className="space-y-3">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">{group.title}</p>
          )}
          <ul className="space-y-px">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} counts={counts} pathname={pathname} onPick={onPick} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <div className="space-y-0.5 border-t border-white/10 pt-3">
      <a
        href="/"
        target="_blank"
        rel="noopener"
        className="flex min-h-[38px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ArrowUpRightIcon className="h-[18px] w-[18px] shrink-0 text-white/55" />
        Open the live site
      </a>
      <Link
        href="/account"
        className="flex min-h-[38px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <UserIcon className="h-[18px] w-[18px] shrink-0 text-white/55" />
        Your account
      </Link>
    </div>
  );
}

const ADMIN_PILL =
  'rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-onDark ring-1 ring-accent/40';

/** The sidebar's head: the full lockup, with "Admin" under it, since the two
 *  side by side are wider than the sidebar. */
function Brand() {
  return (
    <Link href="/admin" className="inline-flex flex-col items-start gap-1.5 rounded-xl py-1" aria-label="Admin overview">
      <LogoLockup tone="dark" />
      <span className={ADMIN_PILL}>Admin</span>
    </Link>
  );
}

/** The phone bar has less room still: the mark alone, then "Admin". */
function BrandCompact() {
  return (
    <Link href="/admin" className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl" aria-label="Admin overview">
      <LogoMark size={30} />
      <span className={ADMIN_PILL}>Admin</span>
    </Link>
  );
}

export function AdminNav({ counts }: { counts: NavCounts }) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const current = ALL.find((i) => isActive(i, pathname)) ?? ALL[0];
  const waiting = ALL.filter((i) => i !== SETUP).reduce(
    (sum, item) => sum + (item.counts ?? []).reduce((n, key) => n + (counts[key] ?? 0), 0),
    0
  );

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Laptop and up: a sidebar the full height of the window that stays put
          while the page scrolls. */}
      <aside
        aria-label="Admin sections"
        className="ground-dark sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-forest-deep px-3 pb-4 pt-3 text-white lg:flex"
      >
        <div className="px-2 pb-3">
          <Brand />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto pb-2 [scrollbar-width:thin]">
          <Links counts={counts} pathname={pathname} />
        </nav>
        {/* The live site and your account sit in the top bar on a laptop. */}
        <div className="border-t border-white/10 pt-2">
          <NavLink item={SETUP} counts={counts} pathname={pathname} />
        </div>
      </aside>

      {/* Phone and tablet: where you are, and a button for everything else. */}
      <div className="ground-dark sticky top-0 z-30 bg-forest-deep text-white lg:hidden">
        <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
          <BrandCompact />
          <span className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold text-white/85">{current.label}</span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="admin-menu"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-semibold text-white ring-1 ring-white/15"
          >
            {open ? <XIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
            Menu
            {!open && waiting > 0 && (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] leading-5 text-forest-deep">
                {waiting}
              </span>
            )}
          </button>
        </div>
        {open && (
          <nav
            id="admin-menu"
            aria-label="Admin sections"
            className="max-h-[calc(100dvh-3.5rem)] space-y-4 overflow-y-auto border-t border-white/10 px-3 py-4 animate-sheet-up"
          >
            <Links counts={counts} pathname={pathname} onPick={() => setOpen(false)} withSetup />
            <Footer />
          </nav>
        )}
      </div>
    </>
  );
}
