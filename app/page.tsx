import type { Metadata } from 'next';
import Link from 'next/link';
import { LocationSearchBar } from '@/components/LocationSearchBar';
import { MapPinIcon, SealCheckIcon, ArrowRightIcon, ArrowDownIcon, ForkKnifeIcon, SearchIcon } from '@/components/icons';
import { HomeReelStrip } from '@/components/HomeReelStrip';
import { LabelKey } from '@/components/home/LabelKey';
import { CuisineRail } from '@/components/home/CuisineRail';
import { GrowthLoop } from '@/components/home/GrowthLoop';
import { SupportPrompt } from '@/components/SupportPrompt';
import { SceneMedia } from '@/components/media/SceneMedia';
import { getFeaturedReels } from '@/lib/reels';
import { getAreasWithPages } from '@/lib/areas';
import { getCuisines } from '@/lib/cuisines';
import { getSiteCounts, formatCount } from '@/lib/siteCounts';
import { STREET, TABLE } from '@/lib/media';
import { heroPrimary } from '@/components/PageHero';
import { jsonLdHtml } from '@/lib/jsonLd';
import { SITE_URL } from '@/lib/site';
import { hreflangAlternates } from '@/lib/locales';
import { Reveal } from '@/components/Reveal';
import { forestFade, forestLights } from '@/components/grounds';

// The English homepage is the x-default and the canonical target every
// translated landing page points back to. See lib/locales.
export const metadata: Metadata = {
  alternates: { canonical: '/', languages: hreflangAlternates(SITE_URL) },
};

// Kept and served by Vercel, rebuilt in the background at most every five
// minutes. It was rebuilt in full on every visit, with three database reads
// in front of the first byte, and the first screen came last. Five minutes
// rather than the listing pages' hour because the reel strip shows labels;
// tapping one opens the restaurant page, which is always read fresh.
export const revalidate = 300;

// Hand-picked London neighbourhoods with dense halal high streets. Linking
// straight to coordinates removes the "what do I even type?" beat for a first
// visit, the hardest moment in a location-first product.
const POPULAR_AREAS = [
  { label: 'Whitechapel', lat: 51.5195, lng: -0.0596 },
  { label: 'Edgware Road', lat: 51.5203, lng: -0.167 },
  { label: 'Green Street', lat: 51.5385, lng: 0.027 },
  { label: 'Shoreditch', lat: 51.5265, lng: -0.0784 },
  { label: 'Tooting', lat: 51.4275, lng: -0.168 },
  { label: 'Wembley', lat: 51.5528, lng: -0.2963 },
];

// Find, understand, go: the whole product in three verbs, said once, right
// before the one thing we ask a reader to do.
const STEPS = [
  { Icon: SearchIcon, verb: 'Find', body: 'Search a postcode, a street or an area, or use where you are. Anywhere in London.' },
  { Icon: SealCheckIcon, verb: 'Understand', body: 'Every place shows its label, what that rests on, and when it was checked.' },
  { Icon: ForkKnifeIcon, verb: 'Go', body: 'Opening hours, the menu and directions, on one page.' },
];

// What the site is and how to search it, for the engines and assistants that
// build an entity out of a domain before they decide what any page means.
const SITE_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'YepItsHalal',
      description:
        'Halal restaurants in London, each with the evidence behind its label and the date it was checked.',
      inLanguage: 'en-GB',
      publisher: { '@id': `${SITE_URL}/#org` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?label={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: 'YepItsHalal',
      url: SITE_URL,
      logo: `${SITE_URL}/icon`,
      areaServed: { '@type': 'City', name: 'London' },
    },
  ],
};

