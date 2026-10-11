'use server';

import { revalidateAdminPath } from '../admin/cache';
import { requireAdmin } from '@/lib/require-admin';
import { dealsDb } from '@/lib/deals/db';
import { ownerError } from './messages';

// Admin only, each one checking for itself: a Server Action can be called
// over the network without its page loading.

export type AdminDealState = { status: 'idle' } | { status: 'saved'; message: string } | { status: 'error'; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function refresh(restaurantId: string) {
  revalidateAdminPath('/admin', 'layout');
  const { data: r } = await dealsDb().from('restaurants').select('slug').eq('id', restaurantId).maybeSingle();
  if (r) {
    revalidateAdminPath(`/restaurant/${r.slug}`);
    revalidateAdminPath(`/manage/${r.slug}/deals`);
  }
}

/** pause, resume (any pause, including one for reports) or end. */
export async function adminDealStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const restaurantId = String(formData.get('restaurant_id') ?? '');
  const action = String(formData.get('action') ?? '');
  if (!UUID.test(restaurantId) || !['pause', 'resume', 'end'].includes(action)) return;
  await dealsDb().rpc('set_deal_status', { p_restaurant_id: restaurantId, p_action: action, p_by: 'admin' });
  await refresh(restaurantId);
}

/** Add or take credit, in pounds, with a note. The token makes a double submit post once. */
export async function adjustCredit(_prev: AdminDealState, formData: FormData): Promise<AdminDealState> {
  const admin = await requireAdmin();
  const restaurantId = String(formData.get('restaurant_id') ?? '');
  const token = String(formData.get('token') ?? '');
  const pounds = Number(String(formData.get('amount') ?? '').replace(/[£,\s]/g, ''));
  const note = String(formData.get('note') ?? '').trim();
  if (!UUID.test(restaurantId) || !UUID.test(token)) return { status: 'error', message: 'Refresh the page and try again.' };
  if (!Number.isFinite(pounds) || pounds === 0) return { status: 'error', message: 'Write an amount, like 5 or -2.50.' };
  if (note.length < 3) return { status: 'error', message: 'Write why. The owner sees it in their activity.' };

  const { data, error } = await dealsDb().rpc('adjust_deal_credit', {
    p_restaurant_id: restaurantId,
    p_amount_pence: Math.round(pounds * 100),
    p_note: note,
    p_admin_id: admin.id,
    p_token: token,
  });
  if (error) return { status: 'error', message: ownerError(error.message, error.hint) };
  await refresh(restaurantId);
  return {
    status: 'saved',
    message: (data as { posted?: boolean } | null)?.posted ? 'Saved.' : 'Already saved. Nothing was added twice.',
  };
}

/** Give one redemption's fee back, within 7 days, once. */
export async function creditBackFee(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const claimId = String(formData.get('claim_id') ?? '');
  const restaurantId = String(formData.get('restaurant_id') ?? '');
  if (!UUID.test(claimId) || !UUID.test(restaurantId)) return;
  await dealsDb().rpc('credit_back_fee', {
    p_claim_id: claimId,
    p_note: 'Fee given back by YepItsHalal',
    p_admin_id: admin.id,
  });
  await refresh(restaurantId);
}
