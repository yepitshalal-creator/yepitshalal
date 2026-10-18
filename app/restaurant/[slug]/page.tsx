import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getNearbyWithEvidence, getRestaurantBySlug, mergedTargetSlug } from '@/lib/restaurants';
import { getNearestPrayerSpaces } from '@/lib/prayerSpaces';
import { NearestPrayerSpace } from '@/components/NearestPrayerSpace';
import { getPublishedReels, isActivePartner } from '@/lib/reels';
import { halalLabel, HalalBadge } from '@/components/HalalBadge';
import { CheckedByUsBadge } from '@/components/CheckedByUsBadge';
import { HalalFactsPanel } from '@/components/HalalFactsPanel';
import { HalalEvidencePanel } from '@/components/HalalEvidencePanel';
import { OpenStatusBadge } from '@/components/OpenStatusBadge';
import { HeroPhotos } from '@/components/HeroPhotos';
import { ReelShowcase } from '@/components/ReelShowcase';
import { OwnershipCta } from '@/components/OwnershipCta';
import { OpeningHoursList } from '@/components/OpeningHoursList';
import { HygieneBadge } from '@/components/HygieneBadge';
import { HygienePanel } from '@/components/HygienePanel';
import { OffersList } from '@/components/OffersList';
import { DealCard } from '@/components/deals/DealCard';
import { getClaimableDeal } from '@/lib/deals/data';
import { RestaurantCard } from '@/components/RestaurantCard';
import { ShareButton } from '@/components/ShareButton';
import { SaveButton } from '@/components/SaveButton';
import { AskBeforeYouOrder } from '@/components/AskBeforeYouOrder';
import { placeTitle as displayTitle, statusFor, summaryFor } from '@/lib/halalPages';
import { tidyAddress } from '@/lib/address';
import { priceSigns } from '@/lib/price';
import { jsonLdHtml } from '@/lib/jsonLd';
import { isUnsplash, skipOptimiser, unsplashSized } from '@/lib/imageUrl';
import { halalAnswerFor } from '@/lib/halalAnswer';
import { SITE_URL } from '@/lib/site';
import { formatUkPhone, splitPhones } from '@/lib/phone';
import { creditLine, representativeImageFor } from '@/lib/representativeImages';
import { isStockPhoto, DAY_NAMES, type SearchResultRestaurant } from '@/lib/types';
import {
  NavigationIcon,
  PhoneIcon,
  GlobeIcon,
  MapPinIcon,
  ArrowUpRightIcon,
  SealCheckIcon,
  WarningIcon,
  InfoIcon,
} from '@/components/icons';

const SOURCE_CREDIT: Record<string, string> = {
  fsa: 'Food Standards Agency food hygiene register (Open Government Licence)',
  osm: 'OpenStreetMap contributors (ODbL)',
  overture: 'Overture Maps Foundation',
  owner_submission: 'Submitted to YepItsHalal',
};

const BUTTON =
  'inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/30 active:scale-[0.98] sm:flex-none';

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const restaurant = await getRestaurantBySlug(params.slug);
  if (!restaurant || !restaurant.isListed) return { title: 'Restaurant not found', robots: { index: false } };

  const title = displayTitle(restaurant);
  const where = restaurant.borough ?? restaurant.postcode ?? 'London';
  const listed = restaurant.isListed;
  const cuisine = restaurant.cuisines[0] ?? restaurant.cuisineLabel;
  // Only a listed place makes a halal statement, and that statement is the
  // label plus the reason for it, never the label alone.
  const answer = halalAnswerFor({
    name: title,
    status: statusFor(restaurant),
    summary: summaryFor(restaurant.halal_summary, restaurant.evidence),
    checkedAt: restaurant.halal_checked_at,
    cuisine,
  });
  const description = listed
    ? `${answer.sentence} See the evidence, the address and today's hours.`.slice(0, 300)
    : `${title}${cuisine ? `, ${cuisine}` : ''} in ${where}. ${answer.sentence}`.slice(0, 300);

  return {
    // "Is X halal?" is asked by the place's own question page
    // (/is-it-halal/<slug>, since 2026-09-24). This page is the listing, so its
    // title says what a listing has, and the two do not compete for one search.
    title: listed ? `${title}, ${where}: ${halalLabel(restaurant.halal_classification)}, hours and directions` : `${title}, ${where}`,
    description,
    alternates: { canonical: `/restaurant/${restaurant.slug}` },
    // Only a listed place gets this far. The search check stays in case a
    // listed place is ever kept out of search.
    robots: listed && restaurant.isSearchable ? undefined : { index: false, follow: true },
  };
}

