import Link from 'next/link';
import clsx from 'clsx';
import {
  ArrowRightIcon,
  HalalFullMark,
  HalalPartialMark,
  HalalUnknownMark,
  InfoIcon,
} from '@/components/icons';
import { halalLabel } from '@/components/HalalBadge';
import { Reveal } from '@/components/Reveal';
import type { HalalStatus } from '@/lib/types';

// The three labels, as a key rather than a legend.
//
// They are not one scale, and a single list reads as one: rows from strongest
// to weakest quietly imply the bottom one sits somewhere near "no". They are
// two kinds of statement. Two labels say what the evidence shows. Unverified
// says it has not been confirmed yet, which is never a no (see the vault's
// "Never fabricate halal facts"). So they are grouped that way, and the second
// group carries its own warning in words rather than leaving it to a footnote.
//
// There were four until 2026-10-11. The fourth, Worth asking, was a place with
// no halal evidence at all; Shabir took those off the site that day.
//
// Definitions match /how-we-check word for word in meaning; that page is the
// long version, and the link to it closes the section.

type Row = { status: HalalStatus; Mark: typeof HalalFullMark; ink: string; body: string };

const SHOWN: Row[] = [
  { status: 'fully_halal', Mark: HalalFullMark, ink: 'text-halal-fullInk', body: 'Strong evidence that all the meat is halal.' },
  { status: 'halal_options', Mark: HalalPartialMark, ink: 'text-halal-partialInk', body: 'Halal food is available, but not everything is halal. Check before you order.' },
];

const OPEN: Row[] = [
  {
    status: 'unverified',
    Mark: HalalUnknownMark,
    ink: 'text-halal-unverifiedInk',
    body: "There are signs this place is halal, but we haven't checked. Ask before you order.",
  },
];

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="mt-2 divide-y divide-black/[0.07]">
      {rows.map(({ status, Mark, ink, body }) => (
        <div key={status} className="py-4">
          <dt className={clsx('flex items-center gap-3 font-display text-[18px] font-semibold', ink)}>
            <Mark className="h-8 w-8 shrink-0" />
            {halalLabel(status)}
          </dt>
          <dd className="mt-1 pl-11 text-[15px] leading-relaxed text-muted">{body}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LabelKey() {
  return (
    <section aria-labelledby="labels-title" className="bg-sand-soft">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-20">
        <Reveal>
          <h2
            id="labels-title"
            className="max-w-2xl text-balance font-display text-[1.8rem] font-semibold leading-[1.1] tracking-[-0.01em] text-ink sm:text-[2.4rem]"
          >
            A &ldquo;halal&rdquo; sign only tells you so much
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-muted sm:text-[17px]">
            It doesn&apos;t tell you who says so, or when. Every place here shows both, under one of three
            labels.
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:mt-10 lg:grid-cols-2 lg:gap-8">
          <Reveal>
            <h3 className="font-display text-lg font-semibold text-ink">What the evidence shows</h3>
            <Rows rows={SHOWN} />
          </Reveal>

          <Reveal delay={120} className="rounded-2xl bg-sand p-5 ring-1 ring-sand-line sm:p-6">
            <h3 className="font-display text-lg font-semibold text-ink">Not confirmed yet</h3>
            <Rows rows={OPEN} />
            <p className="mt-2 flex items-start gap-2.5 border-t border-black/[0.07] pt-4 text-[15px] font-semibold leading-relaxed text-ink">
              <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-spice-ink" aria-hidden="true" />
              <span>
                Unverified never means a place isn&apos;t halal.
              </span>
            </p>
            <p className="mt-1.5 pl-[1.875rem] text-sm leading-relaxed text-muted">
              We only list places with a sign of halal food. Places that say they don&apos;t serve it
              aren&apos;t listed at all.
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted">
            <span className="font-semibold text-ink">We haven&apos;t visited any of these places yet.</span>{' '}
            Every label comes from what a place publishes about itself, or from open data. A place we
            check ourselves carries a &ldquo;Checked by us&rdquo; badge.
          </p>
          <Link
            href="/how-we-check"
            className="group inline-flex min-h-[44px] shrink-0 items-center gap-1.5 text-sm font-semibold text-accent-ink underline decoration-accent-ink/30 underline-offset-4 transition hover:decoration-accent-ink"
          >
            How we label places, in detail
            <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
