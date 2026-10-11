import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { updateRestaurant, deletePhoto, setPrimaryPhoto, setPriceRange } from '@/lib/admin-actions';
import { setCatalogueStatus } from '@/lib/catalogue-actions';
import { PRICE_RANGES } from '@/lib/price';
import { assignRestaurantOwner, setPartnership } from '@/lib/reel-actions';
import { recordCheck } from '@/lib/admin/check-actions';
import { getReelAllowance } from '@/lib/reels';
import { skipOptimiser, thumbUrl } from '@/lib/imageUrl';
import { PhotoUploader } from '@/components/PhotoUploader';
import { DeleteRestaurantButton } from '@/components/DeleteRestaurantButton';
import { ConfirmSubmitButton } from '@/components/admin/ConfirmSubmitButton';
import { CheckForm, type KnownFacts } from '@/components/admin/CheckForm';
import { HalalBadge } from '@/components/HalalBadge';
import { ArrowLeftIcon, ArrowUpRightIcon, SealCheckIcon, StarIcon, TrashIcon } from '@/components/icons';
import { AdminPage, Panel, Field, Tag, FIELD, BUTTON, BUTTON_SECONDARY } from '@/components/admin/ui';
import { CATALOGUE_COLUMNS, STATUS_LABEL, hiddenReason, showsAs, type CatalogueRow } from '@/lib/admin/catalogue';
import { ago, stamp } from '@/lib/admin/format';
import { CHANNEL_LABEL, CONTACT_STATUS } from '@/lib/outreach/labels';
import type { Channel, ContactStatus } from '@/lib/outreach/data';

export const dynamic = 'force-dynamic';

// The browser tab says which place is open, so several can be told apart.
export async function generateMetadata({ params }: { params: { id: string } }) {
  await requireAdmin();
  const { data } = await createAdminSupabase().from('restaurants').select('name').eq('id', params.id).maybeSingle();
  return { title: data?.name ?? 'Restaurant' };
}

// One restaurant, everything about it on one page: what visitors see and why,
// the evidence behind it, a form to record a check, its details and photos,
// owner, deal, reels, history and where the record came from. "Record what
// you find" on What to check next and Certificate claims lands here.

const KIND_LABEL: Record<string, string> = {
  yepitshalal_check: 'Our own check',
  certification: "Certifier's register",
  first_party_statement: "The restaurant's own words",
  certification_claim: 'Says it is certified',
  business_name: 'Its name',
  community_tag: 'Map tag',
  directory_category: 'Directory category',
  owner_submission: 'The owner told us',
  public_submission: 'A diner told us',
};

const CLAIM_LABEL: Record<string, string> = {
  fully_halal: 'Fully Halal',
  halal_options: 'Halal Options',
  halal_mentioned: 'Mentions halal',
  not_halal: 'Not halal',
};

const OUTCOME_LABEL: Record<string, string> = {
  fully_halal: 'Fully Halal',
  halal_options: 'Halal Options',
  unverified: "Couldn't confirm",
  not_halal: 'Told us not halal',
};

interface Evidence {
  id: string;
  kind: string;
  claim: string;
  strength: string;
  source_name: string;
  source_url: string | null;
  excerpt: string | null;
  notes: string | null;
  checked_at: string;
  is_current: boolean;
}

interface Detail extends CatalogueRow {
  description: string | null;
  phone: string | null;
  website_url: string | null;
  menu_url: string | null;
  data_source: string;
  halal_summary: string | null;
  last_checked_at: string | null;
  is_candidate: boolean;
  brand_id: string | null;
  price_range: number | null;
  price_range_source: string | null;
  price_range_at: string | null;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-subtle">{label}</p>
      <div className="mt-1.5 text-sm font-semibold text-ink">{children}</div>
    </div>
  );
}

