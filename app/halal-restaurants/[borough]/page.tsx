import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HalalBadge } from '@/components/HalalBadge';
import { ArrowRightIcon, MapPinIcon } from '@/components/icons';
import { PageHero, heroPrimary } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { inlineLink, pageShell, panel, sectionTitle } from '@/components/prose';
import { getAreaBySlug, getAreasWithPages, type AreaListing } from '@/lib/areas';
import { cleanRestaurantName } from '@/lib/restaurantName';
import { tidyAddress } from '@/lib/address';
import { jsonLdHtml } from '@/lib/jsonLd';
import { SITE_URL } from '@/lib/site';
import type { HalalClassification } from '@/lib/types';

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getAreasWithPages()).map((a) => ({ borough: a.slug }));
}

export async function generateMetadata({ params }: { params: { borough: string } }): Promise<Metadata> {
  const found = await getAreaBySlug(params.borough);
  if (!found) return { title: 'Area not found', robots: { index: false } };
  const { area } = found;
  return {
    title: `Halal restaurants in ${area.borough}`,
    description: `${area.listed} places in ${area.borough} with evidence of halal food: ${area.fully_halal} Fully Halal, ${area.halal_options} with Halal food available and ${area.unverified} Unverified. See where each label comes from.`,
    alternates: { canonical: `/halal-restaurants/${area.slug}` },
  };
}

const GROUPS: { classification: HalalClassification; heading: string; blurb: string }[] = [
  {
    classification: 'fully_halal',
    heading: 'Fully Halal',
    blurb: 'Strong evidence that all the meat is halal, and no sign of alcohol.',
  },
  {
    classification: 'halal_options',
    heading: 'Halal food available',
    blurb: 'Halal food is available, but not everything is halal, or alcohol is served. Check before you order.',
  },
  {
    classification: 'unverified',
    heading: 'Unverified',
    blurb: "There are signs it's halal, but we haven't checked. Ask before you order. It never means not halal.",
  },
];

function title(r: AreaListing) {
  const base = cleanRestaurantName(r.brand_name ?? r.name);
  return r.branch_label ? `${base}, ${r.branch_label}` : base;
}

function shortAddress(r: AreaListing) {
  const first = tidyAddress(r.address).split(',')[0]?.trim();
  if (!first || /street address not known/i.test(r.address)) return r.postcode ?? null;
  return r.postcode && !first.includes(r.postcode) ? `${first}, ${r.postcode}` : first;
}

export default async function AreaPage({ params }: { params: { borough: string } }) {
  const found = await getAreaBySlug(params.borough);
  if (!found) notFound();
  const { area, listings } = found;

  const searchHref = `/search?lat=${area.anchor_lat.toFixed(5)}&lng=${area.anchor_lng.toFixed(5)}&mode=searched_location&label=${encodeURIComponent(area.borough)}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Halal restaurants in London', item: `${SITE_URL}/halal-restaurants` },
        { '@type': 'ListItem', position: 2, name: area.borough, item: `${SITE_URL}/halal-restaurants/${area.slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Halal restaurants in ${area.borough}`,
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
        crumbs={[{ label: 'London', href: '/halal-restaurants' }, { label: area.borough }]}
        title={`Halal restaurants in ${area.borough}`}
        lede={
          <>
            {area.listed} places in {area.borough} with evidence that they serve halal food. Each one
            shows its label, what the label is based on, and when it was checked.
          </>
        }
      >
        {/* The three counts, read as one line of facts rather than three cards. */}
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {GROUPS.map((g) => (
            <div key={g.classification}>
              <dt className="text-xs font-medium text-white/65">{g.heading}</dt>
              <dd className="font-display text-[1.75rem] font-semibold leading-tight tabular-nums text-white">
                {area[g.classification]}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={searchHref} className={heroPrimary}>
            <MapPinIcon className="h-4 w-4" />
            See them on the map
          </Link>
          <Link
            href="/how-we-check"
            className="inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-white underline decoration-white/35 underline-offset-4 transition hover:decoration-white"
          >
            How we label places
          </Link>
        </div>
      </PageHero>

      <div className={`${pageShell} pb-4 pt-6 sm:pt-8`}>
      <div className="max-w-3xl">
      {GROUPS.map((g) => {
        const rows = listings.filter((r) => r.halal_classification === g.classification);
        if (!rows.length) return null;
        return (
          <Reveal as="section" key={g.classification} aria-labelledby={`group-${g.classification}`} className="mt-10">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`group-${g.classification}`} className={sectionTitle}>
                {g.heading} <span className="text-base font-medium text-subtle">({rows.length})</span>
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">{g.blurb}</p>
            <ul className={`mt-4 divide-y divide-line overflow-hidden ${panel}`}>
              {rows.map((r) => {
                const where = shortAddress(r);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/restaurant/${r.slug}`}
                      className="group flex items-center gap-3 px-4 py-3 transition hover:bg-black/[0.02] active:bg-black/[0.05]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 break-words font-display text-[15px] font-semibold leading-snug text-ink">{title(r)}</p>
                        <p className="line-clamp-2 break-words text-[13px] text-muted">
                          {[where, r.cuisine_label].filter(Boolean).join(' · ')}
                        </p>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                          <span className="shrink-0">
                            <HalalBadge classification={r.halal_classification} size="sm" />
                          </span>
                          {r.halal_summary && <span className="min-w-0 break-words text-xs text-muted">{r.halal_summary}</span>}
                        </div>
                      </div>
                      <ArrowRightIcon className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        );
      })}

      <p className="mt-12 border-t border-line pt-6 text-sm leading-relaxed text-muted">
        Missing a place, or think a label is wrong?{' '}
        <Link href="/corrections" className={inlineLink}>
          Tell us
        </Link>
        . Locations come from the Food Standards Agency food hygiene register, OpenStreetMap
        contributors and the Overture Maps Foundation.
      </p>
      </div>
      </div>
    </>
  );
}
