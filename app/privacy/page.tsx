import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { PageBody } from '@/components/PageLayout';
import { inlineLink, noteWarm, sectionTitle } from '@/components/prose';
import { RecordingChoice } from '@/components/RecordingChoice';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What YepItsHalal collects, why, how long it is kept, and how to ask for a copy or have it deleted.',
  alternates: { canonical: '/privacy' },
};

/**
 * Written from what the code actually does, not from a template. Every row of
 * the table below maps to a real route or table, so when one of them changes
 * this page has to change with it. The ones to watch:
 *
 *   /api/subscribe            subscribers
 *   /api/feedback             site_feedback
 *   /api/language-requests    language_requests
 *   /api/restaurants/submit   restaurant_submissions
 *   /api/founders             founder_applications
 *   /api/verification-requests
 *   Supabase Auth             magic link, email only
 *   /api/deals/*              deal_claims, deal_pin_attempts, the yih_device cookie
 *   /manage/[slug]/deals      deals, deal_ledger (restaurant owners)
 *
 * Still to add once ICO registration is done: the registered entity name,
 * trading address and registration number. That registration produces exactly
 * those details, which is why they are not guessed at here.
 *
 * The PostHog row, the PostHog paragraph under Cookies and the Recordings
 * section describe lib/analytics/: the PostHog config, and the scrubber every
 * event and every recording passes through. If either changes, so do they.
 * "How fast pages load" is the web vitals setting there, "where people tap
 * and how far they scroll" is heatmaps, and recording starts only after a yes
 * in components/RecordingConsent.tsx. "It does not keep your IP address"
 * rests on cookieless server hash mode, which strips the IP before anything
 * is stored, so that switch in PostHog has to stay on. For a visitor who says
 * yes to a recording it rests on "Discard client IP data" in the project's
 * settings instead, and scrub.ts asks PostHog not to look up where an IP
 * address is. "30 days" is the free plan's limit for keeping recordings.
 * "Where you are" under Recordings, and "never gets your exact location"
 * under Cookies, rest on MASK_CLASS around the searched place and every
 * distance from it, UNRECORDED_CLASS on the map, and autocapture leaving out
 * each map pin's style.
 */

const COLLECTED: [string, string, string][] = [
  [
    'Your email address',
    'If you sign in, ask to be told when we reach your area, send feedback and leave an address, ask for a language, submit a restaurant, or request a verification.',
    'Kept while your account exists, or until you ask us to remove it.',
  ],
  [
    'What you write to us',
    'Feedback, language requests, restaurant details you submit, and anything you send about your own restaurant. If we write back, we keep a copy of our reply with it.',
    'Kept for two years, so we can see whether we fixed the thing you told us about.',
  ],
  [
    'Your name and a phone number or Instagram handle',
    'Only if you claim a Founders Club spot for your restaurant, so Shabir can get in touch to set up your listing. Never published and never shared.',
    'Kept while your listing or Founder status lasts, or until you ask us to remove it.',
  ],
  [
    'A one way hash of your IP address',
    'To stop one connection flooding the forms. We hash it with a secret and never store the address itself, so it cannot be turned back into your IP.',
    'Kept for 12 months alongside the submission it limited.',
  ],
  [
    'Payment details',
    'Handled entirely by Stripe. We never see or store your card. We keep the Stripe customer and subscription identifiers so we know you are a supporter.',
    'Kept while your support is active, then as long as tax rules require.',
  ],
  [
    'A deal code',
    'Only if you tap "Get my code" on a restaurant deal. We keep the code, when you got it and used it, and anything you tell us if the restaurant did not give you the deal. We also keep a random number your phone holds in a cookie, so the code only works on your phone and a deal is used once a day. That number does not say who you are.',
    'The link to your phone is removed after 400 days. Staff PIN tries are removed after 90 days.',
  ],
  [
    'If you run a restaurant deal',
    'Your email, the deal you set up, when you agreed to the deal terms, and every credit, fee and top up. Card top ups are handled by Stripe. We never see your card.',
    'Kept while your deal runs, then as long as tax rules require.',
  ],
  [
    'Photographs you upload',
    'Only if you manage a restaurant listing and choose to add pictures of it.',
    'Kept while the listing shows them.',
  ],
  [
    'If we ask your restaurant about photos',
    'The business email or phone number your place put online, and where we found it. If you say yes, your name, your role, your email, any photos or videos you send, and the exact words you agreed to, with the date, as proof.',
    'Kept while we use your photos, and the proof of your yes after that. If you say no or ask us to stop, we keep only your email or number on a list, so we never contact you again.',
  ],
  [
    'A recording of your visit',
    'Only if you say yes when we ask. It shows where you clicked, tapped and scrolled, and what the pages looked like, so we can see what is hard to use. It never shows what you type, the place you search near, or pages with your own details.',
    'Kept for 30 days, then deleted.',
  ],
];

