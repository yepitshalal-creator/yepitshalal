'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CoverImage } from './CoverImage';
import clsx from 'clsx';
import { HalalBadge } from './HalalBadge';
import { CheckedByUsBadge } from './CheckedByUsBadge';
import { displayName } from './RestaurantCard';
import { getOpenStatus } from '@/lib/openingStatus';
import { coverFor } from '@/lib/representativeImages';
import { formatUkPhone, splitPhones } from '@/lib/phone';
import { tidyAddress } from '@/lib/address';
import { isStockPhoto, statusOf, type SearchResultRestaurant } from '@/lib/types';
import { whyListed } from '@/lib/whyListed';
import type { PlacePreview } from '@/lib/placePreview';
import { MASK_CLASS } from '@/lib/analytics/scrub';
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  ClockIcon,
  GlobeIcon,
  MapPinIcon,
  NavigationIcon,
  PhoneIcon,
  SealCheckIcon,
  XIcon,
} from './icons';

// Tapping a pin opens what we know about that place, not a teaser for it.
//
// Two halves, for two speeds. Everything the search already returned (name,
// label, reason, distance, cuisine, hours) paints immediately, because making
// someone wait to read what is already on screen in the list would be silly.
// The rest (address, phone, website, evidence) arrives from /api/place/[slug],
// which is the only reason this is not just a link.
//
// On a phone it is a bottom sheet over the map; on a desktop a card beside it.
// Same content either way: a phone is the primary way people use this.

const EVIDENCE_KIND_LABEL: Record<string, string> = {
  yepitshalal_check: 'We checked this ourselves',
  certification: 'Certified',
  first_party_statement: 'The restaurant says so',
  certification_claim: 'The restaurant says it is certified',
  owner_submission: 'The owner told us',
  public_submission: 'A customer told us',
  business_name: 'Its name',
  community_tag: 'OpenStreetMap',
  directory_category: 'Public place data',
};

function hoursToday(hours: { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }[]) {
  const today = new Date().getDay();
  const rows = hours.filter((h) => h.day_of_week === today);
  if (!rows.length) return null;
  if (rows.every((r) => r.is_closed || !r.open_time)) return 'Closed today';
  return rows
    .filter((r) => !r.is_closed && r.open_time && r.close_time)
    .map((r) => `${r.open_time!.slice(0, 5)} to ${r.close_time!.slice(0, 5)}`)
    .join(', ');
}

function DetailRow({
  Icon,
  children,
  href,
  external = false,
}: {
  Icon: typeof MapPinIcon;
  children: React.ReactNode;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
      {href && external && <ArrowUpRightIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />}
    </>
  );

  if (!href) {
    return <li className="flex items-start gap-2.5 py-2 text-[13px] leading-relaxed text-ink/80">{body}</li>;
  }

  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
        className="-mx-2 flex min-h-[44px] items-start gap-2.5 rounded-xl px-2 py-2.5 text-[13px] leading-relaxed text-ink/80 transition hover:bg-black/[0.04] active:bg-black/[0.07]"
      >
        {body}
      </a>
    </li>
  );
}

