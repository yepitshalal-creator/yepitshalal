import Link from 'next/link';
import clsx from 'clsx';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { adminCached } from '@/lib/admin/cache';
import { AdminPage, Panel, List, Row, Tag } from '@/components/admin/ui';
import { ago } from '@/lib/admin/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'People' };

// Everyone with an account: admins, restaurant owners, supporters and people
// who signed in once. An account is made on first sign in (the
// on_auth_user_created trigger). Admin rights come only from an invite in
// admin_invites, used up on first sign in, never from a button here.

type Role = 'consumer' | 'restaurant_owner' | 'verifier' | 'admin';

interface Person {
  id: string;
  email: string;
  role: Role;
  is_yep_plus: boolean;
  created_at: string;
  lastSignIn: string | null;
  owns: { id: string; name: string }[];
  claimsWaiting: number;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  restaurant_owner: 'Restaurant owner',
  verifier: 'Checker',
  consumer: 'Visitor',
};

const FILTERS = ['all', 'admin', 'owners', 'supporters'] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = { all: 'Everyone', admin: 'Admins', owners: 'Restaurant owners', supporters: 'Supporters' };

const loadPeople = adminCached(
  async () => {
    const db = createAdminSupabase();
    const [users, owned, claims, invites, auth] = await Promise.all([
      db.from('users').select('id, email, role, is_yep_plus, created_at').order('created_at', { ascending: false }),
      db.from('restaurants').select('id, name, owner_id').not('owner_id', 'is', null),
      db.from('restaurant_ownership_claims').select('user_id').eq('status', 'pending'),
      db.from('admin_invites').select('email, created_at'),
      // Last sign in lives in Supabase Auth, not in public.users.
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const lastSignIn = new Map((auth.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
    const ownsBy = new Map<string, { id: string; name: string }[]>();
    for (const r of (owned.data ?? []) as { id: string; name: string; owner_id: string }[]) {
      ownsBy.set(r.owner_id, [...(ownsBy.get(r.owner_id) ?? []), { id: r.id, name: r.name }]);
    }
    const waiting = new Map<string, number>();
    for (const c of (claims.data ?? []) as { user_id: string }[]) waiting.set(c.user_id, (waiting.get(c.user_id) ?? 0) + 1);

    const people: Person[] = ((users.data ?? []) as Omit<Person, 'lastSignIn' | 'owns' | 'claimsWaiting'>[]).map((u) => ({
      ...u,
      lastSignIn: lastSignIn.get(u.id) ?? null,
      owns: ownsBy.get(u.id) ?? [],
      claimsWaiting: waiting.get(u.id) ?? 0,
    }));
    return { people, invites: (invites.data ?? []) as { email: string; created_at: string }[] };
  },
  'people-v1',
  120
);

function matches(p: Person, f: Filter) {
  if (f === 'admin') return p.role === 'admin';
  if (f === 'owners') return p.role === 'restaurant_owner' || p.owns.length > 0;
  if (f === 'supporters') return p.is_yep_plus;
  return true;
}

export default async function AdminPeoplePage({ searchParams }: { searchParams: { who?: string } }) {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages, and this page lists people's email addresses.
  await requireAdmin();
  const who: Filter = (FILTERS as readonly string[]).includes(searchParams.who ?? '') ? (searchParams.who as Filter) : 'all';
  const { people, invites } = await loadPeople();
  const shown = people.filter((p) => matches(p, who));

  return (
    <AdminPage
      title="People"
      width="xl"
      description="Everyone with an account. Searching the site never needs one: accounts are for supporters, restaurant owners and admins."
    >
      <nav aria-label="Filter people" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const n = people.filter((p) => matches(p, f)).length;
          const active = who === f;
          return (
            <Link
              key={f}
              href={f === 'all' ? '/admin/people' : `/admin/people?who=${f}`}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition',
                active ? 'bg-ink text-white' : 'border border-line bg-white text-ink/80 hover:border-ink/30'
              )}
            >
              {FILTER_LABEL[f]}
              <span className={clsx('text-xs tabular-nums', active ? 'text-white/70' : 'text-subtle')}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel>
            <List empty="Nobody here yet.">
              {shown.map((p) => (
                <Row key={p.id} className="flex-wrap items-start">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{p.email}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Joined {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {p.lastSignIn ? `last signed in ${ago(p.lastSignIn)}` : 'never signed in'}
                    </p>
                    {p.owns.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-x-2 text-xs">
                        <span className="text-muted">Owns</span>
                        {p.owns.map((r) => (
                          <Link key={r.id} href={`/admin/restaurants/${r.id}`} className="font-semibold text-accent-ink hover:underline">
                            {r.name}
                          </Link>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {p.claimsWaiting > 0 && (
                      <Link href="/admin/claims">
                        <Tag tone="accent">Claim waiting</Tag>
                      </Link>
                    )}
                    {p.is_yep_plus && <Tag tone="good">Supporter</Tag>}
                    <Tag tone={p.role === 'admin' ? 'ink' : 'neutral'}>{ROLE_LABEL[p.role] ?? p.role}</Tag>
                  </div>
                </Row>
              ))}
            </List>
          </Panel>
        </div>

        <Panel title="Admin invites" action={<Tag>{invites.length}</Tag>}>
          <p className="border-b border-line px-5 py-3 text-xs leading-relaxed text-muted">
            An address here becomes an admin the first time it signs in, then drops off the list. Ask Claude to add one;
            there is deliberately no button for it.
          </p>
          <List empty="No invites waiting.">
            {invites.map((i) => (
              <Row key={i.email}>
                <span className="min-w-0 truncate text-sm text-ink">{i.email}</span>
                <span className="text-xs text-subtle">{ago(i.created_at)}</span>
              </Row>
            ))}
          </List>
        </Panel>
      </div>
    </AdminPage>
  );
}
