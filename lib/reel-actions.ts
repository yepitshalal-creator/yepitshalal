'use server';

import { revalidateAdminPath } from './admin/cache';
import { createAdminSupabase } from './supabase/admin';
import { createServerSupabase } from './supabase/server';
import { requireAdmin } from './require-admin';
import { requireRestaurantAccess, assertSlotAvailable } from './require-restaurant';
import type { VideoProvider } from './reels';
import { notifyInbox } from './notify';
import { SITE_URL } from './site';

function providerFor(url: string): VideoProvider | null {
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  return null;
}

async function revalidateFor(restaurantId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from('restaurants')
    .select('slug')
    .eq('id', restaurantId)
    .maybeSingle();
  if (data?.slug) {
    revalidateAdminPath(`/restaurant/${data.slug}`);
    revalidateAdminPath(`/manage/${data.slug}`);
  }
  revalidateAdminPath('/discover');
  revalidateAdminPath('/admin/reels');
}

/**
 * Owner or admin adds an external reel (Instagram / TikTok / YouTube).
 * Goes straight to pending_review: a partnership buys capacity, never a
 * shortcut past moderation.
 */
export async function addEmbedReel(restaurantId: string, formData: FormData) {
  await requireRestaurantAccess(restaurantId);

  const url = String(formData.get('embed_url') ?? '').trim();
  const cover = String(formData.get('cover_url') ?? '').trim();
  const caption = String(formData.get('caption') ?? '').trim();

  if (!url) throw new Error('Paste the link to the reel.');
  const provider = providerFor(url);
  if (!provider) {
    throw new Error('That link is not an Instagram, TikTok or YouTube URL.');
  }
  if (!cover) {
    throw new Error('An embedded reel needs a cover image: there is nothing to show before it plays.');
  }

  await assertSlotAvailable(restaurantId);

  const admin = createAdminSupabase();
  const { error } = await admin.from('restaurant_reels').insert({
    restaurant_id: restaurantId,
    media_kind: 'embed',
    media_url: url,
    provider,
    cover_url: cover,
    caption: caption || null,
    status: 'pending_review',
  });
  if (error) throw new Error(error.message);

  await revalidateFor(restaurantId);
}

/**
 * Records a reel whose video file has already been pushed to storage against a
 * signed URL from /api/reels/upload-url. The signed URL is only minted after
 * the same ownership and allowance checks, so this cannot be used to smuggle in
 * an extra reel.
 */
export async function finalizeUploadedReel(restaurantId: string, formData: FormData) {
  const { userId } = await requireRestaurantAccess(restaurantId);

  const mediaUrl = String(formData.get('media_url') ?? '').trim();
  const cover = String(formData.get('cover_url') ?? '').trim();
  const caption = String(formData.get('caption') ?? '').trim();
  if (!mediaUrl) throw new Error('Upload did not complete.');

  await assertSlotAvailable(restaurantId);

  const admin = createAdminSupabase();
  const { error } = await admin.from('restaurant_reels').insert({
    restaurant_id: restaurantId,
    uploaded_by: userId,
    media_kind: 'upload',
    media_url: mediaUrl,
    cover_url: cover || null,
    caption: caption || null,
    status: 'pending_review',
  });
  if (error) throw new Error(error.message);

  await revalidateFor(restaurantId);
}

export async function updateReel(reelId: string, formData: FormData) {
  const admin = createAdminSupabase();
  const { data: reel } = await admin
    .from('restaurant_reels')
    .select('restaurant_id')
    .eq('id', reelId)
    .maybeSingle();
  if (!reel) throw new Error('Reel not found.');
  await requireRestaurantAccess(reel.restaurant_id);

  const caption = String(formData.get('caption') ?? '').trim();
  const discoveryEligible = formData.get('discovery_eligible') === 'on';

  await admin
    .from('restaurant_reels')
    .update({ caption: caption || null, discovery_eligible: discoveryEligible })
    .eq('id', reelId);

  await revalidateFor(reel.restaurant_id);
}

/** Owner taking their own reel down. Frees the slot immediately. */
export async function withdrawReel(reelId: string) {
  const admin = createAdminSupabase();
  const { data: reel } = await admin
    .from('restaurant_reels')
    .select('restaurant_id')
    .eq('id', reelId)
    .maybeSingle();
  if (!reel) throw new Error('Reel not found.');
  await requireRestaurantAccess(reel.restaurant_id);

  await admin.from('restaurant_reels').update({ status: 'draft' }).eq('id', reelId);
  await revalidateFor(reel.restaurant_id);
}

/** Owner resubmitting a draft. Allowance is re-checked at this point. */
export async function submitReelForReview(reelId: string) {
  const admin = createAdminSupabase();
  const { data: reel } = await admin
    .from('restaurant_reels')
    .select('restaurant_id')
    .eq('id', reelId)
    .maybeSingle();
  if (!reel) throw new Error('Reel not found.');
  await requireRestaurantAccess(reel.restaurant_id);
  await assertSlotAvailable(reel.restaurant_id, reelId);

  await admin
    .from('restaurant_reels')
    .update({ status: 'pending_review', moderation_note: null })
    .eq('id', reelId);
  await revalidateFor(reel.restaurant_id);
}

export async function archiveReel(reelId: string) {
  const admin = createAdminSupabase();
  const { data: reel } = await admin
    .from('restaurant_reels')
    .select('restaurant_id')
    .eq('id', reelId)
    .maybeSingle();
  if (!reel) throw new Error('Reel not found.');
  await requireRestaurantAccess(reel.restaurant_id);

  await admin.from('restaurant_reels').update({ status: 'archived' }).eq('id', reelId);
  await revalidateFor(reel.restaurant_id);
}

