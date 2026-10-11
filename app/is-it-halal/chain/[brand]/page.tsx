import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { chainAnswer, getChain, type Branch } from '@/lib/halalPages';
import { HalalBadge, halalLabel } from '@/components/HalalBadge';
import { formatCheckedDate } from '@/components/HalalEvidencePanel';
import { tidyAddress } from '@/lib/address';
import { jsonLdHtml } from '@/lib/jsonLd';
import { SITE_URL } from '@/lib/site';
import { ArrowUpRightIcon } from '@/components/icons';
import type { HalalStatus } from '@/lib/types';

// "Is <chain> halal?", for every chain with two or more branches we know of
// and at least one with halal evidence.
// It is the question most people type ("is Chicken Cottage halal"), and the
// honest answer is usually that it depends what is known about each branch.
//
// The answer is built only from the branches' own labels (chainAnswer): a chain
// is called halal only where every branch we know of carries that label. What
// the chain says on its own website is quoted separately, as its words, not as
// a check of any kitchen.

// Read fresh on every visit, like the single place pages: the answer is built
// from the branches' labels, and a kept copy could show one that has changed.
export const dynamic = 'force-dynamic';

const LINK = 'font-semibold text-accent-ink hover:underline';
const ORDER: HalalStatus[] = ['fully_halal', 'halal_options', 'unverified', 'unknown'];
// Branches with no halal evidence count towards the answer but have no page
// since 2026-10-11, so they are counted and not listed.
const LISTED = ORDER.filter((s) => s !== 'unknown');

export async function generateMetadata({ params }: { params: { brand: string } }): Promise<Metadata> {
  const chain = await getChain(params.brand);
  if (!chain) return { title: 'Not found', robots: { index: false } };
  const answer = chainAnswer(chain.name, chain.branches);
  return {
    title: `Is ${chain.name} halal? ${answer.verdict}, ${chain.branches.length} London branches`,
    description: answer.sentence.slice(0, 300),
    alternates: { canonical: `/is-it-halal/chain/${chain.slug}` },
    openGraph: { title: `Is ${chain.name} halal?`, description: answer.sentence.slice(0, 300), url: `/is-it-halal/chain/${chain.slug}` },
  };
}

export default async function ChainPage({ params }: { params: { brand: string } }) {
  const chain = await getChain(params.brand);
  if (!chain) notFound();

  const answer = chainAnswer(chain.name, chain.branches);
  const byStatus = new Map<HalalStatus, Branch[]>();
  for (const b of chain.branches) byStatus.set(b.status, [...(byStatus.get(b.status) ?? []), b]);
  const noInfo = byStatus.get('unknown')?.length ?? 0;

  const pageUrl = `${SITE_URL}/is-it-halal/chain/${chain.slug}`;
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: `Is ${chain.name} halal?`, acceptedAnswer: { '@type': 'Answer', text: answer.sentence } }],
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'YepItsHalal', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Is it halal? Chains A to Z', item: `${SITE_URL}/is-it-halal` },
      { '@type': 'ListItem', position: 3, name: `Is ${chain.name} halal?`, item: pageUrl },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <li>
            <Link href="/is-it-halal" className="hover:text-ink hover:underline">
              Is it halal? Chains A to Z
            </Link>
          </li>
          <li aria-hidden="true" className="text-subtle">/</li>
          <li aria-current="page" className="min-w-0 truncate text-ink/70">
            {chain.name}
          </li>
        </ol>
      </nav>

      <h1 className="mt-3 text-balance font-display text-[1.9rem] font-semibold leading-tight text-ink sm:text-4xl">
        Is {chain.name} halal?
      </h1>
      <p className="mt-2 text-sm text-muted">
        {chain.branches.length} branches in London that we know of.{' '}
        {noInfo
          ? `${chain.branches.length - noInfo} ${chain.branches.length - noInfo === 1 ? 'has' : 'have'} halal evidence, each labelled from its own.`
          : 'Each is labelled from its own evidence.'}
      </p>

      <section aria-labelledby="short-answer" className="ground-dark mt-5 rounded-2xl bg-forest-deep p-5 text-white shadow-sm sm:p-6">
        <h2 id="short-answer" className="text-xs font-semibold uppercase tracking-wider text-white/70">
          The short answer
        </h2>
        {/* The verdict and its detail together are the sentence in the markup. */}
        <p className="mt-2 font-display text-2xl font-semibold text-white">{answer.verdict}.</p>
        <p className="mt-2 max-w-2xl text-pretty text-[15px] leading-relaxed text-white/85">{answer.detail}</p>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Branches by label">
          {ORDER.filter((s) => byStatus.get(s)?.length).map((s) => (
            <li key={s} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
              {byStatus.get(s)!.length} {halalLabel(s)}
            </li>
          ))}
        </ul>
      </section>

      {chain.statement && (
        <section aria-labelledby="chain-says" className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 id="chain-says" className="font-display text-lg font-semibold text-ink">
            What {chain.name} says
          </h2>
          <blockquote className="mt-3 border-l-2 border-accent/40 pl-3 text-sm italic leading-relaxed text-ink/80">
            &ldquo;{chain.statement.excerpt}&rdquo;
          </blockquote>
          <p className="mt-2 text-[13px] text-muted">
            {chain.statement.source_url ? (
              <a href={chain.statement.source_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
                The chain&apos;s own website
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              "The chain's own website"
            )}
            , read <time dateTime={chain.statement.checked_at}>{formatCheckedDate(chain.statement.checked_at)}</time>. Its words
            about all its branches, not a check of any one kitchen.
          </p>
        </section>
      )}

      {LISTED.filter((s) => byStatus.get(s)?.length).map((s) => (
        <section key={s} aria-labelledby={`branches-${s}`} className="mt-8">
          <div className="flex items-center gap-2">
            <HalalBadge classification={s} size="md" variant="solid" />
            <h2 id={`branches-${s}`} className="font-display text-lg font-semibold text-ink">
              {byStatus.get(s)!.length === 1 ? '1 branch' : `${byStatus.get(s)!.length} branches`}
            </h2>
          </div>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {byStatus.get(s)!.map((b) => (
              <li key={b.id}>
                <Link href={`/is-it-halal/${b.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-sand-soft">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{b.branch_label ?? tidyAddress(b.address)}</span>
                    <span className="block truncate text-xs text-muted">
                      {[b.borough, b.postcode].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-accent-ink">Is it halal?</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {noInfo > 0 && (
        <p className="mt-8 text-sm leading-relaxed text-muted">
          {noInfo === 1 ? '1 more branch has' : `${noInfo} more branches have`} no halal information yet, so{' '}
          {noInfo === 1 ? 'it is' : 'they are'} not on YepItsHalal. Ask the branch before you order.
        </p>
      )}

      <p className="mt-8 text-sm leading-relaxed text-muted">
        A chain is only called halal here where every branch we know of carries that label. Unverified never means not
        halal.{' '}
        <Link href="/how-we-check" className={LINK}>
          How we label places
        </Link>
      </p>
    </div>
  );
}
