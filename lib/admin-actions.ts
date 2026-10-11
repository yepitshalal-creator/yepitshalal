'use server';

import { revalidatePath } from 'next/cache';
import { createAdminSupabase } from './supabase/admin';
import { requireAdmin } from './require-admin';

const METHOD_LABEL: Record<string, string> = {
  visit: 'Visited in person',
  phone: 'Spoke to the restaurant',
  documents: 'Saw certificates or supplier documents',
  certifier_register: "Found on the certifier's register",
};

/**
 * Publish the outcome of a verification.
 *
 * A check we actually carried out becomes a strong evidence record, and the
 * public label is derived from evidence by refresh_halal_status(). This never
 * writes a classification directly. "Unable to verify" records the attempt and
 * leaves everything public untouched: failing to confirm is not a finding that
 * a place is not halal.
 */
export async function publishVerification(requestId: string, formData: FormData) {
  const adminUser = await requireAdmin();
  const supabase = createAdminSupabase();

  const { data: request } = await supabase
    .from('verification_requests')
    .select('id, restaurant_id')
    .eq('id', requestId)
    .single();
  if (!request) throw new Error('Verification request not found.');

  const classification = String(formData.get('classification'));
  const method = String(formData.get('method') ?? '');
  const publicSummary = String(formData.get('public_summary') ?? '').trim().slice(0, 280);
  const sourceUrl = String(formData.get('source_url') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '');
  const verified = classification === 'fully_halal' || classification === 'halal_options';
  if (verified && (!METHOD_LABEL[method] || !publicSummary)) {
    throw new Error('Say how you checked and what you found before publishing a result.');
  }

  function tri(name: string): boolean | null {
    const v = formData.get(name);
    if (v === 'yes') return true;
    if (v === 'no') return false;
    return null;
  }

  const now = new Date().toISOString();
  const certificationBody = String(formData.get('certification_body') ?? '').trim() || null;
  const facts = {
    restaurant_id: request.restaurant_id,
    all_meat_halal: tri('all_meat_halal'),
    serves_non_halal_meat: tri('serves_non_halal_meat'),
    serves_pork: tri('serves_pork'),
    serves_alcohol: tri('serves_alcohol'),
    has_certification: tri('has_certification'),
    certification_body: certificationBody,
    verification_notes: notes || null,
    verified_at: now,
    last_verified_at: now,
    next_review_due_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    last_outcome: verified ? 'verified' : 'unable_to_verify',
  };

  if (verified) {
    await supabase.from('restaurant_halal_facts').upsert(facts, { onConflict: 'restaurant_id' });

    // A newer check replaces an older one rather than stacking beside it.
    await supabase
      .from('restaurant_halal_evidence')
      .update({ is_current: false })
      .eq('restaurant_id', request.restaurant_id)
      .in('kind', ['yepitshalal_check', 'certification'])
      .eq('is_current', true);

    const evidence: Record<string, string | null>[] = [
      {
        restaurant_id: request.restaurant_id,
        kind: 'yepitshalal_check',
        claim: classification,
        strength: 'strong',
        source_name: 'YepItsHalal',
        source_url: null,
        excerpt: publicSummary,
        notes: METHOD_LABEL[method],
        checked_at: now,
        checked_by: `admin:${adminUser.id}`,
      },
    ];
    // Certification is only recorded as confirmed when it was confirmed with
    // the certifier, not when a restaurant showed us a logo.
    if (facts.has_certification === true && certificationBody && method === 'certifier_register') {
      evidence.push({
        restaurant_id: request.restaurant_id,
        kind: 'certification',
        claim: classification,
        strength: 'strong',
        source_name: certificationBody,
        source_url: sourceUrl,
        excerpt: `Listed on ${certificationBody}'s register of certified outlets.`,
        notes: null,
        checked_at: now,
        checked_by: `admin:${adminUser.id}`,
      });
    }
    await supabase.from('restaurant_halal_evidence').insert(evidence);
  }

  await supabase.from('verification_history').insert({
    restaurant_id: request.restaurant_id,
    verification_request_id: request.id,
    classification_result: classification,
    facts_snapshot: { ...facts, method, public_summary: publicSummary, source_url: sourceUrl },
  });

  await supabase
    .from('verification_requests')
    .update({
      status: verified ? 'completed' : 'unable_to_verify',
      outcome_classification: classification,
      completed_at: now,
    })
    .eq('id', requestId);

  revalidatePath('/admin/queue');
  revalidatePath(`/admin/queue/${requestId}`);
}

