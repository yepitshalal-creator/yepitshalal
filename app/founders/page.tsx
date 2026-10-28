import type { Metadata } from 'next';
import { Newsreader } from 'next/font/google';
import clsx from 'clsx';
import { AvailabilityProvider } from '@/components/founders/AvailabilityProvider';
import {
  ClaimCta,
  FoundersPageView,
  InvitationCard,
  SpotsBadge,
  SpotsInline,
  SpotsMeter,
  StickyClaimBar,
  TrackedLink,
} from '@/components/founders/LiveCount';
import { ClaimForm } from '@/components/founders/ClaimForm';
import { FounderAvatar } from '@/components/founders/FounderAvatar';
import { CollabVisual, DirectLineVisual, DirectoryVisual, ReelVisual } from '@/components/founders/visuals';
import { OfferList, founderOnly, standardOffer } from '@/components/founders/Offers';
import { foundersTitle, heroSecondary, signature } from '@/components/founders/styles';
import { Free } from '@/components/Free';
import { Reveal } from '@/components/Reveal';
import { LogoLockup } from '@/components/Logo';
import { ctaPrimary } from '@/components/cta';
import { forestFade, forestLights } from '@/components/grounds';
import { inlineLink, pageShell } from '@/components/prose';
import { ArrowRightIcon, CheckIcon, InstagramIcon, SealCheckIcon } from '@/components/icons';
import { getFounderAvailability } from '@/lib/founders-data';
import { FOUNDER, cleanSource, isOpen } from '@/lib/founders';

// /founders: the YepItsHalal 100 Founders Club.
//
// A private page. Shabir hands the link out in person, by an NFC tap on his
// phone at the London Halal Food Festival or as a link, to the restaurant and
// stall owners he has just spoken to. So it is written as him talking to them,
// it is kept out of search engines, the sitemap, robots.txt (which would list
// it for anyone to read) and the site's navigation, and it is built for a
// phone first: the offer, the count and the button are on the first screen.
//
// Every number on it is read live from the database (0050_founders_club), and
// a claim is decided there, never here. When the hundred are gone the page
// turns into "Founder spots are full, your restaurant can still join for
// free", without anybody changing it.
//
// The sections keep their places in both states, so a visitor who takes the
// last spot keeps their answer on screen while the rest of the page changes
// around it.

