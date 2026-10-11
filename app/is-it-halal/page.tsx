import type { Metadata } from 'next';
import Link from 'next/link';
import { getChainIndex } from '@/lib/halalPages';
import { getAreasWithPages } from '@/lib/areas';
import { halalLabel } from '@/components/HalalBadge';
import { jsonLdHtml } from '@/lib/jsonLd';
import { SITE_URL } from '@/lib/site';
import type { HalalStatus } from '@/lib/types';

// The way in to the "Is it halal?" pages: every chain A to Z, and the borough
// pages for everywhere else. Search engines find the single pages from the
// sitemap; this is for people, and for the links that tell a crawler which
// pages matter.

// Read fresh on every visit: each chain is listed with its answer, built from
// its branches' labels, and a kept copy could show one that has changed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Is it halal? London restaurant chains, A to Z',
  description:
    'Is Chicken Cottage halal? Is Morley’s? Every London chain on YepItsHalal, with what is actually known about each branch and the evidence behind it.',
  alternates: { canonical: '/is-it-halal' },
};

const ORDER: HalalStatus[] = ['fully_halal', 'halal_options', 'unverified', 'unknown'];

export default async function IsItHalalIndex() {
  const [chains, areas] = await Promise.all([getChainIndex(), getAreasWithPages()]);
  const letters = new Map<string, typeof chains>();
  for (const c of chains) {
    const letter = /^[a-z]/i.test(c.name) ? c.name[0].toUpperCase() : '#';
    letters.set(letter, [...(letters.get(letter) ?? []), c]);
  }

  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Is it halal? London restaurant chains',
    itemListElement: chains.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: `Is ${c.name} halal?`, url: `${SITE_URL}/is-it-halal/chain/${c.slug}` })),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(listLd) }} />

      <h1 className="text-balance font-display text-[1.9rem] font-semibold leading-tight text-ink sm:text-4xl">Is it halal?</h1>
      <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-ink/80">
        Every place in our search has a page answering that question from the evidence, with the date it was read.
        Chains are below, branch by branch. For anywhere else,{' '}
        <Link href="/" className="font-semibold text-accent-ink hover:underline">
          search near a postcode or an area
        </Link>{' '}
        or browse by borough.
      </p>

      <nav aria-label="Chains by letter" className="mt-6 flex flex-wrap gap-1.5">
        {[...letters.keys()].map((l) => (
          <a key={l} href={`#letter-${l}`} className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-full border border-line bg-white px-2 text-sm font-semibold text-ink transition hover:border-ink/30">
            {l}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-8">
        {[...letters.entries()].map(([letter, list]) => (
          <section key={letter} aria-labelledby={`letter-${letter}`}>
            <h2 id={`letter-${letter}`} className="scroll-mt-20 font-display text-xl font-semibold text-ink">
              {letter}
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/is-it-halal/chain/${c.slug}`}
                    className="flex h-full flex-col rounded-xl border border-line bg-white px-4 py-3 transition hover:border-ink/25 hover:shadow-sm"
                  >
                    <span className="font-semibold text-ink">Is {c.name} halal?</span>
                    <span className="mt-0.5 text-xs text-muted">
                      {c.branches} branches:{' '}
                      {ORDER.filter((s) => c.counts[s])
                        .map((s) => `${c.counts[s]} ${halalLabel(s)}`)
                        .join(', ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {areas.length > 0 && (
        <section aria-labelledby="by-borough" className="mt-10">
          <h2 id="by-borough" className="font-display text-xl font-semibold text-ink">
            Everywhere else, by borough
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/halal-restaurants/${a.slug}`}
                  className="inline-flex min-h-[40px] items-center rounded-full border border-line bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                >
                  {a.borough}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
