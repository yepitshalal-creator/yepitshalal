import clsx from 'clsx';
import { HYGIENE_WORDS } from '@/lib/hygiene/display';

// The FSA food hygiene rating, as a few quiet grey words beside the halal
// label: "Food hygiene 5/5". No pill and no dark number since 2026-10-11
// (Shabir: "make the food hygiene rating way more subtle"). The halal label is
// what the site is for; this is a second fact about the kitchen and should be
// found by someone looking for it, not noticed first. It only renders with a
// real 0 to 5 rating. No rating means nothing on the card, not a 0.

export function HygieneBadge({ rating, size = 'sm', className }: { rating?: number | null; size?: 'sm' | 'md'; className?: string }) {
  if (rating === null || rating === undefined) return null;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap font-medium text-subtle',
        size === 'sm' ? 'text-[11.5px]' : 'text-[13px]',
        className
      )}
      title={`Food hygiene rating ${rating}, ${HYGIENE_WORDS[rating]}. From the Food Standards Agency.`}
    >
      Food hygiene
      <span aria-hidden="true" className="tabular-nums text-ink/70">
        {rating}/5
      </span>
      <span className="sr-only">{`${rating} out of 5`}</span>
    </span>
  );
}
