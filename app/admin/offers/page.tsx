import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { createOffer, deleteOffer } from '@/lib/admin-actions';
import { ConfirmSubmitButton } from '@/components/admin/ConfirmSubmitButton';
import { SearchIcon, TrashIcon, XIcon } from '@/components/icons';
import { AdminPage, Panel, List, Row, Field, Tag, FIELD, BUTTON, BUTTON_SECONDARY } from '@/components/admin/ui';
import { adminCached } from '@/lib/admin/cache';
import { cleanQuery, loadCatalogue, readFilters } from '@/lib/admin/catalogue';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Offers' };

interface OfferRow {
  id: string;
  title: string;
  description: string | null;
  yep_plus_only: boolean;
  is_early_access: boolean;
  voucher_code: string | null;
  restaurants: { name: string } | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadOffers = adminCached(
  async () => {
    const { data } = await createAdminSupabase()
      .from('offers')
      .select('id, title, description, yep_plus_only, is_early_access, voucher_code, restaurants(name)')
      .order('created_at', { ascending: false });
    return (data ?? []) as unknown as OfferRow[];
  },
  'offers-v1',
  300
);

// The restaurant is picked first, by searching, because a dropdown of the
// whole catalogue is 12,000 names long and the database hands back at most
// 1,000 of them, so most restaurants could never be chosen.
export default async function AdminOffersPage({ searchParams }: { searchParams: { find?: string; restaurant?: string } }) {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const find = cleanQuery(searchParams.find ?? '');
  const pickedId = UUID.test(searchParams.restaurant ?? '') ? searchParams.restaurant! : null;

  const [rows, picked, matches] = await Promise.all([
    loadOffers(),
    pickedId
      ? createAdminSupabase()
          .from('restaurants')
          .select('id, name, borough, address')
          .eq('id', pickedId)
          .maybeSingle()
          .then((r) => r.data as { id: string; name: string; borough: string | null; address: string | null } | null)
      : null,
    find && !pickedId ? loadCatalogue({ ...readFilters({}), q: find, sort: 'name' }) : null,
  ]);

  return (
    <AdminPage
      tabs={<SectionTabs section="deals" current="/admin/offers" />}
      title="Offers"
      width="lg"
      description="Simple offers only: there is no way to redeem or pay for one yet. A voucher code on a supporters-only offer stays hidden from everyone else."
    >
      <div className="space-y-5">
        <Panel title="New offer">
          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Which restaurant?</p>
              {picked ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-sand-soft/60 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{picked.name}</span>
                    <span className="block truncate text-xs text-muted">{picked.borough ?? picked.address ?? ''}</span>
                  </span>
                  <Link href="/admin/offers" className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-subtle hover:text-ink">
                    <XIcon className="h-4 w-4" />
                    Change
                  </Link>
                </div>
              ) : (
                <>
                  <form action="/admin/offers" className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <label htmlFor="offer-find" className="sr-only">
                        Restaurant name, postcode or address
                      </label>
                      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                      <input id="offer-find" name="find" type="search" defaultValue={find} placeholder="Name, postcode or address" className={`${FIELD} pl-10`} />
                    </div>
                    <button type="submit" className={BUTTON_SECONDARY}>
                      Find
                    </button>
                  </form>
                  {matches && (
                    <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
                      {matches.rows.length === 0 && <li className="px-4 py-3 text-sm text-muted">No restaurant matches.</li>}
                      {matches.rows.slice(0, 8).map((r) => (
                        <li key={r.id}>
                          <Link href={`/admin/offers?restaurant=${r.id}`} className="block px-4 py-2.5 transition-colors hover:bg-sand-soft/60">
                            <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                            <span className="block truncate text-xs text-muted">{r.borough ?? r.address}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1.5 text-xs text-subtle">Or skip this to show the offer everywhere.</p>
                </>
              )}
            </div>

            <form action={createOffer} className="space-y-4 border-t border-line pt-4">
              <input type="hidden" name="restaurant_id" value={picked?.id ?? ''} />
              <Field label="Title" htmlFor="offer-title">
                <input id="offer-title" name="title" required placeholder="For example, 20% off your bill" className={FIELD} />
              </Field>

              <Field label="Description" htmlFor="offer-description">
                <textarea id="offer-description" name="description" rows={2} className={FIELD} />
              </Field>

              <Field label="Voucher code" htmlFor="offer-voucher" hint="Optional.">
                <input id="offer-voucher" name="voucher_code" className={FIELD} />
              </Field>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Who sees it</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/80">
                  <label className="inline-flex min-h-[36px] items-center gap-2">
                    <input type="checkbox" name="yep_plus_only" defaultChecked className="h-4 w-4 accent-accent-ink" />
                    Supporters only
                  </label>
                  <label className="inline-flex min-h-[36px] items-center gap-2">
                    <input type="checkbox" name="is_early_access" className="h-4 w-4 accent-accent-ink" />
                    Early access
                  </label>
                </div>
              </fieldset>

              <button type="submit" className={BUTTON}>
                {picked ? 'Create offer' : 'Create offer for everywhere'}
              </button>
            </form>
          </div>
        </Panel>

        <Panel title="All offers" action={<Tag>{rows.length}</Tag>}>
          <List empty="No offers yet.">
            {rows.map((o) => (
              <Row key={o.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{o.title}</p>
                  <p className="truncate text-xs text-muted">
                    {o.restaurants?.name ?? 'Everywhere'}
                    {o.voucher_code ? `, code ${o.voucher_code}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {o.yep_plus_only ? <Tag tone="ink">Supporters only</Tag> : <Tag>Everyone</Tag>}
                  {o.is_early_access && <Tag tone="accent">Early access</Tag>}
                  <form action={deleteOffer.bind(null, o.id)}>
                    <ConfirmSubmitButton
                      message={`Delete the offer "${o.title}"? This cannot be undone.`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-halal-partialInk transition hover:bg-halal-partialSoft"
                    >
                      <TrashIcon className="h-[18px] w-[18px]" />
                      <span className="sr-only">Delete offer</span>
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </Row>
            ))}
          </List>
        </Panel>
      </div>
    </AdminPage>
  );
}
