'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { saveCheck } from './save-check';
import { ADMIN_DATA } from './cache';
import type { ActionState } from './action-state';

/**
 * Record a check made without a request: a phone call from "What to check
 * next", a register check from "Certificate claims", a visit. The same rules
 * as answering a request, in lib/admin/save-check.ts.
 */
export async function recordCheck(restaurantId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { data: restaurant } = await createAdminSupabase()
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .maybeSingle();
  if (!restaurant) return { error: 'Restaurant not found.' };

  try {
    await saveCheck({ restaurantId, requestId: null, formData, adminId: admin.id, allowNotHalal: true });
    return { ok: 'Saved. The page shows it now.' };
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    // Even after a failure part way, so both pages show what is really there.
    revalidateTag(ADMIN_DATA);
    revalidatePath(`/admin/restaurants/${restaurantId}`);
    revalidatePath(`/restaurant/${restaurant.slug}`);
  }
}