/** Records a photo that was just uploaded through a signed URL. */
export async function addRestaurantPhoto(restaurantId: string, storagePath: string) {
  await requireAdmin();
  if (!storagePath.startsWith(`${restaurantId}/`)) throw new Error('That upload belongs to a different restaurant.');
  const supabase = createAdminSupabase();
  const { data } = supabase.storage.from('restaurant-photos').getPublicUrl(storagePath);
  const { count } = await supabase
    .from('restaurant_photos')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .not('storage_path', 'ilike', '%images.unsplash.com%');
  await supabase.from('restaurant_photos').insert({
    restaurant_id: restaurantId,
    storage_path: data.publicUrl,
    type: 'food',
    // The first real photo replaces a representative stock image as primary.
    is_primary: (count ?? 0) === 0,
  });
  if ((count ?? 0) === 0) {
    await supabase
      .from('restaurant_photos')
      .update({ is_primary: false })
      .eq('restaurant_id', restaurantId)
      .ilike('storage_path', '%images.unsplash.com%');
  }
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

export async function deleteRestaurant(restaurantId: string) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase.from('restaurants').delete().eq('id', restaurantId);
  revalidatePath('/admin/restaurants');
}

export async function updateRestaurant(restaurantId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase
    .from('restaurants')
    .update({
      name: String(formData.get('name') ?? ''),
      address: String(formData.get('address') ?? ''),
      description: String(formData.get('description') ?? '') || null,
      phone: String(formData.get('phone') ?? '') || null,
      website_url: String(formData.get('website_url') ?? '') || null,
      menu_url: String(formData.get('menu_url') ?? '') || null,
    })
    .eq('id', restaurantId);
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  revalidatePath(`/restaurant`);
}

// Price a head, only ever as the owner told us (lib/price.ts). "Not known"
// clears it rather than leaving an old answer in place.
export async function setPriceRange(restaurantId: string, formData: FormData) {
  await requireAdmin();
  const value = Number(formData.get('price_range'));
  const known = [1, 2, 3].includes(value);
  const how = formData.get('how') === 'phone' ? 'owner_by_phone' : 'owner';
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('restaurants')
    .update({
      price_range: known ? value : null,
      price_range_source: known ? how : null,
      price_range_at: known ? new Date().toISOString() : null,
    })
    .eq('id', restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  revalidatePath(`/restaurant`);
}

export async function addVideo(restaurantId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  const embedUrl = String(formData.get('embed_url') ?? '').trim();
  if (!embedUrl) return;
  const provider = embedUrl.includes('tiktok')
    ? 'tiktok'
    : embedUrl.includes('instagram')
    ? 'instagram'
    : 'youtube';
  await supabase.from('restaurant_videos').insert({
    restaurant_id: restaurantId,
    provider,
    embed_url: embedUrl,
    caption: String(formData.get('caption') ?? '') || null,
  });
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

export async function deletePhoto(restaurantId: string, photoId: string) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase.from('restaurant_photos').delete().eq('id', photoId);
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

export async function setPrimaryPhoto(restaurantId: string, photoId: string) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase.from('restaurant_photos').update({ is_primary: false }).eq('restaurant_id', restaurantId);
  await supabase.from('restaurant_photos').update({ is_primary: true }).eq('id', photoId);
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

export async function createOffer(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  const restaurantId = String(formData.get('restaurant_id') ?? '') || null;
  await supabase.from('offers').insert({
    restaurant_id: restaurantId,
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? '') || null,
    yep_plus_only: formData.get('yep_plus_only') === 'on',
    is_early_access: formData.get('is_early_access') === 'on',
    voucher_code: String(formData.get('voucher_code') ?? '') || null,
    ends_at: String(formData.get('ends_at') ?? '') || null,
  });
  revalidatePath('/admin/offers');
}

export async function deleteOffer(offerId: string) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase.from('offers').delete().eq('id', offerId);
  revalidatePath('/admin/offers');
}
