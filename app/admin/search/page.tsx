import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { AdminPage, Panel, List, Row, Tag } from '@/components/admin/ui';
import { HalalBadge } from '@/components/HalalBadge';
import { cleanQuery, filterHref, loadCatalogue, readFilters, showsAs, hiddenReason } from '@/lib/admin/catalogue';
import { loadInbox, INBOX_LABEL } from '@/lib/admin/inbox';
import { ago } from '@/lib/admin/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

// The top bar's search: restaurants by name, postcode or address, people by
// email, and messages by who sent them or what they said.

export default async function AdminSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages, and this page shows people's messages.
  await requireAdmin();
  const q = cleanQuery(searchParams.q ?? '');

  if (!q) {
    return (
      <AdminPage title="Search" width="lg" description="Type a restaurant, a postcode, an email address or words from a message in the box above." >
        <span />
      </AdminPage>
    );
  }

  const needle = q.toLowerCase();
  const filters = { ...readFilters({}), q };
  const [restaurants, people, inbox] = await Promise.all([
    loadCatalogue(filters),
    createAdminSupabase().from('users').select('id, email, role').ilike('email', `%${q}%`).limit(10),
    loadInbox(),
  ]);
  const messages = inbox.items
    .filter((i) => [i.title, i.name, i.email, i.message, i.instagram].some((v) => v?.toLowerCase().includes(needle)))
    .slice(0, 10);

  return (
    <AdminPage title={`Search: ${q}`} width="lg" description="Restaurants, people and messages that match.">
      <div className="space-y-5">
        <Panel
          title="Restaurants"
          action={
            restaurants.total > 0 && (
              <Link href={filterHref(filters)} className="text-xs font-semibold text-accent-ink hover:underline">
                All {restaurants.total.toLocaleString('en-GB')}
              </Link>
            )
          }
        >
          <List empty="No restaurant matches.">
            {restaurants.rows.slice(0, 8).map((r) => {
              const shows = showsAs(r);
              return (
                <Row key={r.id} padded={false}>
                  <Link href={`/admin/restaurants/${r.id}`} className="flex w-full items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-sand-soft/60">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{r.name}</span>
                      <span className="block truncate text-xs text-muted">{r.address}</span>
                    </span>
                    {shows === 'hidden' ? <Tag>{hiddenReason(r)}</Tag> : <HalalBadge classification={shows} size="sm" />}
                  </Link>
                </Row>
              );
            })}
          </List>
        </Panel>

        <Panel title="People">
          <List empty="No account matches.">
            {(people.data ?? []).map((p) => (
              <Row key={p.id}>
                <span className="min-w-0 truncate text-sm text-ink">{p.email}</span>
                <Tag>{String(p.role).replace(/_/g, ' ')}</Tag>
              </Row>
            ))}
          </List>
        </Panel>

        <Panel title="Messages">
          <List empty="No message matches.">
            {messages.map((m) => (
              <Row key={m.key} padded={false}>
                <Link href={`/admin/inbox?view=all&open=${encodeURIComponent(m.key)}`} className="flex w-full items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-sand-soft/60">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{m.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {m.name ?? m.email ?? 'No name'} · {INBOX_LABEL[m.inbox]} · {ago(m.createdAt)}
                    </span>
                  </span>
                </Link>
              </Row>
            ))}
          </List>
        </Panel>
      </div>
    </AdminPage>
  );
}
