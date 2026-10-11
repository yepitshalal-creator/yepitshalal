import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { updateRestaurant, deletePhoto, setPrimaryPhoto, setPriceRange } from '@/lib/admin-actions';
import { PRICE_RANGES } from '@/lib/price';
import { assignRestaurantOwner, setPartnership } from '@/lib/reel-actions';
import { getReelAllowance } from '@/lib/reels';
import { PhotoUploader } from '@/components/PhotoUploader';
import { ConfirmSubmitButton } from '@/components/admin/ConfirmSubmitButton';
import { HalalBadge } from '@/components/HalalBadge';
import { ArrowUpRightIcon, StarIcon, TrashIcon } from '@/components/icons';
import { AdminPage, Panel, Field, FIELD, BUTTON, BUTTON_SECONDARY } from '@/components/admin/ui';
import type { HalalClassification } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminRestaurantEditPage({ params }: { params: { id: string } }) {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const supabase = createAdminSupabase();
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, address, description, phone, website_url, menu_url, halal_classification, owner_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!restaurant) notFound();

  const { data: photos } = await supabase
    .from('restaurant_photos')
    .select('id, storage_path, is_primary')
    .eq('restaurant_id', restaurant.id)
    .order('is_primary', { ascending: false });

  const admin2 = createAdminSupabase();
  const [{ data: partnership }, { data: owner }, allowance, { data: price }] = await Promise.all([
    admin2.from('restaurant_partnerships').select('*').eq('restaurant_id', restaurant.id).maybeSingle(),
    restaurant.owner_id
      ? admin2.from('users').select('email').eq('id', restaurant.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getReelAllowance(restaurant.id),
    // Its own query: before migration 0053 the columns do not exist and the
    // panel below simply has nothing to show.
    admin2.from('restaurants').select('price_range, price_range_source, price_range_at').eq('id', restaurant.id).maybeSingle(),
  ]);

  const updateWithId = updateRestaurant.bind(null, restaurant.id);
  const priceNow = price as { price_range: number | null; price_range_source: string | null; price_range_at: string | null } | null;

  return (
    <AdminPage
      title={restaurant.name}
      description={
        <span className="inline-flex items-center gap-2">
          <HalalBadge
            classification={restaurant.halal_classification as HalalClassification}
            size="sm"
          />
          <span>Set by verification, not here.</span>
        </span>
      }
      action={
        <Link
          href={`/restaurant/${restaurant.slug}`}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft"
        >
          View listing
          <ArrowUpRightIcon className="h-4 w-4" />
        </Link>
      }
    >
      <div className="space-y-5">
        <Panel title="Details">
          <form action={updateWithId} className="space-y-4 px-5 py-4">
            <Field label="Name" htmlFor="name">
              <input id="name" name="name" defaultValue={restaurant.name} className={FIELD} />
            </Field>
            <Field label="Address" htmlFor="address">
              <input
                id="address"
                name="address"
                defaultValue={restaurant.address}
                className={FIELD}
              />
            </Field>
            <Field label="Description" htmlFor="description">
              <textarea
                id="description"
                name="description"
                defaultValue={restaurant.description ?? ''}
                rows={3}
                className={FIELD}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={restaurant.phone ?? ''}
                  className={FIELD}
                />
              </Field>
              <Field label="Website" htmlFor="website_url">
                <input
                  id="website_url"
                  name="website_url"
                  type="url"
                  defaultValue={restaurant.website_url ?? ''}
                  placeholder="https://"
                  className={FIELD}
                />
              </Field>
            </div>
            <Field label="Menu URL" htmlFor="menu_url">
              <input
                id="menu_url"
                name="menu_url"
                type="url"
                defaultValue={restaurant.menu_url ?? ''}
                placeholder="https://"
                className={FIELD}
              />
            </Field>
            <button type="submit" className={BUTTON}>
              Save details
            </button>
          </form>
        </Panel>

        <Panel title="Price a head">
          <form action={setPriceRange.bind(null, restaurant.id)} className="space-y-4 px-5 py-4">
            <p className="text-sm text-muted">
              Only what the owner told us. Never a guess from the menu.
              {priceNow?.price_range_at && (
                <> Last set {new Date(priceNow.price_range_at).toLocaleDateString('en-GB')}{priceNow.price_range_source === 'owner_by_phone' ? ', on a call' : ''}.</>
              )}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Price" htmlFor="price_range">
                <select id="price_range" name="price_range" defaultValue={String(priceNow?.price_range ?? '')} className={FIELD}>
                  <option value="">Not known</option>
                  {PRICE_RANGES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.signs} {p.words}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="How the owner told us" htmlFor="how">
                <select id="how" name="how" defaultValue={priceNow?.price_range_source === 'owner' ? 'writing' : 'phone'} className={FIELD}>
                  <option value="phone">On a call</option>
                  <option value="writing">In writing</option>
                </select>
              </Field>
            </div>
            <button type="submit" className={BUTTON_SECONDARY}>
              Save price
            </button>
          </form>
        </Panel>

        <Panel title="Photos" action={<PhotoUploader restaurantId={restaurant.id} />}>
          <div className="px-5 py-4">
            {(photos ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No photos yet.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(photos ?? []).map((photo) => (
                  <li
                    key={photo.id}
                    className="group relative aspect-square overflow-hidden rounded-xl bg-halal-unverifiedSoft"
                  >
                    <Image
                      src={photo.storage_path}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 33vw, 160px"
                      className="object-cover"
                    />
                    {photo.is_primary && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        <StarIcon className="h-3 w-3" />
                        Main
                      </span>
                    )}
                    {/* focus-within, not just hover: these controls were
                        unreachable by keyboard inside a hover-only overlay. */}
                    <div className="absolute inset-0 flex items-end justify-center gap-1.5 bg-black/0 p-1.5 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 group-focus-within:bg-black/45 group-focus-within:opacity-100">
                      {!photo.is_primary && (
                        <form action={setPrimaryPhoto.bind(null, restaurant.id, photo.id)}>
                          <button
                            type="submit"
                            title="Set as main photo"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm transition hover:bg-white"
                          >
                            <StarIcon className="h-4 w-4" />
                            <span className="sr-only">Set as main photo</span>
                          </button>
                        </form>
                      )}
                      <form action={deletePhoto.bind(null, restaurant.id, photo.id)}>
                        <ConfirmSubmitButton
                          message="Delete this photo? This cannot be undone."
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-halal-partialInk shadow-sm transition hover:bg-white"
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span className="sr-only">Delete photo</span>
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Owner">
          <form action={assignRestaurantOwner.bind(null, restaurant.id)} className="space-y-3 px-5 py-4">
            <p className="text-sm leading-relaxed text-muted">
              Linking an account hands them edit rights over this listing and the ability to
              publish reels, so only link someone you have actually verified. They must have
              signed in at least once. Leave blank to unlink.
            </p>
            <Field label="Owner email" htmlFor="owner_email">
              <input
                id="owner_email"
                name="owner_email"
                type="email"
                defaultValue={owner?.email ?? ''}
                placeholder="owner@restaurant.com"
                className={FIELD}
              />
            </Field>
            <button type="submit" className={BUTTON_SECONDARY}>
              Save owner
            </button>
          </form>
        </Panel>

        <Panel title="Partnership">
          <form action={setPartnership.bind(null, restaurant.id)} className="space-y-4 px-5 py-4">
            <p className="text-sm leading-relaxed text-muted">
              Controls reel capacity only. It has no bearing on halal classification, on the
              verification queue, or on how quickly a reel is reviewed.
            </p>

            <div className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-sm text-ink/80">
              Currently {allowance.published} of {allowance.allowance} reels published
              {allowance.isPartner ? ' (partner)' : allowance.isFounder ? ' (Founder, 3 free for life)' : ' (free tier)'}.
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Status" htmlFor="status">
                <select
                  id="status"
                  name="status"
                  defaultValue={partnership?.status ?? 'none'}
                  className={FIELD}
                >
                  <option value="none">None (free tier)</option>
                  <option value="active">Active partner</option>
                  <option value="past_due">Past due</option>
                  <option value="canceled">Canceled</option>
                </select>
              </Field>
              <Field
                label="Reel allowance override"
                htmlFor="reel_allowance_override"
                hint="Blank uses the tier default from platform_settings."
              >
                <input
                  id="reel_allowance_override"
                  name="reel_allowance_override"
                  type="number"
                  min={0}
                  defaultValue={partnership?.reel_allowance_override ?? ''}
                  className={FIELD}
                />
              </Field>
            </div>

            <Field label="Note" htmlFor="note" hint="Internal only.">
              <input id="note" name="note" defaultValue={partnership?.note ?? ''} className={FIELD} />
            </Field>

            <button type="submit" className={BUTTON}>
              Save partnership
            </button>
          </form>
        </Panel>
      </div>
    </AdminPage>
  );
}
