import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { PageBody } from '@/components/PageLayout';
import { CheckIcon } from '@/components/icons';
import { inlineLink, noteWarm, panel, sectionTitle } from '@/components/prose';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms',
  description:
    'The terms you agree to by using YepItsHalal: what we promise, what we do not, and how supporting us works.',
  alternates: { canonical: '/terms' },
};

/**
 * Two things here are load bearing and should not be softened without thinking
 * about why they are worded this way.
 *
 * 1. The halal disclaimer. It has to be prominent and honest, because the whole
 *    site rests on people trusting a label. Overclaiming here would undo the
 *    care taken everywhere else, and underclaiming would make the site useless.
 *
 * 2. The supporter section. Yep+ unlocks nothing, and promising in the terms
 *    that finding halal food never goes behind a paywall is what keeps it from
 *    being sold as access. The wording is Shabir's, framed as a promise about
 *    what stays free rather than a shrug about what Yep+ lacks. If Yep+ ever
 *    does unlock something, this is one of the places that has to change.
 *
 * Still to add once ICO registration settles the entity: the registered name,
 * trading address and company number, if there is one.
 */

const SHORT_VERSION = [
  'Searching and reading is free, signed in or not. Please do not copy the whole site or resell our data.',
  'Our label is a starting point, not a halal certificate. Always ask the restaurant. That one matters most, so it has its own note below.',
  'We never make up a halal fact. If we do not know, we say we do not know.',
  'Yep+ is support, not access. Finding halal food never goes behind a paywall.',
  'Paying for a priority check buys a faster look, never a particular answer.',
  'Tell us a label is wrong and we take it down while we check.',
];

export default function TermsPage() {
  return (
    <>
      <PageHero tone="sand" title="Terms" lede="The rules for using YepItsHalal. We have kept them in plain English, because terms nobody can read are not really terms." />
      <PageBody>
      <div>

      {/* The short version first, then the halal warning keeps its own warm
          surface right under it. Two surfaces on purpose: the second one is a
          warning a reader must not miss, which is what a surface is for. The
          summary has to stay true to the sections below it, so change one and
          check the other. */}
      <div className={`${panel} mb-4 p-5 sm:p-6`}>
        <h2 className="font-display text-lg font-semibold text-ink">The short version</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink/80">
          {SHORT_VERSION.map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <CheckIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent-ink" strokeWidth={2} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-subtle">
          That is the deal, in plain words. Below is the same thing in full, in the longer
          words these pages usually come in. Help yourself.
        </p>
      </div>

      <div className={noteWarm}>
        <h2 className="font-display text-lg font-semibold text-ink">
          The most important thing on this page
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          YepItsHalal tells you what we have found out about a restaurant. It is not a halal
          certificate, and we are not a certifying body. We can be wrong. Sources go out of
          date. And a kitchen can change where it buys its meat the day after we check.
          <span className="font-semibold text-ink">
            {' '}
            Ask the restaurant.
          </span>{' '}
          Our label is a starting point for that question, not a substitute for it.
        </p>
      </div>

      <h2 className={`mt-12 ${sectionTitle}`}>Using the site</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Search, browse and read as much as you like, signed in or not, for free. You may not
        copy the site wholesale, resell the data, or use it to build a rival directory. Some of
        what we show comes from open data with its own licence terms. Those are credited on{' '}
        <Link href="/how-we-check" className={inlineLink}>
          how we check
        </Link>{' '}
        and{' '}
        <Link href="/image-credits" className={inlineLink}>
          image credits
        </Link>
        .
      </p>

      <h2 className={`mt-12 ${sectionTitle}`}>
        What we promise about halal information
      </h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        <li>We never invent a halal fact. If we do not know, the page says we do not know.</li>
        <li>
          Unverified and Worth asking mean we have not checked. Neither means a place is not
          halal.
        </li>
        <li>Every label says where the evidence came from and when we last looked.</li>
        <li>
          If you tell us a label is wrong, we take it down while we check. See{' '}
          <Link
            href="/corrections"
            className={inlineLink}
          >
            corrections
          </Link>
          .
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        What we cannot promise is that a restaurant has not changed since we looked, or
        that a restaurant told us the truth.
      </p>

      <h2 className={`mt-12 ${sectionTitle}`}>
        If you add something
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        A person reads every form, every bit of feedback and every photo before anything
        goes live. Send only things that are true, and that are yours to send. When you upload a
        photo, you tell us you have the right to it, and you let us show it on the listing. We
        can take anything down, and we will take down anything we find is wrong.
      </p>

      <h2 className={`mt-12 ${sectionTitle}`}>Supporting us</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Yep+ is support, not access.{' '}
        <span className="font-medium text-ink">
          We don&apos;t put finding halal food behind a paywall, and we never will
        </span>
        . Not the listings, not the labels, not how far you can look. Here is what you get. We
        donate a meal every month through ShareTheMeal. A vote on the area we check next. A
        supporter badge. Early access to new things. And no sponsored messages.
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        <li>It renews monthly or yearly until you cancel, at the price shown when you join.</li>
        <li>
          You can cancel any time from your account, in a couple of clicks. You keep the
          perks until the time you have paid for runs out.
        </li>
        <li>
          The meal donation is us giving to ShareTheMeal. We are not partnered with, or
          endorsed by, ShareTheMeal or the World Food Programme.
        </li>
        <li>
          Payments are handled by Stripe. We never see your card.
        </li>
      </ul>

      <h2 className={`mt-12 ${sectionTitle}`}>
        Priority verification
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Paying for a priority verification buys a place at the front of the queue, and a quick,
        careful check.{' '}
        <span className="font-medium text-ink">It does not buy a particular answer.</span>{' '}
        If we check and cannot confirm a place is halal, the page will say so. We do not refund
        the fee for that. But if we miss the time we promised, and it is our fault, you can have
        your money back.
      </p>

      <h2 className={`mt-12 ${sectionTitle}`}>Where we stand</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        We are in Beta and we say so on the site. Things break, coverage is uneven, and
        London is the only city so far. We are not responsible for a decision you make about
        where to eat. Some things the law will not let us sign away, though, and harm caused
        by our own negligence is one of them. Nothing here changes your rights as a consumer.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        These terms follow the law of England and Wales. The courts of England and Wales
        settle any dispute.
      </p>

      <h2 className={`mt-12 ${sectionTitle}`}>Reaching us</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={inlineLink}
        >
          {CONTACT_EMAIL}
        </a>
        . For how we handle your data, see{' '}
        <Link href="/privacy" className={inlineLink}>
          privacy
        </Link>
        .
      </p>

      <p className="mt-10 border-t border-line pt-6 text-xs text-subtle">
        Last updated 21 September 2026.
      </p>
      </div>
      </PageBody>
    </>
  );
}
