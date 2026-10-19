import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { OnThisPage, PageBody, PageSection } from '@/components/PageLayout';
import { bodyText, inlineLink, metaLabel, noteWarm, panel } from '@/components/prose';
import { ctaSecondary } from '@/components/cta';

// What HMC and HFA each say, from their own websites, side by side (the
// 2026-10-12 plan). People choose a certifier by its rules on stunning, and
// the site's labels do not record stunning at all, so this page says what each
// body allows and never which one is right.
//
// Every line below is a body's own published position, paraphrased, with a
// link to where it says so. Read on READ_ON. If either body changes its rules
// or writes to us, this page changes with it.

export const metadata: Metadata = {
  title: 'HMC and HFA: what each one allows',
  description:
    'HMC and HFA both check halal meat in the UK. What each one says about stunning and machine slaughter, from their own websites, side by side.',
  alternates: { canonical: '/how-we-check/hmc-and-hfa' },
};

const READ_ON = '19 October 2026';

const HMC_STUNNING = 'https://halalhmc.org/resources/issues-of-mechanical-slaughter-and-stunning/';
const HMC_KFC = 'https://halalhmc.org/news/hmc-response-to-kfc-stunning/';
const HMC_SHOPS = 'https://halalhmc.org/outlets/';
const HFA_FAQS = 'https://halalfoodauthority.com/en/faqs/';
const HFA_CONTACT = 'https://halalfoodauthority.com/en/contact';

const SIDE_BY_SIDE = [
  {
    topic: 'Stunning first',
    hmc: 'Not allowed. No kind of stunning at all.',
    hfa: 'A light electric stun is allowed for chickens and sheep. A bolt or a blow to the head is not.',
  },
  {
    topic: 'Slaughter by machine',
    hmc: 'Not allowed.',
    hfa: 'Not allowed. A Muslim slaughters each animal by hand.',
  },
  {
    topic: "God's name on each animal",
    hmc: 'Must be said for each one. A recording is not enough.',
    hfa: 'Must be said for each one. A recording is not allowed.',
  },
  {
    topic: 'A list of places it checks',
    hmc: 'Yes, on its website.',
    hfa: 'We could not find one on its website.',
  },
];

const CONTENTS = [
  { id: 'side-by-side', label: 'Side by side' },
  { id: 'hmc', label: 'What HMC says' },
  { id: 'hfa', label: 'What HFA says' },
  { id: 'here', label: 'What it means here' },
  { id: 'check', label: 'Check a place yourself' },
];

function Source({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" className={inlineLink}>
        {children}
      </a>
    </li>
  );
}

