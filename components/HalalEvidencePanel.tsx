import Link from 'next/link';
import { HalalBadge } from './HalalBadge';
import { StillRight } from './StillRight';
import { ArrowUpRightIcon, InfoIcon } from './icons';
import { foodKind } from '@/lib/whyListed';
import type { EvidenceStrength, HalalClassification, HalalEvidence } from '@/lib/types';

// The answer to "is this actually halal, and how do you know?", in the order a
// person asks it: what we say, why, who said it, and when.
//
// Nothing here makes a claim the evidence does not. The label comes from
// refresh_halal_status() in the database, and weak evidence can never produce
// more than Unverified.

export const LABEL_MEANING: Record<HalalClassification, string> = {
  // A place that serves alcohol is never Fully Halal (Shabir, 2026-10-24).
  fully_halal: 'Strong evidence that all the meat served here is halal, and no sign of alcohol.',
  halal_options: 'Halal food is available here, but not everything is halal, or alcohol is served.',
  unverified: "There are signs this place is halal, but we haven't checked.",
};

const STRENGTH: Record<EvidenceStrength, { label: string; explain: string }> = {
  strong: {
    label: 'Strong',
    explain: 'Certification, our own check, or the restaurant clearly saying all its meat is halal.',
  },
  moderate: {
    label: 'Moderate',
    explain: "The restaurant's own words, but not specific about everything it serves.",
  },
  weak: {
    label: 'Weak',
    explain: 'From someone other than the restaurant, or a name or tag. Treat it as a lead.',
  },
};

const KIND_LABEL: Record<string, string> = {
  yepitshalal_check: 'Our check',
  certification: 'Certification',
  first_party_statement: "Restaurant's own words",
  certification_claim: 'Restaurant says it is certified',
  business_name: 'Business name',
  community_tag: 'OpenStreetMap',
  directory_category: 'Public place data',
  owner_submission: 'Sent to us by the owner',
  public_submission: 'Sent to us by a customer',
};

