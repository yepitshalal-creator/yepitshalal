import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { SparkleIcon, CheckIcon, SealCheckIcon, MailIcon, ArrowRightIcon } from '@/components/icons';
import { PageHero, heroPrimary, heroSecondary } from '@/components/PageHero';
import { PageBody, PageSection } from '@/components/PageLayout';
import { Reveal } from '@/components/Reveal';
import { ctaPrimary } from '@/components/cta';
import { forestLights } from '@/components/grounds';
import { noteWarm, panelForest } from '@/components/prose';
import { PARTNERS_EMAIL } from '@/lib/site';
import { KITCHEN } from '@/lib/media';
import { Free } from '@/components/Free';

export const metadata: Metadata = {
  title: 'For restaurants',
  description:
    'How reels work on YepItsHalal. Every restaurant gets one free, and partners get more room to show what they serve.',
  alternates: { canonical: '/partners' },
};

const FREE = [
  'Your listing, with halal information',
  '1 reel, live on your page',
  'That reel can show up in Discover',
  'Request verification',
];

const PARTNER = [
  'More reels: your best dishes, the prep, the room, new menu items',
  'Every reel can show up in Discover on its own',
  'A "Latest from you" section on your restaurant page',
  'Seasonal and offer videos, swapped whenever you like',
];

// The page used to end its partner card on "Get in touch" with nowhere to get
// in touch. Partnerships are business, so they go to info@, and the address is
// printed as well as linked: a mailto link does nothing on a machine with no
// mail app set up.
const MAILTO = `mailto:${PARTNERS_EMAIL}?subject=${encodeURIComponent('Partnership enquiry')}`;

export default function PartnersPage() {
  return (
    <>
      <PageHero
        label={{ text: 'For restaurants', icon: <SparkleIcon className="h-3.5 w-3.5" /> }}
        title="Show people what you actually serve."
        lede="A photo tells someone a restaurant exists. A reel shows them the food coming out of your kitchen. That is what people really decide on."
        art={KITCHEN}
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/submit-restaurant" className={heroPrimary}>
            Add your restaurant
            <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
          </Link>
          <a href={MAILTO} className={heroSecondary}>
            <MailIcon className="h-4 w-4" />
            Ask about a partnership
          </a>
        </div>
      </PageHero>

      <PageBody wide>
        <section aria-labelledby="tiers" className="space-y-4">
          <h2 id="tiers" className="sr-only">
            Free and partner
          </h2>
          {/* Two columns that are not the same kind of thing: what everyone has
              already, and what a partnership adds. Only the second is lifted. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
            <div className="rounded-2xl border border-line p-6">
              <h3 className="font-display text-lg font-semibold text-ink">
                <Free>Free</Free>
              </h3>
              <p className="mt-1 text-sm text-muted">
                Every listed restaurant, <Free>no cost</Free>.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink/80">
                {FREE.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-halal-fullInk" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className={clsx(panelForest, 'p-6')}>
              <div aria-hidden="true" className={`absolute inset-0 -z-10 ${forestLights}`} />
              <h3 className="font-display text-lg font-semibold">Partner</h3>
              <p className="mt-1 text-sm text-white/75">More room to sell the place.</p>
              <ul className="mt-5 space-y-2.5 text-sm text-white/90">
                {PARTNER.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-onDark" />
                    {f}
                  </li>
                ))}
              </ul>
              {/* No price stated: none exists in the product spec yet, and inventing
                  one on a live site would be a commitment nobody has made. */}
              <div className="mt-6 border-t border-white/15 pt-4 text-sm leading-relaxed text-white/85">
                <p>
                  We are setting up partnerships one restaurant at a time while we get this right.
                  Get in touch and we will talk it through.
                </p>
                <a
                  href={MAILTO}
                  className="mt-2 inline-flex min-h-[44px] items-center gap-2 font-semibold text-white underline decoration-white/35 underline-offset-4 transition hover:decoration-white"
                >
                  <MailIcon className="h-4 w-4" />
                  {PARTNERS_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </section>

        <PageSection id="not-bought" title="What a partnership does not buy" reveal>
          <p className={`${noteWarm} flex max-w-2xl items-start gap-3 text-sm leading-relaxed text-ink/80`}>
            <SealCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
            <span>
              It does nothing to your halal label. It does nothing to whether you get verified, or
              how fast that happens. Those work the same for every restaurant here, paying or not.
              We check reels before they go live either way. Paying buys room to market yourself.
              It buys nothing about how we describe your food.
            </span>
          </p>
        </PageSection>

        <Reveal as="section" aria-label="Get listed" className="border-t border-line pt-8">
          <p className="text-[15px] font-medium text-ink">
            Not listed yet? That comes first, and it is <Free>free</Free>.
          </p>
          <Link href="/submit-restaurant" className={`${ctaPrimary} group mt-4`}>
            Add your restaurant
            <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </PageBody>
    </>
  );
}
