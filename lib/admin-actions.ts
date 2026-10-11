'use server';

import { revalidateAdminPath } from './admin/cache';
import { createAdminSupabase } from './supabase/admin';
import { requireAdmin } from './require-admin';
import { saveCheck } from './admin/save-check';
import type { ActionState } from './admin/action-state';

/**
 * Publish the outcome of a verification request.
 *
 * The check itself is written by saveCheck (lib/admin/save-check.ts), the
 * same code a check recorded from a restaurant's admin page uses: a check we
 * carried out becomes a strong evidence record and the public label follows
 * from evidence. "Unable to verify" records the attempt and changes nothing
 * public.
 */
export async function publishVerification(requestId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const adminUser = await requireAdmin();
  const supabase = createAdminSupabase();

  const { data: request } = await supabase
    .from('verification_requests')
    .select('id, restaurant_id')
    .eq('id', requestId)
    .single();
  if (!request) return { error: 'Verification request not found.' };

  try {
    const { outcome, verified } = await saveCheck({
      restaurantId: request.restaurant_id,
      requestId: request.id,
      formData,
      adminId: adminUser.id,
      allowNotHalal: false,
    });

    const { error } = await supabase
      .from('verification_requests')
      .update({
        status: verified ? 'completed' : 'unable_to_verify',
        outcome_classification: outcome,
        completed_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    if (error) {
      console.error('[check] request status', error.message);
      return { error: 'The check is saved, but the request still shows as waiting. Publish it again to finish.' };
    }
    return { ok: 'Published. The request is done.' };
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    revalidateAdminPath('/admin/queue');
    revalidateAdminPath(`/admin/queue/${requestId}`);
  }
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
  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
}

export async function deleteRestaurant(restaurantId: string) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase.from('restaurants').delete().eq('id', restaurantId);
  revalidateAdminPath('/admin/restaurants');
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
  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
  revalidateAdminPath(`/restaurant`);
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
  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
  revalidateAdminPath(`/restaurant`);
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
  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
}

export async function deletePhoto(restaurantId: string, photoId: string) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase.from('restaurant_photos').delete().eq('id', photoId);
  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
}

export async function setPrimaryPhoto(restaurantId: string, photoId: string) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase.from('restaurant_photos').update({ is_primary: false }).eq('restaurant_id', restaurantId);
  await supabase.from('restaurant_photos').update({ is_primary: true }).eq('id', photoId);
  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
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
  revalidateAdminPath('/admin/offers');
}

export async function deleteOffer(offerId: string) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase.from('offers').delete().eq('id', offerId);
  revalidateAdminPath('/admin/offers');
}
