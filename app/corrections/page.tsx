import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { CORRECTIONS_EMAIL } from '@/lib/site';
import { PageHero } from '@/components/PageHero';
import { TAKEAWAY_WINDOW } from '@/lib/media';
import { PageBody, PageSection } from '@/components/PageLayout';
import { Reveal } from '@/components/Reveal';
import { MailIcon } from '@/components/icons';
import { blockTitle, bodyText, inlineLink, panel } from '@/components/prose';

export const metadata: Metadata = {
  title: 'Something wrong? Tell us',
  description:
    'How to correct a halal label, a detail, or a photo on YepItsHalal, and what we promise to do about it.',
  alternates: { canonical: '/corrections' },
};

/**
 * This page exists for two reasons that point the same way.
 *
 * The product reason: a directory that publishes what it does not know has to
 * make it easy to be told it is wrong, or the honesty is decoration.
 *
 * The legal reason: publishing something false about a named business that
 * costs it custom is defamation or malicious falsehood. A published, promptly
 * honoured correction route is the cheapest protection available, and the
 * absence of one is what turns a mistake into a claim. Do not remove it, and
 * do not let the response times here become untrue.
 *
 * Corrections are support work, so the address is help@ (lib/site INBOX).
 */

const STEPS: [string, string][] = [
  [
    'Tell us what is wrong',
    'Email us with the restaurant name and what we have got wrong. A link to the page helps. You do not need to prove anything to start this off, and you do not need to be the owner.',
  ],
  [
    'We take it seriously the same day',
    'If the complaint is that we have called a place halal when it is not, or implied it is not when it is, we remove the label first and work it out afterwards. Nobody should eat something because of a mistake of ours while we deliberate.',
  ],
  [
    'We check it properly',
    'Against the restaurant itself wherever possible, using the same method as everything else on the site.',
  ],
  [
    'We tell you what we did',
    'Within five working days, whether we changed it or not, and why. If we were wrong, the page says when it was corrected.',
  ],
];

/** The address, printed as well as linked: mailto does nothing without a mail app. */
function EmailCard({ className }: { className?: string }) {
  return (
    <div className={clsx(panel, 'p-5 sm:p-6', className)}>
      <h2 className={blockTitle}>Email us</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">One address, read by a person.</p>
      <a
        href={`mailto:${CORRECTIONS_EMAIL}?subject=Correction`}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 break-all font-display text-lg font-semibold text-accent-ink underline decoration-accent-ink/30 underline-offset-4 transition hover:decoration-accent-ink"
      >
        <MailIcon className="h-5 w-5 shrink-0" />
        {CORRECTIONS_EMAIL}
      </a>
    </div>
  );
}

export default function CorrectionsPage() {
  return (
    <>
      <PageHero
        title="Something wrong? Tell us"
        art={TAKEAWAY_WINDOW}
        lede="We publish what we know and say when we have not checked. That only works if it is easy to tell us we have got something wrong, so this is the page for it."
      />

      <PageBody aside={<EmailCard />} asideOnPhone="hide">
        <div className="space-y-4">
          <section
            aria-labelledby="label-down"
            className="rounded-2xl bg-halal-fullSoft p-5 ring-1 ring-halal-full/20 sm:p-6"
          >
            <h2 id="label-down" className={blockTitle}>
              If we have the halal status wrong, we take the label down first
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              We do not leave a disputed halal label up while we investigate. It comes down,
              the page says it is being checked, and it only goes back up when we are sure.
              You do not need to send evidence to get that far.
            </p>
          </section>
          {/* On a phone the address comes straight after the promise. */}
          <EmailCard className="lg:hidden" />
        </div>

        <PageSection id="next" title="What happens next">
          {/* A real sequence, so it is numbered; the step itself is the label. */}
          <ol className="space-y-5">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-semibold tabular-nums text-accent-ink"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </PageSection>

        <PageSection id="remove" title="If you would rather not be listed at all">
          <p className={bodyText}>
            Say so and we will remove the listing. We will ask you to confirm you speak for
            the restaurant, because otherwise anyone could remove anyone. We will not argue
            with you about it, and we will not ask you to buy anything to make it happen.
          </p>
        </PageSection>

        <PageSection id="other" title="Other things to fix">
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-muted marker:text-subtle">
            <li>A wrong address, phone number, or opening hours.</li>
            <li>
              A photo that is yours and should not be here, or one labelled as an example
              photo that is being taken for the real thing.
            </li>
            <li>A place that has closed, moved, or changed hands.</li>
            <li>Two listings for the same place.</li>
            <li>Anything on a prayer space page.</li>
          </ul>
        </PageSection>

        <Reveal as="section" aria-label="Other ways" className="border-t border-line pt-8">
          <p className={bodyText}>
            If you want to look after your listing yourself instead,{' '}
            <Link href="/submit-restaurant" className={inlineLink}>
              claim it here
            </Link>
            . And if you want to understand how a label gets set before you dispute it,{' '}
            <Link href="/how-we-check" className={inlineLink}>
              this is how we check
            </Link>
            .
          </p>
        </Reveal>
      </PageBody>
    </>
  );
}
