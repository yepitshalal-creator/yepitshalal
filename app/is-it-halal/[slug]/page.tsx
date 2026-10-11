import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getNearbyWithEvidence, getRestaurantBySlug, mergedTargetSlug } from '@/lib/restaurants';
import { getBranches, MIN_CHAIN_BRANCHES, placeTitle, statusFor, summaryFor } from '@/lib/halalPages';
import { getAreasWithPages } from '@/lib/areas';
import { halalAnswerFor } from '@/lib/halalAnswer';
import { HalalBadge, halalLabel } from '@/components/HalalBadge';
import { HalalEvidencePanel } from '@/components/HalalEvidencePanel';
import { HalalFactsPanel } from '@/components/HalalFactsPanel';
import { RestaurantCard } from '@/components/RestaurantCard';
import { tidyAddress } from '@/lib/address';
import { jsonLdHtml } from '@/lib/jsonLd';
import { SITE_URL } from '@/lib/site';
import { formatUkPhone, splitPhones } from '@/lib/phone';
import type { SearchResultRestaurant } from '@/lib/types';
import { ArrowRightIcon, GlobeIcon, MapPinIcon, NavigationIcon, PhoneIcon, WarningIcon } from '@/components/icons';

// "Is <place> halal?", one page for every place in search, built from the
// database on request so every place added later has one too. See
// lib/halalPages.ts for why these exist.
//
// The page answers the question it is named after, first and in one sentence,
// in exactly the words the restaurant page uses (halalAnswerFor), then shows
// the evidence, then what else a person deciding where to eat needs: the other
// branches of the same chain, and places nearby that have evidence. It never
// says more than the evidence does, whatever the question in its title.

// Read fresh on every visit. The label is the whole point of the page, and a
// kept copy can be served once after it has gone stale, so a label that
// changed could still show the old one. Until 2026-10-02 the header made every
// page dynamic and this was implicit; now it has to be said.
export const dynamic = 'force-dynamic';

const LINK = 'font-semibold text-accent-ink hover:underline';

function verdictWord(status: ReturnType<typeof statusFor>): string {
  if (status === 'unknown') return 'Not checked yet';
  return status ? halalLabel(status) : 'Not known';
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await getRestaurantBySlug(params.slug);
  if (!r || !r.isListed) return { title: 'Not found', robots: { index: false } };
  const title = placeTitle(r);
  const where = r.borough ?? r.postcode ?? 'London';
  const status = statusFor(r);
  const answer = halalAnswerFor({ name: title, status, summary: summaryFor(r.halal_summary, r.evidence), checkedAt: r.halal_checked_at, cuisine: r.cuisines[0] ?? r.cuisineLabel });
  return {
    title: `Is ${title} halal? ${verdictWord(status)}, ${where}`,
    description: answer.sentence.slice(0, 300),
    alternates: { canonical: `/is-it-halal/${r.slug}` },
    // Only places with halal evidence have this page. From 2026-09-24 to
    // 2026-10-11 the ones nobody had checked had one too, in Google; Shabir
    // took them off the site on 2026-10-11, so they are not found now.
    robots: r.isSearchable ? undefined : { index: false, follow: true },
    openGraph: { title: `Is ${title} halal?`, description: answer.sentence.slice(0, 300), url: `/is-it-halal/${r.slug}` },
  };
}

