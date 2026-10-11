import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { mergeDuplicate, markDistinct } from '@/lib/catalogue-actions';
import { AdminPage, Panel, List, Row, Tag } from '@/components/admin/ui';
import { ConfirmSubmitButton } from '@/components/admin/ConfirmSubmitButton';
import { ArrowUpRightIcon, InfoIcon } from '@/components/icons';
import { HalalBadge } from '@/components/HalalBadge';
import { adminCached } from '@/lib/admin/cache';
import { showsAs, type CatalogueRow } from '@/lib/admin/catalogue';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Duplicates' };

interface Side {
  id: string;
  name: string;
  address: string;
  postcode: string | null;
  phone: string | null;
  slug: string;
  halal_classification: CatalogueRow['halal_classification'];
  halal_evidence_strength: CatalogueRow['halal_evidence_strength'];
  is_searchable: boolean;
  branch_label: string | null;
}

interface Candidate {
  id: string;
  score: number;
  signals: Record<string, string | boolean>;
  a: Side;
  b: Side;
}

// scripts/find-duplicates.mjs writes why a pair matched as short codes. These
// are the same facts in words.
function why(signals: Record<string, string | boolean>): string[] {
  const out: string[] = [];
  if (signals.name === 'identical') out.push('Same name');
  else if (signals.name) out.push('One name is inside the other');
  if (typeof signals.distance === 'string') out.push(`${signals.distance.replace(/m$/, '')} metres apart`);
  if (signals.postcode) out.push(`Same postcode, ${signals.postcode}`);
  if (signals.phone) out.push('Same phone number');
  if (signals.website) out.push(`Same website, ${signals.website}`);
  if (signals.same_brand) out.push('Same chain');
  return out;
}

async function buildCandidates(): Promise<Candidate[]> {
  const supabase = createAdminSupabase();

  const { data: rows } = await supabase
    .from('catalogue_dedupe_candidates')
    .select('id, score, signals, restaurant_a, restaurant_b')
    .eq('status', 'pending')
    .order('score', { ascending: false })
    .limit(50);

  const ids = [
    ...new Set((rows ?? []).flatMap((r) => [r.restaurant_a, r.restaurant_b])),
  ];
  const { data: restaurants } = ids.length
    ? await supabase
        .from('restaurants')
        .select('id, name, address, postcode, phone, slug, halal_classification, halal_evidence_strength, is_searchable, branch_label')
        .in('id', ids)
    : { data: [] };
  const byId = new Map((restaurants ?? []).map((r) => [r.id, r as Side]));

  return (rows ?? [])
    .map((r) => ({
      id: r.id,
      score: r.score,
      signals: (r.signals ?? {}) as Record<string, string | boolean>,
      a: byId.get(r.restaurant_a),
      b: byId.get(r.restaurant_b),
    }))
    .filter((c): c is Candidate => Boolean(c.a && c.b));
}

const loadCandidates = adminCached(buildCandidates, 'duplicates-v1', 300);

export default async function AdminDuplicatesPage() {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const candidates = await loadCandidates();

  return (
    <AdminPage
      tabs={<SectionTabs section="restaurants" current="/admin/duplicates" />}
      title="Duplicates"
      width="lg"
      description="Pairs of records that may be the same restaurant. Nothing here has been joined yet. A person decides, because joining two real restaurants by mistake is far worse than a copy for a week."
    >
      <div className="space-y-5">
        <p className="flex items-start gap-2 rounded-2xl border border-line bg-white px-5 py-3.5 text-sm leading-relaxed text-muted shadow-sm">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
          <span>
            Two branches of one chain are not copies. Morley&apos;s Peckham and Morley&apos;s
            Brixton share a name and are two different places. If that is what you see, choose{' '}
            <strong className="font-semibold text-ink">Different places</strong>.
          </span>
        </p>

        <Panel
          title="Waiting"
          action={<Tag tone={candidates.length ? 'ink' : 'neutral'}>{candidates.length}</Tag>}
        >
          <List empty="No pairs waiting. New ones show up after the next catalogue import.">
            {candidates.map((c) => (
              <Row key={c.id} className="flex-col items-stretch gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={c.score >= 80 ? 'warn' : 'neutral'}>{c.score}/100</Tag>
                  {why(c.signals).map((w) => (
                    <span key={w} className="rounded-full bg-sand-soft px-2.5 py-0.5 text-xs font-medium text-ink/75">
                      {w}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[c.a, c.b].map((side, i) => (
                    <div key={side.id} className="rounded-xl border border-line p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/admin/restaurants/${side.id}`} className="min-w-0 font-medium text-ink hover:underline">
                          {side.name}
                        </Link>
                        {side.is_searchable && (
                          <a
                            href={`/restaurant/${side.slug}`}
                            target="_blank"
                            rel="noopener"
                            title="The live page"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-accent-ink transition hover:bg-accent-soft"
                          >
                            <ArrowUpRightIcon className="h-3.5 w-3.5" />
                            <span className="sr-only">Open the live page for {side.name}</span>
                          </a>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{side.address}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
                        {(() => {
                          const shows = showsAs(side);
                          return shows === 'hidden' ? <span className="font-semibold text-ink/70">Hidden</span> : <HalalBadge classification={shows} size="sm" />;
                        })()}
                        <span>{side.phone ?? 'No phone'}</span>
                        {side.branch_label && <span>{side.branch_label}</span>}
                      </div>
                      <form
                        action={mergeDuplicate.bind(
                          null,
                          c.id,
                          side.id,
                          i === 0 ? c.b.id : c.a.id
                        )}
                        className="mt-3"
                      >
                        <ConfirmSubmitButton
                          message={`Keep "${side.name}" and merge the other record into it? The other record is kept but hidden from search, so this is reversible.`}
                          className="inline-flex min-h-[36px] w-full items-center justify-center rounded-full bg-ink px-4 text-xs font-semibold text-white transition hover:bg-accent-ink"
                        >
                          Keep this one
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ))}
                </div>

                <form action={markDistinct.bind(null, c.id)}>
                  <button className="inline-flex min-h-[36px] items-center rounded-full border border-line px-4 text-xs font-semibold text-ink transition hover:border-ink/30">
                    Different places
                  </button>
                </form>
              </Row>
            ))}
          </List>
        </Panel>
      </div>
    </AdminPage>
  );
}
