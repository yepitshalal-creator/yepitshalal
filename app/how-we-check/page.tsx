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
    'What Fully Halal, Halal Options, Unverified and Worth asking mean on YepItsHalal. Where our facts come from, and what we do not know.',
  alternates: { canonical: '/how-we-check' },
};

const LABELS = [
  {
    classification: 'fully_halal' as const,
    needs: 'Strong evidence that all the meat is halal.',
    examples: 'A halal certificate we checked with the people who gave it. Or our own visit. Or the restaurant saying plainly that all its meat is halal, with nothing on its site to suggest otherwise.',
  },
  {
    classification: 'halal_options' as const,
    needs: 'They serve halal food. They also serve food that is not halal. That can include pork or alcohol.',
    examples: 'The restaurant says it has halal options or a halal menu. Or its site mentions halal food next to pork, or next to meat that is not halal.',
  },
  {
    classification: 'unverified' as const,
    needs: 'There are signs of halal food. Not enough to say more.',
    examples: 'The word halal on its website. Or "halal" in its name. Or a tag from someone who mapped it on OpenStreetMap. Or a halal tag in open place data.',
  },
  {
    classification: 'unknown' as const,
    needs: 'They serve a kind of food that is often halal in London. Nobody has checked.',
    examples: 'A kebab shop. A Pakistani grill. A peri peri chicken shop. That is why the place is here at all. It is a reason to ask, not an answer. Places that say they are not halal are never shown.',
  },
];

const SOURCES = [
  ["The restaurant's own website", 'We read what a restaurant says about itself, then quote it. With a link, and the date we read it.'],
  ['Halal certificates', 'We only call it a certificate once we have checked it with the people who gave it. If a restaurant says it is certified, we show that as exactly what it is: the restaurant saying so.'],
  ['Our own checks', 'When we have been to a place ourselves, the page says how and when.'],
  ['OpenStreetMap', 'People who map places sometimes tag one as halal. That helps, but it counts as weak evidence.'],
  ['Open place data', 'Data sets from the Overture Maps Foundation sometimes list a place as halal. Also weak evidence.'],
  ['People who tell us', 'Owners and customers can send us details. We read every one. A listing built on one message alone stays Unverified. It stays that way until something stronger arrives.'],
];

const CONTENTS = [
  { id: 'labels', label: 'What each label means' },
  { id: 'evidence', label: 'Where our facts come from' },
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
            Every place tells you what we know, how we know it, and when we checked. If we
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
            Everything here comes from two places. What restaurants say about themselves on their
            own websites. And open data: OpenStreetMap, and the Food Standards Agency&apos;s hygiene
            register. Nobody from YepItsHalal has walked into a kitchen, rung a manager or read a
            certificate. We started with what we can gather honestly at scale, and we say exactly
            where each fact came from.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
            When that changes for a place, you will see it. A place we have checked ourselves gets a{' '}
            <span className="font-semibold text-accent-ink">Checked by us</span> badge, in search and
            on its page, with the date and what we did. No badge means no visit, however sure the
            label above it looks.
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
            Unverified and Worth asking never mean a place isn&apos;t halal. If a restaurant says it
            doesn&apos;t serve halal food, or someone who mapped it says so, we don&apos;t show it at
            all.
          </p>
        </PageSection>

        <PageSection id="evidence" title="Where our facts come from">
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
            When a restaurant hasn&apos;t sent us its own photos, we show a picture of the kind of
            food it serves, marked as an example. It is never that restaurant&apos;s own dish. Who
            took each photo, and its licence, is on the{' '}
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
              restaurant data. None of it touches a halal label. A mosque being near a restaurant
              says nothing about that restaurant&apos;s food. Hardly any of them carry opening times,
              a mosque listed as open may still be locked, and open doors are not the same as jamaat.
              So ring ahead for a particular prayer.{' '}
              <Link href="/prayer-spaces" className={inlineLink}>
                All prayer spaces
              </Link>
            </p>
            <p className={bodyText}>
              Whether a restaurant has somewhere to pray inside comes from the people who go.
              They tell us through the same form as everything else. It shows who told us and when. We have not
              confirmed it unless the page says so. If nobody has told us, we show exactly that.
              Never a no.
            </p>
          </div>
        </PageSection>

        <PageSection id="limits" title={<>What a label can&apos;t tell you</>}>
          <div className="space-y-3">
            <p className={bodyText}>
              Standards differ. Some people only eat hand-slaughtered meat. Some avoid places that
              serve alcohol. And restaurants change where they buy their meat. A label is a starting
              point, built from what we can see. Only the kitchen can tell you for certain, so ask
              them.
            </p>
            <p className={bodyText}>
              Restaurant names, places and details come from three open sources. The Food Standards
              Agency food hygiene register (Open Government Licence). OpenStreetMap contributors (ODbL). And the Overture
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