export function formatCheckedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EvidenceItem({ e, lead = false }: { e: HalalEvidence; lead?: boolean }) {
  return (
    <div className={lead ? '' : 'border-t border-line pt-3'}>
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
        {e.source_name === "The chain's website" ? "The chain's own words" : KIND_LABEL[e.kind] ?? 'Evidence'}
      </p>
      {e.excerpt && (
        <blockquote className="mt-1.5 border-l-2 border-accent/40 pl-3 text-sm italic leading-relaxed text-ink/80">
          &ldquo;{e.excerpt}&rdquo;
        </blockquote>
      )}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-subtle">Source</dt>
        <dd className="min-w-0 text-ink/80">
          {e.source_url ? (
            <a
              href={e.source_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline"
            >
              <span className="truncate">{e.source_name}</span>
              <ArrowUpRightIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            e.source_name
          )}
        </dd>
        <dt className="text-subtle">Checked</dt>
        <dd className="text-ink/80">
          <time dateTime={e.checked_at}>{formatCheckedDate(e.checked_at)}</time>
          {e.notes && e.kind === 'yepitshalal_check' && <span className="text-subtle"> · {e.notes}</span>}
        </dd>
        <dt className="text-subtle">Strength</dt>
        <dd className="text-ink/80">{STRENGTH[e.strength].label}</dd>
      </dl>
    </div>
  );
}

export function HalalEvidencePanel({
  classification,
  strength,
  summary,
  evidence,
  isListed,
  isSearchable = false,
  cuisine = null,
  slug,
  name,
  checkedByUs = false,
  title,
}: {
  classification: HalalClassification;
  strength: EvidenceStrength | null;
  summary: string | null;
  evidence: HalalEvidence[];
  isListed: boolean;
  /** In search as a place nobody has checked: shown as Worth asking. */
  isSearchable?: boolean;
  cuisine?: string | null;
  slug: string;
  /** Used in the heading, because "Is X halal?" is what people searched for. */
  name: string;
  /** Somebody from YepItsHalal went, rang, or read the certificate. */
  checkedByUs?: boolean;
  /** The panel's heading. On an "Is it halal?" page the question is already the page's own heading. */
  title?: string;
}) {
  const heading = title ?? `Is ${name} halal?`;
  if (!isListed && isSearchable && !strength) {
    return (
      <section aria-labelledby="halal-status" className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="halal-status" className="text-balance font-display text-lg font-semibold text-ink">
            {heading}
          </h2>
          <HalalBadge classification="unknown" size="md" variant="solid" />
        </div>
        {/* The reason first, the gap second. Opening with what we hadn't done
            read as "we know nothing about this place", when there is a plain
            reason it is here and the reader deserves to have it first. */}
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {cuisine
            ? `It serves ${foodKind(cuisine)}, which is often halal in London. That is why it's here.`
            : "Its name suggests food that is often served halal in London. That is why it's here."}{' '}
          It is a reason to ask, not an answer.
        </p>
        <div className="mt-4 rounded-xl bg-sand p-4 text-sm leading-relaxed text-ink/80">
          <h3 className="font-semibold text-ink">What we don&apos;t know</h3>
          <p className="mt-1">
            Nobody from YepItsHalal has been here, and we haven&apos;t found anything this place or
            anyone else has said about its meat. Check with the restaurant before you order.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link href={`/submit-restaurant?update=${slug}`} className="font-semibold text-accent-ink hover:underline">
            Know if it&apos;s halal? Tell us
          </Link>
          <Link href={`/restaurant/${slug}/verify`} className="font-semibold text-accent-ink hover:underline">
            Ask us to check it
          </Link>
          <Link href="/how-we-check" className="font-medium text-muted hover:text-ink hover:underline">
            How we label places
          </Link>
        </div>
      </section>
    );
  }

  if (!isListed || !strength) {
    return (
      <section aria-labelledby="halal-status" className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 id="halal-status" className="text-balance font-display text-lg font-semibold text-ink">
          {heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {summary ??
            "We don't have any evidence that this place serves halal food, so it isn't shown in search. That doesn't mean it isn't halal. It means we can't tell you either way."}
        </p>
        <p className="mt-3 text-sm">
          <Link href={`/submit-restaurant?update=${slug}`} className="font-semibold text-accent-ink hover:underline">
            Know it serves halal food? Tell us
          </Link>
        </p>
      </section>
    );
  }

  const positive = evidence.filter((e) => e.claim !== 'not_halal');
  const [lead, ...rest] = positive;
  // When the newest piece of evidence was read, up by the label, so nobody has
  // to open the evidence to see how fresh it is.
  const lastChecked = positive.reduce<string | null>((max, e) => (!max || e.checked_at > max ? e.checked_at : max), null);

  return (
    <section aria-labelledby="halal-status" className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="halal-status" className="text-balance font-display text-lg font-semibold text-ink">
          {heading}
        </h2>
        <HalalBadge classification={classification} size="md" variant="solid" />
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{LABEL_MEANING[classification]}</p>
      {lastChecked && (
        <p className="mt-1 text-xs text-subtle">
          Evidence last checked <time dateTime={lastChecked}>{formatCheckedDate(lastChecked)}</time>
        </p>
      )}

      <div className="mt-4 rounded-xl bg-sand p-4">
        <h3 className="text-sm font-semibold text-ink">Why we say this</h3>
        {summary && <p className="mt-1 text-sm text-ink/80">{summary}.</p>}
        {lead && (
          <div className="mt-3">
            <EvidenceItem e={lead} lead />
          </div>
        )}
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
        <span>
          <span className="font-semibold text-ink/80">{STRENGTH[strength].label} evidence.</span>{' '}
          {STRENGTH[strength].explain}
          {classification === 'unverified' && ' Unverified never means not halal.'}
        </span>
      </p>

      {/* The thing a reader is most likely to assume, said plainly. Everything
          above comes from what this restaurant publishes or what open data
          records; none of it is a visit. */}
      {!checkedByUs && (
        <p className="mt-3 rounded-xl bg-sand px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-ink/80">Nobody from YepItsHalal has been here.</span>{' '}
          We have not visited, phoned or seen a certificate for this place. When we do, this page
          says so and the listing carries our badge.
        </p>
      )}

      {rest.length > 0 && (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-accent-ink hover:underline">
            {rest.length === 1 ? '1 more piece of evidence' : `${rest.length} more pieces of evidence`}
          </summary>
          <div className="mt-3 space-y-3">
            {rest.map((e) => (
              <EvidenceItem key={e.id} e={e} />
            ))}
          </div>
        </details>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <StillRight slug={slug} />
        <p className="mt-3 text-xs text-muted">
          <Link href="/how-we-check" className="font-medium text-accent-ink hover:underline">
            How we label places
          </Link>
        </p>
      </div>
    </section>
  );
}
