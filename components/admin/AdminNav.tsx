'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  SealCheckIcon,
  ForkKnifeIcon,
  SparkleIcon,
  UserIcon,
  MapIcon,
  MapPinIcon,
  ListIcon,
  PlusIcon,
  PhoneIcon,
  StarIcon,
  HeartHandIcon,
  GridIcon,
  InboxIcon,
  ChartIcon,
  MenuIcon,
  XIcon,
  TicketIcon,
  MailIcon,
} from '../icons';

// The admin's map. It used to be one row of fourteen tabs that scrolled
// sideways; now the sections sit in four groups that say what each is for,
// as a sidebar on a laptop and a menu button on a phone. The numbers are what
// is waiting on somebody, counted on the server by lib/admin/stats.ts.

export interface NavCounts {
  messages: number;
  submissions: number;
  checks: number;
  claims: number;
  deals: number;
}

type Item = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  count?: keyof NavCounts;
  exact?: boolean;
};

const GROUPS: { title: string | null; items: Item[] }[] = [
  {
    title: null,
    items: [
      { href: '/admin', label: 'Overview', Icon: GridIcon, exact: true },
      { href: '/admin/inbox', label: 'Inbox', Icon: InboxIcon, count: 'messages' },
      { href: '/admin/analytics', label: 'Analytics', Icon: ChartIcon },
    ],
  },
  {
    title: 'Listings',
    items: [
      { href: '/admin/submissions', label: 'Submissions', Icon: PlusIcon, count: 'submissions' },
      { href: '/admin/queue', label: 'Verification queue', Icon: SealCheckIcon, count: 'checks' },
      { href: '/admin/verify', label: 'What to check next', Icon: PhoneIcon },
      { href: '/admin/certification', label: 'Certification', Icon: SealCheckIcon },
      { href: '/admin/restaurants', label: 'Restaurants', Icon: ForkKnifeIcon },
      { href: '/admin/duplicates', label: 'Duplicates', Icon: ListIcon },
      { href: '/admin/coverage', label: 'Coverage', Icon: MapPinIcon },
    ],
  },
  {
    title: 'Restaurants and owners',
    items: [
      { href: '/admin/founders', label: 'Founders', Icon: StarIcon },
      { href: '/admin/claims', label: 'Ownership claims', Icon: UserIcon, count: 'claims' },
      { href: '/admin/outreach', label: 'Outreach', Icon: MailIcon },
      { href: '/admin/offers', label: 'Offers', Icon: SparkleIcon },
      { href: '/admin/reels', label: 'Reels', Icon: MapIcon },
    ],
  },
  {
    title: 'Deals',
    items: [{ href: '/admin/deals', label: 'Deals and credit', Icon: TicketIcon, count: 'deals' }],
  },
  {
    title: 'People',
    items: [
      { href: '/admin/subscriptions', label: 'Supporters', Icon: HeartHandIcon },
      { href: '/admin/demand', label: 'Where next', Icon: MapPinIcon },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

function isActive(item: Item, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Badge({ n, onDark }: { n: number; onDark: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={clsx(
        'ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums',
        onDark ? 'bg-accent text-forest-deep' : 'bg-accent-soft text-accent-ink'
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

function Links({ counts, pathname, onPick }: { counts: NavCounts; pathname: string; onPick?: () => void }) {
  return (
    <div className="space-y-5">
      {GROUPS.map((group, gi) => (
        <div key={gi}>
          {group.title && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{group.title}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item, pathname);
              const n = item.count ? counts[item.count] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onPick}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors',
                      active ? 'bg-forest-deep text-white' : 'text-ink/75 hover:bg-sand-soft hover:text-ink'
                    )}
                  >
                    <item.Icon className={clsx('h-[18px] w-[18px] shrink-0', active ? 'text-accent-onDark' : 'text-subtle')} />
                    <span className="truncate">{item.label}</span>
                    <Badge n={n} onDark={active} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminNav({ counts }: { counts: NavCounts }) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const current = ALL.find((i) => isActive(i, pathname)) ?? ALL[0];
  const waiting = counts.messages + counts.submissions + counts.checks + counts.claims + counts.deals;

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Laptop and up: a sidebar that stays put while the page scrolls. */}
      <aside
        aria-label="Admin sections"
        className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-white px-3 py-5 lg:block"
      >
        <p className="mb-4 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          Admin
        </p>
        <nav>
          <Links counts={counts} pathname={pathname} />
        </nav>
      </aside>

      {/* Phone and tablet: where you are, and a button for everything else. */}
      <div className="sticky top-14 z-20 border-b border-line bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 px-4 py-2 sm:px-6">
          <span className="inline-flex min-h-[32px] items-center rounded-full bg-forest-deep px-3 text-[11px] font-semibold uppercase tracking-wide text-white">
            Admin
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{current.label}</span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="admin-menu"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-ink"
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
          <nav id="admin-menu" aria-label="Admin sections" className="max-h-[70vh] overflow-y-auto border-t border-line px-3 py-4 animate-sheet-up">
            <Links counts={counts} pathname={pathname} onPick={() => setOpen(false)} />
          </nav>
        )}
      </div>
    </>
  );
}