export default function HmcAndHfaPage() {
  return (
    <>
      <PageHero
        title="HMC and HFA"
        lede="Two UK groups that check halal meat, in their own words. We do not pick a side."
        crumbs={[{ label: 'How we label places', href: '/how-we-check' }, { label: 'HMC and HFA' }]}
      />

      <PageBody aside={<OnThisPage items={CONTENTS} />} asideOnPhone="hide">
        <div className="space-y-3">
          <p className={bodyText}>
            HMC is the Halal Monitoring Committee. HFA is the Halal Food Authority. Both check that
            meat is halal, and both give a certificate to the places that pass. Both say a machine
            must not do the slaughter, and God&apos;s name is said for each animal. They do not agree
            on stunning.
          </p>
          <p className={bodyText}>
            Stunning means knocking an animal out, often with electricity, just before it is
            slaughtered. Some Muslims will not eat meat from a stunned animal. Some will. That is
            often why a person picks one group over the other.
          </p>
        </div>

        {/* Not revealed on scroll: it is the answer most people came for, and
            it sits in the first view on a phone. */}
        <PageSection id="side-by-side" title="Side by side" reveal={false}>
          <div className={`${panel} divide-y divide-line overflow-hidden`}>
            {SIDE_BY_SIDE.map(({ topic, hmc, hfa }) => (
              <div key={topic} className="px-5 py-4 sm:px-6">
                <h3 className="text-sm font-semibold text-ink">{topic}</h3>
                <dl className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <dt className={metaLabel}>HMC</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-ink/80">{hmc}</dd>
                  </div>
                  <div>
                    <dt className={metaLabel}>HFA</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-ink/80">{hfa}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            There are other halal groups too. This page is only about these two.
          </p>
        </PageSection>

        <PageSection id="hmc" title="What HMC says">
          <div className="space-y-3">
            <p className={bodyText}>
              HMC does not allow stunning of any kind. Its website says it has set &ldquo;a blanket
              ruling disallowing stunning in any form.&rdquo; It says stunning can kill an animal
              before it is slaughtered, most of all chickens. It also says stunning leaves blood in
              the meat. It says this is why it says no.
            </p>
            <p className={bodyText}>
              HMC does not allow slaughter by machine. It says a recording of God&apos;s name, or
              blessing the blades, is not enough. The name has to be said for each animal.
            </p>
            <p className={bodyText}>
              In 2018, HMC wrote that its staff are at every slaughterhouse it certifies, every day,
              and that they make surprise visits to the shops.
            </p>
            <ul className="space-y-1 pt-1 text-sm">
              <Source href={HMC_STUNNING}>HMC: Issues of Mechanical Slaughter and Stunning</Source>
              <Source href={HMC_KFC}>HMC: Response to KFC and Stunning (December 2018)</Source>
            </ul>
          </div>
        </PageSection>

        <PageSection id="hfa" title="What HFA says">
          <div className="space-y-3">
            <p className={bodyText}>
              HFA allows some stunning, with rules. It does not allow a bolt or a blow to the head.
              It does allow a light electric stun: a water bath for chickens and other birds, and
              tongs for sheep. A vet has to check that the animal is still alive when it is
              slaughtered. HFA says it has always held to &ldquo;no stunning to kill.&rdquo;
            </p>
            <p className={bodyText}>
              HFA does not allow slaughter by machine. It says a Muslim slaughters every animal by
              hand and says Bismillahi Allahu Akbar for each one. It says a recording playing in the
              background is not allowed.
            </p>
            <ul className="space-y-1 pt-1 text-sm">
              <Source href={HFA_FAQS}>HFA: Frequently asked questions</Source>
            </ul>
          </div>
        </PageSection>

        <PageSection id="here" title="What it means on YepItsHalal">
          <div className={noteWarm}>
            <p className="text-[15px] leading-relaxed text-ink/80">
              We do not decide who is right. That is for you, and the scholars you trust.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
              Our labels do not say if meat was stunned. Fully Halal means strong proof that all the
              meat is halal. It does not say whose rules were used.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
              If a place&apos;s page names a group, look the place up with that group too. A
              restaurant saying it is HMC is not the same as HMC saying so.
            </p>
          </div>
        </PageSection>

        <PageSection id="check" title="Check a place yourself">
          <ul className="space-y-3">
            <li className={bodyText}>
              <span className="font-semibold text-ink">Ask first.</span> Ask the restaurant who
              certifies its meat.
            </li>
            <li className={bodyText}>
              <span className="font-semibold text-ink">For HMC,</span> HMC says to look for its yellow
              sticker and this year&apos;s certificate, then find the place on{' '}
              <a href={HMC_SHOPS} target="_blank" rel="noopener noreferrer" className={inlineLink}>
                HMC&apos;s own list
              </a>
              .
            </li>
            <li className={bodyText}>
              <span className="font-semibold text-ink">For HFA,</span> ask to see the HFA
              certificate. We could not find a list of places on HFA&apos;s website, so if you are
              not sure,{' '}
              <a href={HFA_CONTACT} target="_blank" rel="noopener noreferrer" className={inlineLink}>
                ask HFA
              </a>
              .
            </li>
          </ul>
        </PageSection>

        <section aria-label="Tell us" className="border-t border-line pt-8">
          <p className="text-sm leading-relaxed text-muted">
            We read both websites on {READ_ON}. If a group changes its rules, or tells us we got
            something wrong, we will fix this page.
          </p>
          <div className="mt-4">
            <Link href="/corrections" className={ctaSecondary}>
              Tell us what&apos;s wrong
            </Link>
          </div>
        </section>
      </PageBody>
    </>
  );
}
