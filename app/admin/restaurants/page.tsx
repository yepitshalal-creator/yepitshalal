import Link from 'next/link';
import clsx from 'clsx';
import { requireAdmin } from '@/lib/require-admin';
import { HalalBadge } from '@/components/HalalBadge';
import { PlusIcon, ArrowUpRightIcon, ArrowLeftIcon, ArrowRightIcon, SealCheckIcon, UserIcon, SearchIcon } from '@/components/icons';
import { AdminPage, BUTTON, BUTTON_SECONDARY, FIELD } from '@/components/admin/ui';
import { ago } from '@/lib/admin/format';
import {
  SHOWS,
  SHOWS_LABEL,
  STATUSES,
  STATUS_LABEL,
  SORTS,
  SORT_LABEL,
  filterHref,
  hiddenReason,
  loadCatalogue,
  readFilters,
  showsAs,
  type CatalogueRow,
} from '@/lib/admin/catalogue';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Restaurants' };

const SELECT = `${FIELD} sm:w-auto`;

function ShowsAsCell({ r }: { r: CatalogueRow }) {
  const s = showsAs(r);
  if (s === 'hidden') {
    return (
      <span className="inline-flex flex-col">
        <span className="text-xs font-semibold text-ink/70">Hidden</span>
        <span className="text-xs text-subtle">{hiddenReason(r)}</span>
      </span>
    );
  }
  return <HalalBadge classification={s} size="sm" />;
}

