import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRightIcon, CheckIcon, HeartHandIcon, SealCheckIcon, SparkleIcon } from '@/components/icons';
import { Free } from '@/components/Free';
import { LogoBadge, LogoMark } from '@/components/Logo';
import { SupportStory, type StoryCard } from '@/components/support/SupportStory';
import { Reveal } from '@/components/Reveal';
import { forestLights } from '@/components/grounds';
import { inlineLink, pageShell } from '@/components/prose';
import { ctaGhost } from '@/components/cta';
import { SUPPORTER_PRICES } from '@/lib/supporterPricing';
import { supporterPaymentsReady } from '@/lib/supporterReadiness';
import { EVIDENCE, NOTES, STREET_WIDE, TABLE } from '@/lib/media';

export const metadata: Metadata = {
  title: 'Support YepItsHalal',
  description:
    'Finding out whether your dinner is halal is free. For everyone, everywhere in London, and it stays that way. Supporters pay for the checking that builds the catalogue. For every month of support, we donate a meal through ShareTheMeal. From £2.99 a month.',
  alternates: { canonical: '/yep-plus' },
};

// The case for support, as a short story told in cards (2026-09-24), and then
// the ask. Nothing on this page may promise something that does not exist.
// Every perk listed is already built: the meal pledge (worded as us donating,
// see the vault's "Charitable claims must not outrun the mechanism"), the
// monthly area vote, the supporter badge, first look at new things, and no
// sponsored messages. The earlier "supporting now counts for more" section
// promised offers that do not exist yet, so it is gone.
//
// Prices print from SUPPORTER_PRICES, the same values the checkout's price
// guard compares against Stripe. The buttons are only live when Stripe
// actually holds those prices (lib/supporterReadiness): until then the page
// says so instead of offering a checkout that can only refuse.

function Notice({ tone, children }: { tone: 'good' | 'warn'; children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className={
        tone === 'good'
          ? 'rounded-2xl bg-halal-fullSoft px-5 py-4 text-sm font-medium text-halal-fullInk ring-1 ring-halal-full/20'
          : 'rounded-2xl bg-halal-partialSoft px-5 py-4 text-sm font-medium text-halal-partialInk ring-1 ring-halal-partial/20'
      }
    >
      {children}
    </p>
  );
}

const PERKS = [
  'We donate a meal through ShareTheMeal for every month of support',
  'A vote each month on the area we check next',
  'A supporter badge on your account',
  'First look at new things, and first asked when we are unsure',
  'No sponsored messages, if we ever carry any',
];

/** The forest panel a card shows when its picture is an idea, not a photo. */
function ForestVisual({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="grain absolute inset-0 overflow-hidden bg-forest-deep">
      <div className={`absolute inset-0 ${forestLights}`} />
      {/* The card's pale edge, so the panel reads as part of the card. */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-sand-soft lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-24 lg:bg-gradient-to-r" />
      {/* Centred in the teal that is left once the fade is taken away, so
          nothing drawn here runs into the pale edge. */}
      <div className="relative flex h-full items-center justify-center pb-12 lg:pb-0 lg:pr-20">{children}</div>
    </div>
  );
}

function SupportAsk({ ready }: { ready: boolean }) {
  const monthly = SUPPORTER_PRICES.monthly.label;
  const annual = SUPPORTER_PRICES.annual.label;
  const button =
    'inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition duration-200 sm:w-auto';
  return (
    <div className="space-y-4">
      <p>
        You can use the catalogue without paying, and you always will. Supporting it helps us keep it going,
        and keep it growing.
      </p>

      <p className="flex flex-wrap items-baseline gap-x-2 text-ink">
        <span className="text-sm text-muted">from</span>
        <span className="font-display text-[2.4rem] font-semibold leading-none tabular-nums">{monthly}</span>
        <span className="text-base text-muted">/month</span>
        <span className="text-sm text-muted">
          or <span className="font-semibold text-ink">{annual} a year</span>
        </span>
      </p>

      {/* The same form and the same route as ever: the checkout and its price
          guard are untouched. Only offered when it can actually complete. */}
      <form action="/api/checkout/yep-plus" method="POST" className="flex flex-col gap-2.5 sm:flex-row">
        <button
          name="plan"
          value="monthly"
          disabled={!ready}
          className={clsx(button, 'bg-ink text-white shadow-sm hover:-translate-y-px hover:bg-accent-ink disabled:pointer-events-none disabled:bg-ink/40')}
        >
          Support: {monthly} a month
        </button>
        <button
          name="plan"
          value="annual"
          disabled={!ready}
          className={clsx(button, 'border border-line bg-white text-ink hover:-translate-y-px hover:border-ink/25 disabled:pointer-events-none disabled:text-ink/45')}
        >
          {annual} a year
        </button>
      </form>

      {ready ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <SealCheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          Payments are handled by Stripe. We never see your card details. Cancel any time.
        </p>
      ) : (
        <p role="status" className="rounded-xl bg-sand px-4 py-3 text-sm leading-relaxed text-ink/80 ring-1 ring-sand-line">
          <span className="font-semibold text-ink">Card payments open soon.</span> We&apos;re finishing the payment
          setup, so nothing can be charged yet. Everything on the site is already <Free>free</Free> to use.
        </p>
      )}

      <details className="group border-t border-line pt-3">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-lg text-sm font-semibold text-ink transition hover:text-accent-ink [&::-webkit-details-marker]:hidden">
          What supporters get
          <span aria-hidden="true" className="text-lg leading-none text-subtle transition group-open:rotate-45">
            +
          </span>
        </summary>
        <ul className="mt-1 space-y-2 pb-1">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-ink/80">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-halal-fullInk" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Stop, and nothing disappears: you keep the whole site, like everyone else.
        </p>
      </details>
    </div>
  );
}

