import type { Metadata } from 'next';
import Link from 'next/link';
import { HalalBadge } from '@/components/HalalBadge';
import { PageHero } from '@/components/PageHero';
import { OnThisPage, PageBody, PageSection } from '@/components/PageLayout';
import { Reveal } from '@/components/Reveal';
import { blockTitle, bodyText, inlineLink, noteWarm, panel } from '@/components/prose';
import { ctaGhost, ctaSecondary } from '@/components/cta';
import { ArrowRightIcon } from '@/components/icons';
import { EVIDENCE } from '@/lib/media';

export const metadata: Metadata = {
  title: 'How we label halal places',
  description:
    'What Fully Halal, Halal food available and Unverified mean on YepItsHalal, where the evidence comes from, and what we do not know.',
  alternates: { canonical: '/how-we-check' },
};

const LABELS = [
  {
    classification: 'fully_halal' as const,
    needs: 'Strong evidence that all the meat served is halal.',
    examples: 'Halal certification we have confirmed, our own check, or the restaurant clearly saying all its meat is halal with nothing on its site suggesting otherwise.',
  },
  {
    classification: 'halal_options' as const,
    needs: 'Halal food is available, but not everything is halal. Check before you order.',
    examples: 'The restaurant says it has halal options or a halal menu, or its site mentions halal food alongside pork or non-halal meat.',
  },
  {
    classification: 'unverified' as const,
    needs: "There are signs this place is halal, but we haven't checked. Ask before you order.",
    examples: 'A mention of halal on its website, "halal" in its name, a community tag on OpenStreetMap, or a halal category in public place data.',
  },
];

const SOURCES = [
  ["The restaurant's own website", 'We read what restaurants publish about themselves and quote it, with a link and the date we read it.'],
  ['Certification', 'Only shown as certification when it has been confirmed with the certifier. A restaurant saying it is certified is shown as exactly that.'],
  ['Our own checks', 'When we have checked a place ourselves, the page says how and when.'],
  ['OpenStreetMap', 'Community mappers sometimes tag places as halal. Useful, but it counts as weak evidence.'],
  ['Public place data', 'Datasets from the Overture Maps Foundation sometimes categorise places as halal. Also weak evidence.'],
  ['People who tell us', 'Owners and customers can send us details. We review every submission, and a listing that rests on one alone stays Unverified until something stronger arrives.'],
];

const CONTENTS = [
  { id: 'labels', label: 'What each label means' },
  { id: 'evidence', label: 'Where the evidence comes from' },
  { id: 'photos', label: 'Photos' },
  { id: 'pray', label: 'Somewhere to pray' },
  { id: 'limits', label: "What a label can't tell you" },
];

export default function HowWeCheckPage() {
  return (
    <>
      <PageHero
        title="How we label halal places"
        lede={
          <>
            Every place tells you what we know, how we know it, and when it was checked. If we
            don&apos;t know something, we say so.
          </>
        }
        art={EVIDENCE}
      />

      <PageBody aside={<OnThisPage items={CONTENTS} />} asideOnPhone="hide">
        {/* The single most important thing a visitor could misunderstand, at the
            top of the page that exists to prevent that misunderstanding. Not
            revealed on scroll: it is on screen when the page opens. */}
        <section aria-labelledby="not-visited" className={noteWarm}>
          <h2 id="not-visited" className={blockTitle}>
            We haven&apos;t visited any of these restaurants yet
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
            Everything on this site so far comes from what restaurants publish about themselves and
            from open data: their own websites, OpenStreetMap, and the Food Standards Agency&apos;s
            hygiene register. Nobody from YepItsHalal has walked into a kitchen, rung a manager or
            read a certificate. We are starting with what can be gathered honestly at scale, and
            saying exactly where it came from.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
            When that changes for a place, you will see it. A listing we have checked ourselves
            carries a <span className="font-semibold text-accent-ink">Checked by us</span> badge in
            search results and on its page, with the date and what we did. No badge means no visit,
            however confident the label above it looks.
          </p>
        </section>

        <PageSection id="labels" title="What each label means">
          <dl className={`${panel} divide-y divide-line overflow-hidden`}>
            {LABELS.map(({ classification, needs, examples }) => (
              <div key={classification} className="px-5 py-4 sm:px-6">
                <dt>
                  <HalalBadge classification={classification} size="md" />
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed">
                  <p className="font-medium text-ink">{needs}</p>
                  <p className="mt-1 text-muted">{examples}</p>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Unverified never means a place isn&apos;t halal. We only show places with a sign of halal
            food. When a restaurant, or a person who mapped it, says it doesn&apos;t serve halal food,
            we don&apos;t show it at all.
          </p>
        </PageSection>

        <PageSection id="evidence" title="Where the evidence comes from">
          {/* Six sources, one list. A box around each one said "six separate
              things"; they are one question answered six ways. */}
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {SOURCES.map(([title, body]) => (
              <li key={title} className="border-t border-line py-4">
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </PageSection>

        <PageSection id="photos" title="Photos">
          <p className={bodyText}>
            When a restaurant hasn&apos;t sent us its own photos, we show a picture of the kind of food it
            serves, marked as an example. It is never the restaurant&apos;s own dish. Who took each one,
            and its licence, is on the{' '}
            <Link href="/image-credits" className={inlineLink}>
              image credits
            </Link>{' '}
            page.
          </p>
        </PageSection>

        {/* Two different questions, kept apart here as they are everywhere else:
            one of them is about meat, the other is about a room. */}
        <PageSection id="pray" title="Somewhere to pray">
          <div className="space-y-3">
            <p className={bodyText}>
              Mosques and prayer spaces come from OpenStreetMap, the same open source as much of the
              restaurant data, and none of it touches a halal label: a mosque being near a restaurant
              says nothing about that restaurant&apos;s food. Hardly any of them carry opening times, a
              mosque listed as open may still be locked, and the doors being open is not the same as
              jamaat, so ring ahead for a particular prayer.{' '}
              <Link href="/prayer-spaces" className={inlineLink}>
                All prayer spaces
              </Link>
            </p>
            <p className={bodyText}>
              Whether a restaurant has somewhere to pray inside comes from the people who go, through
              the same form as everything else. It shows who told us and when, and it is never
              confirmed by us unless the page says so. Nobody having told us is shown as exactly that,
              never as a no.
            </p>
          </div>
        </PageSection>

        <PageSection id="limits" title={<>What a label can&apos;t tell you</>}>
          <div className="space-y-3">
            <p className={bodyText}>
              Standards differ. Some people only eat hand-slaughtered meat, some avoid places that
              serve alcohol, and restaurants change suppliers. A label is a starting point built from
              the evidence we can see. The kitchen is the only one who can tell you for certain, so
              ask them.
            </p>
            <p className={bodyText}>
              Restaurant locations and details come from the Food Standards Agency food hygiene
              register (Open Government Licence), OpenStreetMap contributors (ODbL) and the Overture
              Maps Foundation.
            </p>
          </div>
        </PageSection>

        <Reveal
          as="section"
          aria-label="Tell us"
          className="border-t border-line pt-8"
        >
          <p className="text-[15px] font-medium text-ink">Spotted something wrong, or run a restaurant?</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href="/corrections" className={ctaSecondary}>
              Tell us what&apos;s wrong
            </Link>
            <Link href="/submit-restaurant" className={`${ctaGhost} group`}>
              Add a restaurant
              <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </PageBody>
    </>
  );
}
