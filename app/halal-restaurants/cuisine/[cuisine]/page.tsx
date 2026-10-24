import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HalalBadge } from '@/components/HalalBadge';
import { ArrowRightIcon } from '@/components/icons';
import { getCuisineBySlug, getCuisines, type CuisineListing } from '@/lib/cuisines';
import { getAreasWithPages, boroughSlug } from '@/lib/areas';
import { cleanRestaurantName } from '@/lib/restaurantName';
import { tidyAddress } from '@/lib/address';
import { jsonLdHtml } from '@/lib/jsonLd';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { inlineLink, pageShell, panel, sectionTitle } from '@/components/prose';
import { SITE_URL } from '@/lib/site';
import type { HalalClassification } from '@/lib/types';

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getCuisines()).map((c) => ({ cuisine: c.slug }));
}

export async function generateMetadata({ params }: { params: { cuisine: string } }): Promise<Metadata> {
  const found = await getCuisineBySlug(params.cuisine);
  if (!found) return { title: 'Not found', robots: { index: false } };
  const { cuisine } = found;
  // Kept exactly as stored: most of these are proper adjectives, and "halal
  // indian" in a page title reads like a mistake.
  const name = cuisine.cuisine;
  return {
    title: `Halal ${name} in London`,
    description: `${cuisine.listed} halal ${name} places across London with evidence behind the label: ${cuisine.fully_halal} Fully Halal and ${cuisine.halal_options} with halal food available. See what each label is based on and when it was checked.`,
    alternates: { canonical: `/halal-restaurants/cuisine/${cuisine.slug}` },
  };
}

const GROUPS: { classification: HalalClassification; heading: string; blurb: string }[] = [
  { classification: 'fully_halal', heading: 'Fully Halal', blurb: 'Strong evidence that all the meat is halal, and no sign of alcohol.' },
  { classification: 'halal_options', heading: 'Halal food available', blurb: 'Halal food is available, but not everything is halal, or alcohol is served. Check before you order.' },
  {
    classification: 'unverified',
    heading: 'Unverified',
    blurb: "There are signs it's halal, but we haven't checked. Ask before you order. It never means not halal.",
  },
];

function title(r: CuisineListing) {
  const base = cleanRestaurantName(r.brand_name ?? r.name);
  return r.branch_label ? `${base}, ${r.branch_label}` : base;
}

function shortAddress(r: CuisineListing) {
  const first = tidyAddress(r.address).split(',')[0]?.trim();
  if (!first || /street address not known/i.test(r.address)) return r.postcode ?? null;
  return r.postcode && !first.includes(r.postcode) ? `${first}, ${r.postcode}` : first;
}

export default async function CuisinePage({ params }: { params: { cuisine: string } }) {
  const found = await getCuisineBySlug(params.cuisine);
  if (!found) notFound();
  const { cuisine, listings } = found;
  // Kept exactly as stored: most of these are proper adjectives, and "halal
  // indian" in a page title reads like a mistake.
  const name = cuisine.cuisine;

  // The other axis: the same food, narrowed to where somebody actually is.
  // A directory page is only useful if it hands you the next, smaller question.
  const areas = await getAreasWithPages();
  const boroughCounts = new Map<string, number>();
  for (const r of listings) {
    if (r.borough) boroughCounts.set(r.borough, (boroughCounts.get(r.borough) ?? 0) + 1);
  }
  const topBoroughs = [...boroughCounts.entries()]
    .filter(([b]) => areas.some((a) => a.borough === b))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Halal restaurants in London', item: `${SITE_URL}/halal-restaurants` },
        { '@type': 'ListItem', position: 2, name: 'By kind of food', item: `${SITE_URL}/halal-restaurants/cuisine` },
        {
          '@type': 'ListItem',
          position: 3,
          name: `Halal ${name}`,
          item: `${SITE_URL}/halal-restaurants/cuisine/${cuisine.slug}`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Halal ${name} in London`,
      numberOfItems: listings.length,
      itemListElement: listings.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/restaurant/${r.slug}`,
        name: title(r),
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <PageHero
        crumbs={[
          { label: 'London', href: '/halal-restaurants' },
          { label: 'By kind of food', href: '/halal-restaurants/cuisine' },
          { label: cuisine.cuisine },
        ]}
        title={`Halal ${name} in London`}
        lede={
          <>
            {cuisine.listed} {name} places across London with evidence that they serve halal food. Each
            one shows its label, what the label is based on, and when it was checked.
          </>
        }
      >
        {/* The three counts, read as one line of facts rather than three cards. */}
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {GROUPS.map((g) => (
            <div key={g.classification}>
              <dt className="text-xs font-medium text-white/65">{g.heading}</dt>
              <dd className="font-display text-[1.75rem] font-semibold leading-tight tabular-nums text-white">
                {cuisine[g.classification]}
              </dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <div className={`${pageShell} pb-4 pt-8 sm:pt-10`}>
      <div className="max-w-3xl">
      {topBoroughs.length > 0 && (
        <nav aria-label="By area">
          <h2 className="text-sm font-semibold text-ink">Where they are</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {topBoroughs.map(([borough, n]) => (
              <li key={borough}>
                <Link
                  href={`/halal-restaurants/${boroughSlug(borough)}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[14px] font-medium text-ink/85 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent-soft hover:text-ink hover:shadow-sm"
                >
                  {borough}
                  <span className="text-subtle">{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {GROUPS.map((g) => {
        const rows = listings.filter((r) => r.halal_classification === g.classification && r.halal_evidence_strength);
        if (!rows.length) return null;
        return (
          <Reveal as="section" key={g.classification} aria-labelledby={`group-${g.classification}`} className="mt-10">
            <h2 id={`group-${g.classification}`} className={sectionTitle}>
              {g.heading} <span className="text-base font-medium text-subtle">({rows.length})</span>
            </h2>
            <p className="mt-1 text-sm text-muted">{g.blurb}</p>
            <ul className={`mt-4 divide-y divide-line overflow-hidden ${panel}`}>
              {rows.map((r) => {
                const where = [shortAddress(r), r.borough].filter(Boolean).join(' · ');
                return (
                  <li key={r.id}>
                    <Link
                      href={`/restaurant/${r.slug}`}
                      className="group flex items-center gap-3 px-4 py-3 transition hover:bg-black/[0.02] active:bg-black/[0.05]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 break-words font-display text-[15px] font-semibold leading-snug text-ink">{title(r)}</p>
                        <p className="line-clamp-2 break-words text-[13px] text-muted">{where}</p>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                          <span className="shrink-0">
                            <HalalBadge classification={r.halal_classification} size="sm" />
                          </span>
                          {r.halal_summary && <span className="min-w-0 break-words text-xs text-muted">{r.halal_summary}</span>}
                        </div>
                      </div>
                      <ArrowRightIcon className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        );
      })}

      <p className="mt-12 border-t border-line pt-6 text-sm leading-relaxed text-muted">
        Know a halal {name} place we&apos;re missing?{' '}
        <Link href="/submit-restaurant" className={inlineLink}>
          Add it
        </Link>
        , or see{' '}
        <Link href="/how-we-check" className={inlineLink}>
          how we label places
        </Link>
        .
      </p>
      </div>
      </div>
    </>
  );
}
