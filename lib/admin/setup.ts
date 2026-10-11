import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { supporterPaymentsReady } from '@/lib/supporterReadiness';
import { readyTopups } from '@/lib/deals/topups';
import { posthogConfigured, totals } from './posthog';
import { adminCached } from './cache';
import { getStripe } from '@/lib/stripe';

// The list of small jobs that switch the site's parts on: keys, prices, DNS
// and dashboard settings. Shabir, 2026-10-10: build the backend first and
// leave the small setup jobs for the end. This is where they wait.
//
// Every item answers from the live system where it can (an environment
// variable is set, Stripe has the right price, PostHog answers, a database
// function exists). Some settings live in another company's dashboard that the
// site cannot read, such as Supabase's sign-in URLs; those are ticked by hand
// and the tick is kept in platform_settings under SETUP_MARKS_KEY.
//
// Nothing here prints a secret. A key is only ever reported as set or not.

export const SETUP_MARKS_KEY = 'admin_setup_marks';

export type SetupState = 'done' | 'todo' | 'by_hand' | 'later';

export interface SetupItem {
  id: string;
  group: SetupGroup;
  title: string;
  /** One line on what breaks until it is done. */
  why: string;
  state: SetupState;
  /** Who can do it: some need Shabir's own logins. */
  who: 'Shabir' | 'Claude' | 'Either';
  steps?: string[];
  link?: { href: string; label: string };
  /** What the live check saw, in words. */
  seen?: string;
  /** For a by-hand item: when it was ticked. */
  markedAt?: string;
}

export const SETUP_GROUPS = ['Sign in and email', 'Money', 'Analytics and jobs', 'Database and security'] as const;
export type SetupGroup = (typeof SETUP_GROUPS)[number];

const has = (name: string) => Boolean(process.env[name]?.trim());

/** Ticks given by hand, as { item id: ISO date }. */
export async function setupMarks(): Promise<Record<string, string>> {
  const { data } = await createAdminSupabase()
    .from('platform_settings')
    .select('value')
    .eq('key', SETUP_MARKS_KEY)
    .maybeSingle();
  const value = data?.value;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

// Does the live database have this function? Read from the API's own
// description of itself, so nothing is called. A function that is called to
// find out whether it exists may also do its job, which for a purge is not a
// test anyone wants.
async function rpcNames(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`rest ${res.status}`);
  const spec = (await res.json()) as { paths?: Record<string, unknown> };
  return Object.keys(spec.paths ?? {})
    .filter((p) => p.startsWith('/rpc/'))
    .map((p) => p.slice(5));
}
const cachedRpcNames = unstable_cache(rpcNames, ['admin-setup-rpc-names'], { revalidate: 3600 });

async function hasFunction(name: string): Promise<boolean | null> {
  try {
    return (await cachedRpcNames()).includes(name);
  } catch {
    return null;
  }
}

function bool(ok: boolean): SetupState {
  return ok ? 'done' : 'todo';
}

// YepItsHalal's own Stripe account, made by Shabir on 2026-10-10 as
// yepitshalal@gmail.com. The old one sits in the shared Falah Collective space.
const STRIPE_ACCOUNT = 'acct_1UMmbYPkZdRI5YcI';

interface StripeAccountState {
  id: string;
  chargesEnabled: boolean;
}

/** Which Stripe account the site's key opens, and whether it can take
 *  payments. Read only, kept ten minutes. Null when there is no key or Stripe
 *  does not answer. */
const stripeAccount = unstable_cache(
  async (): Promise<StripeAccountState | null> => {
    const stripe = getStripe();
    if (!stripe) return null;
    try {
      const account = await stripe.accounts.retrieve();
      return { id: account.id, chargesEnabled: Boolean(account.charges_enabled) };
    } catch {
      return null;
    }
  },
  ['admin-stripe-account-v1'],
  { revalidate: 600 }
);

