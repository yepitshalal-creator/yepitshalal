import clsx from 'clsx';
import { HalalFullMark, HalalNotCheckedMark, HalalPartialMark, HalalUnknownMark } from './icons';
import type { HalalStatus } from '@/lib/types';

// Two jobs, two shapes.
//
// `inline` is the default because it is what appears in lists, and in a list the
// status is a *reading* about one restaurant, not a bucket it belongs to. As a
// tinted pill it had the same visual weight as the cuisine tag beside it, so it
// scanned as another category chip. Mark plus word, no chip, reads as a status.
//
// `solid` keeps the filled pill for the two places that need to hold their own
// against a photograph or act as a page-level headline.
//
// The mark does the semantic work in both: filled / half-filled /
// dashed-and-empty / ring-with-a-bar survives greyscale and colour blindness, where three
// coloured dots did not.
const CONFIG: Record<
  HalalStatus,
  { label: string; hint: string; Mark: typeof HalalFullMark; text: string; bg: string; ring: string }
> = {
  fully_halal: {
    label: 'Fully Halal',
    hint: 'Everything on the menu',
    Mark: HalalFullMark,
    text: 'text-halal-fullInk',
    bg: 'bg-halal-fullSoft',
    ring: 'ring-halal-full/20',
  },
  halal_options: {
    label: 'Halal Options',
    hint: 'Some of the menu',
    Mark: HalalPartialMark,
    text: 'text-halal-partialInk',
    bg: 'bg-halal-partialSoft',
    ring: 'ring-halal-partial/20',
  },
  unverified: {
    label: 'Unverified',
    hint: 'Signs of halal, not confirmed',
    Mark: HalalUnknownMark,
    text: 'text-halal-unverifiedInk',
    bg: 'bg-halal-unverifiedSoft',
    ring: 'ring-halal-unverified/20',
  },
  // "Not checked yet" said what we had not done and left the obvious question
  // unanswered: then why am I looking at it? A place is here because the food
  // it serves is often halal in London, which is a reason to ask. Say that.
  unknown: {
    label: 'Worth asking',
    hint: 'The kind of place that often is',
    Mark: HalalNotCheckedMark,
    text: 'text-subtle',
    bg: 'bg-white',
    ring: 'ring-black/10',
  },
};

export function HalalBadge({
  classification,
  size = 'md',
  variant = 'inline',
}: {
  classification: HalalStatus;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'solid' | 'photo';
}) {
  const cfg = CONFIG[classification];
  const Mark = cfg.Mark;

  const markSize = size === 'lg' ? 'h-[18px] w-[18px]' : size === 'sm' ? 'h-4 w-4' : 'h-[17px] w-[17px]';
  const textSize = size === 'lg' ? 'text-sm' : size === 'sm' ? 'text-xs' : 'text-[13px]';

  if (variant === 'inline') {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 whitespace-nowrap font-semibold',
          cfg.text,
          textSize
        )}
      >
        <Mark className={clsx('shrink-0', markSize)} />
        {cfg.label}
      </span>
    );
  }

  const pad = size === 'lg' ? 'px-3 py-1.5 gap-2' : size === 'sm' ? 'px-2 py-0.5 gap-1.5' : 'px-2.5 py-1 gap-1.5';

  // On top of a photograph: plain white, so the mark and word read the same
  // over any food, light or dark.
  if (variant === 'photo') {
    return (
      <span
        className={clsx(
          'inline-flex items-center whitespace-nowrap rounded-full bg-white font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.18)]',
          classification === 'unknown' ? 'text-ink/70' : cfg.text,
          pad,
          textSize
        )}
      >
        <Mark className={clsx('shrink-0', markSize)} />
        {cfg.label}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-full font-semibold ring-1',
        cfg.bg,
        cfg.text,
        cfg.ring,
        pad,
        textSize
      )}
    >
      <Mark className={clsx('shrink-0', markSize)} />
      {cfg.label}
    </span>
  );
}

export function halalLabel(classification: HalalStatus): string {
  return CONFIG[classification].label;
}

export function halalHint(classification: HalalStatus): string {
  return CONFIG[classification].hint;
}
