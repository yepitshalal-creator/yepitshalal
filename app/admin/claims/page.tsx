import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { reviewOwnershipClaim } from '@/lib/reel-actions';
import { AdminPage, Panel, List, Row, Tag } from '@/components/admin/ui';
import { ArrowUpRightIcon } from '@/components/icons';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ownership claims' };

interface Claim {
  id: string;
  restaurant_id: string;
  status: string;
  contact_note: string | null;
  created_at: string;
  restaurants: { name: string; slug: string } | null;
  users: { email: string } | null;
}

export default async function AdminClaimsPage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('restaurant_ownership_claims')
    .select('id, restaurant_id, status, contact_note, created_at, restaurants(name, slug), users(email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const claims = (data ?? []) as unknown as Claim[];

  // Said yes to photos from the same email (outreach, 0054): good evidence
  // the person runs the place. Before that migration this finds nothing.
  const { data: yeses } = claims.length
    ? await supabase
        .from('content_permissions')
        .select('restaurant_id, given_by_email, agreed_at')
        .in('restaurant_id', claims.map((c) => c.restaurant_id))
        .is('withdrawn_at', null)
    : { data: [] };
  const saidYes = new Map(
    ((yeses ?? []) as { restaurant_id: string; given_by_email: string; agreed_at: string }[]).map((y) => [
      `${y.restaurant_id}|${y.given_by_email.toLowerCase()}`,
      y.agreed_at,
    ])
  );

  return (
    <AdminPage
      tabs={<SectionTabs section="partners" current="/admin/claims" />}
      title="Ownership claims"
      width="lg"
      description="Approving one hands that account edit rights over a live listing and the ability to publish reels. Check the person actually runs the restaurant before approving."
    >
      <Panel
        title="Waiting"
        action={<Tag tone={claims.length ? 'ink' : 'neutral'}>{claims.length}</Tag>}
      >
        <List empty="No claims waiting.">
          {claims.map((c) => (
            <Row key={c.id} className="items-start">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/restaurant/${c.restaurants?.slug ?? ''}`}
                  className="inline-flex items-center gap-1 font-medium text-ink hover:underline"
                >
                  {c.restaurants?.name ?? 'Unknown restaurant'}
                  <ArrowUpRightIcon className="h-3.5 w-3.5 text-subtle" />
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  {c.users?.email ?? 'Unknown account'} ·{' '}
                  {new Date(c.created_at).toLocaleDateString('en-GB')}
                </p>
                {saidYes.has(`${c.restaurant_id}|${(c.users?.email ?? '').toLowerCase()}`) && (
                  <p className="mt-1.5">
                    <Tag tone="good">
                      Said yes to photos with this email on{' '}
                      {new Date(saidYes.get(`${c.restaurant_id}|${(c.users?.email ?? '').toLowerCase()}`) as string).toLocaleDateString('en-GB')}
                    </Tag>
                  </p>
                )}
                {c.contact_note && (
                  <p className="mt-1.5 rounded-xl bg-black/[0.03] px-3 py-2 text-sm leading-relaxed text-ink/80">
                    {c.contact_note}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={reviewOwnershipClaim.bind(null, c.id, true)}>
                  <button className="inline-flex min-h-[36px] items-center rounded-full bg-ink px-4 text-xs font-semibold text-white transition hover:bg-accent-ink">
                    Approve
                  </button>
                </form>
                <form action={reviewOwnershipClaim.bind(null, c.id, false)}>
                  <button className="inline-flex min-h-[36px] items-center rounded-full border border-line px-4 text-xs font-semibold text-halal-partialInk transition hover:border-halal-partial/40">
                    Reject
                  </button>
                </form>
              </div>
            </Row>
          ))}
        </List>
      </Panel>
    </AdminPage>
  );
}
