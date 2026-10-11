'use server';

import { revalidateAdminPath } from './cache';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { SETUP_MARKS_KEY, setupMarks } from './setup';

// Ticks a by-hand setup item done, or takes the tick back. Only for the items
// the site cannot check itself; the others answer from the live system and a
// tick would only hide the truth.
const BY_HAND = new Set(['auth-site-url', 'auth-smtp', 'resend-domain', 'stripe-account', 'stripe-webhook', 'stripe-portal', 'old-login', 'retention']);

export async function markSetupItem(id: string, done: boolean) {
  await requireAdmin();
  if (!BY_HAND.has(id)) return;
  const marks = await setupMarks();
  if (done) marks[id] = new Date().toISOString();
  else delete marks[id];
  await createAdminSupabase()
    .from('platform_settings')
    .upsert(
      {
        key: SETUP_MARKS_KEY,
        value: marks,
        description: 'Setup items ticked by hand on /admin/setup: { item id: when }. Written only by the admin.',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  revalidateAdminPath('/admin', 'layout');
}
