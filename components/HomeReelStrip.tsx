import Link from 'next/link';
import Image from 'next/image';
import { skipOptimiser } from '@/lib/imageUrl';
import { HalalBadge } from './HalalBadge';
import { ArrowRightIcon } from './icons';
import { ctaSecondarySm } from './cta';
import type { FeaturedReel } from '@/lib/reels';

/**
 * The homepage's one visual-discovery moment: proof that a listing here shows
 * you the food, not just an address.
 *
 * Deliberately still. Autoplaying a row of videos on a homepage is the exact
 * thing the brief rules out, and it would fight the search field for attention
 * on the one screen where search must win. Cards show a cover frame and link
 * through: the moving version lives on Discover, which is what the link is for.
 */
export function HomeReelStrip({ reels }: { reels: FeaturedReel[] }) {
  // No published reels yet. Nothing is shown rather than a promise of content
  // that does not exist, or a pointer to a Discover page that is not live.
  if (reels.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-6 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-balance font-display text-2xl font-semibold text-ink sm:text-3xl">
            See what they&apos;re actually serving
          </h2>
          <p className="mt-2 max-w-md text-pretty text-[15px] leading-relaxed text-muted">
            Straight from the kitchens themselves.
          </p>
        </div>
        <Link href="/discover" className={ctaSecondarySm}>
          Browse more places
          <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Scrolls on a phone, fits on a desktop. No carousel chrome: a rail the
          thumb already knows how to use beats arrows nobody presses. */}
      <ul className="no-scrollbar rail-fade -mx-5 mt-6 flex gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0 sm:[mask-image:none]">
        {reels.map((reel) => (
          <li key={reel.id} className="shrink-0">
            <Link
              href={`/restaurant/${reel.slug}`}
              className="group relative block aspect-[9/16] w-[152px] overflow-hidden rounded-2xl bg-ink ring-1 ring-black/10 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg sm:w-[172px]"
            >
              {reel.coverUrl ? (
                <Image
                  src={reel.coverUrl}
                  unoptimized={skipOptimiser(reel.coverUrl)}
                  alt=""
                  fill
                  sizes="172px"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <video
                  src={reel.mediaUrl}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              )}

              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

              <span className="pointer-events-none absolute inset-x-2.5 bottom-2.5">
                <HalalBadge classification={reel.halal_classification} size="sm" variant="solid" />
                <span className="mt-1.5 block truncate font-display text-sm font-semibold text-white">
                  {reel.name}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
