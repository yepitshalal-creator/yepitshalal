import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon, ForkKnifeIcon, MapIcon, MapPinIcon, SealCheckIcon, SearchIcon } from '@/components/icons';
import { PageHero, heroPrimary, heroSecondary } from '@/components/PageHero';
import { PrayerBand } from '@/components/discover/PrayerBand';
import { Reveal } from '@/components/Reveal';
import { linkCard } from '@/components/cta';
import { pageShell } from '@/components/prose';
import { STREET } from '@/lib/media';
import { boroughSlug, getAreasWithPages } from '@/lib/areas';
import { countPrayerSpaces, getPrayerSpaceBoroughs } from '@/lib/prayerSpaces';

// Discover is the wider places hub, and the feed part of it is deliberately
// not live yet. Search, then evidence, then discovery: a feed is only worth
// scrolling once the places in it can be trusted, so the top of this page says
// what is coming without pretending any of it exists.
//
// What already exists lives here too (2026-09-24): somewhere to pray near
// where you eat, moved from the homepage, and the ways to browse the catalogue
// today, by borough and by kind of food.
//
// The same street as the homepage and Add a restaurant, in the same
// treatment: discovering places, adding places and the catalogue growing are
// one story, so they share one picture.
//
// The route, header link and bottom tab stay as they are. When the feed is
// ready it goes under the header. (DiscoverFeed and lib/discover.ts are kept
// for that.)

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Discover',
  description: 'A better way to find halal places across London is on its way. For now: prayer spaces near where you eat, plus every borough and kind of food.',
  // A holding page is not something to send searchers to.
  robots: { index: false, follow: true },
};

const NOW = [
  {
    Icon: MapPinIcon,
    title: 'More of London',
    body: 'Finding halal places borough by borough, including the ones that are hard to find online.',
  },
  {
    Icon: SealCheckIcon,
    title: 'Evidence behind every label',
    body: 'We show where each halal label came from, and when we checked it. And we say so when we are not sure.',
  },
  {
    Icon: SearchIcon,
    title: 'Search you can rely on',
    body: 'Postcodes, streets, areas and restaurant names, with results that match the map.',
  },
];

export default async function DiscoverPage() {
  const [total, prayerBoroughs, areas] = await Promise.all([
    countPrayerSpaces(),
    getPrayerSpaceBoroughs(),
    getAreasWithPages(),
  ]);
  const withPages = new Set(areas.map((a) => a.slug));
  const boroughs = [...prayerBoroughs]
    .sort((a, b) => b.spaces - a.spaces)
    .slice(0, 8)
    .map((b) => {
      const slug = boroughSlug(b.borough);
      return { ...b, href: withPages.has(slug) ? `/halal-restaurants/${slug}` : null };
    });

  return (
    <>
      <PageHero
        label={{ text: 'Coming soon' }}
        title="Something better is coming."
        lede="We're building a better way to discover halal places across London. First we're making sure the places, and the halal information about them, are right."
        art={STREET}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/" className={heroPrimary}>
            Search near you
            <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link href="/submit-restaurant" className={heroSecondary}>
            Tell us about a place
          </Link>
        </div>
      </PageHero>

      {/* Straight under the first banner: what is nearby, and where to pray. */}
      <PrayerBand total={total} boroughs={boroughs} />

      <div className={`${pageShell} grid grid-cols-1 gap-12 pb-4 pt-14 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16`}>
        <Reveal as="section" aria-labelledby="working-on-title">
          <h2 id="working-on-title" className="font-display text-[1.6rem] font-semibold leading-tight text-ink sm:text-[1.85rem]">
            What we&apos;re working on first
          </h2>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {NOW.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-4 py-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-[17px] font-semibold text-ink">{title}</h3>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal as="section" delay={120} aria-labelledby="browse-title">
          <h2 id="browse-title" className="font-display text-[1.6rem] font-semibold leading-tight text-ink sm:text-[1.85rem]">
            Browse what&apos;s here today
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-3">
            <Link href="/halal-restaurants" className={`${linkCard} flex items-center gap-4 p-5`}>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand text-spice-ink ring-1 ring-sand-line">
                <MapIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[17px] font-semibold text-ink">By borough</span>
                <span className="block text-sm text-muted">Every part of London we list, with its labels.</span>
              </span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-subtle transition duration-200 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
            </Link>
            <Link href="/halal-restaurants/cuisine" className={`${linkCard} flex items-center gap-4 p-5`}>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand text-spice-ink ring-1 ring-sand-line">
                <ForkKnifeIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[17px] font-semibold text-ink">By kind of food</span>
                <span className="block text-sm text-muted">Start with what you fancy, then pick a place.</span>
              </span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-subtle transition duration-200 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </>
  );
}