export default async function AdminRestaurantsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const f = readFilters(searchParams);
  const { rows, total, pages, facets, boroughs } = await loadCatalogue(f);
  const filtered = Boolean(f.q || f.borough || f.checked || f.owned || f.status !== 'any');

  return (
    <AdminPage
      tabs={<SectionTabs section="restaurants" current="/admin/restaurants" />}
      title="Restaurants"
      width="xl"
      description={
        filtered
          ? `${total.toLocaleString('en-GB')} records match. Showing ${SHOWS_LABEL[f.shows].toLowerCase()}.`
          : `Every record in the catalogue: ${facets.all.toLocaleString('en-GB')} in all, ${(facets.fully_halal + facets.halal_options + facets.unverified).toLocaleString('en-GB')} with a halal label, ${facets.unknown.toLocaleString('en-GB')} with no evidence (not shown) and ${facets.hidden.toLocaleString('en-GB')} hidden from search.`
      }
      action={
        <Link href="/submit-restaurant" className={BUTTON_SECONDARY}>
          <PlusIcon className="h-4 w-4" />
          Add restaurant
        </Link>
      }
    >
      {/* What a visitor sees, as tabs with counts. */}
      <nav aria-label="Filter by what visitors see" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SHOWS.map((s) => {
          const active = f.shows === s;
          return (
            <Link
              key={s}
              href={filterHref(f, { shows: s })}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition',
                active ? 'bg-ink text-white' : 'border border-line bg-white text-ink/80 hover:border-ink/30'
              )}
            >
              {SHOWS_LABEL[s]}
              <span className={clsx('tabular-nums text-xs', active ? 'text-white/70' : 'text-subtle')}>
                {facets[s].toLocaleString('en-GB')}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* The rest of the filters: a plain form, so it works without JavaScript
          and every view has an address. */}
      <form action="/admin/restaurants" className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-sm">
        {f.shows !== 'all' && <input type="hidden" name="shows" value={f.shows} />}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="relative">
            <label htmlFor="cat-q" className="sr-only">
              Name, postcode or address
            </label>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input id="cat-q" name="q" type="search" defaultValue={f.q} placeholder="Name, postcode or address" className={`${FIELD} pl-10`} />
          </div>
          <div>
            <label htmlFor="cat-borough" className="sr-only">
              Borough
            </label>
            <select id="cat-borough" name="borough" defaultValue={f.borough} className={SELECT}>
              <option value="">All boroughs</option>
              {boroughs.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cat-status" className="sr-only">
              Open or closed
            </label>
            <select id="cat-status" name="status" defaultValue={f.status} className={SELECT}>
              <option value="any">Any state</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cat-sort" className="sr-only">
              Order
            </label>
            <select id="cat-sort" name="sort" defaultValue={f.sort} className={SELECT}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex min-h-[32px] items-center gap-2 text-sm text-ink/85">
            <input type="checkbox" name="checked" value="1" defaultChecked={f.checked} className="h-4 w-4 accent-[#276F0A]" />
            Checked by us
          </label>
          <label className="inline-flex min-h-[32px] items-center gap-2 text-sm text-ink/85">
            <input type="checkbox" name="owned" value="1" defaultChecked={f.owned} className="h-4 w-4 accent-[#276F0A]" />
            Has an owner account
          </label>
          <div className="ml-auto flex items-center gap-2">
            {filtered && (
              <Link href={filterHref({ ...f, q: '', borough: '', status: 'any', checked: false, owned: false })} className="text-sm font-semibold text-subtle hover:text-ink">
                Clear
              </Link>
            )}
            <button type="submit" className={BUTTON}>
              Show
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">No records match. Try fewer filters.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-sand-soft/60 text-xs text-subtle">
              <tr>
                <th scope="col" className="w-full px-4 py-2.5 font-medium">Restaurant</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Area</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Visitors see</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium xl:table-cell">Evidence</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Last checked</th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top transition-colors hover:bg-sand-soft/50">
                  <td className="w-full max-w-0 px-4 py-3">
                    <Link href={`/admin/restaurants/${r.id}`} className="block truncate font-semibold text-ink hover:underline">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      {r.brands?.name && <span>{r.brands.name}</span>}
                      {r.cuisine_label && <span>{r.cuisine_label}</span>}
                      {r.owner_id && (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-spice-ink">
                          <UserIcon className="h-3 w-3" />
                          Owner
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-subtle md:hidden">{r.address}</p>
                  </td>
                  <td className="hidden max-w-[260px] px-4 py-3 md:table-cell">
                    <p className="truncate text-ink/85">{r.borough ?? 'No borough'}</p>
                    <p className="truncate text-xs text-subtle">{r.address}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ShowsAsCell r={r} />
                  </td>
                  <td className="hidden px-4 py-3 xl:table-cell">
                    <span className="text-xs text-ink/80">
                      {r.halal_evidence_strength
                        ? `${r.halal_evidence_strength.charAt(0).toUpperCase()}${r.halal_evidence_strength.slice(1)}`
                        : 'None yet'}
                    </span>
                    {r.checked_by_us && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-halal-fullInk">
                        <SealCheckIcon className="h-3.5 w-3.5" />
                        Checked by us
                      </span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-muted lg:table-cell">
                    {r.halal_checked_at ? ago(r.halal_checked_at) : 'Never'}
                  </td>
                  <td className="px-2 py-3 text-right sm:px-4">
                    {/* On a phone the name is the way in, so the row keeps its room for it. */}
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/admin/restaurants/${r.id}`}
                        className="hidden min-h-[34px] items-center rounded-full border border-line px-3 text-xs font-semibold text-ink transition hover:border-ink/30 sm:inline-flex"
                      >
                        Open
                      </Link>
                      {r.is_searchable && (
                        <a
                          href={`/restaurant/${r.slug}`}
                          target="_blank"
                          rel="noopener"
                          title="The live page"
                          className="inline-flex min-h-[34px] items-center rounded-full px-2 text-accent-ink transition hover:bg-accent-soft"
                        >
                          <ArrowUpRightIcon className="h-4 w-4" />
                          <span className="sr-only">Open the live page for {r.name}</span>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm">
          {f.page > 1 ? (
            <Link href={filterHref(f, { page: f.page - 1 })} className={BUTTON_SECONDARY}>
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {f.page.toLocaleString('en-GB')} of {pages.toLocaleString('en-GB')}
          </span>
          {f.page < pages ? (
            <Link href={filterHref(f, { page: f.page + 1 })} className={BUTTON_SECONDARY}>
              Next
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </AdminPage>
  );
}
