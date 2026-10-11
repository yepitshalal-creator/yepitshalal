'use server';

import { revalidateAdminPath } from './admin/cache';
import { createAdminSupabase } from './supabase/admin';
import { requireAdmin } from './require-admin';

/**
 * Two records describe the same physical place. The loser is not deleted: it
 * keeps its provenance and gains a pointer to the survivor, so the decision is
 * reversible and a future ingest that rediscovers the business can match
 * against it rather than creating a third copy.
 *
 * Fields the survivor is missing are taken from the loser first: a duplicate
 * often carries the phone number or postcode the kept record lacks.
 */
export async function mergeDuplicate(candidateId: string, keepId: string, dropId: string) {
  const user = await requireAdmin();
  const supabase = createAdminSupabase();

  const [{ data: keep }, { data: drop }] = await Promise.all([
    supabase.from('restaurants').select('*').eq('id', keepId).maybeSingle(),
    supabase.from('restaurants').select('*').eq('id', dropId).maybeSingle(),
  ]);
  if (!keep || !drop) throw new Error('One of those records no longer exists.');

  const fill: Record<string, unknown> = {};
  for (const field of ['phone', 'website_url', 'menu_url', 'postcode', 'description'] as const) {
    if (!keep[field] && drop[field]) fill[field] = drop[field];
  }
  if (Object.keys(fill).length > 0) {
    await supabase.from('restaurants').update(fill).eq('id', keepId);
  }

  await supabase
    .from('restaurants')
    .update({ merged_into: keepId, catalogue_status: 'needs_review' })
    .eq('id', dropId);

  await supabase
    .from('catalogue_dedupe_candidates')
    .update({ status: 'merged', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', candidateId);

  revalidateAdminPath('/admin/duplicates');
  revalidateAdminPath('/admin/coverage');
}

/** These are two different places. Recording it stops them being re-queued. */
export async function markDistinct(candidateId: string) {
  const user = await requireAdmin();
  const supabase = createAdminSupabase();
  await supabase
    .from('catalogue_dedupe_candidates')
    .update({ status: 'distinct', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', candidateId);
  revalidateAdminPath('/admin/duplicates');
}

/** Lifecycle: closed, temporarily shut, or needs a second look. */
export async function setCatalogueStatus(restaurantId: string, formData: FormData) {
  await requireAdmin();
  const status = String(formData.get('catalogue_status') ?? 'active');
  const allowed = ['active', 'temporarily_closed', 'permanently_closed', 'needs_review'];
  if (!allowed.includes(status)) throw new Error('Unknown catalogue status.');

  const supabase = createAdminSupabase();
  await supabase
    .from('restaurants')
    .update({ catalogue_status: status, last_checked_at: new Date().toISOString() })
    .eq('id', restaurantId);

  revalidateAdminPath(`/admin/restaurants/${restaurantId}`);
  revalidateAdminPath('/admin/coverage');
}