export function PlaceSheet({
  restaurant,
  onClose,
}: {
  restaurant: SearchResultRestaurant;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PlacePreview | null>(null);
  const [failed, setFailed] = useState(false);
  // Re-tapping a pin you already opened should be instant, and panning the map
  // re-renders every marker, so this survives more taps than you would think.
  const cache = useRef(new Map<string, PlacePreview>());
  const headingRef = useRef<HTMLHeadingElement>(null);

  const title = displayName(restaurant);
  const status = statusOf(restaurant);
  // A small dot on the map arrives without its photo or reason line (see
  // SearchView's openDot); both come with the details below. Until they do,
  // the picture is left blank rather than showing an example that then swaps.
  const photoPath = restaurant.primary_photo_path ?? detail?.photo_path ?? null;
  const waitingForPhoto = !photoPath && !detail && !failed;
  const cover = coverFor({ ...restaurant, primary_photo_path: photoPath }, (url) => !isStockPhoto(url));
  const miles = restaurant.distance_meters / 1609.34;
  const distance = miles < 0.1 ? 'On your doorstep' : `${miles.toFixed(1)} mi away`;
  const cuisine = restaurant.cuisines?.slice(0, 2).join(' · ') || restaurant.cuisine_label || null;
  const hours = detail?.opening_hours?.length ? detail.opening_hours : restaurant.opening_hours ?? [];
  const open = hours.length ? getOpenStatus(hours) : null;
  const today = hours.length ? hoursToday(hours) : null;
  const phones = splitPhones(detail?.phone);
  // Same words as the card: the label, and under it why this place is on a
  // halal site when nobody has checked it. See lib/whyListed.
  const reason =
    restaurant.halal_summary ?? detail?.halal_summary ?? (status === 'unknown' ? whyListed(restaurant).full : null);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`;

  useEffect(() => {
    const cached = cache.current.get(restaurant.slug);
    setFailed(false);
    setDetail(cached ?? null);
    if (cached) return;

    const ac = new AbortController();
    fetch(`/api/place/${restaurant.slug}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('not ok'))))
      .then((json: PlacePreview) => {
        cache.current.set(restaurant.slug, json);
        setDetail(json);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      });
    return () => ac.abort();
  }, [restaurant.slug]);

  // The pin was the pointer action; this is where reading and the next action
  // happen, so focus follows it. Escape closes it (handled by the parent).
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [restaurant.id]);

  // Most addresses already end in their postcode; a few do not. Appending it
  // blindly produced "312 Bancroft Road, London, E1 4BU, E1 4BU".
  const addressLine = (() => {
    if (!detail) return null;
    const street = tidyAddress(detail.address).replace(/street address not known,?\s*/i, '').replace(/[,\s]+$/, '');
    const pc = detail.postcode;
    if (!pc) return street || null;
    if (street.toUpperCase().includes(pc.toUpperCase())) return street;
    return street ? `${street}, ${pc}` : pc;
  })();

  return (
    <div
      role="dialog"
      aria-label={`${title}, details`}
      className={clsx(
        'absolute z-30 animate-sheet-up',
        // Phone: a sheet off the bottom edge, clear of the tab bar.
        'inset-x-0 bottom-0 max-h-[78%]',
        // Desktop: a card beside the map, never covering it end to end.
        'sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-h-[calc(100%-2rem)] sm:w-[22.5rem]'
      )}
    >
      <div className="flex max-h-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/10 sm:rounded-3xl sm:shadow-2xl">
        {/* Decorative on purpose: it says "this slid up from the bottom", and
            the close button below is the real, labelled control. */}
        <div aria-hidden="true" className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-black/15" />
        </div>

        <div className="relative shrink-0">
          <div className="relative h-32 w-full overflow-hidden bg-halal-unverifiedSoft sm:h-36">
            {!waitingForPhoto && (
              <CoverImage src={cover.src} alt={cover.own ? title : ''} sizes="(max-width: 640px) 100vw, 360px" />
            )}
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" />
            {waitingForPhoto ? null : !cover.own ? (
              <span className="absolute bottom-2 left-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                Example dish, not this restaurant
              </span>
            ) : (
              detail?.photo_source_site && (
                <span className="absolute bottom-2 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  From {detail.photo_source_site}
                </span>
              )
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 active:scale-95"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-pretty font-display text-lg font-semibold leading-tight text-ink outline-none"
          >
            {title}
          </h2>

          <p className="mt-1 text-[13px] text-muted">
            {/* Measured from where the visitor searched (MASK_CLASS). */}
            <span className={`${MASK_CLASS} font-medium text-ink/75`}>{distance}</span>
            {restaurant.branch_label && <> · {restaurant.branch_label}</>}
            {cuisine && <> · {cuisine}</>}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <HalalBadge classification={status} size="sm" variant="solid" />
            {restaurant.checked_by_us && <CheckedByUsBadge size="sm" />}
            {open && open.state !== 'unknown' && (
              <span
                suppressHydrationWarning
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                  open.state === 'open'
                    ? 'bg-halal-fullSoft text-halal-fullInk ring-halal-full/20'
                    : open.state === 'closing_soon'
                      ? 'bg-halal-partialSoft text-halal-partialInk ring-halal-partial/20'
                      : 'bg-halal-unverifiedSoft text-halal-unverifiedInk ring-halal-unverified/20'
                )}
              >
                <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {open.label}
              </span>
            )}
          </div>

          {/* Evidence summaries come out of the database without a full stop;
              the "why it's here" line is a sentence and has one already. */}
          {reason && (
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{reason.replace(/\.$/, '')}.</p>
          )}

          {/* What the label rests on, in one line, with the way to see all of it. */}
          {detail && detail.evidence_count > 0 && (
            <Link
              href={`/restaurant/${restaurant.slug}#halal-status`}
              className="mt-2.5 flex items-start gap-2 rounded-xl bg-sand px-3 py-2.5 text-[13px] leading-relaxed text-ink/80 transition hover:bg-black/[0.05]"
            >
              <SealCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-ink">
                  {detail.lead_evidence ? EVIDENCE_KIND_LABEL[detail.lead_evidence.kind] ?? 'Evidence' : 'Evidence'}
                </span>
                {detail.evidence_count > 1 && (
                  <span className="text-muted">
                    {' '}
                    and {detail.evidence_count - 1} more {detail.evidence_count === 2 ? 'source' : 'sources'}
                  </span>
                )}
                {detail.lead_evidence?.excerpt && (
                  <span className="mt-0.5 block line-clamp-2 italic text-muted">
                    &ldquo;{detail.lead_evidence.excerpt}&rdquo;
                  </span>
                )}
              </span>
              <ArrowRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
            </Link>
          )}

          <ul className="mt-1.5 divide-y divide-line">
            {addressLine && (
              <DetailRow Icon={MapPinIcon} href={directions} external>
                {addressLine}
              </DetailRow>
            )}
            {today && (
              <DetailRow Icon={ClockIcon}>
                <span suppressHydrationWarning>
                  {today === 'Closed today' ? today : `Today ${today}`}
                  {open?.detail && <span className="text-muted"> · {open.detail}</span>}
                </span>
              </DetailRow>
            )}
            {phones.map((p) => (
              <DetailRow key={p} Icon={PhoneIcon} href={`tel:${p}`}>
                {formatUkPhone(p)}
              </DetailRow>
            ))}
            {detail?.website_url && (
              <DetailRow Icon={GlobeIcon} href={detail.website_url} external>
                <span className="min-w-0 [overflow-wrap:anywhere]">{detail.website_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
              </DetailRow>
            )}
          </ul>

          {!detail && !failed && (
            <div aria-hidden="true" className="mt-2 space-y-2.5 py-1">
              <span className="block h-3.5 w-4/5 animate-pulse rounded bg-black/[0.06]" />
              <span className="block h-3.5 w-3/5 animate-pulse rounded bg-black/[0.06]" />
            </div>
          )}
          {failed && (
            <p className="py-2 text-[13px] text-muted">
              The rest of the details didn&apos;t load.{' '}
              <Link href={`/restaurant/${restaurant.slug}`} className="font-semibold text-accent-ink underline underline-offset-2">
                Open the page
              </Link>
            </p>
          )}

          {detail && !addressLine && !phones.length && !detail.website_url && (
            <p className="py-2 text-[13px] leading-relaxed text-muted">
              We don&apos;t have an address or phone number for this one yet.{' '}
              <Link
                href={`/submit-restaurant?update=${restaurant.slug}`}
                className="font-semibold text-accent-ink underline underline-offset-2"
              >
                Know them?
              </Link>
            </p>
          )}
        </div>

        {/* Pinned, because these are the two things a hungry person does next. */}
        <div className="shrink-0 border-t border-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex gap-2">
            <Link
              href={`/restaurant/${restaurant.slug}`}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-accent-ink active:scale-[0.98]"
            >
              Full details
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
            {phones[0] && (
              <a
                href={`tel:${phones[0]}`}
                aria-label={`Call ${title}`}
                className="inline-flex min-h-[44px] w-12 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-ink/30 active:scale-[0.98]"
              >
                <PhoneIcon className="h-[18px] w-[18px]" aria-hidden="true" />
              </a>
            )}
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Directions to ${title}`}
              className="inline-flex min-h-[44px] w-12 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-ink/30 active:scale-[0.98]"
            >
              <NavigationIcon className="h-[18px] w-[18px]" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