/** Is the £30 priority check price there, live, one off and exactly £30? */
const priorityPriceReady = unstable_cache(
  async (): Promise<boolean> => {
    const stripe = getStripe();
    const id = process.env.STRIPE_PRICE_PRIORITY_VERIFICATION;
    if (!stripe || !id) return false;
    try {
      const p = await stripe.prices.retrieve(id);
      return p.active && p.type === 'one_time' && p.currency === 'gbp' && p.unit_amount === 3000;
    } catch {
      return false;
    }
  },
  ['admin-priority-price-v1'],
  { revalidate: 600 }
);

function byHand(id: string, marks: Record<string, string>): Pick<SetupItem, 'state' | 'markedAt'> {
  return marks[id] ? { state: 'done', markedAt: marks[id] } : { state: 'by_hand' };
}

export const setupItems = cache(async (): Promise<SetupItem[]> => {
  const [marks, yepPlusReady, topups, posthogWorks, retention, stripeAcct, priorityReady] = await Promise.all([
    setupMarks().catch(() => ({}) as Record<string, string>),
    supporterPaymentsReady().catch(() => false),
    readyTopups().catch(() => [] as number[]),
    posthogConfigured ? totals(7).then((t) => t !== null).catch(() => false) : Promise.resolve(false),
    hasFunction('purge_expired_personal_data'),
    stripeAccount(),
    priorityPriceReady(),
  ]);
  const onNewStripe = stripeAcct?.id === STRIPE_ACCOUNT;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  // The old style keys are long JWTs that begin "eyJ"; the new secret keys
  // begin "sb_secret_". Only the start is read.
  const legacyKeys = serviceKey.startsWith('eyJ');

  const items: SetupItem[] = [
    // Sign in and email
    {
      id: 'auth-site-url',
      group: 'Sign in and email',
      title: 'Sign-in links open yepitshalal.com',
      why: 'Until this is done, every sign-in email sends people to a test address that does not work, so nobody can sign in. That includes you, restaurant owners and supporters.',
      who: 'Either',
      steps: [
        'Open Supabase, then Authentication, then URL Configuration.',
        'Set Site URL to https://www.yepitshalal.com and press Save.',
        'Under Redirect URLs press Add URL and add https://www.yepitshalal.com/**',
        'Add https://yepitshalal.com/** the same way.',
        'Add http://localhost:3000/** so a copy of the site on a computer can sign in too.',
      ],
      link: { href: 'https://supabase.com/dashboard/project/wxiaexrsfraiktbdmdlu/auth/url-configuration', label: 'Open the setting' },
      ...byHand('auth-site-url', marks),
    },
    {
      id: 'auth-smtp',
      group: 'Sign in and email',
      title: 'Sign-in emails go out through Resend',
      why: "Supabase's own email only reaches people on the Supabase team, a few an hour. Restaurant owners and supporters would never get their link.",
      who: 'Either',
      steps: [
        'In Resend, open Settings, then Integrations, and choose Supabase.',
        'Pick the YepItsHalal project and a sender at yepitshalal.com, such as hello@yepitshalal.com.',
        'Press Connect. Resend fills in Supabase for you.',
      ],
      link: { href: 'https://resend.com/settings/integrations', label: 'Open Resend' },
      ...byHand('auth-smtp', marks),
    },
    {
      id: 'resend-key',
      group: 'Sign in and email',
      title: 'Email key saved in Vercel',
      why: 'Forms cannot email you, and the inbox cannot send replies, without it.',
      who: 'Shabir',
      state: bool(has('RESEND_API_KEY')),
      seen: has('RESEND_API_KEY') ? 'RESEND_API_KEY is set.' : 'RESEND_API_KEY is not set.',
      link: { href: 'https://vercel.com/yepitshalal-9131/yepitshalal/settings/environment-variables', label: 'Vercel settings' },
    },
    {
      id: 'resend-domain',
      group: 'Sign in and email',
      title: 'Resend has checked yepitshalal.com',
      why: 'Resend refuses to send from an address it has not checked, so every email fails until the DNS key matches.',
      who: 'Shabir',
      steps: [
        'In Resend, open Domains, then yepitshalal.com, and copy the DKIM value.',
        'In Namecheap, open Advanced DNS and edit the TXT record named resend._domainkey.',
        'Paste the value, press the green tick, then press Verify in Resend.',
      ],
      link: { href: 'https://resend.com/domains', label: 'Open Resend' },
      ...byHand('resend-domain', marks),
    },

    // Money
    {
      id: 'stripe-account',
      group: 'Money',
      title: 'Finish setting up your Stripe account',
      why: 'Stripe takes no payment until it knows who the business is and where to send the money. Only the owner can tell it that.',
      who: 'Shabir',
      state: onNewStripe && stripeAcct?.chargesEnabled ? 'done' : 'todo',
      seen: !stripeAcct
        ? 'The site has no working Stripe key.'
        : !onNewStripe
          ? "The site's key still opens the old Falah Collective account."
          : stripeAcct.chargesEnabled
            ? 'The site uses your new account, and Stripe takes payments.'
            : 'The site uses your new account, but Stripe has not switched payments on yet.',
      steps: [
        'Open Stripe and press Continue setup.',
        'Fill in the business details, your ID and the bank account. The website is https://www.yepitshalal.com.',
        'In Stripe, open Developers, then API keys, and make the secret key. Copy it into Vercel as STRIPE_SECRET_KEY (Production, Sensitive) in place of the old one, then redeploy.',
      ],
      link: { href: 'https://dashboard.stripe.com/acct_1UMmbYPkZdRI5YcI/dashboard', label: 'Open Stripe' },
    },
    {
      id: 'yep-plus-prices',
      group: 'Money',
      title: 'Yep+ prices: £2.99 a month and £24 a year',
      why: 'Until both prices match the page, the Support button stays off, so nobody can be charged the wrong amount.',
      who: 'Claude',
      state: bool(yepPlusReady),
      seen: yepPlusReady
        ? 'Both prices exist in Stripe and match the page.'
        : 'Stripe does not have both prices at the amounts the page shows.',
      steps: [
        'Claude makes a product "Yep+" with a £2.99 monthly price and a £24 yearly price, once Stripe is set up.',
      ],
    },
    {
      id: 'priority-price',
      group: 'Money',
      title: 'Priority check price: £30',
      why: 'Restaurants can pay to go first in the check queue only once this price is in the new account.',
      who: 'Claude',
      state: bool(priorityReady),
      seen: priorityReady ? 'The £30 price is in Stripe and matches the page.' : 'Stripe does not have the £30 price yet.',
      steps: ['Claude makes a one off £30 price, "Priority Verification", once Stripe is set up.'],
    },
    {
      id: 'deal-credit-prices',
      group: 'Money',
      title: 'Deal credit packs: £25 and £50',
      why: 'Restaurants can only top up with card once these exist. Their free £10 works without them.',
      who: 'Claude',
      state: bool(topups.length === 2),
      seen: `${topups.length} of 2 packs are ready in Stripe.`,
      steps: [
        'Claude makes a product "Deal credit" with one off prices of £25 and £50, once Stripe is set up.',
      ],
    },
    {
      id: 'stripe-webhook',
      group: 'Money',
      title: 'Stripe tells the site when someone pays',
      why: 'Without it a payment goes through but the site never finds out, so the supporter or the credit never appears.',
      who: 'Either',
      steps: [
        'Claude adds the webhook in Stripe once it is set up: https://www.yepitshalal.com/api/webhooks/stripe, for checkout.session.completed, customer.subscription.updated, customer.subscription.deleted and charge.refunded.',
        'You open it in Stripe, press Reveal under Signing secret, and copy it into Vercel as STRIPE_WEBHOOK_SECRET (Production, Sensitive) in place of the old one. Then redeploy.',
      ],
      seen: has('STRIPE_WEBHOOK_SECRET') ? 'A signing secret is set, but the site cannot see which account it came from.' : 'No signing secret is set.',
      ...(has('STRIPE_WEBHOOK_SECRET') ? byHand('stripe-webhook', marks) : { state: 'todo' as const }),
    },
    {
      id: 'stripe-portal',
      group: 'Money',
      title: 'Supporters can manage Yep+ themselves',
      why: "The Manage button on a supporter's account page opens Stripe's billing page, which Stripe keeps off until it is saved once.",
      who: 'Either',
      steps: ['In Stripe, open Settings, then Billing, then Customer portal. Let people cancel and update their card, then save.'],
      link: { href: 'https://dashboard.stripe.com/acct_1UMmbYPkZdRI5YcI/settings/billing/portal', label: 'Open the setting' },
      ...byHand('stripe-portal', marks),
    },

    // Analytics and jobs
    {
      id: 'posthog-key',
      group: 'Analytics and jobs',
      title: 'Analytics page reads PostHog',
      why: 'The Overview and Analytics pages show visitors only with this key.',
      who: 'Shabir',
      state: bool(posthogWorks),
      seen: !posthogConfigured
        ? 'POSTHOG_PERSONAL_API_KEY is not set.'
        : posthogWorks
          ? 'PostHog answered with this week\'s numbers.'
          : 'The key is set but PostHog did not answer. Check it has "Query read" for project 284609.',
    },
    {
      id: 'cron-secret',
      group: 'Analytics and jobs',
      title: 'Daily and weekly deal jobs can run',
      why: 'The jobs that expire old codes and email owners about low credit refuse to run without it.',
      who: 'Shabir',
      state: bool(has('CRON_SECRET')),
      seen: has('CRON_SECRET') ? 'CRON_SECRET is set.' : 'CRON_SECRET is not set.',
    },

    // Database and security
    {
      id: 'retention',
      group: 'Database and security',
      title: 'Old personal data deletes itself',
      why: 'The privacy page promises form messages are deleted after two years. The job that does it is written but not switched on.',
      who: 'Claude',
      state: retention === null ? 'by_hand' : bool(retention),
      seen:
        retention === null
          ? 'Could not ask the database.'
          : retention
            ? 'purge_expired_personal_data is in the live database.'
            : 'purge_expired_personal_data is not in the live database yet (migration 0047).',
      steps: ['Reply YES to Claude to apply migration 0047. Every table it touches is empty today.'],
    },
    {
      id: 'supabase-keys',
      group: 'Database and security',
      title: "Move to Supabase's new keys, before the end of 2026",
      why: 'The old keys stop working at the end of 2026, and moving is the only way to retire a key that leaked in September.',
      who: 'Claude',
      state: legacyKeys ? 'later' : 'done',
      seen: legacyKeys ? 'The site still uses the old style keys.' : 'The site uses the new secret key.',
      steps: ['Claude upgrades the Supabase library, then you swap the two keys in Vercel. Full order in the vault, Security follow-ups item 4.'],
    },
    {
      id: 'old-login',
      group: 'Database and security',
      title: 'Remove the old Falah login from Supabase',
      why: 'sha@falahcollective.com is still an owner of the YepItsHalal database. It should only be yepitshalal@gmail.com.',
      who: 'Shabir',
      steps: ['In Supabase, open the YepItsHalal organisation, then Team, and remove sha@falahcollective.com.'],
      link: { href: 'https://supabase.com/dashboard/org/jeuqvaxmvfwvornqkkzb/team', label: 'Open the team' },
      ...byHand('old-login', marks),
    },
  ];
  return items;
});

/** Items still to do, for the sidebar's number. "Later" items are not counted.
 *  Kept five minutes, since the sidebar asks on every page. */
export const setupOpenCount = adminCached(
  async (): Promise<number> => {
    const items = await setupItems();
    return items.filter((i) => i.state === 'todo' || i.state === 'by_hand').length;
  },
  'setup-open-v1',
  300
);
