import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { AdminPage, Panel, List, Row, Tag } from '@/components/admin/ui';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New restaurants', robots: { index: false } };

const STATUS_TONE = { pending: 'warn', approved: 'good', duplicate: 'accent', rejected: 'neutral' } as const;
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', duplicate: 'Merged', rejected: 'Rejected' } as const;
const RELATIONSHIP = { owner: 'Owner', staff: 'Staff', customer: 'Customer' } as const;

export default async function SubmissionsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin();
  const status = (['pending', 'approved', 'duplicate', 'rejected'] as const).find((s) => s === searchParams.status) ?? 'pending';
  const supabase = createAdminSupabase();

  const [{ data: rows }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('restaurant_submissions')
      .select('id, name, postcode, borough, relationship, created_at, status, duplicate_candidates, halal_claim')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('restaurant_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return (
    <AdminPage
      tabs={<SectionTabs section="restaurants" current="/admin/submissions" />}
      title="New restaurants"
      description="Restaurants sent in through Add a restaurant. Nothing here is public until it is approved."
      width="lg"
    >
      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {(['pending', 'approved', 'duplicate', 'rejected'] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/submissions?status=${s}`}
            aria-current={s === status ? 'page' : undefined}
            className={`inline-flex min-h-[36px] items-center rounded-full border px-3.5 text-sm font-medium ${
              s === status ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink/75 hover:text-ink'
            }`}
          >
            {STATUS_LABEL[s]}
            {s === 'pending' && pendingCount ? ` (${pendingCount})` : ''}
          </Link>
        ))}
      </nav>

      <Panel>
        <List empty={status === 'pending' ? 'Nothing waiting for review.' : 'None yet.'}>
          {(rows ?? []).map((r) => {
            const dupes = Array.isArray(r.duplicate_candidates) ? r.duplicate_candidates : [];
            const likely = dupes.some((d: { similarity: number; distance_meters: number }) => d.similarity >= 0.6 && d.distance_meters <= 150);
            return (
              <Row key={r.id} className="flex-wrap">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/submissions/${r.id}`} className="font-medium text-ink hover:underline">
                    {r.name}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {r.postcode} · {r.borough} · {RELATIONSHIP[r.relationship as keyof typeof RELATIONSHIP]} ·{' '}
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {likely && <Tag tone="warn">Possible duplicate</Tag>}
                  <Tag tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE]}>
                    {STATUS_LABEL[r.status as keyof typeof STATUS_LABEL]}
                  </Tag>
                </div>
              </Row>
            );
          })}
        </List>
      </Panel>
    </AdminPage>
  );
}
