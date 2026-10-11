// The YepItsHalal logo, chosen by Shabir on 2026-09-24 from five variations:
// "YEP ITS" set straight, YEP in white and ITS in lime, over a lime location
// pin that holds حلال in white, on a deep teal disc inside a white ring. It
// reads as one sentence, "Yep, it's halal", with the Arabic word as the pin.
//
// The files in /public/brand are traced from that artwork, not redrawn, so the
// lettering and the calligraphy are exactly as designed; only the ring was
// replaced by a true circle. Built by ~/.claude/tools/brand/trace-logo.mjs and
// build-logo.mjs.
//
// Three forms of it, each used where it can be read:
//
//  - LogoMark: the pin and حلال on the teal disc, no English, for 32 to 64px
//    (the header). The favicons (public/favicon*) are the same pin and word,
//    larger on the disc and without the white ring, at every size: the
//    Arabic-free pin reads as a "C" (2026-09-24).
//  - LogoLockup: the mark beside YEP ITS HALAL, for navigation. The logo
//    writes halal in Arabic; the lockup spells it out so the name reads.
//  - LogoBadge: the whole logo, from about 96px up (the footer, the support
//    card, social profiles, app icons).
//
// Still no tick, and no seal wording round the edge: a round حلال badge with
// either would read as a halal certification, and YepItsHalal certifies
// nothing (see /terms).

/* eslint-disable @next/next/no-img-element */

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/yepitshalal-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      className={className}
    />
  );
}

/** YEP ITS HALAL on its own. `tone` is the ground it sits on. */
export function LogoWordmark({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    // 711 by 90: the wordmark's own proportions.
    <img
      src={tone === 'dark' ? '/brand/yepitshalal-wordmark-on-dark.svg' : '/brand/yepitshalal-wordmark-on-light.svg'}
      alt="YepItsHalal"
      width={126}
      height={16}
      decoding="async"
      className={className}
    />
  );
}

/**
 * The mark and the wordmark. `tone` is the ground it sits on.
 *
 * Sized for the 56px header (2026-09-24, "ensure it's properly visible"): the
 * mark fills 40 of its 56px from 640px up, and the wordmark's capitals are set
 * to match the pin's head rather than sit small beside it.
 */
export function LogoLockup({
  tone = 'dark',
  wordmarkClassName = 'h-[15px] w-auto min-[380px]:h-4 sm:h-[19px]',
}: {
  tone?: 'dark' | 'light';
  /** The wordmark's height at each width, where a row has less room (the site header). */
  wordmarkClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 sm:gap-2.5">
      <LogoMark size={40} className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
      <LogoWordmark tone={tone} className={wordmarkClassName} />
    </span>
  );
}

/** The full logo, as a cached file. Use at 96px and up. */
export function LogoBadge({
  size = 120,
  className,
  decorative = false,
}: {
  size?: number;
  className?: string;
  /** Beside words that already say YepItsHalal. */
  decorative?: boolean;
}) {
  return (
    <img
      src="/brand/yepitshalal-logo.svg"
      alt={decorative ? '' : 'YepItsHalal'}
      width={size}
      height={size}
      decoding="async"
      className={className}
    />
  );
}
