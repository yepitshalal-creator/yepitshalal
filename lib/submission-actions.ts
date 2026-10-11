'use server';

import { revalidateAdminPath } from './admin/cache';
import { redirect } from 'next/navigation';
import { createAdminSupabase } from './supabase/admin';
import { requireAdmin } from './require-admin';

// Reviewing "Add a restaurant" submissions. Three outcomes:
//   approve  a new listing, labelled from the submitter's own claim as weak
//            evidence, so it can never show as more than Unverified until
//            something stronger is added;
//   merge    the same place we already list: the submission is attached to it
//            as evidence and fills in contact details it was missing;
//   reject   nothing is published.

interface Submission {
  id: string;
  status: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  borough: string;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  cuisine: string | null;
  relationship: 'owner' | 'staff' | 'customer';
  halal_claim: 'fully_halal' | 'halal_options' | null;
  serves_pork: boolean | null;
  serves_alcohol: boolean | null;
  certification_body: string | null;
  evidence_url: string | null;
  prayer_facility: 'prayer_room' | 'space' | 'none' | null;
  prayer_facility_note: string | null;
  notes: string | null;
}

/**
 * Somewhere to pray, as reported by whoever sent the form.
 *
 * Kept apart from the halal evidence on purpose. It is a fact about the room,
 * not about the meat, and refresh_halal_status never reads it. Nothing is
 * written when the submitter did not answer: silence stays silence, and the
 * page says "nobody has told us" rather than "nowhere".
 */
function prayerPatch(sub: Submission): Record<string, unknown> {
  if (!sub.prayer_facility) return {};
  return {
    prayer_facility: sub.prayer_facility,
    prayer_facility_note: sub.prayer_facility_note,
    prayer_facility_source: sub.relationship,
    prayer_facility_at: new Date().toISOString(),
  };
}

async function loadPending(id: string): Promise<Submission> {
  const supabase = createAdminSupabase();
  const { data } = await supabase.from('restaurant_submissions').select('*').eq('id', id).maybeSingle();
  if (!data) throw new Error('Submission not found.');
  if (data.status !== 'pending') throw new Error('This submission has already been reviewed.');
  return data as Submission;
}

