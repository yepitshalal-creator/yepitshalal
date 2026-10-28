// The site answers on www and permanently redirects the bare domain to it, so
// www is the address it is actually known by. Every canonical link, sitemap
// entry and structured-data URL has to say the same thing, or a crawler is told
// the page's real address is one that redirects somewhere else.
const PRODUCTION_URL = 'https://www.yepitshalal.com';

/**
 * The address the site is known by, for canonical links, the sitemap, structured
 * data, emails and payment return links.
 *
 * In production a deployment address (*.vercel.app) in NEXT_PUBLIC_SITE_URL is
 * ignored: search engines would take it for the real site and index that
 * instead of yepitshalal.com. The bare domain is corrected to www for the
 * reason above. Elsewhere (local, previews) the setting is used as given.
 */
function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (!configured) return PRODUCTION_URL;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return PRODUCTION_URL;
  }
  if (process.env.VERCEL_ENV === 'production') {
    if (/\.vercel\.app$/i.test(url.hostname)) return PRODUCTION_URL;
    if (url.hostname === 'yepitshalal.com') return PRODUCTION_URL;
  }
  return configured;
}

export const SITE_URL = resolveSiteUrl();

/**
 * The address a visitor writes to about their data, a wrong halal label, or
 * anything else that needs a person.
 *
 * It is published on /privacy, /terms and /corrections, so it has to receive
 * mail. Set up forwarding before those pages go live: a privacy notice naming
 * an address that bounces is worse than one that names none, because it is the
 * first thing an ICO complaint checks.
 */
export const CONTACT_EMAIL = 'hello@yepitshalal.com';

/**
 * The three inboxes, and the only three. Each is a Namecheap forwarding alias,
 * and all three were confirmed as accepting mail from Resend on 2026-09-23.
 *
 *   hello  anything general: site feedback, city and language requests
 *   info   business: new restaurants, ownership claims, partnerships
 *   help   support: verification requests, corrections, edits to a listing
 *
 * Where a form's email lands is decided here and in lib/notify.ts, never in the
 * page, so a visitor is never shown the routing.
 */
export const INBOX = {
  hello: 'hello@yepitshalal.com',
  info: 'info@yepitshalal.com',
  help: 'help@yepitshalal.com',
} as const;

export type Inbox = keyof typeof INBOX;

/**
 * Where form mail is actually delivered, from 2026-10-03.
 *
 * INBOX above is what a visitor sees. This is where the message lands. The two
 * are deliberately separate: the published addresses stay on the domain,
 * because a privacy notice naming a gmail.com address is the first thing an ICO
 * complaint checks, and yepitshalal.com is what is verified in Resend.
 *
 * The +tag carries the routing INBOX used to carry on its own. Gmail delivers
 * yepitshalal+help@gmail.com to yepitshalal@gmail.com, and a Gmail filter can
 * match on the tag, so support mail and business mail can still be told apart
 * in one inbox.
 *
 * This only covers mail the site sends. Mail a visitor writes to hello@, info@
 * or help@ still goes through the Namecheap forwarding, which is a setting on
 * the domain, not in this repo.
 */
export const NOTIFY_TO = {
  hello: 'yepitshalal+hello@gmail.com',
  info: 'yepitshalal+info@gmail.com',
  help: 'yepitshalal+help@gmail.com',
} as const satisfies Record<Inbox, string>;

/** Where somebody writes about a wrong label or a wrong detail. */
export const CORRECTIONS_EMAIL = INBOX.help;

/** Where a restaurant writes about a partnership. */
export const PARTNERS_EMAIL = INBOX.info;
