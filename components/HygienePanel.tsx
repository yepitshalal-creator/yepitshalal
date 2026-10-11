import { ArrowUpRightIcon } from './icons';
import { HYGIENE_WORDS, fsaUrl, formatInspectionDate, unratedLine, type HygieneRecord } from '@/lib/hygiene/display';

// The food hygiene rating on a place page: the number, the FSA's words for it,
// when the council inspected, and a link to check it on the FSA's own site.
// With no record we say so plainly. Not known is never shown as a low score.

export function HygienePanel({ hygiene }: { hygiene: HygieneRecord | null }) {
  const rating = hygiene?.rating ?? null;
  const other = hygiene && rating === null ? unratedLine(hygiene.rating_label) : null;

  return (
    <section aria-labelledby="hygiene" className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 id="hygiene" className="font-display text-base font-semibold text-ink">
        Food hygiene
      </h2>

      {rating !== null ? (
        <div className="mt-3 flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink font-display text-2xl font-semibold text-white tabular-nums"
          >
            {rating}
          </span>
          <p className="text-sm leading-snug">
            <span className="block font-semibold text-ink">
              {rating} out of 5. {HYGIENE_WORDS[rating]}.
            </span>
            {hygiene?.rating_date && (
              <span className="block text-muted">
                Checked on {formatInspectionDate(hygiene.rating_date)}
                {hygiene.local_authority ? ` by ${hygiene.local_authority} council.` : '.'}
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted">{other ?? 'Not known yet. We have no rating for this place.'}</p>
      )}

      {hygiene?.new_rating_pending && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">A newer check is waiting to be published.</p>
      )}

      {hygiene && (
        <p className="mt-3 text-[13px] text-subtle">
          From the Food Standards Agency.{' '}
          <a
            href={fsaUrl(hygiene.fhrs_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-semibold text-accent-ink hover:underline"
          >
            See it on their site
            <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      )}
    </section>
  );
}
