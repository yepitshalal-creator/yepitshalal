'use server';

import { revalidateAdminPath } from './admin/cache';
import { redirect } from 'next/navigation';
import { createAdminSupabase } from './supabase/admin';
import { requireAdmin } from './require-admin';

// Looking after the 100 Founders Club applications, /admin/founders.
//
//   checked  Shabir has confirmed it is a real food business. Its spot and its
//            number do not change.
//   reject   spam, a test, or not a food business. A Founder's spot is freed
//            at once, the count on /founders goes down by one, and the next
//            claim takes the lowest free number (0050).
//   restore  undo a rejection, as long as nobody has taken its spot, or
//            applied as the same business, since.
//   link     attach the listing it became. That is what gives a Founder's
//            page its 3 reel slots.
//
// None of these touch a halal label. Being a Founder never buys one.
//
// When something cannot be done the page says why, through ?notice=, rather
// than by throwing: a production build replaces a thrown message with a
// generic error page, and the reason is the useful part.

type Status = 'pending' | 'approved' | 'rejected';

// The notices /admin/founders knows how to show.
type FounderNotice = 'restore-taken' | 'no-listing' | 'failed';

function refresh() {
  revalidateAdminPath('/admin/founders');
  revalidateAdminPath('/founders');
}

function back(notice: FounderNotice): never {
  redirect(`/admin/founders?notice=${notice}`);
}

async function setStatus(id: string, status: Status, reviewer: string, note?: string | null) {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('founder_applications')
    .update({
      status,
      reviewed_by: reviewer,
      reviewed_at: new Date().toISOString(),
      ...(note !== undefined ? { review_note: note } : {}),
    })
    .eq('id', id);
  if (error) back(error.code === '23505' ? 'restore-taken' : 'failed');
}

export async function approveFounderApplication(id: string) {
  const admin = await requireAdmin();
  await setStatus(id, 'approved', admin.id);
  refresh();
}

export async function rejectFounderApplication(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;
  await setStatus(id, 'rejected', admin.id, note);
  refresh();
}

export async function restoreFounderApplication(id: string) {
  const admin = await requireAdmin();
  await setStatus(id, 'pending', admin.id);
  refresh();
}

/** Takes a listing's slug, or its whole address. Empty unlinks it. */
export async function linkFounderListing(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  const raw = String(formData.get('listing') ?? '').trim();
  const slug = raw
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?(?:restaurant|is-it-halal)\//, '')
    .replace(/[/?#].*$/, '')
    .slice(0, 160);

  let restaurantId: string | null = null;
  if (slug) {
    const { data: restaurant } = await supabase.from('restaurants').select('id').eq('slug', slug).maybeSingle();
    if (!restaurant) back('no-listing');
    restaurantId = restaurant.id;
  }

  const { error } = await supabase.from('founder_applications').update({ restaurant_id: restaurantId }).eq('id', id);
  if (error) back('failed');
  refresh();
}
