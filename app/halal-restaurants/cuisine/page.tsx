import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';
import { getCuisines } from '@/lib/cuisines';
import { jsonLdHtml } from '@/lib/jsonLd';
import { SITE_URL } from '@/lib/site';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { inlineLink, pageShell } from '@/components/prose';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Halal food in London, by kind of food',
  description:
    'Halal kebab, biryani, fried chicken, burgers and more across London. Every label shows where it came from, and the date we checked.',
  alternates: { canonical: '/halal-restaurants/cuisine' },
};

export default async function CuisineIndexPage() {
  const cuisines = await getCuisines();
  const total = cuisines.reduce((n, c) => n + c.listed, 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Halal restaurants in London', item: `${SITE_URL}/halal-restaurants` },
      { '@type': 'ListItem', position: 2, name: 'By kind of food', item: `${SITE_URL}/halal-restaurants/cuisine` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <PageHero
        crumbs={[{ label: 'London', href: '/halal-restaurants' }, { label: 'By kind of food' }]}
        title="Halal food in London, by what you fancy"
        lede={
          <>
            Most people do not decide by postcode. {total.toLocaleString('en-GB')} places with evidence of
            halal food, sorted by what they actually serve.
          </>
        }
      />

      <div className={`${pageShell} pb-4 pt-10 sm:pt-14`}>
        {/* The same index shape as the borough list: rules, not cards. */}
        <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {cuisines.map((c) => (
            <li key={c.slug} className="border-t border-line">
              <Link
                href={`/halal-restaurants/cuisine/${c.slug}`}
                className="group -mx-3 flex min-h-[60px] items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[16px] font-semibold text-ink">Halal {c.cuisine}</span>
                  <span className="mt-0.5 block text-[13px] tabular-nums text-muted">
                    {c.listed} with evidence
                    {c.fully_halal > 0 && <>, {c.fully_halal} Fully Halal</>}
                  </span>
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-subtle transition duration-200 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <Reveal as="section" aria-label="Browse by borough" className="mt-10 border-t border-line pt-6">
          <p className="text-sm leading-relaxed text-muted">
            Looking for somewhere specific instead?{' '}
            <Link href="/halal-restaurants" className={inlineLink}>
              Browse by borough
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </>
  );
}
