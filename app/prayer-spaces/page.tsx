import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRightIcon, ClockIcon, MapPinIcon, NavigationIcon, PhoneIcon } from '@/components/icons';
import { NearestMosqueButton } from '@/components/NearestMosqueButton';
import { boroughSlug, getAreasWithPages } from '@/lib/areas';
import { formatUkPhone, splitPhones } from '@/lib/phone';
import {
  countPrayerSpaces,
  countPrayerSpacesWithHours,
  formatMetres,
  formatOsmHours,
  getNearestPrayerSpaces,
  getPrayerSpaceBoroughs,
  walkingMinutes,
} from '@/lib/prayerSpaces';
import { jsonLdHtml } from '@/lib/jsonLd';
import { SITE_URL } from '@/lib/site';
import { PageHero } from '@/components/PageHero';
import { PageBody, PageSection } from '@/components/PageLayout';
import { Reveal } from '@/components/Reveal';
import { inlineLink, noteWarm, panel } from '@/components/prose';
import { PRAYER_ROOM } from '@/lib/media';
import { FocusOnArrive } from '@/components/FocusOnArrive';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Mosques and prayer spaces in London',
  description:
    'Mosques across London, from OpenStreetMap. Each one shows how far it is to walk, and any hours people have recorded. Separate from the halal listings: a place to pray, not a claim about food.',
  alternates: { canonical: '/prayer-spaces' },
};

// A separate function from the restaurant search, deliberately. Somewhere to
// pray is a different question from what is safe to eat, and mixing them would
// let one imply the other. The only crossing point is a restaurant page saying
// how far the nearest one is to walk.
//
// It takes a location the same way the restaurant search does: from a link you
// arrived on, or from a borough you pick here.

interface Props {
  searchParams: { lat?: string; lng?: string; label?: string };
}