const newsreaderItalic = Newsreader({
  subsets: ['latin'],
  style: 'italic',
  weight: ['500'],
  variable: '--font-display-italic',
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'A private invitation',
  description:
    'For the London food businesses Shabir met at the Halal Food Festival. The YepItsHalal 100 Founders Club, free for life.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // Seen when the link is shared in WhatsApp or a DM. The site's own picture,
  // set here because a page that sets its own openGraph loses the inherited one.
  openGraph: {
    title: 'The YepItsHalal 100 Founders Club',
    description: 'A private invite from Shabir Ahmed. Free perks for life, for the first 100 London halal food businesses.',
    images: [{ url: '/opengraph-image.jpg', width: 1200, height: 630, alt: 'The YepItsHalal logo' }],
  },
};

export default async function FoundersPage({ searchParams }: { searchParams: { src?: string } }) {
  const availability = await getFounderAvailability();
  const full = availability ? !isOpen(availability) : false;

  return (
    <div className={newsreaderItalic.variable}>
      <AvailabilityProvider initial={availability} source={cleanSource(searchParams.src)}>
        <FoundersPageView />
        <Hero full={full} />
        {full && <StillFree />}
        <Letter />
        <Benefits full={full} />
        {!full && <Trade />}
        <Roadmap />
        <Claim full={full} />
        <DirectMessage />
        <StickyClaimBar />
      </AvailabilityProvider>
    </div>
  );
}

// ── The invitation ─────────────────────────────────────────────────────────

// First 100, then Founder status, then the perks free for life: the whole
// offer in one line, kept to a line or two on a phone so both buttons stay on
// the first screen.
const STEPS = [
  { n: 1, text: <>First 100</> },
  { n: 2, text: <>Founder status</> },
  { n: 3, text: <Free tone="dark">Free lifetime perks</Free> },
];

function Hero({ full }: { full: boolean }) {
  return (
    <section aria-labelledby="founders-title" className="ground-dark grain relative overflow-hidden bg-forest-deep text-white">
      <div aria-hidden="true" className={`absolute inset-0 ${forestLights}`} />
      <div aria-hidden="true" className={forestFade} />

      <div
        className={clsx(
          pageShell,
          'relative grid items-center gap-12 pb-14 pt-5 sm:pb-20 sm:pt-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14 lg:pb-24 lg:pt-16'
        )}
      >
        {/* On a phone the buttons have to be on the first screen, which in a
            browser with its toolbars showing is about 650px tall. So the three
            steps sit under the buttons there, and above them from 640px. */}
        <div className="flex min-w-0 flex-col">
          <div className="self-start">
            <SpotsBadge />
          </div>

          <div className="mt-4 flex animate-fade-up items-center gap-3 sm:mt-5 sm:gap-3.5 [animation-delay:80ms]">
            <FounderAvatar size={48} eager decorative className="sm:hidden" />
            <FounderAvatar size={56} eager decorative className="hidden sm:inline-block" />
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{FOUNDER.name}</p>
              <p className="text-sm leading-snug text-white/70">
                Founder of YepItsHalal,{' '}
                <TrackedLink
                  href={FOUNDER.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  event="founders_instagram_clicked"
                  props={{ where: 'hero_handle' }}
                  className="underline decoration-white/30 underline-offset-[3px] transition hover:text-white hover:decoration-white"
                >
                  @{FOUNDER.instagramHandle}
                </TrackedLink>
              </p>
            </div>
          </div>

          <h1
            id="founders-title"
            className="mt-5 max-w-[36rem] text-balance font-display font-semibold leading-[1.06] tracking-[-0.02em] sm:mt-6"
          >
            <span className="block text-[1.15rem] font-medium leading-snug tracking-normal text-accent-onDark sm:text-[1.35rem]">
              Met me at the Halal Food Festival?
            </span>
            <span className="mt-2 block text-[2rem] min-[390px]:text-[2.15rem] sm:text-[2.85rem] lg:text-[3.2rem]">
              {full
                ? 'Founder spots are now full. Your restaurant can still join for free.'
                : 'Let’s put your restaurant on the map, without the big fees.'}
            </span>
          </h1>

          <p className="mt-4 max-w-[34rem] text-pretty text-[16px] leading-relaxed text-white/80 sm:mt-5 sm:text-[17px]">
            {full ? (
              <>
                The first 100 YepItsHalal Founders have now been claimed. Thank you to everyone who
                joined us early. Your restaurant can still get a <Free tone="dark">free</Free> listing
                on YepItsHalal.
              </>
            ) : (
              <>
                Welcome to the YepItsHalal 100 Founders Club. I&apos;m keeping{' '}
                <Free tone="dark">free lifetime perks</Free>, 3 video reel slots and direct access to
                me for 100 London halal food businesses. Before we open paid plans to everyone.
              </>
            )}
          </p>

          {!full && (
            <ol aria-label="How it works" className="order-last mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] font-semibold text-white/90 sm:order-none sm:text-sm">
              {STEPS.map((s, i) => (
                <li key={s.n} className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-forest-deep">
                    {s.n}
                  </span>
                  {s.text}
                  {i < STEPS.length - 1 && <ArrowRightIcon className="ml-0.5 h-3.5 w-3.5 text-white/45" />}
                </li>
              ))}
            </ol>
          )}

          <div id="hero-cta" className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap">
            <ClaimCta where="hero" />
            <TrackedLink
              href={FOUNDER.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              event="founders_instagram_clicked"
              props={{ where: 'hero' }}
              className={clsx(heroSecondary, 'min-h-[52px] w-full text-[15px] sm:w-auto')}
            >
              <InstagramIcon className="h-[18px] w-[18px]" />
              Message Shabir on Instagram
            </TrackedLink>
          </div>
          <p className="mt-4 text-sm text-white/70">
            <Free tone="dark">Free</Free>. No card needed. It takes about 30 seconds.
          </p>
        </div>

        <div className="hidden justify-center lg:flex">
          <InvitationCard />
        </div>
      </div>
    </section>
  );
}

// ── Once the hundred are gone ──────────────────────────────────────────────

function StillFree() {
  return (
    <section aria-labelledby="still-free-title" className={clsx(pageShell, 'pt-12 sm:pt-16')}>
      <div className="grid items-center gap-8 rounded-[28px] bg-white p-6 ring-1 ring-sand-line sm:p-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 id="still-free-title" className={foundersTitle}>
            Your restaurant can still join YepItsHalal for <Free>free</Free>.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Founder status is closed, but a standard listing is <Free>free</Free> for every London
            halal food business. It includes:
          </p>
        </div>
        <div>
          <OfferList items={standardOffer()} />
          <TrackedLink
            href="#claim"
            event="founders_standard_cta_clicked"
            props={{ where: 'still_free' }}
            className={clsx(ctaPrimary, 'group mt-7 w-full sm:w-auto')}
          >
            List my restaurant for free
            <ArrowRightIcon className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}

// ── The letter ─────────────────────────────────────────────────────────────

// Shabir's words, with three facts made exact. Delivery apps: Uber Eats
// publishes 30% when its couriers deliver, and Deliveroo is widely reported at
// 25 to 35%, so "up to 30% or more". "Verified" became "the evidence behind
// every label", because nothing here is certified by us (see /how-we-check).
// And collection ordering is next, with no date yet, so it is "next", not
// "rolling out".
function Letter() {
  return (
    <section aria-labelledby="letter-title" className={clsx(pageShell, 'py-14 sm:py-20')}>
      <Reveal>
        <article className="relative mx-auto max-w-[44rem] overflow-hidden rounded-[28px] bg-white px-5 pb-8 pt-7 shadow-[0_1px_2px_rgba(15,37,43,0.05),0_30px_70px_-40px_rgba(4,24,30,0.45)] ring-1 ring-sand-line sm:px-12 sm:pb-12 sm:pt-10">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-forest via-forest to-accent" />
          <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
            <span aria-hidden="true">
              <LogoLockup tone="light" />
            </span>
            <p className="text-sm text-subtle">London</p>
          </div>

          <h2
            id="letter-title"
            className="mt-7 text-balance font-display text-[1.4rem] font-semibold leading-snug text-ink sm:text-[1.7rem]"
          >
            An open message from Shabir Ahmed, Founder of YepItsHalal
          </h2>

          <div className="mt-5 space-y-4 font-display text-[1.07rem] leading-[1.65] text-ink/85 sm:space-y-5 sm:text-[1.22rem] sm:leading-[1.7]">
            <p>
              The big delivery apps and the old food sites take advantage of small halal
              businesses. The apps take up to 30% or more of every order. Then you pay again just to
              be seen. You work harder than ever, and you keep less.
            </p>
            <p className="text-[1.5rem] font-semibold leading-snug text-forest sm:text-[1.75rem]">We&apos;re changing that.</p>
            <p>
              YepItsHalal started with one simple aim. Help Londoners find halal food fast, and show
              the evidence behind every label. And do it without eating into your profits. Today we
              are building a directory built around video. Next comes collection ordering, with a
              much smaller cut. Then local delivery, done fairly.
            </p>
            <p>Because you met me at the festival, I want you in our first 100 Founding Partners.</p>
          </div>

          <div className="mt-9 flex items-center gap-4 border-t border-line pt-6">
            <FounderAvatar size={56} ground="light" decorative />
            <div>
              <p className={clsx(signature, 'text-[2.1rem] leading-none text-forest')}>Shabir</p>
              <p className="mt-2 text-sm text-muted">Shabir Ahmed, Founder of YepItsHalal</p>
            </div>
          </div>
        </article>
      </Reveal>
    </section>
  );
}

// ── What a Founder gets ────────────────────────────────────────────────────

function Benefit({
  n,
  tag,
  title,
  visual,
  flip = false,
  children,
}: {
  n: number;
  tag: React.ReactNode;
  title: string;
  visual: React.ReactNode;
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <Reveal className={clsx('min-w-0', flip && 'lg:order-2')}>
        <p className="flex items-center gap-3 text-sm font-semibold">
          <span className="font-display text-base tabular-nums text-accent-ink">0{n}</span>
          <span aria-hidden="true" className="h-px w-7 bg-sand-line" />
          <span className="text-spice-ink">{tag}</span>
        </p>
        <h3 className="mt-3 text-balance font-display text-[1.55rem] font-semibold leading-[1.15] tracking-[-0.01em] text-ink sm:text-[1.9rem]">
          {title}
        </h3>
        <p className="mt-3 max-w-[34rem] text-pretty text-[16px] leading-relaxed text-muted">{children}</p>
      </Reveal>
      <Reveal delay={120} className={clsx('min-w-0', flip && 'lg:order-1')}>
        {visual}
      </Reveal>
    </li>
  );
}

function Benefits({ full }: { full: boolean }) {
  if (full) {
    return (
      <section aria-labelledby="benefits-title" className={clsx(pageShell, 'pb-6')}>
        <Reveal className="grid gap-8 rounded-[28px] bg-sand p-6 ring-1 ring-sand-line sm:p-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2 id="benefits-title" className={foundersTitle}>
              What our first 100 Founders got
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">
              Founder status is closed. These were reserved for the first 100 and are theirs for
              life. Every other restaurant still gets the <Free>free</Free> standard listing above.
            </p>
          </div>
          <OfferList items={founderOnly()} />
        </Reveal>
      </section>
    );
  }

  return (
    <section aria-labelledby="benefits-title" className={clsx(pageShell, 'pb-6')}>
      <Reveal className="max-w-2xl">
        <h2 id="benefits-title" className={foundersTitle}>
          What you get as a Founding Partner
        </h2>
        <p className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="font-display text-[2.6rem] font-semibold leading-none tracking-[-0.02em] sm:text-[3.4rem]">
            <Free>100% free</Free>
          </span>
          <span className="text-[15px] leading-relaxed text-muted">
            <SpotsInline />
          </span>
        </p>
      </Reveal>

      <ol className="mt-12 space-y-16 sm:mt-16 sm:space-y-24">
        <Benefit
          n={1}
          tag={
            <>
              <Free>Free</Free> lifetime directory profile
            </>
          }
          title="You control your listing, and your halal details"
          visual={<DirectoryVisual />}
        >
          Put your address, opening hours, menu and exact halal details on our live London site.
          Each one shows where it came from. Need a change? Send it from your phone, straight to me.
          Nobody in between.
        </Benefit>

        <Benefit
          n={2}
          tag={
            <>
              3 <Free>free</Free> video reel slots
            </>
          }
          title="Food videos on our new Discover feed"
          visual={<ReelVisual />}
          flip
        >
          Still pictures don&apos;t sell food. Video does. When our TikTok-style Discover page opens, a
          free listing gets 1 reel. Founders get 3 reel slots, <Free>free forever</Free>. Show your
          best dishes to hungry people nearby. And your reels are checked first when it opens.
        </Benefit>

        <Benefit
          n={3}
          tag={
            <>
              <Free>Free</Free> social promotion
            </>
          }
          title="We show your videos to our London followers"
          visual={<CollabVisual />}
        >
          Send us your food videos, or just tag us. We&apos;ll repost them, post them together with
          you, and share them across YepItsHalal and our social pages. All to bring hungry people
          straight to your door.
        </Benefit>

        <Benefit
          n={4}
          tag="VIP direct access"
          title="A direct WhatsApp and Instagram line to me"
          visual={<DirectLineVisual />}
          flip
        >
          No support tickets. No chatbots. You get me, @{FOUNDER.instagramHandle}. Message me to
          update your page, ask for something new, or sort out a problem. Usually in minutes.
        </Benefit>
      </ol>
    </section>
  );
}

// ── The trade ──────────────────────────────────────────────────────────────

function Trade() {
  return (
    <section aria-labelledby="trade-title" className="mt-20 bg-sand sm:mt-28">
      <div
        className={clsx(
          pageShell,
          'grid gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16'
        )}
      >
        <Reveal>
          <h2 id="trade-title" className={foundersTitle}>
            What we need from you
          </h2>
          <p className="mt-5 text-balance font-display text-[1.6rem] font-semibold leading-snug text-forest sm:text-[2rem]">
            We don&apos;t want your money. We want your partnership.
          </p>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">
            In exchange for your lifetime Founder status, we only ask for two simple things.
          </p>
        </Reveal>

        <div>
          <ol className="grid gap-4 sm:grid-cols-2">
            <Reveal as="li" delay={60} className="rounded-2xl bg-white p-5 ring-1 ring-sand-line sm:p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-deep font-display text-sm font-semibold text-accent-onDark">
                  1
                </span>
                <h3 className="font-display text-xl font-semibold text-ink">Content permission</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Let us use, repost and post together with you on your food videos. We show off your
                business across the directory and our social pages.
              </p>
            </Reveal>
            <Reveal as="li" delay={120} className="rounded-2xl bg-white p-5 ring-1 ring-sand-line sm:p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-deep font-display text-sm font-semibold text-accent-onDark">
                  2
                </span>
                <h3 className="font-display text-xl font-semibold text-ink">Honest details</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                True details about your menu and your halal setup. So people choosing where to eat
                get the full picture.
              </p>
            </Reveal>
          </ol>
          <p className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-muted">
            <SealCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
            <span>
              Being a Founder never buys a halal label. Your label comes from your evidence, the same
              as every other restaurant.{' '}
              <a href="/how-we-check" className={inlineLink}>
                How we label places
              </a>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Where it is going ──────────────────────────────────────────────────────

const PHASES = [
  {
    state: 'live' as const,
    label: 'Active now',
    title: 'The free directory and search engine',
    body: 'We send London food lovers straight to your restaurant, with your halal details, hours and menu. The Discover feed for video is being built on top of it.',
  },
  {
    state: 'next' as const,
    label: 'Coming next',
    title: 'Online collection ordering',
    body: 'Order through the site and collect it yourself. Built to take a much smaller cut than the delivery apps.',
  },
  {
    state: 'later' as const,
    label: 'Future vision',
    title: 'Local delivery',
    body: 'Our own delivery, built to take on Just Eat, Uber Eats and Deliveroo. On a smaller cut.',
  },
];

function Roadmap() {
  return (
    <section aria-labelledby="roadmap-title" className={clsx(pageShell, 'py-16 sm:py-24')}>
      <Reveal className="max-w-2xl">
        <h2 id="roadmap-title" className={foundersTitle}>
          Where YepItsHalal is heading
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          Only the first step is live today. This is what comes after it, in order.
        </p>
      </Reveal>

      <ol className="relative mt-10 grid gap-10 lg:mt-14 lg:grid-cols-3 lg:gap-10">
        <span
          aria-hidden="true"
          className="absolute bottom-4 left-[11px] top-4 w-px bg-gradient-to-b from-accent via-sand-line to-sand-line lg:bottom-auto lg:left-3 lg:right-3 lg:top-[11px] lg:h-px lg:w-auto lg:bg-gradient-to-r"
        />
        {PHASES.map((p, i) => (
          <Reveal as="li" key={p.title} delay={i === 0 ? 0 : i === 1 ? 120 : 240} className="relative pl-11 lg:pl-0 lg:pt-12">
            <span
              aria-hidden="true"
              className={clsx(
                'absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full lg:top-0',
                p.state === 'live' && 'bg-accent ring-4 ring-accent/25',
                p.state === 'next' && 'bg-sand-soft ring-2 ring-forest',
                p.state === 'later' && 'border-2 border-dashed border-forest/45 bg-sand-soft'
              )}
            >
              {p.state === 'live' && <CheckIcon className="h-3.5 w-3.5 text-forest-deep" strokeWidth={2.5} />}
            </span>
            <p
              className={clsx(
                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                p.state === 'live' && 'bg-accent-soft text-accent-ink ring-accent/30',
                p.state === 'next' && 'bg-sand text-spice-ink ring-sand-line',
                p.state === 'later' && 'bg-white text-subtle ring-line'
              )}
            >
              {p.label}
            </p>
            <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-ink sm:text-[1.35rem]">{p.title}</h3>
            <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{p.body}</p>
          </Reveal>
        ))}
      </ol>

      <Reveal>
        <p className="mt-12 text-balance font-display text-[1.55rem] font-semibold leading-snug text-forest sm:text-[2rem]">
          We keep money where it belongs: in your business.
        </p>
      </Reveal>
    </section>
  );
}

// ── The claim ──────────────────────────────────────────────────────────────

function Claim({ full }: { full: boolean }) {
  return (
    <section
      id="claim"
      aria-labelledby="claim-title"
      className="ground-dark grain relative scroll-mt-14 overflow-hidden bg-forest-deep text-white"
    >
      <div aria-hidden="true" className={`absolute inset-0 ${forestLights}`} />
      <div
        className={clsx(
          pageShell,
          'relative grid gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16'
        )}
      >
        {/* First in the page, so the button above lands on the form and the
            keyboard reaches it first. From 1024px it sits on the right. */}
        <div className="min-w-0 lg:order-2">
          <ClaimForm />
        </div>

        <div className="min-w-0 lg:sticky lg:top-24 lg:order-1">
          <h2 id="claim-title" className="text-balance font-display text-[1.85rem] font-semibold leading-[1.1] sm:text-[2.4rem]">
            {full ? 'The first 100 are in' : 'Only 100 Founders, ever'}
          </h2>
          <p className="mt-3 max-w-md text-[16px] leading-relaxed text-white/75">
            {full
              ? 'Founder status is closed. Every London halal food business can still get a free standard listing.'
              : 'Whether we met at the festival or a friend passed you this link, the offer is the same.'}
          </p>
          <div className="mt-8">
            <SpotsMeter tone="dark" />
          </div>
          {!full && (
            <ul className="mt-8 space-y-2.5 text-[15px] text-white/85">
              {['Free. No card needed.', 'About 30 seconds, four questions.', "I'll message you myself to set it up."].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <CheckIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent-onDark" strokeWidth={2} />
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Or just talk ───────────────────────────────────────────────────────────

function DirectMessage() {
  return (
    <section aria-labelledby="dm-title" className={clsx(pageShell, 'pb-4 pt-16 sm:pb-10 sm:pt-24')}>
      <Reveal className="mx-auto max-w-xl text-center">
        <div className="flex justify-center">
          <FounderAvatar size={76} ground="light" decorative />
        </div>
        <h2 id="dm-title" className="mt-6 text-balance font-display text-[1.75rem] font-semibold leading-tight text-ink sm:text-[2.15rem]">
          Prefer to chat directly before signing up?
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          Send me a direct message on Instagram right now. Mention &ldquo;Festival Founder&rdquo; so I
          know where we met.
        </p>
        <TrackedLink
          href={FOUNDER.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          event="founders_instagram_clicked"
          props={{ where: 'bottom' }}
          className={clsx(ctaPrimary, 'mt-7 min-h-[52px] text-[15px]')}
        >
          <InstagramIcon className="h-[18px] w-[18px]" />@{FOUNDER.instagramHandle}
        </TrackedLink>
      </Reveal>
    </section>
  );
}
