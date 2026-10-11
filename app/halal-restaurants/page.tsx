import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';
import { getAreas, MIN_AREA_LISTINGS } from '@/lib/areas';
import { PageHero, heroSecondary } from '@/components/PageHero';
import { pageShell, inlineLink } from '@/components/prose';
import { Reveal } from '@/components/Reveal';
import { STREET } from '@/lib/media';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const areas = await getAreas();
  const total = areas.reduce((n, a) => n + a.listed, 0);
  return {
    title: 'Halal restaurants in London, by borough',
    description: `${total.toLocaleString('en-GB')} places across London with evidence of halal food, borough by borough. Every label shows what it is based on and when it was checked.`,
    alternates: { canonical: '/halal-restaurants' },
  };
}

export default async function LondonAreasPage() {
  const areas = await getAreas();
  const withPages = areas.filter((a) => a.listed >= MIN_AREA_LISTINGS).sort((a, b) => a.borough.localeCompare(b.borough));
  const thin = areas.filter((a) => a.listed < MIN_AREA_LISTINGS).sort((a, b) => a.borough.localeCompare(b.borough));
  const total = areas.reduce((n, a) => n + a.listed, 0);
  const fully = areas.reduce((n, a) => n + a.fully_halal, 0);
  const options = areas.reduce((n, a) => n + a.halal_options, 0);

  return (
    <>
      <PageHero
        title="Halal restaurants in London"
        lede={
          <>
            {total.toLocaleString('en-GB')} places with evidence of halal food, including{' '}
            {fully.toLocaleString('en-GB')} Fully Halal and {options.toLocaleString('en-GB')} with halal
            food available.
          </>
        }
        art={STREET}
      >
        <Link href="/" className={heroSecondary}>
          Search by postcode
        </Link>
      </PageHero>

      <div className={`${pageShell} pb-4 pt-10 sm:pt-14`}>
        <h2 className="text-sm font-semibold text-ink">Pick a borough</h2>
        {/* One list in columns, rows divided by rules: it is an index, and an
            index reads down, not as a wall of separate cards. */}
        <ul className="mt-3 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {withPages.map((a) => (
            <li key={a.slug} className="border-t border-line">
              <Link
                href={`/halal-restaurants/${a.slug}`}
                className="group -mx-3 flex min-h-[60px] items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white"
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-[16px] font-semibold text-ink">{a.borough}</span>
                  <span className="block text-xs tabular-nums text-muted">
                    {a.listed} places, {a.fully_halal} Fully Halal
                  </span>
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-subtle transition duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>

        {thin.length > 0 && (
          <Reveal as="section" aria-label="Boroughs with few places" className="mt-10 max-w-2xl border-t border-line pt-6">
            <p className="text-sm leading-relaxed text-muted">
              We don&apos;t know of many places yet in {thin.map((a) => a.borough).join(', ')}. They can
              still be searched, and if you know a halal place there,{' '}
              <Link href="/submit-restaurant" className={inlineLink}>
                tell us about it
              </Link>
              .
            </p>
          </Reveal>
        )}
      </div>
    </>
  );
}