export default async function YepPlusPage({ searchParams }: { searchParams: { checkout?: string } }) {
  const ready = await supporterPaymentsReady();

  const notice =
    searchParams.checkout === 'success' ? (
      <Notice tone="good">
        Thank you. Your support is set up.{' '}
        <Link href="/account" className="underline underline-offset-2">
          See it on your account
        </Link>
        .
      </Notice>
    ) : searchParams.checkout === 'cancelled' ? (
      <Notice tone="warn">No payment was taken. You can start any time.</Notice>
    ) : searchParams.checkout === 'not_configured' ? (
      <Notice tone="warn">Support payments aren&apos;t switched on yet. Please check back soon.</Notice>
    ) : searchParams.checkout === 'price_mismatch' ? (
      // The price on this page and the price in Stripe disagree, so nothing
      // was charged. Says what happened rather than blaming the card, and
      // does not repeat a number we have just admitted we cannot honour.
      <Notice tone="warn">
        We stopped that before anything was charged. Our payment setup does not match the price on this
        page. We will not take money on a number we have not got right. It is being fixed. Nothing left
        your account.
      </Notice>
    ) : null;

  const cards: StoryCard[] = [
    {
      id: 'problem',
      kicker: 'The problem',
      label: 'A halal sign is a claim, not an answer',
      title: <>A &ldquo;halal&rdquo; sign is a claim, not an answer.</>,
      body: (
        <p>
          Finding somewhere to eat is the easy part. Knowing what its halal sign means is harder. Who says
          so? What is that based on? And when did anyone last check?
        </p>
      ),
      art: STREET_WIDE,
    },
    {
      id: 'building',
      kicker: 'What we’re building',
      label: 'A catalogue that shows its working',
      title: <>So we&apos;re building a catalogue that shows its working.</>,
      body: (
        <p>
          Every place on YepItsHalal shows its label. It shows where that came from, and when we checked. And it says so
          plainly when we do not know. Searching is <Free>free</Free> for everyone, anywhere in London,
          with no account.
        </p>
      ),
      art: EVIDENCE,
    },
    {
      id: 'work',
      kicker: 'Behind the scenes',
      label: 'What checking a place takes',
      title: <>Checking a place properly is slow, careful work.</>,
      body: (
        <>
          <ul className="divide-y divide-black/[0.07] border-y border-black/[0.07]">
            {[
              'Reading what a place says about its meat, and where it says it',
              'Ringing to ask what the website doesn’t say',
              'Recording every answer with its source and the date',
              'Going back when menus and suppliers change',
              'And keeping the site, the maps and the search running',
            ].map((line) => (
              <li key={line} className="py-2">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            No place has had all of this yet. Every label so far comes from what places publish, and from
            open data. Support is what pays for the rest.
          </p>
        </>
      ),
      art: NOTES,
    },
    {
      id: 'support',
      kicker: 'What support does',
      label: 'What support changes',
      title: <>Support is what turns a list into a checked catalogue.</>,
      body: (
        <>
          <ol className="space-y-2.5">
            {[
              'Your support pays for the checking',
              'More places checked, and kept up to date',
              'A bigger catalogue you can rely on',
              'Better answers when you’re deciding where to eat',
            ].map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-ink/85">
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular-nums text-accent-ink"
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm">Supporters also vote each month on the area we check next.</p>
        </>
      ),
      visual: (
        <ForestVisual>
          <span className="relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
            <span className="absolute inset-0 rounded-full border border-white/10" />
            <span className="absolute inset-5 rounded-full border border-white/15" />
            <span className="absolute inset-10 rounded-full border border-accent-onDark/30" />
            <LogoMark size={64} className="relative drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]" />
          </span>
        </ForestVisual>
      ),
    },
    {
      id: 'matters',
      kicker: 'Why it matters',
      label: 'Why it matters',
      title: <>Because &ldquo;where can we eat?&rdquo; deserves a straight answer.</>,
      body: (
        <p>
          With family, friends or workmates, nobody should have to guess. Nobody should take a sticker in a window on
          trust. A catalogue that says what it knows, and what it does not, helps the whole table decide.
        </p>
      ),
      art: TABLE,
    },
    {
      id: 'ask',
      kicker: 'Keep it going',
      label: 'Become a supporter',
      title: (
        <>
          Keep it <Free>free</Free>. Help it grow.
        </>
      ),
      body: <SupportAsk ready={ready} />,
      visual: (
        <ForestVisual>
          <LogoBadge
            size={164}
            decorative
            className="h-28 w-28 drop-shadow-[0_18px_28px_rgba(0,0,0,0.4)] sm:h-40 sm:w-40 lg:h-[164px] lg:w-[164px] lg:scale-125"
          />
        </ForestVisual>
      ),
    },
  ];

  return (
    <>
      {/* The first view keeps its promise as the headline. The story starts
          right under it, on the same ground. */}
      <section aria-labelledby="support-title" className="ground-dark grain relative overflow-hidden bg-forest-deep pb-12 pt-9 text-white sm:pb-14 sm:pt-12 lg:pt-10">
        <div aria-hidden="true" className={`absolute inset-0 ${forestLights}`} />
        <div className={`${pageShell} relative`}>
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
            <SparkleIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Yep+
          </p>
          <h1
            id="support-title"
            className="max-w-3xl text-balance font-display text-[2rem] font-semibold leading-[1.06] tracking-[-0.02em] min-[390px]:text-[2.2rem] sm:text-[2.7rem] lg:text-[3.1rem]"
          >
            The food info is <Free tone="dark">free</Free>. Always.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-white/80 sm:text-[17px]">
            Nobody should have to pay to find out whether their dinner is halal.
          </p>
          {notice && <div className="mt-6 max-w-2xl">{notice}</div>}
        </div>

        <div className="relative mt-7 lg:mt-8">
          <SupportStory cards={cards} />
        </div>
      </section>

      <div className={`${pageShell} grid grid-cols-1 gap-10 pb-4 pt-12 sm:pt-14 lg:grid-cols-2 lg:gap-16`}>
        <Reveal as="section" aria-labelledby="meal">
          <h2 id="meal" className="font-display text-xl font-semibold text-ink">
            About the meal
          </h2>
          <p className="mt-3 flex items-start gap-3 text-[15px] leading-relaxed text-muted">
            <HeartHandIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
            <span>
              We donate a meal through{' '}
              <a href="https://sharethemeal.org" target="_blank" rel="noopener noreferrer" className={inlineLink}>
                ShareTheMeal
              </a>
              , the UN World Food Programme&apos;s hunger app. We do this for every month of support we receive. That is us
              giving to them. They have not partnered with us, and they have not endorsed us.
            </span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Nothing here buys a label. A restaurant cannot pay to be called halal, and neither can you.
          </p>
        </Reveal>

        <Reveal as="section" delay={120} aria-label="Help for free">
          <h2 className="font-display text-xl font-semibold text-ink">
            Not ready to pay? Helping is still <Free>free</Free>.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            <Link href="/submit-restaurant" className={inlineLink}>
              Add a place we&apos;re missing
            </Link>{' '}
            or tell us when we have something wrong. Use the feedback box at the bottom of any page. That is
            worth as much as the money.
          </p>
          <Link href="/how-we-check" className={`${ctaGhost} group -ml-4 mt-2`}>
            How we check a restaurant
            <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </>
  );
}
