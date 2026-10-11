'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { saveCheck } from './save-check';
import { ADMIN_DATA } from './cache';

/**
 * Record a check made without a request: a phone call from "What to check
 * next", a register check from "Certificate claims", a visit. The same rules
 * as answering a request, in lib/admin/save-check.ts.
 */
export async function recordCheck(restaurantId: string, formData: FormData) {
  const admin = await requireAdmin();
  const { data: restaurant } = await createAdminSupabase()
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .maybeSingle();
  if (!restaurant) throw new Error('Restaurant not found.');

  await saveCheck({ restaurantId, requestId: null, formData, adminId: admin.id, allowNotHalal: true });

  revalidateTag(ADMIN_DATA);
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  revalidatePath(`/restaurant/${restaurant.slug}`);
}