export default async function RestaurantPage({ params }: { params: { slug: string } }) {
  const restaurant = await getRestaurantBySlug(params.slug);
  if (!restaurant) notFound();

  // A duplicate merged into another record (admin, Duplicates) sends anyone
  // with an old link or bookmark to the record that was kept, permanently.
  if (restaurant.mergedInto) {
    const kept = await mergedTargetSlug(restaurant.mergedInto);
    if (kept && kept !== restaurant.slug) permanentRedirect(`/restaurant/${kept}`);
  }
  // Only places with halal evidence are on the site (Shabir, 2026-10-11). The
  // rest, once shown as Worth asking, stay in the catalogue for the admin.
  if (!restaurant.isListed) notFound();

  const [reels, partner, nearby, prayerSpaces, deal] = await Promise.all([
    getPublishedReels(restaurant.id),
    isActivePartner(restaurant.id),
    getNearbyWithEvidence(restaurant),
    getNearestPrayerSpaces(restaurant.lat, restaurant.lng, 3),
    getClaimableDeal(restaurant.id),
  ]);

  const title = displayTitle(restaurant);
  const status = statusFor(restaurant);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`;
  const cuisine = restaurant.cuisines.join(' · ') || restaurant.cuisineLabel || null;
  const closed = restaurant.catalogueStatus === 'permanently_closed' || restaurant.catalogueStatus === 'temporarily_closed';
  const realPhotos = restaurant.photos.filter((p) => !isStockPhoto(p.storage_path));
  const hasGenuineCheck = restaurant.evidence.some((e) => e.kind === 'yepitshalal_check');
  const phones = splitPhones(restaurant.phone);
  const price = priceSigns(restaurant.priceRange);
  const websiteHost = restaurant.website_url ? hostOf(restaurant.website_url) : null;
  const addressKnown = !/street address not known/i.test(restaurant.address);
  const editHref = `/submit-restaurant?update=${restaurant.slug}`;

  // The picture at the top: the restaurant's own photo when it sent one,
  // otherwise a picture of the kind of food it serves, labelled as exactly that.
  const representative = realPhotos.length
    ? null
    : representativeImageFor({
        id: restaurant.id,
        name: restaurant.name,
        cuisine_label: restaurant.cuisineLabel,
        cuisines: restaurant.cuisines,
        brand_name: restaurant.brandName,
      });
  const heroPhoto = realPhotos[0] ?? null;
  const heroSrc = heroPhoto?.storage_path ?? representative!.src;

  // Facts about the place only. Schema.org has no halal property, and a
  // structured claim a search engine would repeat without our caveats is the
  // last place to overstate one.
  const hoursSpec = DAY_NAMES.flatMap((day, i) =>
    restaurant.openingHours
      .filter((h) => h.day_of_week === i && !h.is_closed && h.open_time && h.close_time)
      .map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${day}`,
        opens: h.open_time!.slice(0, 5),
        closes: h.close_time!.slice(0, 5),
      }))
  );
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: title,
    url: `${SITE_URL}/restaurant/${restaurant.slug}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address,
      ...(restaurant.postcode ? { postalCode: restaurant.postcode } : {}),
      addressLocality: 'London',
      addressCountry: 'GB',
    },
    geo: { '@type': 'GeoCoordinates', latitude: restaurant.lat, longitude: restaurant.lng },
    ...(restaurant.cuisines.length ? { servesCuisine: restaurant.cuisines } : {}),
    ...(phones.length ? { telephone: phones[0] } : {}),
    ...(restaurant.website_url || restaurant.socials.length
      ? { sameAs: [restaurant.website_url, ...restaurant.socials].filter(Boolean) }
      : {}),
    ...(restaurant.menu_url ? { hasMenu: restaurant.menu_url } : {}),
    ...(realPhotos.length ? { image: realPhotos.map((p) => p.storage_path) } : {}),
    ...(hoursSpec.length ? { openingHoursSpecification: hoursSpec } : {}),
  };

  // The question itself ("Is X halal?") is marked up on the place's own
  // question page, /is-it-halal/<slug>, which exists to answer it. One page
  // per question: two pages carrying the same FAQ would compete for it.

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-4 sm:px-6 sm:py-8">
      {restaurant.isListed && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
        </>
      )}

      {closed && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-halal-partialSoft px-4 py-3 text-sm font-medium text-halal-partialInk ring-1 ring-halal-partial/20">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {restaurant.catalogueStatus === 'permanently_closed'
            ? 'This restaurant appears to have closed permanently.'
            : 'This restaurant appears to be temporarily closed.'}
        </p>
      )}

      {/* Several photos of their own: swipe through them. One, or an example
          picture: a single figure, as before. The halal label sits on the
          picture either way, where the eye lands first. */}
      {realPhotos.length > 1 ? (
        <HeroPhotos photos={realPhotos} title={title}>
          {status && (
            <span className="absolute left-3 top-3">
              <HalalBadge classification={status} size="md" variant="photo" />
            </span>
          )}
        </HeroPhotos>
      ) : (
      <figure className="relative -mx-4 overflow-hidden bg-halal-unverifiedSoft sm:mx-0 sm:rounded-2xl">
        {status && (
          <span className="absolute left-3 top-3 z-10">
            <HalalBadge classification={status} size="md" variant="photo" />
          </span>
        )}
        <div className="relative aspect-[16/9] sm:aspect-[21/8]">
          <Image
            src={isUnsplash(heroSrc) ? unsplashSized(heroSrc, 1600, 900) : heroSrc}
            alt={representative ? '' : title}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 896px"
            unoptimized={skipOptimiser(heroSrc)}
            className={heroPhoto?.is_logo ? 'bg-white object-contain p-6' : 'object-cover'}
          />
        </div>
        {representative ? (
          <figcaption className="absolute bottom-2 right-2 max-w-[calc(100%-1rem)] rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            <Link href="/image-credits" className="block truncate hover:underline">
              Example of the food, not this restaurant&apos;s own · {creditLine(representative)}
            </Link>
          </figcaption>
        ) : (
          /* Their picture, from their own website, credited to them. */
          heroPhoto?.source_site && (
            <figcaption className="absolute bottom-2 right-2 max-w-[calc(100%-1rem)] rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <a
                href={heroPhoto.source_url ?? `https://${heroPhoto.source_site}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="block truncate hover:underline"
              >
                {heroPhoto.is_logo ? 'Logo' : 'Photo'} from {heroPhoto.source_site}
              </a>
            </figcaption>
          )
        )}
      </figure>
      )}

      <header className="mt-4">
        <h1 className="text-balance font-display text-[1.7rem] font-semibold leading-tight text-ink sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
          <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
          <span>
            {cuisine && (
              <>
                {cuisine}
                <span className="mx-1.5 text-subtle" aria-hidden="true">·</span>
              </>
            )}
            {tidyAddress(restaurant.address)}
          </span>
        </p>
        {/* Small facts: open now and somewhere to pray as pills, when someone
            has told us, and the kitchen's hygiene rating as quiet grey words
            after them. Unknown is left off. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasGenuineCheck && <CheckedByUsBadge />}
          {!closed && <OpenStatusBadge hours={restaurant.openingHours} />}
          {(restaurant.prayerFacility === 'prayer_room' || restaurant.prayerFacility === 'space') && (
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-black/[0.055] px-2.5 py-1 text-xs font-semibold text-ink/75">
              {restaurant.prayerFacility === 'prayer_room' ? 'Prayer room' : 'Space to pray'}
            </span>
          )}
          <HygieneBadge rating={restaurant.hygiene?.rating} size="md" className="px-0.5" />
        </div>
      </header>

      {/* Directions, Call and Menu sit here on a laptop. On a phone they are
          held at the bottom of the screen instead (below), in reach of a thumb. */}
      <div className="-mt-2 flex flex-wrap justify-end gap-2 sm:mt-4 sm:justify-start">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-ink hover:shadow-md active:scale-[0.98] sm:inline-flex sm:flex-none"
        >
          <NavigationIcon className="h-4 w-4" />
          Directions
        </a>
        {phones.length > 0 && (
          <a href={`tel:${phones[0]}`} className={`${BUTTON} max-sm:hidden`}>
            <PhoneIcon className="h-4 w-4" />
            Call
          </a>
        )}
        {(restaurant.menu_url || websiteHost) && (
          <a href={restaurant.menu_url ?? restaurant.website_url!} target="_blank" rel="noopener noreferrer" className={`${BUTTON} max-sm:hidden`}>
            {restaurant.menu_url ? 'Menu' : 'Website'}
            <ArrowUpRightIcon className="h-4 w-4 text-subtle" />
          </a>
        )}
        <SaveButton slug={restaurant.slug} className={`${BUTTON} max-sm:min-h-[40px] max-sm:flex-none max-sm:px-4`} />
        <ShareButton title={title} className={`${BUTTON} max-sm:min-h-[40px] max-sm:flex-none max-sm:px-4`} />
      </div>

      {/* The phone's bar of actions, above the tab bar. Most visitors land here
          from Google, so this is where they decide. The same links as above,
          so the visit numbers count a tap here the same way. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 px-4 py-2.5 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[46px] flex-[1.4] items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white active:scale-[0.98]"
          >
            <NavigationIcon className="h-4 w-4" />
            Directions
          </a>
          {phones.length > 0 && (
            <a
              href={`tel:${phones[0]}`}
              className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full bg-black/[0.06] px-3 text-sm font-semibold text-ink active:scale-[0.98]"
            >
              <PhoneIcon className="h-4 w-4" />
              Call
            </a>
          )}
          {(restaurant.menu_url || websiteHost) && (
            <a
              href={restaurant.menu_url ?? restaurant.website_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1 rounded-full bg-black/[0.06] px-3 text-sm font-semibold text-ink active:scale-[0.98]"
            >
              {restaurant.menu_url ? 'Menu' : 'Website'}
              <ArrowUpRightIcon className="h-3.5 w-3.5 text-subtle" />
            </a>
          )}
        </div>
      </div>

      {/* Halal status comes before everything else below the name, because it
          is the question the page exists to answer. */}
      <div className="mt-5">
        <HalalEvidencePanel
          classification={restaurant.halal_classification}
          strength={restaurant.halal_evidence_strength}
          summary={summaryFor(restaurant.halal_summary, restaurant.evidence)}
          evidence={restaurant.evidence}
          isListed={restaurant.isListed}
          isSearchable={restaurant.isSearchable}
          cuisine={restaurant.cuisines[0] ?? restaurant.cuisineLabel}
          slug={restaurant.slug}
          name={title}
          checkedByUs={hasGenuineCheck}
        />

        {restaurant.isSearchable && (
          <p className="mt-2 px-1 text-sm">
            <Link href={`/is-it-halal/${restaurant.slug}`} className="font-semibold text-accent-ink hover:underline">
              Is {title} halal? The short answer, to share
            </Link>
          </p>
        )}

        {!closed && <AskBeforeYouOrder phone={phones[0] ?? null} />}

        <NearestPrayerSpace
          spaces={prayerSpaces}
          placeName={title}
          slug={restaurant.slug}
          facility={restaurant.prayerFacility}
          facilityNote={restaurant.prayerFacilityNote}
          facilitySource={restaurant.prayerFacilitySource}
          facilityAt={restaurant.prayerFacilityAt}
        />
      </div>

      {/* The restaurant's own deal, under the halal answer, never above it. A
          closed place takes no claims (claim_deal checks too). */}
      {deal && !closed && <DealCard deal={deal} label={status} />}

      {restaurant.description && (
        <p className="mt-5 max-w-2xl text-pretty text-[15px] leading-relaxed text-ink/80">{restaurant.description}</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-[1.4fr_1fr] sm:gap-6">
        <div className="space-y-5 sm:space-y-6">
          {/* Detailed facts only exist when we checked the place ourselves. */}
          {hasGenuineCheck && restaurant.halalFacts && <HalalFactsPanel facts={restaurant.halalFacts} />}

          <ReelShowcase
            reels={reels}
            restaurantName={restaurant.name}
            classification={restaurant.halal_classification}
            isPartner={partner}
          />

          {nearby.length > 0 && (
            <section aria-labelledby="nearby" className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="nearby" className="font-display text-lg font-semibold text-ink">
                  Nearby, with halal evidence
                </h2>
                <Link
                  href={`/search?lat=${restaurant.lat}&lng=${restaurant.lng}&mode=searched_location&label=${encodeURIComponent(title)}`}
                  className="shrink-0 text-sm font-semibold text-accent-ink hover:underline"
                >
                  See the map
                </Link>
              </div>
              {nearby.map((r) => (
                <RestaurantCard key={r.id} restaurant={r as unknown as SearchResultRestaurant} />
              ))}
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-ink">Opening hours</h2>
              {!closed && <OpenStatusBadge hours={restaurant.openingHours} showDetail={false} />}
            </div>
            <div className="mt-3">
              <OpeningHoursList hours={restaurant.openingHours} />
            </div>
          </section>

          <HygienePanel hygiene={restaurant.hygiene} />

          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold text-ink">Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Address</dt>
                <dd className="mt-0.5 text-ink/80">{tidyAddress(restaurant.address)}</dd>
              </div>
              {restaurant.borough && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Borough</dt>
                  <dd className="mt-0.5 text-ink/80">{restaurant.borough}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Price a head</dt>
                <dd className="mt-0.5 text-ink/80">
                  {price ? (
                    <>
                      <span className="font-semibold text-ink">{price.signs}</span> {price.words}, from the owner
                    </>
                  ) : (
                    <span className="text-muted">Not known yet</span>
                  )}
                </dd>
              </div>
              {phones.length > 0 && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Phone</dt>
                  <dd className="mt-0.5 flex flex-col gap-1">
                    {phones.map((p) => (
                      <a key={p} href={`tel:${p}`} className="inline-flex items-center gap-1.5 font-medium text-accent-ink hover:underline">
                        <PhoneIcon className="h-4 w-4" />
                        {formatUkPhone(p)}
                      </a>
                    ))}
                  </dd>
                </div>
              )}
              {websiteHost && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Website</dt>
                  <dd className="mt-0.5">
                    <a
                      href={restaurant.website_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-accent-ink hover:underline"
                    >
                      <GlobeIcon className="h-4 w-4" />
                      {websiteHost}
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </dd>
                </div>
              )}
              {restaurant.socials.length > 0 && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Social</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    {restaurant.socials.slice(0, 3).map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-accent-ink hover:underline">
                        {/instagram/.test(url) ? 'Instagram' : /facebook/.test(url) ? 'Facebook' : /tiktok/.test(url) ? 'TikTok' : /twitter|x\.com/.test(url) ? 'X' : 'Link'}
                      </a>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {/* Like a map listing that nobody has filled in yet: say what's
                missing and let whoever knows add it. */}
            {(phones.length === 0 || !websiteHost || !addressKnown) && (
              <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
                <span>
                  We don&apos;t have{' '}
                  {[!addressKnown && 'a street address', phones.length === 0 && 'a phone number', !websiteHost && 'a website']
                    .filter(Boolean)
                    .join(', ')
                    .replace(/, ([^,]*)$/, ' or $1')}{' '}
                  for this place yet.{' '}
                  <Link href={editHref} className="font-semibold text-accent-ink hover:underline">
                    Suggest an edit
                  </Link>
                </span>
              </p>
            )}
          </section>

          <OffersList offers={restaurant.offers} />

          {/* /owners sends a picked restaurant here, as #claim. */}
          <div id="claim" className="scroll-mt-24">
            <OwnershipCta restaurantId={restaurant.id} slug={restaurant.slug} />
          </div>

          {restaurant.isListed && !hasGenuineCheck && (
            <Link
              href={`/restaurant/${restaurant.slug}/verify`}
              className="flex items-start gap-3 rounded-2xl border border-dashed border-black/15 p-5 text-sm text-muted transition hover:border-ink/30 hover:bg-white"
            >
              <SealCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
              <span>
                Run this restaurant?{' '}
                <span className="font-semibold text-accent-ink">Ask us to check your halal information</span>
              </span>
            </Link>
          )}

          <p className="px-1 text-xs leading-relaxed text-subtle">
            {restaurant.sources.length > 0 && (
              <>
                Listing details from{' '}
                {[...new Set(restaurant.sources.map((s) => SOURCE_CREDIT[s.source] ?? s.source))].join('; ')}.{' '}
              </>
            )}
            <Link href={editHref} className="font-medium text-accent-ink hover:underline">
              Something wrong or out of date?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
