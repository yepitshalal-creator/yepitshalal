import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { ArrowRightIcon } from '@/components/icons';
import { AdminPage, Panel, List, Row, Tag, QueueStatusTag } from '@/components/admin/ui';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Check requests' };

interface QueueRequest {
  id: string;
  queue_type: string;
  status: string;
  entered_queue_at: string;
  contact_email: string | null;
  restaurants: { name: string; slug: string } | null;
}

function daysWaiting(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export default async function AdminQueuePage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const supabase = createAdminSupabase();
  const monthStart = new Date();
  monthStart.setUTCDate(1);

  const [{ data: requests }, { data: voteData }] = await Promise.all([
    supabase
      .from('verification_requests')
      .select('id, queue_type, status, entered_queue_at, contact_email, restaurants(name, slug)')
      .in('status', ['awaiting_slot', 'queued', 'in_review', 'pending_qc'])
      .order('queue_type', { ascending: false })
      .order('entered_queue_at', { ascending: true }),
    supabase.from('area_votes').select('borough').eq('month', monthStart.toISOString().slice(0, 10)),
  ]);

  // Supporters were promised the area they vote for goes to the top of the
  // queue, so whoever works this page has to be able to see it from here.
  const tally = new Map<string, number>();
  for (const v of (voteData ?? []) as { borough: string }[]) {
    tally.set(v.borough, (tally.get(v.borough) ?? 0) + 1);
  }
  const leader = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const all = (requests ?? []) as unknown as QueueRequest[];
  const priority = all.filter((r) => r.queue_type === 'priority');
  const free = all.filter((r) => r.queue_type === 'free');

  return (
    <AdminPage
      tabs={<SectionTabs section="checks" current="/admin/queue" />}
      title="Check requests"
      description={`${all.length} open request${all.length === 1 ? '' : 's'}, priority first, then oldest.`}
      width="lg"
    >
      <div className="space-y-5">
        {leader && (
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-ink">
            Supporters voted for <span className="font-semibold">{leader[0]}</span> this month
            ({leader[1]} {leader[1] === 1 ? 'vote' : 'votes'}). Check places there next.{' '}
            <Link href="/admin/coverage" className="font-semibold underline underline-offset-2">
              See the standings
            </Link>
          </p>
        )}
        <Section
          title="Priority"
          tone="ink"
          count={priority.length}
          requests={priority}
          empty="No priority requests waiting."
        />
        <Section
          title="Free"
          count={free.length}
          requests={free}
          empty="No free requests waiting."
        />
      </div>
    </AdminPage>
  );
}

function Section({
  title,
  count,
  requests,
  empty,
  tone = 'neutral',
}: {
  title: string;
  count: number;
  requests: QueueRequest[];
  empty: string;
  tone?: 'ink' | 'neutral';
}) {
  return (
    <Panel title={title} action={<Tag tone={tone}>{count}</Tag>}>
      <List empty={empty}>
        {requests.map((r) => (
          <Row key={r.id} padded={false}>
            <Link
              href={`/admin/queue/${r.id}`}
              className="group flex min-h-[64px] flex-1 items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-black/[0.02]"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">
                  {r.restaurants?.name ?? 'Unknown restaurant'}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  Waiting {daysWaiting(r.entered_queue_at)}
                  {r.contact_email ? ` · ${r.contact_email}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5">
                <QueueStatusTag status={r.status} />
                <ArrowRightIcon className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </span>
            </Link>
          </Row>
        ))}
      </List>
    </Panel>
  );
}
