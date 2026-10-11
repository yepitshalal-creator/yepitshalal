'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { ForkKnifeIcon } from './icons';
import { isBusinessLogo } from '@/lib/types';
import { isOwnStorage, isUnsplash, thumbUrl, unsplashSized } from '@/lib/imageUrl';

// Every picture on this site is one of three things: the restaurant's own photo,
// the restaurant's own logo taken from its website, or a labelled example of
// the kind of food it serves. All three come from somewhere we do not control,
// and any of them can hand back something a browser cannot decode. The default
// result is the broken-image glyph in the middle of a card, which looks like
// the site is broken rather than one file, so a failure falls back to a plain
// tinted tile instead.
//
// A picture we store is served at the size it is shown and never sent through
// the image optimiser: see lib/imageUrl.ts for why that matters.
//
// A logo is never cropped to fill. Cropping a wordmark to a square makes it
// read as a photograph of the food, which it is not.

export function CoverImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
  /** Set on a small, list-sized box: uses the stored thumbnail. */
  thumb = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  thumb?: boolean;
}) {
  // A phone on a patchy connection drops image requests all the time, and a
  // card that gave up on the first drop stays a grey tile for the rest of the
  // session. One retry costs nothing and recovers most of them.
  const [attempt, setAttempt] = useState(0);
  const failed = attempt > 1;
  // A picture still on its way when the card appears fades in once it has
  // arrived, rather than snapping on (.image-enter in globals.css). Decided in
  // the browser after mount, so the server's HTML never hides a picture: one
  // marked priority, or one the browser already has, shows at once.
  const [waiting, setWaiting] = useState(false);
  const [arrived, setArrived] = useState(false);
  const watch = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && !priority && !img.complete) setWaiting(true);
    },
    [priority]
  );
  const logo = isBusinessLogo(src);
  const ours = isOwnStorage(src);
  const unsplash = isUnsplash(src);
  // Ours: the stored copy at the right size. Unsplash: sized by Unsplash's own
  // CDN. Neither goes near the image optimiser.
  const chosen = ours
    ? thumb
      ? thumbUrl(src)
      : src
    : unsplash
      ? unsplashSized(src, thumb ? 480 : 960, thumb ? 360 : 720)
      : src;

  if (failed) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-halal-unverifiedSoft" aria-hidden="true">
        <ForkKnifeIcon className="h-1/3 w-1/3 text-subtle/50" />
      </span>
    );
  }

  return (
    <Image
      key={attempt}
      src={attempt === 0 ? chosen : `${chosen}${chosen.includes('?') ? '&' : '?'}retry=1`}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={ours || unsplash}
      ref={watch}
      onLoad={() => setArrived(true)}
      onError={() => setAttempt((n) => n + 1)}
      className={clsx(
        logo ? 'bg-white object-contain p-2' : 'object-cover',
        waiting && (arrived ? 'image-enter' : 'opacity-0'),
        className
      )}
    />
  );
}
