import clsx from 'clsx';
import { HYGIENE_WORDS } from '@/lib/hygiene/display';

// The FSA food hygiene rating, as a small grey pill beside the halal label.
// Grey on purpose: the halal label is what the site is for, and this is a
// second fact about the kitchen, so it never outshouts it. It only renders
// with a real 0 to 5 rating. No rating means nothing on the card, not a 0.

export function HygieneBadge({ rating, size = 'sm', className }: { rating?: number | null; size?: 'sm' | 'md'; className?: string }) {
  if (rating === null || rating === undefined) return null;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-black/[0.055] font-semibold text-ink/75',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className
      )}
      title={`Food hygiene rating ${rating}, ${HYGIENE_WORDS[rating]}. From the Food Standards Agency.`}
    >
      Food hygiene
      <span
        aria-hidden="true"
        className={clsx(
          'inline-flex items-center justify-center rounded-full bg-ink font-bold text-white tabular-nums',
          size === 'sm' ? 'h-4 w-4 text-[10px]' : 'h-5 w-5 text-[11px]'
        )}
      >
        {rating}
      </span>
      <span className="sr-only">{`${rating} out of 5`}</span>
    </span>
  );
}