function instagramUrl(handle: string | null): string | null {
  if (!handle) return null;
  if (/^https?:\/\//i.test(handle)) return handle;
  const h = handle.replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
  return h ? `https://www.instagram.com/${h}/` : null;
}

/** Whether the submission says anything about halal food at all. "Not sure" doesn't. */
function saysSomethingHalal(sub: Submission): boolean {
  return Boolean(sub.halal_claim || sub.certification_body || sub.serves_pork !== null);
}

function evidenceFor(sub: Submission, restaurantId: string, reviewer: string) {
  const byOwner = sub.relationship === 'owner' || sub.relationship === 'staff';
  const said = [
    sub.halal_claim === 'fully_halal' && 'all meat halal',
    sub.halal_claim === 'halal_options' && 'some halal options',
    sub.serves_pork === true && 'pork served',
    sub.serves_pork === false && 'no pork',
    sub.serves_alcohol === true && 'alcohol served',
    sub.serves_alcohol === false && 'no alcohol',
    sub.certification_body && `says certified by ${sub.certification_body}`,
  ].filter(Boolean);
  return {
    restaurant_id: restaurantId,
    kind: byOwner ? 'owner_submission' : 'public_submission',
    claim: sub.halal_claim ?? 'halal_mentioned',
    // Deliberately weak whatever it claims: we have not confirmed who sent it.
    strength: 'weak',
    source_name: sub.relationship === 'owner' ? 'Someone who says they run it'
      : sub.relationship === 'staff' ? 'Someone who says they work there'
      : 'A customer',
    source_url: sub.evidence_url,
    excerpt: said.length ? `Told us: ${said.join(', ')}.`.slice(0, 300) : null,
    notes: sub.notes,
    checked_at: new Date().toISOString(),
    checked_by: `admin:${reviewer}`,
  };
}

function slugFor(name: string, postcode: string): string {
  const base = name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const area = postcode.split(' ')[0].toLowerCase();
  return `${base}-${area}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function approveSubmission(id: string) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabase();
  const sub = await loadPending(id);

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .insert({
      name: sub.name,
      slug: slugFor(sub.name, sub.postcode),
      address: `${sub.address}, ${sub.postcode}`,
      postcode: sub.postcode,
      borough: sub.borough,
      phone: sub.phone,
      website_url: sub.website,
      socials: [instagramUrl(sub.instagram)].filter(Boolean),
      cuisine_label: sub.cuisine,
      data_source: 'owner_submitted',
      catalogue_status: 'active',
      halal_classification: 'unverified',
      // Nothing said about halal: kept as a candidate, not given a label. The
      // site has not shown places with no evidence since 2026-10-11.
      is_candidate: !saysSomethingHalal(sub),
      location: `SRID=4326;POINT(${sub.lng} ${sub.lat})`,
      ...prayerPatch(sub),
    })
    .select('id, slug')
    .single();
  if (error || !restaurant) throw new Error(error?.message ?? 'Could not create the listing.');

  if (sub.cuisine) {
    const { data: cuisine } = await supabase.from('cuisines').select('id').ilike('name', sub.cuisine).maybeSingle();
    if (cuisine) await supabase.from('restaurant_cuisines').insert({ restaurant_id: restaurant.id, cuisine_id: cuisine.id });
  }

  await supabase.from('restaurant_source_links').insert({
    restaurant_id: restaurant.id,
    source: 'owner_submission',
    source_id: sub.id,
    source_name: sub.name,
  });

  // The evidence row is what gives it a label: refresh_halal_status runs on insert.
  if (saysSomethingHalal(sub)) {
    await supabase.from('restaurant_halal_evidence').insert(evidenceFor(sub, restaurant.id, admin.id));
  }

  await supabase
    .from('restaurant_submissions')
    .update({ status: 'approved', reviewed_by: admin.id, reviewed_at: new Date().toISOString(), restaurant_id: restaurant.id })
    .eq('id', id);

  revalidateAdminPath('/admin/submissions');
  redirect(`/admin/submissions/${id}`);
}

export async function mergeSubmission(id: string, restaurantId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabase();
  const sub = await loadPending(id);

  const { data: existing } = await supabase
    .from('restaurants')
    .select('id, phone, website_url, socials, address, postcode, cuisine_label')
    .eq('id', restaurantId)
    .maybeSingle();
  if (!existing) throw new Error('That listing no longer exists.');

  // Only fill gaps. A submission never overwrites details we already hold.
  const patch: Record<string, unknown> = {};
  if (!existing.phone && sub.phone) patch.phone = sub.phone;
  if (!existing.website_url && sub.website) patch.website_url = sub.website;
  if (/street address not known/i.test(existing.address) && sub.address) patch.address = `${sub.address}, ${sub.postcode}`;
  if (!existing.postcode && sub.postcode) patch.postcode = sub.postcode;
  if (!existing.cuisine_label && sub.cuisine) patch.cuisine_label = sub.cuisine;
  const ig = instagramUrl(sub.instagram);
  if (ig && !(existing.socials ?? []).includes(ig)) patch.socials = [...(existing.socials ?? []), ig];
  // The prayer facility is the one thing a merge does overwrite: a more recent
  // visit beats an older one, and a room that has closed should stop being
  // advertised. Only when this submission actually answered.
  Object.assign(patch, prayerPatch(sub));
  if (Object.keys(patch).length) await supabase.from('restaurants').update(patch).eq('id', restaurantId);

  if (saysSomethingHalal(sub)) {
    await supabase.from('restaurant_halal_evidence').insert(evidenceFor(sub, restaurantId, admin.id));
  }

  await supabase
    .from('restaurant_submissions')
    .update({ status: 'duplicate', reviewed_by: admin.id, reviewed_at: new Date().toISOString(), restaurant_id: restaurantId })
    .eq('id', id);

  revalidateAdminPath('/admin/submissions');
  redirect(`/admin/submissions/${id}`);
}

export async function rejectSubmission(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createAdminSupabase();
  await loadPending(id);
  await supabase
    .from('restaurant_submissions')
    .update({
      status: 'rejected',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      review_note: String(formData.get('note') ?? '').slice(0, 500) || null,
    })
    .eq('id', id);
  revalidateAdminPath('/admin/submissions');
  redirect(`/admin/submissions/${id}`);
}
