'use client';

import Link from 'next/link';
import { CoverImage } from './CoverImage';
import { HalalBadge } from './HalalBadge';
import { CheckedByUsBadge } from './CheckedByUsBadge';
import { HygieneBadge } from './HygieneBadge';
import { ArrowRightIcon } from './icons';
import { cleanRestaurantName } from '@/lib/restaurantName';
import { getOpenStatus } from '@/lib/openingStatus';
import { coverFor } from '@/lib/representativeImages';
import { priceSigns } from '@/lib/price';
import { isBusinessLogo, isStockPhoto, statusOf, type SearchResultRestaurant } from '@/lib/types';
import { whyListed } from '@/lib/whyListed';
import { MASK_CLASS } from '@/lib/analytics/scrub';

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) return 'On your doorstep';
  return `${miles.toFixed(1)} mi`;
}

/**
 * A branch descriptor used to live inside the name ("Morley's Chicken (Acton)").
 * With brand and branch as separate columns the card shows the brand once and
 * puts the location on its own line, so two nearby branches read as two places.
 * Registration names ("X Ltd t/a Y") are shown as the name on the door.
 */
export function displayName(r: { name: string; brand_name?: string | null; branch_label?: string | null }): string {
  return cleanRestaurantName(r.brand_name ?? r.name);
}

const OPEN_TONE: Record<string, string> = {
  open: 'text-halal-fullInk',
  closing_soon: 'text-halal-partialInk',
  closed: 'text-subtle',
};

const SHADOW =
  'shadow-[0_1px_2px_rgba(15,37,43,0.04),0_10px_28px_-14px_rgba(15,37,43,0.18)] hover:shadow-[0_2px_4px_rgba(15,37,43,0.05),0_18px_38px_-16px_rgba(15,37,43,0.26)]';

function Dot() {
  return (
    <span className="mx-1.5 text-black/20" aria-hidden="true">
      •
    </span>
  );
}

/** Everything both layouts say about a place, worked out once. */
function cardFacts(restaurant: SearchResultRestaurant) {
  const status = statusOf(restaurant);
  const cover = coverFor(restaurant, (url) => !isStockPhoto(url));
  return {
    title: displayName(restaurant),
    cuisine: restaurant.cuisines?.slice(0, 2).join(' · ') || restaurant.cuisine_label || null,
    distance: formatDistance(restaurant.distance_meters),
    status,
    open: restaurant.opening_hours?.length ? getOpenStatus(restaurant.opening_hours) : null,
    price: priceSigns(restaurant.price_range),
    cover,
    logo: cover.own && isBusinessLogo(cover.src),
    // The reason line: what the label rests on, or, for a place nobody has
    // checked, why it is in front of you at all: it serves the kind of food
    // that is often halal in London.
    reason: restaurant.halal_summary ?? (status === 'unknown' ? whyListed(restaurant).line : null),
  };
}

/** Distance, area, food, price and open now, on one line. Unknown is left off. */
function Facts({ restaurant, card }: { restaurant: SearchResultRestaurant; card: ReturnType<typeof cardFacts> }) {
  return (
    <>
      {/* Measured from where the visitor searched (MASK_CLASS). */}
      <span className={`${MASK_CLASS} font-semibold text-ink/75`}>{card.distance}</span>
      {restaurant.branch_label && (
        <>
          <Dot />
          {restaurant.branch_label}
        </>
      )}
      {card.cuisine && (
        <>
          <Dot />
          {card.cuisine}
        </>
      )}
      {card.price && (
        <>
          <Dot />
          <span aria-label={card.price.words}>{card.price.signs}</span>
        </>
      )}
      {card.open && card.open.state !== 'unknown' && (
        <>
          <Dot />
          <span suppressHydrationWarning className={`font-semibold ${OPEN_TONE[card.open.state]}`}>
            {card.open.label}
          </span>
        </>
      )}
    </>
  );
}

export function RestaurantCard({
  restaurant,
  priority = false,
  layout = 'row',
}: {
  restaurant: SearchResultRestaurant;
  /** Set on the first few rows: one of them is the LCP element. */
  priority?: boolean;
  /** 'tile': the big photo card for search results. 'row': compact, for
   *  short lists beside other content. */
  layout?: 'tile' | 'row';
}) {
  const card = cardFacts(restaurant);
  return layout === 'tile' ? (
    <TileCard restaurant={restaurant} card={card} priority={priority} />
  ) : (
    <RowCard restaurant={restaurant} card={card} priority={priority} />
  );
}

