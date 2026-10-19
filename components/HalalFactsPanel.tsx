import clsx from 'clsx';
import Link from 'next/link';
import { CheckIcon, WarningIcon, InfoIcon } from './icons';
import { CheckFreshness } from './CheckFreshness';
import { formatCheckedDate } from './HalalEvidencePanel';
import type { HalalEvidence, HalalFactsPublic, TriState } from '@/lib/types';

type Tone = 'good' | 'warn' | 'neutral';

function triLabel(value: TriState, yesLabel = 'Yes', noLabel = 'No'): string {
  if (value === true) return yesLabel;
  if (value === false) return noLabel;
  return 'Not known';
}

function toneFor(value: TriState, positiveWhenFalse: boolean): Tone {
  if (value === null) return 'neutral';
  const isGood = positiveWhenFalse ? value === false : value === true;
  return isGood ? 'good' : 'warn';
}

const TONE_CLASSES: Record<Tone, string> = {
  good: 'text-halal-fullInk',
  warn: 'text-halal-partialInk',
  neutral: 'text-subtle',
};

// Each answer carries a glyph as well as a colour: green-vs-amber alone is the
// exact pairing colour-blind readers lose. The 'warn' glyph is a warning sign
// rather than a cross, because these answers are already yes/no words: a cross
// beside the word 'Yes' reads as a contradiction, a warning sign reads as
// 'worth knowing', which is what an amber row actually means.
const TONE_ICON: Record<Tone, typeof CheckIcon> = {
  good: CheckIcon,
  warn: WarningIcon,
  neutral: InfoIcon,
};

function Row({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const Icon = TONE_ICON[tone];
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-ink/75">{label}</dt>
      <dd className={clsx('flex items-center gap-1.5 text-sm font-semibold', TONE_CLASSES[tone])}>
        <Icon className="h-4 w-4 shrink-0" />
        {value}
      </dd>
    </div>
  );
}

// Certification is the one answer here that is somebody else's to give: only
// HMC can say HMC certifies a place. So "Certified" needs a current
// 'certification' evidence row, which lib/admin/save-check.ts writes only for
// a check against the certifier's own list. When a restaurant told us on the
// phone, or showed us a certificate, the panel says that is what the
// restaurant says, as /how-we-check promises.
function certificationRow(said: TriState, listing: HalalEvidence | null): { value: string; tone: Tone } {
  if (said === true) return listing ? { value: 'Certified', tone: 'good' } : { value: 'They say so', tone: 'neutral' };
  return { value: triLabel(said, 'Certified', 'Not certified'), tone: toneFor(said, false) };
}

/** HMC and HFA disagree on stunning, and /how-we-check/hmc-and-hfa sets out
 *  each one's rules in its own words. Shown beside either name. */
function RulesLink({ name }: { name: string | null }) {
  if (!name || !/\bhmc\b|halal monitoring|\bhfa\b|halal food authority/i.test(name)) return null;
  return (
    <>
      {' '}
      <Link href="/how-we-check/hmc-and-hfa" className="font-medium text-accent-ink underline underline-offset-2">
        What HMC and HFA each allow
      </Link>
    </>
  );
}

function CertificationNote({ body, listing }: { body: string | null; listing: HalalEvidence | null }) {
  if (listing) {
    const list = `${listing.source_name}'s list`;
    return (
      <p className="mt-3 text-xs text-muted">
        Certified by {listing.source_name}. We checked{' '}
        {listing.source_url ? (
          <a
            href={listing.source_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-accent-ink underline underline-offset-2"
          >
            {list}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          list
        )}{' '}
        on <time dateTime={listing.checked_at}>{formatCheckedDate(listing.checked_at)}</time>.
        <RulesLink name={listing.source_name} />
      </p>
    );
  }
  return (
    <p className="mt-3 text-xs text-muted">
      {body
        ? `The restaurant says it is certified by ${body}. We have not checked ${body}'s list.`
        : 'The restaurant says it is certified. It did not tell us who by, so we have not checked.'}
      <RulesLink name={body} />
    </p>
  );
}

export function HalalFactsPanel({ facts, evidence }: { facts: HalalFactsPublic | null; evidence: HalalEvidence[] }) {
  const allMeatHalal = facts?.all_meat_halal ?? null;
  const halalFoodLabel =
    allMeatHalal === true ? 'All' : allMeatHalal === false ? 'Selected options' : 'Not known';
  const halalFoodTone: Tone =
    allMeatHalal === true ? 'good' : allMeatHalal === false ? 'warn' : 'neutral';
  const saysCertified = facts?.has_certification ?? null;
  const listing = saysCertified === true ? evidence.find((e) => e.kind === 'certification') ?? null : null;
  const certification = certificationRow(saysCertified, listing);

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-ink">Halal information</h2>
      <CheckFreshness facts={facts} />
      <dl className="mt-3">
        <Row label="Halal food" value={halalFoodLabel} tone={halalFoodTone} />
        <Row
          label="Alcohol"
          value={triLabel(facts?.serves_alcohol ?? null)}
          tone={toneFor(facts?.serves_alcohol ?? null, true)}
        />
        <Row
          label="Pork"
          value={triLabel(facts?.serves_pork ?? null)}
          tone={toneFor(facts?.serves_pork ?? null, true)}
        />
        <Row
          label="Non-halal meat"
          value={triLabel(facts?.serves_non_halal_meat ?? null)}
          tone={toneFor(facts?.serves_non_halal_meat ?? null, true)}
        />
        <Row label="Halal certification" value={certification.value} tone={certification.tone} />
      </dl>
      {saysCertified === true && <CertificationNote body={facts?.certification_body ?? null} listing={listing} />}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        We only show what we actually know. &ldquo;Not known&rdquo; doesn&apos;t mean
        &ldquo;no.&rdquo;
      </p>
    </div>
  );
}
