import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon, SealCheckIcon, StoreIcon } from '@/components/icons';
import { PageHero } from '@/components/PageHero';
import { PageBody } from '@/components/PageLayout';
import { LocationSearchBar } from '@/components/LocationSearchBar';
import { ctaPrimary, linkCard } from '@/components/cta';
import { noteWarm } from '@/components/prose';
import { Free } from '@/components/Free';
import { KITCHEN } from '@/lib/media';
import { getSiteCounts, formatCount } from '@/lib/siteCounts';

// The way in for restaurant owners, from the button in the header and the
// tab bar (Shabir, 2026-10-11: "Add" did not make it obvious that a
// restaurant can find itself and put its details in). It promises only what
// exists: claiming on the restaurant's own page (OwnershipCta, approved in
// /admin/claims), then /manage for a deal, reels and the poster, "Suggest an
// edit" for details, and /submit-restaurant for a place we do not have.

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'For restaurant owners',
  description: 'Find your restaurant on YepItsHalal, tell us it is yours, and keep its page right. Claiming it is free.',
  alternates: { canonical: '/owners' },
};

const STEPS = [
  {
    title: 'Find it',
    body: 'Type your restaurant’s name in the box. Pick it from the list.',
  },
  {
    title: 'Tell us it’s yours',
    body: 'Its page opens where it asks if you run it. Sign in and claim it. We check with you by phone or email.',
  },
  {
    title: 'Run your page',
    body: 'Then you can post reels and run a deal. To fix a detail, like your hours, tap “Suggest an edit” on your page.',
  },
];

export default async function OwnersPage() {
  const counts = await getSiteCounts();

  return (
    <>
      <PageHero
        label={{ text: 'For restaurant owners', icon: <StoreIcon className="h-3.5 w-3.5" /> }}
        title="Is your restaurant on here?"
        lede={
          <>
            {counts ? `${formatCount(counts.places)} places in London are on YepItsHalal.` : 'Lots of London places are on YepItsHalal.'}{' '}
            Yours may be one of them. Find it and claim it. Claiming is <Free tone="dark">free</Free>.
          </>
        }
        art={KITCHEN}
      >
        <LocationSearchBar placeholder="Your restaurant’s name" restaurantHash="#claim" />
      </PageHero>

      <PageBody wide>
        <section aria-labelledby="how" className="space-y-4">
          <h2 id="how" className="font-display text-xl font-semibold text-ink">
            How it works
          </h2>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-line bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-semibold text-accent-ink">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink/80">{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            Your first reel is <Free>free</Free>.
          </p>
        </section>

        <section aria-label="Other ways in" className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Not on here yet?</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/80">
              Add your restaurant. It is <Free>free</Free>.
            </p>
            <Link href="/submit-restaurant" className={`${ctaPrimary} group mt-4`}>
              Add your restaurant
              <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <Link href="/manage" className={`${linkCard} flex items-center justify-between gap-3 p-5 sm:p-6`}>
            <span>
              <span className="block font-display text-lg font-semibold text-ink">Already claimed it?</span>
              <span className="mt-1 block text-sm text-ink/80">Go to your restaurants: your deal, reels and poster.</span>
            </span>
            <ArrowRightIcon className="h-5 w-5 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        </section>

        <p className={`${noteWarm} mt-10 flex max-w-2xl items-start gap-3 text-sm leading-relaxed text-ink/80`}>
          <SealCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
          <span>
            Nobody can pay for a halal label here. A label comes from evidence, and we show where it came from.{' '}
            <Link href="/how-we-check" className="font-semibold text-accent-ink hover:underline">
              How we label places
            </Link>
          </span>
        </p>

        <p className="mt-8 text-sm text-muted">
          Want more people to see your food?{' '}
          <Link href="/partners" className="font-semibold text-accent-ink hover:underline">
            See what partners get
          </Link>
        </p>
      </PageBody>
    </>
  );
}
