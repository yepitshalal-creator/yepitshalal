'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { skipOptimiser } from '@/lib/imageUrl';
import type { RestaurantPhoto } from '@/lib/types';

// The restaurant's own photos at the top of its page, one screen wide, to swipe
// through the way food apps do. The browser does the swiping (scroll snap), so
// it works with a thumb, a trackpad and a keyboard alike. The dots only follow
// along; they are buttons too, for anyone who cannot swipe.
//
// Only the restaurant's own pictures come here. A labelled example picture is a
// single image and stays in the page's own figure.

export function HeroPhotos({ photos, title, children }: { photos: RestaurantPhoto[]; title: string; children?: React.ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const go = (i: number) => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: 'smooth' });
  const credit = photos[active];

  return (
    <figure className="relative -mx-4 overflow-hidden bg-halal-unverifiedSoft sm:mx-0 sm:rounded-2xl">
      <div
        ref={strip}
        tabIndex={0}
        aria-label={`Photos of ${title}. Swipe to see more.`}
        className="flex aspect-[16/9] snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:aspect-[21/8] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, i) => (
          <div key={p.id} className="relative h-full w-full shrink-0 snap-center">
            <Image
              src={p.storage_path}
              alt={`${title}, photo ${i + 1} of ${photos.length}`}
              fill
              priority={i === 0}
              sizes="(max-width: 640px) 100vw, 896px"
              unoptimized={skipOptimiser(p.storage_path)}
              className={p.is_logo ? 'bg-white object-contain p-6' : 'object-cover'}
            />
          </div>
        ))}
      </div>

      {children}

      <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show photo ${i + 1} of ${photos.length}`}
            aria-current={i === active ? 'true' : undefined}
            className="flex h-6 w-4 items-center justify-center"
          >
            <span className={clsx('h-1.5 w-1.5 rounded-full shadow-[0_0_3px_rgba(0,0,0,0.4)]', i === active ? 'bg-white' : 'bg-white/55')} />
          </button>
        ))}
      </div>

      {/* Their picture, from their own website, credited to them. */}
      {credit?.source_site && (
        <figcaption className="absolute right-2 top-2 max-w-[60%] rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <a
            href={credit.source_url ?? `https://${credit.source_site}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="block truncate hover:underline"
          >
            {credit.is_logo ? 'Logo' : 'Photo'} from {credit.source_site}
          </a>
        </figcaption>
      )}
    </figure>
  );
}