const PROCESSORS: [string, string, string][] = [
  ['Supabase', 'Database, sign in, and photo storage.', 'https://supabase.com/privacy'],
  ['Vercel', 'Hosting, and privacy friendly visitor analytics.', 'https://vercel.com/legal/privacy-policy'],
  ['PostHog', 'Counting which pages and buttons get used, seeing where people tap and scroll, timing how fast pages load, and spotting pages that break. If you say yes, it also records your visit. Its servers are in the EU.', 'https://posthog.com/privacy'],
  ['Stripe', 'Payments, if you support us, buy a priority verification, or top up deal credit.', 'https://stripe.com/gb/privacy'],
  ['Resend', 'Delivering what you send through a form on this site to our own inbox, so a person reads it, sending our reply back to you, and sending the emails that ask restaurants about their photos. It does not track whether you open it.', 'https://resend.com/legal/privacy-policy'],
];

const RIGHTS = [
  'Ask for a copy of everything we hold about you.',
  'Ask us to correct anything that is wrong.',
  'Ask us to delete it.',
  'Ask us to stop using it for something.',
  'Take your data elsewhere.',
  'Complain to the Information Commissioner, without telling us first.',
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero tone="sand" title="Privacy" lede="Searching for halal food should not cost you your privacy. This page says exactly what we collect, why, and how to get rid of it. It is short because we collect little." />
      <PageBody>
      <div>

      <div className={noteWarm}>
        <h2 className="font-display text-lg font-semibold text-ink">
          You can use the whole site without telling us who you are
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          Search, the map, every restaurant page and the prayer spaces work signed out.
          When you search near yourself, your location is sent to our server to find what
          is nearby and is then thrown away. We do not store it, and we do not build a
          history of where you have searched. We only record a visit if you say yes.
        </p>
      </div>

      <h2 className={`mt-12 ${sectionTitle}`}>What we collect</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Only when you do something that needs it. Nothing in this list is collected just
        by visiting.
      </p>
      <div className="mt-4 border-b border-line">
        {COLLECTED.map(([what, why, kept]) => (
          <div key={what} className="border-t border-line py-4">
            <h3 className="font-display text-base font-semibold text-ink">{what}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{why}</p>
            <p className="mt-2 text-xs leading-relaxed text-subtle">{kept}</p>
          </div>
        ))}
      </div>

      <h2 className={`mt-12 ${sectionTitle}`}>Why we are allowed to</h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
        <li>
          <span className="font-medium text-ink">Because you asked us to.</span> Signing in,
          submitting a restaurant, asking for a language, asking to be told when we reach
          your area, saying yes to a recording. Consent, and you can withdraw it at any
          time.
        </li>
        <li>
          <span className="font-medium text-ink">Because we have a contract with you.</span>{' '}
          Supporting us, buying a priority verification, getting a deal code, or running a
          deal for your restaurant.
        </li>
        <li>
          <span className="font-medium text-ink">
            Because we have a legitimate interest.
          </span>{' '}
          Hashing an IP address, to stop the forms being flooded. Counting visits and
          button taps, so we know which pages are worth keeping. Seeing where people tap
          and how far they scroll, added up across everyone, so we know what to fix.
          Timing how fast pages load, so we can make slow ones faster. Hearing when a page
          breaks, so we can fix it. Asking a restaurant, at the business email or phone it
          put online, if we may show its photos. Each is the gentlest way we could think of
          to do it.
        </li>
      </ul>

      <h2 className={`mt-12 ${sectionTitle}`}>Cookies</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        We do not use advertising or tracking cookies. Our visitor analytics, from
        Vercel, does not use cookies and does not follow you between sites. If you sign
        in, Supabase sets a cookie that keeps you signed in, because you asked to be
        signed in.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        If you tap &ldquo;Get my code&rdquo; on a restaurant deal, we set one more cookie.
        It holds a random number, so your code only works on your phone. The deal needs
        it to work. It does not follow you to other sites, and it goes after 400 days.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        PostHog counts which pages and buttons get used, and sees where people tap and
        how far they scroll. It times how fast each page loads, and it tells us when a
        page breaks. For all of that it sets no cookies and stores nothing on your
        device. To tell one visit from another, it makes a code from your IP address and
        your browser. The code changes every day. Nobody can turn it back into your IP
        address or your browser, and PostHog does not keep your IP address. It never
        gets your exact location, your full postcode, or your email address.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The one thing we ask about is recording your visit, below. Whatever you answer,
        your browser remembers it, so we do not ask again.
      </p>

      <h2 id="recordings" className={`mt-12 scroll-mt-24 ${sectionTitle}`}>Recordings</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        We ask before we record a visit. A recording shows where someone clicked, tapped
        and scrolled, and what the pages looked like. We watch them to find what is hard
        to use, so we can fix it.
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        <li>
          What you type is hidden. So is anything on the page that shows where you are:
          the place you search near, how far things are from it, and the map.
        </li>
        <li>Pages with your own details, like your account, show as an empty box.</li>
        <li>
          If you say yes, PostHog keeps a small note in your browser, so the pages of your
          visit join up. It goes when you close the tab, or as soon as you say no.
        </li>
        <li>PostHog keeps each recording for 30 days, then deletes it.</li>
        <li>You can change your answer here at any time. Saying no stops the recording.</li>
      </ul>
      <RecordingChoice />

      <h2 className={`mt-12 ${sectionTitle}`}>Who else sees it</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        We do not sell your data and we do not share it for advertising. These companies
        process it so the site can work:
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
        {PROCESSORS.map(([name, role, href]) => (
          <li key={name}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={inlineLink}
            >
              {name}
            </a>{' '}
            {role}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Some of them run servers outside the UK. Where that happens, the transfer relies
        on the safeguards in their agreements with us.
      </p>

      <h2 className={`mt-12 ${sectionTitle}`}>What you can ask for</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        {RIGHTS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Email{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={inlineLink}
        >
          {CONTACT_EMAIL}
        </a>{' '}
        and we will answer within a month. You do not have to give a reason. If you would
        rather complain to the regulator, the Information Commissioner is at{' '}
        <a
          href="https://ico.org.uk/make-a-complaint/"
          target="_blank"
          rel="noopener noreferrer"
          className={inlineLink}
        >
          ico.org.uk
        </a>
        .
      </p>

      <h2 className={`mt-12 ${sectionTitle}`}>
        Restaurants are not covered by this page
      </h2>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
        Information about a restaurant as a business, its address, its menu, what it says
        about halal, is not personal data and this page does not govern it. If you run a
        place and think we have something wrong,{' '}
        <Link href="/corrections" className={inlineLink}>
          tell us and we will fix it
        </Link>
        .
      </p>

      <p className="mt-10 border-t border-line pt-6 text-xs text-subtle">
        Last updated 3 October 2026. If we change how any of this works, we will change
        this page on the same day.
      </p>
      </div>
      </PageBody>
    </>
  );
}