// The order of the page, 2026-09-24:
//
//   what this is        the first screen: the promise, the search, London only
//   what a label means  the key, with the two "not confirmed" labels set apart
//   what to eat         kinds of food, straight after the key
//   what to do          find, understand, go, and the search itself
//   how it grows        ask for your area, add a place, list a restaurant
//   how to help         one question, and the way to the answer
//
// Prayer spaces moved to Discover, where "what is nearby" belongs, and the
// P.S. support block became the one short prompt at the end.
export default async function HomePage() {
  const [featuredReels, areas, cuisines, counts] = await Promise.all([
    getFeaturedReels(),
    getAreasWithPages(),
    getCuisines(),
    getSiteCounts(),
  ]);
  // The borough pages are the indexable half of this site. Every prominent link
  // on this page went to /search, which is noindexed and disallowed in
  // robots.txt, so a crawler arriving here had nowhere to go but the footer.
  const biggestAreas = [...areas].sort((a, b) => b.listed - a.listed).slice(0, 8);
  // Most people do not decide by postcode, they decide by what they fancy, so
  // the kind of food is an entry point rather than a filter buried in a box.
  const topCuisines = cuisines.slice(0, 10);

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(SITE_LD) }} />

      {/* ATTENTION. The first screen is unchanged in what it says: the promise,
          the search, the popular areas, and on its bottom edge that this is a
          London-only beta. What changed is the street. It is no longer a
          framed video beside the words; it is the ground itself. On a phone
          it fills the top of the screen in its tall composition and fades
          down into the forest, where the headline picks up. From 1024px it
          fills the right of the screen to the window's edge and fades toward
          the words. */}
      <section className="ground-dark grain relative overflow-hidden bg-forest-deep">
        <div aria-hidden="true" className={`absolute inset-0 ${forestLights}`} />
        <SceneMedia
          art={STREET}
          eager
          className="absolute inset-x-0 top-0 h-[58%] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[60%]"
          fade={{ bottom: '78%' }}
          fadeLg={{ left: '64%', bottom: '36%' }}
          position="50% 40%"
          positionLg="60% 50%"
          sizes="(min-width: 1024px) 72vw, 180vw"
          control="top-right"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-forest-deep/5 via-forest-deep/20 to-forest-deep/60 lg:bg-gradient-to-r lg:from-forest-deep/45 lg:via-forest-deep/5 lg:to-transparent"
          />
        </SceneMedia>
        {/* The fade into the pale page below. 40px, and the London line's bottom
            padding keeps every element clear of it (ca6bf7c). */}
        <div aria-hidden="true" className={forestFade} />

        {/* Exactly one screen tall (.hero-screen in globals.css), so the
            London line below sits on the bottom edge of the first view. */}
        <div className="hero-screen relative mx-auto flex max-w-6xl flex-col px-5 sm:px-6">
          <div className="flex flex-1 flex-col justify-end pb-7 pt-10 sm:pb-10 lg:justify-center lg:pb-14 lg:pt-12">
            <div className="text-center lg:max-w-[33rem] lg:text-left xl:max-w-[36rem]">
              {/* The whole pitch, and big enough to be the only thing read.
                  Two lines, on every width, because the break is a decision
                  and not something to leave to the container. The size is
                  the largest that keeps "wherever you are." on one line at
                  375px. */}
              <h1 className="font-display text-[2rem] font-semibold leading-[1.06] tracking-[-0.02em] text-white [text-shadow:0_2px_28px_rgba(4,24,30,0.55)] min-[360px]:text-[2.2rem] min-[390px]:text-[2.35rem] sm:text-[3.1rem] lg:text-[3.6rem] xl:text-[4rem]">
                <span className="block">Find halal food,</span>
                <span className="block">wherever you are.</span>
              </h1>

              <div id="search" className="mt-5 flex scroll-mt-24 justify-center sm:mt-8 lg:justify-start">
                <LocationSearchBar />
              </div>

              {/* How big the search is, from the database (lib/siteCounts.ts).
                  Every place on the site has halal evidence, so one number. */}
              {counts && (
                <p className="mt-2 text-sm font-medium text-white/90 [text-shadow:0_1px_12px_rgba(4,24,30,0.7)]">
                  {formatCount(counts.listed)} places in London{' '}
                  <span className="max-[359px]:block">with signs of halal food.</span>
                </p>
              )}

              <div className="mt-4 sm:mt-7">
                <h2 className="text-xs font-semibold text-white/70">Popular areas</h2>
                {/* Wrapped, never a sideways row: on a phone the row hid
                    Tooting and Wembley past the edge (Shabir, 2026-10-11:
                    "the top part popular areas buttons is cut off"). */}
                <ul className="mt-2.5 flex flex-wrap justify-center gap-2 lg:justify-start">
                  {POPULAR_AREAS.map((area) => (
                    <li key={area.label}>
                      <Link
                        href={`/search?lat=${area.lat}&lng=${area.lng}&mode=searched_location&label=${encodeURIComponent(area.label)}`}
                        className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full bg-forest-deep/35 px-3.5 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-sm transition duration-200 ease-out hover:bg-white/20 active:scale-[0.97] max-[359px]:px-3 max-[359px]:text-[13px]"
                      >
                        {area.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* The bottom edge of the first screen. Two facts, not one hedge:
              saying it is a beta, that it is London only for now, and asking
              where to go next makes the limitation read as a plan. The form
              itself stays out of this view, further down (#next-cities). */}
          <div className="relative border-t border-white/12 pb-12 pt-3">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-white lg:justify-between">
              <p className="inline-flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-forest-deep">
                  Beta
                </span>
                <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
                  <MapPinIcon className="h-4 w-4 text-accent-onDark" aria-hidden="true" />
                  London only, for now.
                </span>
              </p>
              <a
                href="#next-cities"
                className="group inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-white/85 underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white"
              >
                Tell us where you&apos;re looking
                <ArrowDownIcon className="h-4 w-4 transition duration-200 group-hover:translate-y-0.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* INTEREST. The one idea the rest of the site leans on: a label is an
          answer to "who says so, and when", and two of the four are not a
          no. */}
      <LabelKey />

      {/* DESIRE. Understand, then discover: the food, straight after the key. */}
      <CuisineRail cuisines={topCuisines} />

      {/* Proof from the kitchens, when there is any. Renders nothing until a
          reel is published. */}
      <HomeReelStrip reels={featuredReels} />

      {/* ACTION. Find, understand, go, then the search itself. The headline
          echoes the hero's, closing the loop it opened. On the forest, so the
          page's one real ask reads as an action point rather than as another
          block of copy.

          Behind it, the shared table: hands reaching across one meal, the
          moment the question is for (Shabir, 2026-09-24: use the shared meal).
          On a phone it is a band across the top that the heading rises into;
          from 1024px it fills the right of the section and the words keep the
          left, so no line of text ever sits on the picture. */}
      <section aria-labelledby="eat-title" className="ground-dark grain relative overflow-hidden bg-forest-deep text-white">
        <div aria-hidden="true" className={`absolute inset-0 ${forestLights}`} />
        <SceneMedia
          art={TABLE}
          className="absolute inset-x-0 top-0 h-[min(66vw,400px)] sm:h-[min(50vw,440px)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[58%]"
          fade={{ bottom: '64%' }}
          fadeLg={{ left: '56%', top: '12%', bottom: '18%' }}
          sizes="(min-width: 1024px) 60vw, 100vw"
          position="50% 55%"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-forest-deep/5 via-forest-deep/20 to-forest-deep/70 lg:bg-gradient-to-r lg:from-forest-deep/55 lg:via-forest-deep/10 lg:to-transparent"
          />
        </SceneMedia>
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-[min(52vw,300px)] sm:px-6 sm:pb-20 sm:pt-[min(40vw,340px)] lg:py-24">
          <div className="lg:max-w-[46%]">
          <Reveal>
            <h2 id="eat-title" className="text-balance font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.015em] sm:text-[2.8rem]">
              So, where are you eating?
            </h2>
          </Reveal>

          <ol className="mt-8 grid grid-cols-1 gap-6 sm:mt-10 sm:grid-cols-3 sm:gap-8 lg:grid-cols-1 lg:gap-6">
            {STEPS.map(({ Icon, verb, body }, i) => (
              <Reveal as="li" key={verb} delay={i === 0 ? 0 : i === 1 ? 60 : 120} className="flex gap-4 sm:block lg:flex">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent-onDark ring-1 ring-white/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="block sm:mt-4 lg:mt-0">
                  <span className="block font-display text-xl font-semibold">{verb}</span>
                  <span className="mt-1 block max-w-xs text-[15px] leading-relaxed text-white/75">{body}</span>
                </span>
              </Reveal>
            ))}
          </ol>

          <Reveal className="mt-10 flex flex-col gap-6 border-t border-white/12 pt-8">
            <a href="#search" className={`${heroPrimary} self-start`}>
              Search your area
              <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            {biggestAreas.length > 0 && (
              <nav aria-label="Start with a borough">
                <p className="text-xs font-semibold text-white/65">Or start with a borough</p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {biggestAreas.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/halal-restaurants/${a.slug}`}
                        className="inline-flex min-h-[40px] items-center rounded-full bg-white/10 px-3.5 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/20"
                      >
                        {a.borough}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href="/halal-restaurants"
                      className="group inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent-onDark underline decoration-accent-onDark/40 underline-offset-4 transition hover:decoration-accent-onDark"
                    >
                      All of London
                      <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </li>
                </ul>
              </nav>
            )}
          </Reveal>
          </div>
        </div>
      </section>

      {/* HOW IT GROWS. Ask for your area; add a place; list a restaurant. */}
      <GrowthLoop />

      {/* HOW TO HELP. One question, one button, the answer on /yep-plus. */}
      <SupportPrompt />
    </div>
  );
}