export default async function PrayerSpacesPage({ searchParams }: Props) {
  const lat = Number(searchParams.lat);
  const lng = Number(searchParams.lng);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const label = searchParams.label?.slice(0, 80);

  const [total, withHours, boroughs, nearby, areas] = await Promise.all([
    countPrayerSpaces(),
    countPrayerSpacesWithHours(),
    getPrayerSpaceBoroughs(),
    hasPoint ? getNearestPrayerSpaces(lat, lng, 20, 8000) : Promise.resolve([]),
    getAreasWithPages(),
  ]);
  // A borough with prayer spaces but too few listed restaurants has no page to
  // link to (Bexley, 2026-09-24). It is still shown, just not as a link.
  const withPages = new Set(areas.map((a) => a.slug));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'YepItsHalal', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Prayer spaces', item: `${SITE_URL}/prayer-spaces` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      {/* Arriving from "Find the nearest mosque", the answer comes first: a
          short header with no picture, and the list straight under it, so the
          mosques are on the first screen of a phone rather than below a hero
          and two notes (Shabir, 2026-09-24). Without a location it is the
          page to browse from, as before. */}
      {hasPoint ? (
        <>
          <PageHero
            titleId="near-title"
            title={nearby.length ? (label && label !== 'you' ? `Mosques near ${label}` : 'Mosques near you') : `Nothing found near ${label ?? 'you'}`}
            lede={
              nearby.length
                ? `The ${nearby.length} nearest, closest first, with roughly how long each is to walk.`
                : "We don't know of a prayer space within five miles of there. That does not mean there isn't one."
            }
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <NearestMosqueButton variant="onDark" label="Search again from here" />
              <a href="#by-borough" className="inline-flex min-h-[44px] items-center text-sm font-medium text-white/85 underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white">
                Or pick a borough
              </a>
            </div>
          </PageHero>
          <FocusOnArrive id="near-title" />
        </>
      ) : (
        <PageHero
          title="Mosques and prayer spaces in London"
          lede={
            <>
              {total} places to pray across London, from OpenStreetMap. Every restaurant page also says how
              far the nearest one is to walk.
            </>
          }
          art={PRAYER_ROOM}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <NearestMosqueButton variant="onDark" />
            <span className="text-[13px] text-white/70">Uses your location. We never store it.</span>
          </div>
        </PageHero>
      )}

      <PageBody>
      {hasPoint && nearby.length > 0 && (
        <section aria-labelledby="near-title">
          <ul className={`divide-y divide-line overflow-hidden ${panel}`}>
            {nearby.map((s, i) => {
              const hours = formatOsmHours(s.opening_hours);
              const services = formatOsmHours(s.service_times);
              const phone = splitPhones(s.phone)[0] ?? null;
              return (
                // Each one arrives a moment after the one before, nearest
                // first, so the eye lands on the top of the list. Reduced
                // motion is handled globally (globals.css).
                <li key={s.id} className="animate-fade-up px-4 py-3" style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="font-display text-[15px] font-semibold text-ink">{s.name}</p>
                    <p className="text-[13px] font-semibold text-accent-ink">
                      about {walkingMinutes(s.distance_meters)} min walk
                    </p>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {formatMetres(s.distance_meters)}
                    {s.address ? ` · ${s.address}` : s.postcode ? ` · ${s.postcode}` : ''}
                    {s.borough ? ` · ${s.borough}` : ''}
                  </p>

                  {/* Hours only when a mapper recorded them, and always as
                      "listed as", never as "open now". */}
                  {(hours || services) && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-relaxed text-ink/75">
                      <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
                      <span>
                        {hours && <>Listed as open {hours}. </>}
                        {services && <>Prayer times listed as {services}. </>}
                        <span className="text-subtle">Worth confirming before you set off.</span>
                      </span>
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-accent-ink hover:underline"
                    >
                      <NavigationIcon className="h-4 w-4" aria-hidden="true" />
                      Directions
                    </a>
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="inline-flex items-center gap-1.5 font-semibold text-accent-ink hover:underline"
                      >
                        <PhoneIcon className="h-4 w-4" aria-hidden="true" />
                        {formatUkPhone(phone)}
                      </a>
                    )}
                    {s.website_url && (
                      <a
                        href={s.website_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink hover:underline"
                      >
                        Website
                        <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Said near the top, not buried at the bottom, because it changes how
          you use the page: a mosque listed as open may well be locked. */}
      <div className="space-y-4">
        <p className={`${noteWarm} flex items-start gap-2.5 text-sm leading-relaxed text-ink/80`}>
          <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-spice-ink" aria-hidden="true" />
          <span>
            <span className="font-semibold text-ink">Opening times are the weak part.</span> Only{' '}
            {withHours} of these {total} carry any hours in OpenStreetMap, a mosque listed as open may
            still be locked, and the doors being open is not the same as jamaat. For a particular
            prayer, ring them or check their own website.
          </span>
        </p>

        <p className="text-pretty text-sm leading-relaxed text-muted">
          This is separate from the halal listings on purpose. A mosque being near a restaurant says
          nothing about that restaurant&apos;s food. And a halal label says nothing about the mosque.
        </p>
      </div>

      <PageSection
        id="by-borough"
        title="By borough"
        lede="Pick a borough to see its halal places. Every restaurant page shows the nearest prayer space."
      >
        <ul className="flex flex-wrap gap-2">
          {boroughs.map((b) => (
            <li key={b.borough}>
              {withPages.has(boroughSlug(b.borough)) ? (
                <Link
                  href={`/halal-restaurants/${boroughSlug(b.borough)}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[14px] font-medium text-ink/85 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent-soft hover:text-ink hover:shadow-sm"
                >
                  {b.borough}
                  <span className="text-[13px] tabular-nums text-subtle">{b.spaces}</span>
                </Link>
              ) : (
                <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[14px] text-muted">
                  {b.borough}
                  <span className="text-[13px] tabular-nums text-subtle">{b.spaces}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </PageSection>

      <Reveal as="section" aria-label="Where this comes from" className="border-t border-line pt-6">
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted">
          <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <span>
            Prayer space data from{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className={inlineLink}
            >
              OpenStreetMap contributors
            </a>
            , under the Open Database Licence. That is OpenStreetMap&apos;s coverage of London, not
            a complete list of its mosques, and we haven&apos;t visited any of them. Know one
            we&apos;re missing, or something that&apos;s wrong?{' '}
            {/* Corrections, not the restaurant form: this is about a mosque. */}
            <Link href="/corrections" className={inlineLink}>
              Tell us
            </Link>
            .
          </span>
        </p>
      </Reveal>
      </PageBody>
    </>
  );
}
