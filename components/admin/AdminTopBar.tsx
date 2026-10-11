import Link from 'next/link';
import { ArrowUpRightIcon, SearchIcon, UserIcon } from '@/components/icons';

// One search box for the whole admin, on every page: restaurants by name,
// postcode or address, people by email, messages by sender or words. A plain
// GET form, so it works before any JavaScript arrives and the results page
// has an address that can be shared or reloaded. On a laptop the live site and
// your account sit at its right; on a phone they are in the menu.
export function AdminTopBar({ q = '' }: { q?: string }) {
  return (
    <div className="sticky top-14 z-20 border-b border-line bg-sand-soft/90 backdrop-blur lg:top-0">
      <form action="/admin/search" role="search" className="flex items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <label htmlFor="admin-search" className="sr-only">
          Search the admin
        </label>
        <div className="relative w-full max-w-xl">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            id="admin-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search restaurants, people and messages"
            autoComplete="off"
            className="h-10 w-full rounded-full border border-black/10 bg-white pl-10 pr-4 text-[16px] text-ink placeholder:text-subtle focus:border-accent-ink focus:outline-none focus:ring-2 focus:ring-accent-ink/20 sm:text-sm"
          />
        </div>
        <div className="ml-auto hidden shrink-0 items-center gap-1 lg:flex">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink/75 transition hover:bg-white hover:text-ink"
          >
            <ArrowUpRightIcon className="h-4 w-4" />
            Live site
          </a>
          <Link
            href="/account"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink/75 transition hover:bg-white hover:text-ink"
          >
            <UserIcon className="h-4 w-4" />
            Your account
          </Link>
        </div>
      </form>
    </div>
  );
}
