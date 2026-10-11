import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { adminCached } from '@/lib/admin/cache';
import { AdminPage, Panel, Tag } from '@/components/admin/ui';
import { ArrowUpRightIcon, InfoIcon } from '@/components/icons';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Certificate claims' };

// Every place that says it is certified, grouped by who says it.
//
// A claim of certification is recorded as a claim and never as certification:
// "the restaurant says it is HMC certified" is not the same fact as "HMC
// certifies this restaurant", and only the second one is strong evidence.
// Confirming one turns an Unverified listing into Fully Halal, which makes this
// the highest-value queue in the catalogue.
//
// It is grouped by website because the claims are not 140 separate jobs. Two
// chains account for most of them, and a chain is one conversation.
//
// Why there is no import button here: the certifier registers are not ours to
// copy. HMC's site refuses our requests outright, and neither body publishes
// terms for reuse, so this lists what to check and links to their own lookup.
// Whoever checks records the outcome as our own evidence, dated, the same way
// every other check on this site is recorded.

interface ClaimRow {
  excerpt: string | null;
  source_url: string | null;
  restaurants: {
    id: string;
    name: string;
    slug: string;
    website_url: string | null;
    halal_classification: string;
    is_searchable: boolean;
  } | null;
}

/** Which body the restaurant names, when it names one at all. */
function certifierIn(text: string): { name: string; lookup: string } | null {
  if (/\bhmc\b|halal monitoring committee/i.test(text)) {
    return { name: 'HMC', lookup: 'https://halalhmc.org/certified-outlets/' };
  }
  if (/\bhfa\b|halal food authority/i.test(text)) {
    return { name: 'HFA', lookup: 'https://halalfoodauthority.com/' };
  }
  if (/halal trust/i.test(text)) return { name: 'Halal Trust', lookup: 'https://halaltrust.co.uk/' };
  return null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Every current certificate claim with its listing, kept ten minutes.
const loadClaims = adminCached(
  async () => {
    const { data } = await createAdminSupabase()
      .from('restaurant_halal_evidence')
      .select('excerpt, source_url, restaurants(id, name, slug, website_url, halal_classification, is_searchable)')
      .eq('is_current', true)
      .eq('kind', 'certification_claim');
    return data;
  },
  'certification-claims-v1',
  600
);

export default async function AdminCertificationPage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const data = await loadClaims();

  const claims = ((data ?? []) as unknown as ClaimRow[]).filter((c) => c.restaurants?.is_searchable);

  // One group per website, because that is the unit of work: a chain's claim is
  // true or false for every branch at once.
  const groups = new Map<
    string,
    { key: string; label: string; branches: ClaimRow[]; excerpt: string; source: string | null; certifier: ReturnType<typeof certifierIn> }
  >();
  for (const claim of claims) {
    const r = claim.restaurants!;
    const key = hostOf(r.website_url) ?? `name:${r.name.toLowerCase()}`;
    const said = `${claim.excerpt ?? ''} ${r.name}`;
    const existing = groups.get(key);
    if (existing) {
      existing.branches.push(claim);
      if (!existing.certifier) existing.certifier = certifierIn(said);
    } else {
      groups.set(key, {
        key,
        label: hostOf(r.website_url) ?? r.name,
        branches: [claim],
        excerpt: claim.excerpt ?? '',
        source: claim.source_url,
        certifier: certifierIn(said),
      });
    }
  }

  const ordered = [...groups.values()].sort((a, b) => b.branches.length - a.branches.length);
  const listings = claims.length;
  const named = ordered.filter((g) => g.certifier).length;

  return (
    <AdminPage
      tabs={<SectionTabs section="checks" current="/admin/certification" />}
      title="Certificate claims"
      width="lg"
      description={`${listings} listings across ${ordered.length} businesses say they are certified, and every one of them is still labelled Unverified. Confirm a claim and it becomes Fully Halal.`}
    >
      <div className="space-y-5">
        <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-ink">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            A claim is not a certification. Check it against the certifier&apos;s own register or by
            asking the restaurant, then record what you found on the listing: that becomes our
            evidence, with today&apos;s date on it. {named} of these name the body that certified them.
          </span>
        </p>

        <Panel title="Businesses, biggest first" action={<Tag>{ordered.length}</Tag>}>
          <ul className="divide-y divide-line">
            {ordered.map((g) => (
              <li key={g.key} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold text-ink">{g.label}</span>
                  <span className="text-sm text-muted">
                    {g.branches.length} {g.branches.length === 1 ? 'listing' : 'listings'}
                  </span>
                </div>

                {g.excerpt && (
                  <blockquote className="mt-1.5 border-l-2 border-accent/40 pl-3 text-sm italic leading-relaxed text-ink/75">
                    &ldquo;{g.excerpt.slice(0, 200)}&rdquo;
                  </blockquote>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                  {g.certifier ? (
                    <a
                      href={g.certifier.lookup}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-accent-ink hover:underline"
                    >
                      Check the {g.certifier.name} register
                      <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-subtle">No certifier named: ask them who certifies them</span>
                  )}
                  {g.source && (
                    <a
                      href={g.source}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink hover:underline"
                    >
                      Where they said it
                      <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-[13px] font-semibold text-accent-ink hover:underline">
                    The {g.branches.length === 1 ? 'listing' : `${g.branches.length} listings`}
                  </summary>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                    {g.branches.map((b) => (
                      <li key={b.restaurants!.id}>
                        <Link
                          href={`/admin/restaurants/${b.restaurants!.id}`}
                          className="text-muted hover:text-ink hover:underline"
                        >
                          {b.restaurants!.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AdminPage>
  );
}
