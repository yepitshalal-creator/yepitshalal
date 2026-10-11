import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { adminCached } from '@/lib/admin/cache';
import { AdminPage, Panel, Tag } from '@/components/admin/ui';
import { ArrowUpRightIcon, InfoIcon, PhoneIcon } from '@/components/icons';
import { formatUkPhone, splitPhones } from '@/lib/phone';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'What to check next' };

// The call sheet.
//
// 11,735 places and one pair of hands. Checking them in any order is a job
// without an end, so this orders them by the only thing that matters when the
// budget is time: how many listings one conversation would settle.
//
// A chain is one conversation. Confirming how Chicken Cottage sources its meat
// settles 74 listings at once, and the biggest twenty businesses here cover
// well over a thousand between them. Everything else is a long tail to be
// worked through by the people who actually run those shops, through the claim
// flow, which is why this page leads with the ones worth a phone call and
// nothing else.
//
// No paid data anywhere in it: the numbers and addresses are ones the
// catalogue already holds, and the check itself is a phone call or a page on
// the restaurant's own website.

interface Row {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  website_url: string | null;
  is_listed: boolean;
  halal_classification: string;
  halal_evidence_strength: string | null;
  checked_by_us: boolean;
  brands: { name: string } | null;
}

/** One key per business, however the catalogue happens to spell it. */
function businessKey(r: Row): string {
  const host = (r.website_url || '')
    .replace(/^https?:\/\/(www\.)?/, '')
    .split('/')[0]
    .toLowerCase();
  if (host) {
    // "morleyschicken.com" and a brand called "Morley's" are one business.
    return host.replace(/\.(co\.uk|com|uk|net|org|london|shop|store)$/i, '');
  }
  return (r.brands?.name ?? r.name).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// The call sheet reads every searchable listing, twelve pages of a thousand,
// so the finished list is kept for ten minutes rather than rebuilt on every
// visit. Recording a check clears it (revalidateAdminPath).
async function buildWorklist() {
  const supabase = createAdminSupabase();

  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, slug, phone, website_url, is_listed, halal_classification, halal_evidence_strength, checked_by_us, brands(name)')
      .eq('is_searchable', true)
      .order('id')
      .range(from, from + 999);
    if (error || !data) break;
    rows.push(...(data as unknown as Row[]));
    if (data.length < 1000) break;
  }

  const claims = new Set<string>();
  const { data: claimRows } = await supabase
    .from('restaurant_halal_evidence')
    .select('restaurant_id')
    .eq('is_current', true)
    .eq('kind', 'certification_claim');
  for (const c of (claimRows ?? []) as { restaurant_id: string }[]) claims.add(c.restaurant_id);

  const groups = new Map<
    string,
    { key: string; label: string; rows: Row[]; phone: string | null; website: string | null; claims: number; checked: number }
  >();
  for (const r of rows) {
    if (r.checked_by_us) continue; // Already settled.
    const key = businessKey(r);
    const g = groups.get(key) ?? {
      key,
      label: r.brands?.name ?? r.name,
      rows: [],
      phone: null,
      website: null,
      claims: 0,
      checked: 0,
    };
    g.rows.push(r);
    if (!g.phone && r.phone) g.phone = r.phone;
    if (!g.website && r.website_url) g.website = r.website_url;
    if (claims.has(r.id)) g.claims++;
    // Prefer a brand name over one branch's trading name as the label.
    if (r.brands?.name) g.label = r.brands.name;
    groups.set(key, g);
  }

  const worklist = [...groups.values()]
    .filter((g) => g.rows.length >= 3)
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 40);

  const covered = worklist.reduce((n, g) => n + g.rows.length, 0);
  const singles = [...groups.values()].filter((g) => g.rows.length < 3).reduce((n, g) => n + g.rows.length, 0);
  return { worklist, covered, singles };
}

const loadWorklist = adminCached(buildWorklist, 'verify-worklist-v1', 600);

export default async function AdminVerifyPage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const { worklist, covered, singles } = await loadWorklist();

  return (
    <AdminPage
      tabs={<SectionTabs section="checks" current="/admin/verify" />}
      title="What to check next"
      width="lg"
      description={`Ordered by how many listings one conversation would settle. These 40 businesses cover ${covered.toLocaleString('en-GB')} of them; the remaining ${singles.toLocaleString('en-GB')} are one-offs, best left to their owners through the claim flow.`}
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-ink">
          <p className="flex items-start gap-2">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">Cheapest first.</span> A chain that publishes its own
              halal branch list settles every branch at once and costs one page read: that is a
              first-party statement, the same evidence standard as anything else here. Next cheapest
              is the phone. Anything needing a visit comes last, and most places will never need one.
            </span>
          </p>
          <p className="mt-2 flex items-start gap-2">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">On every call, also ask:</span> &ldquo;Can we use your photos
              and menu on your page and our Instagram?&rdquo; If yes, add them in{' '}
              <a href="/admin/outreach" className="font-semibold underline underline-offset-2">Outreach</a> as a phone
              contact and send them their yes link. Check the number is not on the TPS list before a call that asks.
            </span>
          </p>
        </div>

        <Panel title="Biggest first" action={<Tag>{worklist.length}</Tag>}>
          <ol className="divide-y divide-line">
            {worklist.map((g, i) => {
              const phones = splitPhones(g.phone);
              const listed = g.rows.filter((r) => r.is_listed).length;
              return (
                <li key={g.key} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-semibold text-ink">
                      {i + 1}. {g.label}
                    </span>
                    <span className="text-sm text-muted">
                      {g.rows.length} {g.rows.length === 1 ? 'listing' : 'listings'}
                    </span>
                  </div>

                  <p className="mt-0.5 text-[13px] text-muted">
                    {listed} with some evidence, {g.rows.length - listed} with none
                    {g.claims > 0 && (
                      <span className="font-semibold text-accent-ink"> · says it is certified</span>
                    )}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                    {phones[0] && (
                      <a
                        href={`tel:${phones[0]}`}
                        className="inline-flex items-center gap-1.5 font-semibold text-accent-ink hover:underline"
                      >
                        <PhoneIcon className="h-4 w-4" aria-hidden="true" />
                        {formatUkPhone(phones[0])}
                      </a>
                    )}
                    {g.website && (
                      <a
                        href={g.website}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink hover:underline"
                      >
                        Their website
                        <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                    <Link
                      href={`/admin/restaurants/${g.rows[0].id}`}
                      className="font-medium text-muted hover:text-ink hover:underline"
                    >
                      Record what you find
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </AdminPage>
  );
}