export default async function AdminRestaurantPage({ params }: { params: { id: string } }) {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const db = createAdminSupabase();
  const { data } = await db
    .from('restaurants')
    .select(`${CATALOGUE_COLUMNS}, description, phone, website_url, menu_url, data_source, halal_summary, last_checked_at, is_candidate, price_range, price_range_source, price_range_at, brand_id`)
    .eq('id', params.id)
    .maybeSingle();
  if (!data) notFound();
  const r = data as unknown as Detail;

  // Outreach for this place, or for its chain's head office.
  const reach = r.brand_id ? `restaurant_id.eq.${r.id},brand_id.eq.${r.brand_id}` : `restaurant_id.eq.${r.id}`;
  const [evidence, facts, history, photos, partnership, owner, allowance, claims, deal, reels, sources, dupes, contacts, yeses] =
    await Promise.all([
      db
        .from('restaurant_halal_evidence')
        .select('id, kind, claim, strength, source_name, source_url, excerpt, notes, checked_at, is_current')
        .eq('restaurant_id', r.id)
        .order('is_current', { ascending: false })
        .order('checked_at', { ascending: false })
        .limit(20),
      db
        .from('restaurant_halal_facts')
        .select('all_meat_halal, serves_non_halal_meat, serves_pork, serves_alcohol, has_certification, certification_body')
        .eq('restaurant_id', r.id)
        .maybeSingle(),
      db
        .from('verification_history')
        .select('id, classification_result, facts_snapshot, verified_at')
        .eq('restaurant_id', r.id)
        .order('verified_at', { ascending: false })
        .limit(10),
      db.from('restaurant_photos').select('id, storage_path, is_primary').eq('restaurant_id', r.id).order('is_primary', { ascending: false }),
      db.from('restaurant_partnerships').select('status, reel_allowance_override, note').eq('restaurant_id', r.id).maybeSingle(),
      r.owner_id ? db.from('users').select('email').eq('id', r.owner_id).maybeSingle() : Promise.resolve({ data: null }),
      getReelAllowance(r.id),
      db
        .from('restaurant_ownership_claims')
        .select('id, status, created_at, users(email)')
        .eq('restaurant_id', r.id)
        .order('created_at', { ascending: false })
        .limit(5),
      db.from('deals').select('status, title, paused_reason').eq('restaurant_id', r.id).maybeSingle(),
      db.from('restaurant_reels').select('status').eq('restaurant_id', r.id),
      db.from('restaurant_source_links').select('source, source_name, licence, last_seen_at').eq('restaurant_id', r.id),
      db
        .from('catalogue_dedupe_candidates')
        .select('id')
        .eq('status', 'pending')
        .or(`restaurant_a.eq.${r.id},restaurant_b.eq.${r.id}`),
      db
        .from('outreach_contacts')
        .select('id, brand_id, channel, status, phone, email, last_event, updated_at')
        .or(reach)
        .order('updated_at', { ascending: false })
        .limit(5),
      db
        .from('content_permissions')
        .select('id, brand_id, given_by_name, agreed_at, withdrawn_at')
        .or(reach)
        .order('agreed_at', { ascending: false })
        .limit(3),
    ]);

  const evidenceRows = (evidence.data ?? []) as Evidence[];
  const shows = showsAs(r);
  const reelCounts = ((reels.data ?? []) as { status: string }[]).reduce<Record<string, number>>((acc, x) => {
    acc[x.status] = (acc[x.status] ?? 0) + 1;
    return acc;
  }, {});
  const claimRows = (claims.data ?? []) as unknown as { id: string; status: string; created_at: string; users: { email: string } | null }[];
  const historyRows = (history.data ?? []) as { id: string; classification_result: string; facts_snapshot: Record<string, unknown>; verified_at: string }[];
  const sourceRows = (sources.data ?? []) as { source: string; source_name: string | null; licence: string | null; last_seen_at: string | null }[];
  const status = r.merged_into ? 'merged' : r.catalogue_status === 'active' ? 'open' : r.catalogue_status;
  const contactRows = (contacts.data ?? []) as { id: string; brand_id: string | null; channel: Channel; status: ContactStatus; phone: string | null; email: string | null; last_event: string | null; updated_at: string }[];
  const yesRows = (yeses.data ?? []) as { id: string; brand_id: string | null; given_by_name: string; agreed_at: string; withdrawn_at: string | null }[];

  return (
    <AdminPage
      title={r.name}
      width="xl"
      description={[r.address, r.borough].filter(Boolean).join(' · ')}
      action={
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/restaurants" className={BUTTON_SECONDARY}>
            <ArrowLeftIcon className="h-4 w-4" />
            All restaurants
          </Link>
          {r.is_searchable && (
            <a href={`/restaurant/${r.slug}`} target="_blank" rel="noopener" className={BUTTON_SECONDARY}>
              Live page
              <ArrowUpRightIcon className="h-4 w-4" />
            </a>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Fact label="Visitors see">
          {shows === 'hidden' ? (
            <span>
              Hidden <span className="block text-xs font-normal text-muted">{hiddenReason(r)}</span>
            </span>
          ) : (
            <HalalBadge classification={shows} size="sm" />
          )}
        </Fact>
        <Fact label="Evidence">
          {r.halal_evidence_strength ? `${r.halal_evidence_strength.charAt(0).toUpperCase()}${r.halal_evidence_strength.slice(1)}` : 'None yet'}
          {r.checked_by_us && (
            <span className="mt-1 flex items-center gap-1 text-xs text-halal-fullInk">
              <SealCheckIcon className="h-3.5 w-3.5" />
              Checked by us
            </span>
          )}
        </Fact>
        <Fact label="Open or closed">
          {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}
          {/* Its old page sends visitors to the kept record; this does the same here. */}
          {r.merged_into && (
            <Link href={`/admin/restaurants/${r.merged_into}`} className="mt-1 block text-xs font-semibold text-accent-ink hover:underline">
              Open the record we kept
            </Link>
          )}
        </Fact>
        <Fact label="Owner">
          {owner.data?.email ? <span className="block truncate">{owner.data.email}</span> : <span className="text-muted">No owner account</span>}
        </Fact>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel title="Halal evidence" action={<Tag>{evidenceRows.filter((e) => e.is_current).length} current</Tag>}>
            {r.halal_summary && <p className="border-b border-line px-5 py-3 text-sm text-ink/85">{r.halal_summary}</p>}
            {evidenceRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">
                No evidence yet.{' '}
                {r.is_candidate
                  ? 'It shows as Worth asking because its name or food is often halal in London.'
                  : 'Search leaves it out until there is some.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {evidenceRows.map((e) => (
                  <li key={e.id} className={clsx('px-5 py-3.5', !e.is_current && 'opacity-60')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{KIND_LABEL[e.kind] ?? e.kind}</span>
                      <Tag tone={e.claim === 'not_halal' ? 'warn' : e.claim === 'fully_halal' ? 'good' : 'neutral'}>{CLAIM_LABEL[e.claim] ?? e.claim}</Tag>
                      <Tag>{e.strength}</Tag>
                      {!e.is_current && <Tag>Replaced</Tag>}
                      <span className="ml-auto text-xs text-subtle">{ago(e.checked_at)}</span>
                    </div>
                    {e.excerpt && <p className="mt-1.5 text-sm leading-relaxed text-ink/80">&ldquo;{e.excerpt}&rdquo;</p>}
                    <p className="mt-1 text-xs text-muted">
                      {e.source_url ? (
                        <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink hover:underline">
                          {e.source_name}
                        </a>
                      ) : (
                        e.source_name
                      )}
                      {e.notes && <> · {e.notes}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <section id="check" className="scroll-mt-24">
            <Panel title="Record a check">
              <p className="border-b border-line px-5 py-3 text-sm leading-relaxed text-muted">
                A call, a visit or the certifier&apos;s register. What you save becomes our evidence with today&apos;s date, and
                the label visitors see follows from it. Couldn&apos;t confirm changes nothing public.
              </p>
              <CheckForm action={recordCheck.bind(null, r.id)} facts={(facts.data as KnownFacts | null) ?? null} />
            </Panel>
          </section>

          <Panel title="Details">
            <form action={updateRestaurant.bind(null, r.id)} className="space-y-4 px-5 py-4">
              <Field label="Name" htmlFor="name">
                <input id="name" name="name" defaultValue={r.name} className={FIELD} />
              </Field>
              <Field label="Address" htmlFor="address">
                <input id="address" name="address" defaultValue={r.address ?? ''} className={FIELD} />
              </Field>
              <Field label="Description" htmlFor="description">
                <textarea id="description" name="description" defaultValue={r.description ?? ''} rows={3} className={FIELD} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phone" htmlFor="phone">
                  <input id="phone" name="phone" type="tel" defaultValue={r.phone ?? ''} className={FIELD} />
                </Field>
                <Field label="Website" htmlFor="website_url">
                  <input id="website_url" name="website_url" type="url" defaultValue={r.website_url ?? ''} placeholder="https://" className={FIELD} />
                </Field>
              </div>
              <Field label="Menu link" htmlFor="menu_url">
                <input id="menu_url" name="menu_url" type="url" defaultValue={r.menu_url ?? ''} placeholder="https://" className={FIELD} />
              </Field>
              <button type="submit" className={BUTTON}>
                Save details
              </button>
            </form>
          </Panel>

          <Panel title="Price a head">
            <form action={setPriceRange.bind(null, r.id)} className="space-y-4 px-5 py-4">
              <p className="text-sm text-muted">
                Only what the owner told us. Never a guess from the menu.
                {r.price_range_at && (
                  <> Last set {new Date(r.price_range_at).toLocaleDateString('en-GB')}{r.price_range_source === 'owner_by_phone' ? ', on a call' : ''}.</>
                )}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Price" htmlFor="price_range">
                  <select id="price_range" name="price_range" defaultValue={String(r.price_range ?? '')} className={FIELD}>
                    <option value="">Not known</option>
                    {PRICE_RANGES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.signs} {p.words}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="How the owner told us" htmlFor="how">
                  <select id="how" name="how" defaultValue={r.price_range_source === 'owner' ? 'writing' : 'phone'} className={FIELD}>
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

          <Panel title="Photos" action={<PhotoUploader restaurantId={r.id} />}>
            <div className="px-5 py-4">
              {(photos.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No photos yet.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {(photos.data ?? []).map((photo) => (
                    <li key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-halal-unverifiedSoft">
                      {/* The small copy, never through the image optimiser (it
                          402s past its monthly quota, see lib/imageUrl.ts). */}
                      <Image
                        src={thumbUrl(photo.storage_path)}
                        alt=""
                        fill
                        sizes="160px"
                        unoptimized={skipOptimiser(photo.storage_path)}
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
                          <form action={setPrimaryPhoto.bind(null, r.id, photo.id)}>
                            <button type="submit" title="Set as main photo" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm transition hover:bg-white">
                              <StarIcon className="h-4 w-4" />
                              <span className="sr-only">Set as main photo</span>
                            </button>
                          </form>
                        )}
                        <form action={deletePhoto.bind(null, r.id, photo.id)}>
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
        </div>

        <div className="space-y-5">
          <Panel title="Open or closed">
            <form action={setCatalogueStatus.bind(null, r.id)} className="flex items-end gap-2 px-5 py-4">
              <div className="min-w-0 flex-1">
                <label htmlFor="catalogue_status" className="mb-1.5 block text-sm font-medium text-ink">
                  State
                </label>
                <select id="catalogue_status" name="catalogue_status" defaultValue={r.catalogue_status} className={FIELD}>
                  <option value="active">Open</option>
                  <option value="temporarily_closed">Closed for now</option>
                  <option value="permanently_closed">Closed for good</option>
                  <option value="needs_review">Needs a look</option>
                </select>
              </div>
              <button type="submit" className={BUTTON_SECONDARY}>
                Save
              </button>
            </form>
            {r.last_checked_at && <p className="-mt-2 px-5 pb-4 text-xs text-subtle">Last changed {stamp(r.last_checked_at)}.</p>}
          </Panel>

          <Panel title="Owner">
            <form action={assignRestaurantOwner.bind(null, r.id)} className="space-y-3 px-5 py-4">
              <p className="text-sm leading-relaxed text-muted">
                Linking an account lets them edit this listing, publish reels and run a deal. Only link someone you have
                checked runs the place. They must have signed in once. Leave blank to unlink.
              </p>
              <Field label="Owner email" htmlFor="owner_email">
                <input id="owner_email" name="owner_email" type="email" defaultValue={owner.data?.email ?? ''} placeholder="owner@restaurant.com" className={FIELD} />
              </Field>
              <button type="submit" className={BUTTON_SECONDARY}>
                Save owner
              </button>
            </form>
            {claimRows.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {claimRows.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-ink/85">{c.users?.email ?? 'Unknown account'}</span>
                    <Tag tone={c.status === 'pending' ? 'accent' : c.status === 'approved' ? 'good' : 'neutral'}>
                      {c.status === 'pending' ? 'Claim waiting' : c.status === 'approved' ? 'Approved' : 'Rejected'}
                    </Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Outreach" action={<Link href="/admin/outreach" className="text-xs font-semibold text-accent-ink hover:underline">Open</Link>}>
            {contactRows.length === 0 && yesRows.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">
                Not on the outreach list.{' '}
                <Link href={`/admin/outreach?place=${encodeURIComponent(r.slug)}#add`} className="font-semibold text-accent-ink hover:underline">
                  Add it
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {yesRows.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="min-w-0 text-ink/85">
                      {p.withdrawn_at ? 'Took back their yes' : 'Said yes to photos'}
                      {p.brand_id ? ' (whole chain)' : ''}, {p.given_by_name}
                    </span>
                    <Tag tone={p.withdrawn_at ? 'warn' : 'good'}>{stamp(p.withdrawn_at ?? p.agreed_at)}</Tag>
                  </li>
                ))}
                {contactRows.map((c) => (
                  <li key={c.id} className="px-5 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 text-ink/85">
                        {CHANNEL_LABEL[c.channel]}
                        {c.brand_id ? ', head office' : ''}
                      </span>
                      <Tag tone={CONTACT_STATUS[c.status].tone}>{CONTACT_STATUS[c.status].label}</Tag>
                    </div>
                    {(c.phone || c.last_event) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {c.phone && (
                          <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="font-semibold text-accent-ink hover:underline">
                            {c.phone}
                          </a>
                        )}
                        {c.phone && c.last_event ? ' · ' : ''}
                        {c.last_event ? `last: ${c.last_event}` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Deal" action={<Link href={`/admin/deals/${r.id}`} className="text-xs font-semibold text-accent-ink hover:underline">Open</Link>}>
            <p className="px-5 py-4 text-sm text-ink/85">
              {deal.data
                ? `${deal.data.title ?? 'A deal'}: ${deal.data.status === 'paused' ? `paused${deal.data.paused_reason === 'reports' ? ' after reports' : ''}` : deal.data.status}.`
                : 'No deal. The owner starts one from their own page once their claim is approved.'}
            </p>
          </Panel>

          <Panel title="Reels and partnership">
            <form action={setPartnership.bind(null, r.id)} className="space-y-4 px-5 py-4">
              <div className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-sm text-ink/80">
                {allowance.published} of {allowance.allowance} reels published
                {allowance.isPartner ? ' (partner)' : allowance.isFounder ? ' (Founder, 3 free for life)' : ' (free tier)'}.
                {(reelCounts.pending_review ?? 0) > 0 && (
                  <Link href="/admin/reels" className="ml-1 font-semibold text-accent-ink hover:underline">
                    {reelCounts.pending_review} waiting for review
                  </Link>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted">
                Partnership sets reel space only. It never touches the halal label, the check queue or how fast a reel is
                reviewed.
              </p>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <Field label="Status" htmlFor="status">
                  <select id="status" name="status" defaultValue={partnership.data?.status ?? 'none'} className={FIELD}>
                    <option value="none">None</option>
                    <option value="active">Partner</option>
                    <option value="past_due">Past due</option>
                    <option value="canceled">Cancelled</option>
                  </select>
                </Field>
                <Field label="Reel limit" htmlFor="reel_allowance_override" hint="Blank for the default.">
                  <input id="reel_allowance_override" name="reel_allowance_override" type="number" min={0} defaultValue={partnership.data?.reel_allowance_override ?? ''} className={FIELD} />
                </Field>
              </div>
              <Field label="Note" htmlFor="note" hint="Only admins see it.">
                <input id="note" name="note" defaultValue={partnership.data?.note ?? ''} className={FIELD} />
              </Field>
              <button type="submit" className={BUTTON_SECONDARY}>
                Save
              </button>
            </form>
          </Panel>

          <Panel title="Check history">
            {historyRows.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">Never checked by us.</p>
            ) : (
              <ul className="divide-y divide-line">
                {historyRows.map((h) => {
                  const outcome = String(h.facts_snapshot?.outcome ?? h.classification_result);
                  const method = String(h.facts_snapshot?.method ?? '');
                  return (
                    <li key={h.id} className="px-5 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{OUTCOME_LABEL[outcome] ?? outcome}</span>
                        <span className="text-xs text-subtle">{stamp(h.verified_at)}</span>
                      </div>
                      {method && <p className="text-xs text-muted">{method.replace(/_/g, ' ')}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Where this record came from">
            <dl className="space-y-1.5 px-5 py-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">First added</dt>
                <dd className="text-ink">{stamp(r.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Added by</dt>
                <dd className="text-ink">{r.data_source.replace(/_/g, ' ')}</dd>
              </div>
            </dl>
            {sourceRows.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {sourceRows.map((s) => (
                  <li key={`${s.source}-${s.source_name}`} className="px-5 py-2.5 text-xs">
                    <span className="font-semibold text-ink">{s.source}</span>
                    {s.source_name && <span className="text-muted"> · {s.source_name}</span>}
                    {s.licence && <span className="block text-subtle">{s.licence}</span>}
                  </li>
                ))}
              </ul>
            )}
            {(dupes.data ?? []).length > 0 && (
              <p className="border-t border-line px-5 py-3 text-sm">
                <Link href="/admin/duplicates" className="font-semibold text-accent-ink hover:underline">
                  Might be a duplicate: review it
                </Link>
              </p>
            )}
          </Panel>

          <Panel title="Remove">
            <div className="flex items-start gap-3 px-5 py-4">
              <p className="flex-1 text-sm leading-relaxed text-muted">
                Deleting cannot be undone and takes its evidence with it. For a place that has shut, choose Closed for good
                above instead.
              </p>
              <DeleteRestaurantButton restaurantId={r.id} />
            </div>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