// ============================================================================
// Admin-only moderation. Publishing is an admin act, never an owner one.
// ============================================================================

export async function approveReel(reelId: string) {
  await requireAdmin();
  const admin = createAdminSupabase();
  const { data: reel } = await admin
    .from('restaurant_reels')
    .select('restaurant_id')
    .eq('id', reelId)
    .maybeSingle();
  if (!reel) throw new Error('Reel not found.');

  // The allowance trigger will refuse this if the restaurant is already full;
  // surfacing it as a readable message keeps the admin from guessing.
  const { error } = await admin
    .from('restaurant_reels')
    .update({ status: 'published', moderation_note: null })
    .eq('id', reelId);
  if (error) throw new Error(error.message);

  await revalidateFor(reel.restaurant_id);
}

export async function rejectReel(reelId: string, formData: FormData) {
  await requireAdmin();
  const note = String(formData.get('moderation_note') ?? '').trim();
  const admin = createAdminSupabase();
  const { data: reel } = await admin
    .from('restaurant_reels')
    .select('restaurant_id')
    .eq('id', reelId)
    .maybeSingle();
  if (!reel) throw new Error('Reel not found.');

  await admin
    .from('restaurant_reels')
    .update({ status: 'rejected', moderation_note: note || 'Does not meet content guidelines.' })
    .eq('id', reelId);
  await revalidateFor(reel.restaurant_id);
}

// ============================================================================
// Ownership and partnership: both admin acts.
// ============================================================================

/** Admin links a signed-up user to a restaurant, granting management rights. */
export async function assignRestaurantOwner(restaurantId: string, formData: FormData) {
  await requireAdmin();
  const email = String(formData.get('owner_email') ?? '').trim().toLowerCase();
  const admin = createAdminSupabase();

  if (!email) {
    await admin.from('restaurants').update({ owner_id: null }).eq('id', restaurantId);
    revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
    return;
  }

  const { data: user } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (!user) {
    throw new Error(`No account for ${email}. Ask them to sign in once first, then link them.`);
  }

  await admin.from('restaurants').update({ owner_id: user.id }).eq('id', restaurantId);
  await admin.from('users').update({ role: 'restaurant_owner' }).eq('id', user.id).eq('role', 'consumer');
  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
}

export async function reviewOwnershipClaim(claimId: string, approve: boolean) {
  const adminUser = await requireAdmin();
  const admin = createAdminSupabase();

  const { data: claim } = await admin
    .from('restaurant_ownership_claims')
    .select('restaurant_id, user_id')
    .eq('id', claimId)
    .maybeSingle();
  if (!claim) throw new Error('Claim not found.');

  await admin
    .from('restaurant_ownership_claims')
    .update({
      status: approve ? 'approved' : 'rejected',
      reviewed_by: adminUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', claimId);

  if (approve) {
    await admin.from('restaurants').update({ owner_id: claim.user_id }).eq('id', claim.restaurant_id);
    await admin
      .from('users')
      .update({ role: 'restaurant_owner' })
      .eq('id', claim.user_id)
      .eq('role', 'consumer');
  }

  revalidateAdminPath('/admin/claims');
}

/**
 * Partnership status is set by an admin (and, once Stripe prices exist, by the
 * webhook). It changes reel capacity only: there is deliberately no path from
 * here to halal_classification or to the verification queue.
 */
export async function setPartnership(restaurantId: string, formData: FormData) {
  await requireAdmin();
  const status = String(formData.get('status') ?? 'none') as
    | 'none'
    | 'active'
    | 'past_due'
    | 'canceled';
  const overrideRaw = String(formData.get('reel_allowance_override') ?? '').trim();
  const override = overrideRaw === '' ? null : Number(overrideRaw);
  if (override !== null && (!Number.isInteger(override) || override < 0)) {
    throw new Error('Reel allowance override must be a whole number, or blank for the tier default.');
  }

  const admin = createAdminSupabase();
  await admin.from('restaurant_partnerships').upsert(
    {
      restaurant_id: restaurantId,
      status,
      reel_allowance_override: override,
      note: String(formData.get('note') ?? '').trim() || null,
    },
    { onConflict: 'restaurant_id' }
  );

  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
}

/** A signed-in user asking to manage a listing. Admin approval grants it. */
export async function submitOwnershipClaim(restaurantId: string, formData: FormData) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in first so we know who to link.');

  const admin = createAdminSupabase();
  const { error } = await admin.from('restaurant_ownership_claims').upsert(
    {
      restaurant_id: restaurantId,
      user_id: user.id,
      contact_note: String(formData.get('contact_note') ?? '').trim() || null,
      status: 'pending',
    },
    { onConflict: 'restaurant_id,user_id' }
  );
  if (error) throw new Error(error.message);

  const { data: r } = await admin
    .from('restaurants')
    .select('slug, name')
    .eq('id', restaurantId)
    .maybeSingle();
  if (r?.slug) revalidateAdminPath(`/restaurant/${r.slug}`);
  revalidateAdminPath('/admin/claims');

  // Somebody asking to run a listing is business, so info@.
  await notifyInbox({
    inbox: 'info',
    subject: `Ownership claim: ${r?.name ?? 'a restaurant'}`,
    fields: [
      ['Restaurant', r?.name],
      ['Page', r?.slug ? `${SITE_URL}/restaurant/${r.slug}` : null],
      ['Signed in as', user.email],
      ['Their note', String(formData.get('contact_note') ?? '').trim() || null],
    ],
    replyTo: user.email,
    action: { label: 'Review claims', href: `${SITE_URL}/admin/claims` },
  });
}
