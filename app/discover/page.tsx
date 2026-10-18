import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon, ForkKnifeIcon, HeartIcon, MapIcon, SealCheckIcon } from '@/components/icons';
import { PageHero, heroPrimary, heroSecondary } from '@/components/PageHero';
import { PrayerBand } from '@/components/discover/PrayerBand';
import { FullyHalalNearButton } from '@/components/FullyHalalNearButton';
import { Reveal } from '@/components/Reveal';
import { linkCard } from '@/components/cta';
import { pageShell, sectionTitle } from '@/components/prose';
import { STREET } from '@/lib/media';
import { boroughSlug, getAreasWithPages } from '@/lib/areas';
import { countPrayerSpaces, getPrayerSpaceBoroughs } from '@/lib/prayerSpaces';

// Browse, the phone's second tab. Until the 2026-10-12 plan (Step 3) this was
// Discover, a "Coming soon" page for a video feed with no videos in it. Now it
// is ready made ways in, built only from what the site already holds: Fully
// Halal near you, every borough, every kind of food, every chain, and
// somewhere to pray. No list here makes a claim the place pages do not.
//
// The route stays /discover, so old links, the header and the app keep
// working. The feed (DiscoverFeed and lib/discover.ts) is kept for the day
// owners have videos to fill it.

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Browse halal places in London',
  description:
    'Fully Halal places near you, every London borough, every kind of food, every chain branch by branch, and somewhere to pray nearby.',
  alternates: { canonical: '/discover' },
};

const LISTS = [
  {
    href: '/halal-restaurants',
    Icon: MapIcon,
    title: 'By borough',
    body: 'Every part of London we list, with its labels.',
  },
  {
    href: '/halal-restaurants/cuisine',
    Icon: ForkKnifeIcon,
    title: 'By kind of food',
    body: 'Start with what you fancy, then pick a place.',
  },
  {
    href: '/is-it-halal',
    Icon: SealCheckIcon,
    title: 'Chains A to Z',
    body: 'Is it halal? Each chain, branch by branch.',
  },
  {
    href: '/saved',
    Icon: HeartIcon,
    title: 'Your saved places',
    body: 'The places you saved, kept on this phone.',
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
        title="Browse halal places in London"
        lede="Pick a way in. Every place shows the proof behind its label."
        art={STREET}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <FullyHalalNearButton className={`${heroPrimary} disabled:opacity-70`} />
          <Link href="/" className={heroSecondary}>
            Search a postcode or area
          </Link>
        </div>
      </PageHero>

      <div className={`${pageShell} pb-14 pt-12 sm:pt-14`}>
        <Reveal as="section" aria-labelledby="lists-title">
          <h2 id="lists-title" className={sectionTitle}>
            Start with a list
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LISTS.map(({ href, Icon, title, body }) => (
              <Link key={href} href={href} className={`${linkCard} flex items-center gap-4 p-5`}>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand text-spice-ink ring-1 ring-sand-line">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[17px] font-semibold text-ink">{title}</span>
                  <span className="block text-sm text-muted">{body}</span>
                </span>
                <ArrowRightIcon
                  className="h-4 w-4 shrink-0 text-subtle transition duration-200 group-hover:translate-x-0.5 group-hover:text-ink"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Where to eat, then where to pray nearby. */}
      <PrayerBand total={total} boroughs={boroughs} />
    </>
  );
}