export default async function IsItHalalPage({ params }: { params: { slug: string } }) {
  const r = await getRestaurantBySlug(params.slug);
  if (!r) notFound();
  // A merged duplicate sends an old link to the record that was kept, as the
  // restaurant page does.
  if (r.mergedInto) {
    const kept = await mergedTargetSlug(r.mergedInto);
    if (kept && kept !== r.slug) permanentRedirect(`/is-it-halal/${kept}`);
  }
  if (!r.isListed) notFound();

  const [nearby, branches, areas] = await Promise.all([
    getNearbyWithEvidence(r),
    r.brandId ? getBranches(r.brandId) : Promise.resolve([]),
    getAreasWithPages(),
  ]);

  const title = placeTitle(r);
  const status = statusFor(r);
  const cuisine = r.cuisines.join(' · ') || r.cuisineLabel || null;
  const answer = halalAnswerFor({ name: title, status, summary: summaryFor(r.halal_summary, r.evidence), checkedAt: r.halal_checked_at, cuisine: r.cuisines[0] ?? r.cuisineLabel });
  // The verdict the sentence opens with, set large; a sentence without one keeps
  // its words whole under the plain verdict.
  const opening = answer.sentence.match(/^(Yes\.|Partly\.|We cannot confirm it\.|Worth asking\.)\s*(.*)$/);
  const answerLead = opening ? opening[1] : `${answer.verdict}.`;
  const answerRest = opening ? opening[2] : answer.sentence;
  const brand = r.brandName ? placeTitle({ name: r.brandName, brandName: null, branchLabel: null }) : null;
  const area = r.borough ? areas.find((a) => a.borough === r.borough) ?? null : null;
  const closed = r.catalogueStatus === 'permanently_closed' || r.catalogueStatus === 'temporarily_closed';
  const phones = splitPhones(r.phone);
  const addressKnown = !/street address not known/i.test(r.address);
  // Branches with no halal evidence have no page, so they are not linked.
  const otherBranches = branches.filter((b) => b.id !== r.id && b.status !== 'unknown');
  const chainPage = r.brandSlug && branches.length >= MIN_CHAIN_BRANCHES ? `/is-it-halal/chain/${r.brandSlug}` : null;
  const hasGenuineCheck = r.evidence.some((e) => e.kind === 'yepitshalal_check');

  const pageUrl = `${SITE_URL}/is-it-halal/${r.slug}`;
  const crumbs = [
    { name: 'YepItsHalal', url: `${SITE_URL}/` },
    { name: 'Halal restaurants in London', url: `${SITE_URL}/halal-restaurants` },
    ...(area ? [{ name: `Halal restaurants in ${area.borough}`, url: `${SITE_URL}/halal-restaurants/${area.slug}` }] : []),
    { name: `Is ${title} halal?`, url: pageUrl },
  ];
  // Only where somebody from YepItsHalal checked, and only because the facts
  // panel below shows the same answers.
  const facts = hasGenuineCheck ? r.halalFacts : null;
  const alcohol = facts?.serves_alcohol;
  const pork = facts?.serves_pork;
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: `Is ${title} halal?`, acceptedAnswer: { '@type': 'Answer', text: answer.sentence } },
      ...(facts && (alcohol !== undefined || pork !== undefined)
        ? [
            {
              '@type': 'Question',
              name: `Does ${title} serve alcohol or pork?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: [
                  alcohol === true ? 'Alcohol is served.' : alcohol === false ? 'No alcohol is served.' : 'We have not confirmed whether alcohol is served.',
                  pork === true ? 'Pork is served.' : pork === false ? 'No pork is served.' : 'We have not confirmed whether pork is served.',
                ].join(' '),
              },
            },
          ]
        : []),
      ...(r.evidence.length
        ? [
            {
              '@type': 'Question',
              name: `How do you know whether ${title} is halal?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `From ${r.evidence.length === 1 ? 'one source' : `${r.evidence.length} sources`} listed on this page, each with the date it was checked: ${[...new Set(r.evidence.map((e) => e.source_name))].slice(0, 3).join(', ')}. We never label a place from its name or its cuisine alone.`,
              },
            },
          ]
        : []),
    ],
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <li>
            <Link href="/halal-restaurants" className="hover:text-ink hover:underline">
              Halal restaurants
            </Link>
          </li>
          {area && (
            <>
              <li aria-hidden="true" className="text-subtle">/</li>
              <li>
                <Link href={`/halal-restaurants/${area.slug}`} className="hover:text-ink hover:underline">
                  {area.borough}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true" className="text-subtle">/</li>
          <li aria-current="page" className="min-w-0 truncate text-ink/70">
            {title}
          </li>
        </ol>
      </nav>

      <h1 className="mt-3 text-balance font-display text-[1.9rem] font-semibold leading-tight text-ink sm:text-4xl">
        Is {title} halal?
      </h1>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
        <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
        <span>
          {cuisine && (
            <>
              {cuisine}
              <span className="mx-1.5 text-subtle" aria-hidden="true">·</span>
            </>
          )}
          {tidyAddress(r.address)}
        </span>
      </p>

      {closed && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-halal-partialSoft px-4 py-3 text-sm font-medium text-halal-partialInk ring-1 ring-halal-partial/20">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {r.catalogueStatus === 'permanently_closed' ? 'This restaurant appears to have closed permanently.' : 'This restaurant appears to be temporarily closed.'}
        </p>
      )}

      {/* The short answer, first. It is the text search engines and assistants
          are given in the FAQ markup above, so it has to be on the page too. */}
      <section aria-labelledby="short-answer" className="mt-5 rounded-2xl bg-forest-deep p-5 text-white shadow-sm ground-dark sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="short-answer" className="text-xs font-semibold uppercase tracking-wider text-white/70">
            The short answer
          </h2>
          {status && <HalalBadge classification={status} size="lg" variant="solid" />}
        </div>
        {/* Word for word the sentence in the markup: its first sentence as the
            headline, the rest beneath. */}
        <p className="mt-2 max-w-2xl text-pretty">
          <span className="block font-display text-2xl font-semibold text-white">{answerLead}</span>
          {answerRest && <span className="mt-2 block text-[15px] leading-relaxed text-white/85">{answerRest}</span>}
        </p>
      </section>

      <div className="mt-5">
        <HalalEvidencePanel
          classification={r.halal_classification}
          strength={r.halal_evidence_strength}
          summary={summaryFor(r.halal_summary, r.evidence)}
          evidence={r.evidence}
          isListed={r.isListed}
          isSearchable={r.isSearchable}
          cuisine={r.cuisines[0] ?? r.cuisineLabel}
          slug={r.slug}
          name={title}
          checkedByUs={hasGenuineCheck}
          title={r.isListed ? 'What the evidence says' : 'What we know'}
        />
        {facts && (
          <div className="mt-5">
            <HalalFactsPanel facts={facts} />
          </div>
        )}
      </div>

      <section aria-labelledby="before-you-go" className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 id="before-you-go" className="font-display text-lg font-semibold text-ink">
          Before you go
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          {addressKnown && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Address</dt>
              <dd className="mt-0.5 text-ink/80">{tidyAddress(r.address)}</dd>
            </div>
          )}
          {phones.length > 0 && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Phone, to ask them</dt>
              <dd className="mt-0.5">
                <a href={`tel:${phones[0]}`} className={`inline-flex items-center gap-1.5 ${LINK}`}>
                  <PhoneIcon className="h-4 w-4" />
                  {formatUkPhone(phones[0])}
                </a>
              </dd>
            </div>
          )}
          {r.website_url && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Website</dt>
              <dd className="mt-0.5">
                <a href={r.website_url} target="_blank" rel="noopener noreferrer" className={`inline-flex max-w-full items-start gap-1.5 ${LINK}`}>
                  <GlobeIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{r.website_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-ink active:scale-[0.98]"
          >
            <NavigationIcon className="h-4 w-4" />
            Directions
          </a>
          <Link
            href={`/restaurant/${r.slug}`}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/30 active:scale-[0.98]"
          >
            Hours, photos and the full listing
            <ArrowRightIcon className="h-4 w-4 text-subtle" />
          </Link>
        </div>
      </section>

      {otherBranches.length > 0 && (
        <section aria-labelledby="branches" className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="branches" className="font-display text-lg font-semibold text-ink">
              Other {brand ?? ''} branches in London
            </h2>
            {chainPage && brand && (
              <Link href={chainPage} className={`text-sm ${LINK}`}>
                Is {brand} halal? All {branches.length} branches
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">Each branch is labelled from its own evidence.</p>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {otherBranches.slice(0, 8).map((b) => (
              <li key={b.id}>
                <Link href={`/is-it-halal/${b.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-sand-soft active:bg-sand">
                  <span className="min-w-0">
                    <span className="line-clamp-2 break-words font-medium text-ink">{b.branch_label ?? tidyAddress(b.address)}</span>
                    <span className="block break-words text-xs text-muted">{b.borough}</span>
                  </span>
                  <HalalBadge classification={b.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nearby.length > 0 && (
        <section aria-labelledby="nearby" className="mt-8 space-y-2.5">
          <h2 id="nearby" className="font-display text-lg font-semibold text-ink">
            Nearby, with halal evidence
          </h2>
          {nearby.map((n) => (
            <RestaurantCard key={n.id} restaurant={n as unknown as SearchResultRestaurant} />
          ))}
        </section>
      )}

      <p className="mt-8 text-sm leading-relaxed text-muted">
        YepItsHalal labels a place only from evidence: what it says itself, certification, or our own check, each with
        the date it was read. Unverified never means not halal.{' '}
        <Link href="/how-we-check" className={LINK}>
          How we label places
        </Link>
        {' · '}
        <Link href={`/submit-restaurant?update=${r.slug}`} className={LINK}>
          Know something we don&apos;t? Tell us
        </Link>
      </p>
    </div>
  );
}
