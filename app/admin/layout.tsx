import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/require-admin';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { BLOCK_CLASS } from '@/lib/analytics/scrub';
import { waitingCounts } from '@/lib/admin/stats';
import { setupOpenCount } from '@/lib/admin/setup';

export const dynamic = 'force-dynamic';

// Admin is behind an auth check, but a stray crawler following a leaked link
// should still be told not to index it.
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [counts, setup] = await Promise.all([waitingCounts(), setupOpenCount().catch(() => 0)]);
  // Submitters' email addresses and messages: session recordings show all of
  // admin as an empty box (BLOCK_CLASS in lib/analytics/scrub.ts).
  return (
    <div className={`${BLOCK_CLASS} lg:flex lg:items-start`}>
      <AdminNav counts={{ ...counts, setup }} />
      <div className="min-w-0 flex-1">
        <AdminTopBar />
        {children}
      </div>
    </div>
  );
}