// The search result, the way food apps show one: the picture first and wide,
// the halal label on it where the eye lands, then the name and the facts.
function TileCard({
  restaurant,
  card,
  priority,
}: {
  restaurant: SearchResultRestaurant;
  card: ReturnType<typeof cardFacts>;
  priority: boolean;
}) {
  return (
    <Link
      href={`/restaurant/${restaurant.slug}`}
      className={`group block overflow-hidden rounded-[22px] bg-white transition duration-200 active:scale-[0.995] hover:-translate-y-[2px] ${SHADOW}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-halal-unverifiedSoft">
        <CoverImage
          src={card.cover.src}
          alt={card.cover.own ? card.title : ''}
          sizes="(max-width: 640px) 100vw, 560px"
          priority={priority}
          className={card.logo ? 'p-6 sm:p-8' : 'transition duration-500 group-hover:scale-[1.04]'}
        />
        {/* Never the restaurant's own food unless it is their picture, and the
            card says so, in words, on the picture itself. */}
        {!card.cover.own && (
          <>
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
            <span className="absolute bottom-2 left-3 text-[11px] font-medium leading-none text-white/90">Example photo</span>
          </>
        )}
        <span className="absolute left-2.5 top-2.5">
          <HalalBadge classification={card.status} size="sm" variant="photo" />
        </span>
        {/* Earned from our own visit numbers, never set by hand (lib/popular.ts). */}
        {restaurant.popular && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-forest-deep shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
            Popular
          </span>
        )}
      </div>

      <div className="px-3.5 pb-3.5 pt-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-display text-[18px] font-semibold leading-tight text-ink sm:text-[19px]">
            {card.title}
          </h3>
          {restaurant.checked_by_us && <CheckedByUsBadge size="sm" className="mt-0.5 shrink-0" />}
        </div>
        <p className="mt-1 truncate text-[13px] leading-snug text-muted">
          <Facts restaurant={restaurant} card={card} />
        </p>
        {card.reason && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-subtle">{card.reason.replace(/\.$/, '')}.</p>
        )}
        {restaurant.hygiene_rating != null && (
          <div className="mt-2">
            <HygieneBadge rating={restaurant.hygiene_rating} />
          </div>
        )}
      </div>
    </Link>
  );
}

function RowCard({
  restaurant,
  card,
  priority,
}: {
  restaurant: SearchResultRestaurant;
  card: ReturnType<typeof cardFacts>;
  priority: boolean;
}) {
  return (
    // No outline. A hairline ring plus a shadow plus a border on the thing
    // above it is what made a list of thirty of these read as a stack of boxes;
    // a soft shadow alone is enough to lift a white card off a warm ground, and
    // the eye is then free to land on the photograph and the name.
    <Link
      href={`/restaurant/${restaurant.slug}`}
      className={`group flex items-center gap-4 rounded-[22px] bg-white p-3 transition duration-200 active:scale-[0.995] hover:-translate-y-[2px] sm:p-3.5 ${SHADOW}`}
    >
      <div className="relative h-[100px] w-[100px] shrink-0 overflow-hidden rounded-[16px] bg-halal-unverifiedSoft sm:h-[116px] sm:w-[116px]">
        <CoverImage
          src={card.cover.src}
          alt={card.cover.own ? card.title : ''}
          sizes="(max-width: 640px) 100px, 116px"
          priority={priority}
          thumb
          className={card.logo ? '' : 'transition duration-500 group-hover:scale-[1.06]'}
        />
        {/* Never the restaurant's own food unless it is their picture, and the
            card says so. A wash into the bottom edge rather than a black pill
            stuck on the corner: the same honesty, without a hard little box. */}
        {!card.cover.own && (
          <>
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/45 to-transparent" />
            <span className="absolute bottom-1 left-2 text-[10px] font-medium leading-none text-white/85">Example</span>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 font-display text-[17px] font-semibold leading-[1.2] text-ink sm:text-[19px]">{card.title}</h3>

        <p className="mt-1 truncate text-[13px] leading-snug text-muted">
          <Facts restaurant={restaurant} card={card} />
        </p>

        {/* The label and, under it, the reason for it: a label alone is the
            thing this site exists to improve on. */}
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <HalalBadge classification={card.status} size="sm" />
          {restaurant.checked_by_us && <CheckedByUsBadge size="sm" />}
          <HygieneBadge rating={restaurant.hygiene_rating} />
        </span>
        {card.reason && (
          <span className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-subtle">{card.reason.replace(/\.$/, '')}.</span>
        )}
      </div>

      <ArrowRightIcon
        className="mr-1 hidden h-4 w-4 shrink-0 text-black/15 transition group-hover:translate-x-0.5 group-hover:text-ink/50 sm:block"
        aria-hidden="true"
      />
    </Link>
  );
}
