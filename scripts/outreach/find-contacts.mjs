// Finds who to ask for permission to use a place's photos, and how we are
// allowed to ask them, before anything goes into outreach_contacts.
//
//   node scripts/outreach/find-contacts.mjs                     dry run: chains plus OSM emails, writes a CSV
//   node scripts/outreach/find-contacts.mjs --limit 40          consider at most 40 chains or places (default 40)
//   node scripts/outreach/find-contacts.mjs --places            also read single places' own websites
//   node scripts/outreach/find-contacts.mjs --places=osm-email  only the places that already have an OSM email
//   node scripts/outreach/find-contacts.mjs --apply out/contacts-....csv
//                                                               insert a CSV you have checked (writes to live)
//
//   Other flags: --no-chains, --no-osm, --delay 1500 (ms between website
//   requests, never under 1000), --out path/to/file.csv, --refresh-osm (ask
//   Overpass again even about objects it answered for in the last 7 days)
//
// What it reads
//   - Our own tables, read only: restaurants (searchable ones), brands, and
//     restaurant_source_links (the OSM rows, whose source_id is like n123).
//   - OpenStreetMap through the public Overpass API: the email and
//     contact:email tags on the OSM objects our places came from. Small id
//     lookups of 400, one at a time, 10s apart, a User-Agent naming
//     yepitshalal.com, a long wait on 429 or 504. Answers are kept for 7 days
//     in out/osm-email-tags.json, so a re-run asks only about the rest. If
//     Overpass stays busy the run carries on and says how many are unchecked.
//   - A chain's or a place's OWN website: the home page and at most four
//     obvious pages (contact, privacy, terms, about). robots.txt is obeyed, one
//     request a second at most, 10s timeout, 1 MB cap, HTML only. A redirect
//     to anyone else's site (social, delivery, directory) is not followed.
//
// What it never does
//   - Never Google, TripAdvisor, Instagram, Facebook, delivery platforms or any
//     directory. catalogue/lib.mjs refuses those hosts.
//   - Never guesses an address like info@domain. Only addresses published on
//     their own pages (mailto links, plain text, structured data, Cloudflare's
//     encoded links) or in OSM's email / contact:email tags.
//   - Never uses Companies House. The only limited company evidence is the
//     place's own website naming the company ("XYZ Ltd", "Registered in
//     England", "Company number 12345678").
//   - Never writes to the database unless you pass --apply with a CSV. The dry
//     run only reads, and writes a CSV to scripts/outreach/out/ (git ignored).
//   - Never prints the service role key, and puts no secret in the CSV.
//
// The rule (migration 0054, and PECR, which treats sole traders and
// partnerships as people): channel 'email' only for a chain's head office, or
// for a limited company whose own website names the company, and only with an
// address we found published. Everyone else gets 'phone' if we know a number,
// otherwise 'contact_form'. The email column is still filled in where we found
// one, so the list is complete, but nothing is ever sent to it.
//
// A chain is a brand with 2 or more searchable branches. One head office row
// covers every branch (brand_id set, restaurant_id empty), so OSM emails of
// chain branches are left out. The chain's site is brands.website_url, or else
// a site at least two of its branches list that carries the chain's name.
//
// --apply reads a CSV this script wrote (after you have checked it), checks
// every row against the rule again, skips any email already in
// outreach_contacts (any case), any place or chain that already has a contact,
// and anything on outreach_stop_list, then inserts the rest: status 'ready'
// for email rows, 'new' for the others. Sending stays off until it is switched
// on in /admin/outreach.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { hostMatchesName, websiteHost, websiteUrl } from '../catalogue/lib.mjs';
import { allowedByRobots, parseRobots } from '../catalogue/page-text.mjs';

// --- Flags -------------------------------------------------------------------------
const ARGS = process.argv.slice(2);
function arg(name) {
  const eq = ARGS.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = ARGS.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const next = ARGS[i + 1];
  return next && !next.startsWith('--') ? next : true;
}
function fail(message) {
  console.error(message);
  process.exit(1);
}

const APPLY = arg('apply');
if (APPLY === true) fail('--apply needs the CSV to insert: --apply scripts/outreach/out/contacts-....csv');
const LIMIT = Number(arg('limit') ?? 40);
if (!Number.isInteger(LIMIT) || LIMIT < 1) fail('--limit needs a whole number, like --limit 40');
const PLACES_ARG = arg('places');
const PLACES = PLACES_ARG === undefined ? null : PLACES_ARG === true || PLACES_ARG === 'all' ? 'all' : PLACES_ARG;
if (PLACES && PLACES !== 'all' && PLACES !== 'osm-email') fail('--places takes nothing, "all" or "osm-email"');
const NO_CHAINS = ARGS.includes('--no-chains');
const NO_OSM = ARGS.includes('--no-osm');
const DELAY_MS = Math.max(1000, Number(arg('delay') ?? 1000) || 1000);
const OUT_ARG = arg('out');

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_000_000;
const MAX_PAGES = 5; // the home page and four more
const UA = 'YepItsHalalBot/1.0 (+https://yepitshalal.com; finds published contact details to ask restaurants for photo permission)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const OSM_BATCH = 400;
const OSM_PAUSE_MS = 10_000;
const OSM_CACHE_DAYS = 7;
const REFRESH_OSM = ARGS.includes('--refresh-osm');

// --- Database (the key is read, never printed) -------------------------------------
const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) fail('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function readAll(table, columns, order, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(columns);
    if (filter) q = filter(q);
    for (const col of order) q = q.order(col);
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// --- Small helpers -------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normEmail = (e) => String(e ?? '').trim().toLowerCase();
/** Same as lib/outreach/data.ts: digits only, +44 as 0, at least ten digits. */
const phoneDigits = (p) => {
  const d = String(p ?? '').replace(/\D/g, '').replace(/^44/, '0');
  return d.length >= 10 ? d : null;
};
const mask = (email) => {
  const [local, domain] = String(email).split('@');
  return local && domain ? `${local[0]}***@${domain}` : '';
};
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function baseDomain(host) {
  const p = String(host).toLowerCase().replace(/^www\./, '').split('.');
  if (p.length > 2 && p[p.length - 1].length === 2 && /^(co|org|ac|gov|net|me|ltd|plc|sch)$/.test(p[p.length - 2])) {
    return p.slice(-3).join('.');
  }
  return p.slice(-2).join('.');
}

// --- What counts as a published address ------------------------------------------------
const EMAIL_SHAPE = /^[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}$/;
const FILE_TLD = /\.(png|jpe?g|gif|webp|svg|avif|css|js|ico|mp4|pdf|php|html?)$/;
const JUNK_DOMAIN = /(^|\.)(example\.(com|org|net|co\.uk)|domain\.(com|co\.uk)|yourdomain\.[a-z.]+|email\.com|sentry\.io|wixpress\.com|sentry-next\.wixpress\.com|mysite\.com|test\.com|company\.com|website\.com|address\.com)$/;
const JUNK_LOCAL = /^(your|yourname|your\.name|name|email|user|username|someone|john\.?doe|jane\.?doe|firstname|first\.last|test)$/;

function cleanEmail(raw) {
  let e = String(raw ?? '').trim().replace(/^mailto:/i, '');
  try { e = decodeURIComponent(e); } catch { /* keep as is */ }
  e = e.split('?')[0].trim().toLowerCase().replace(/[.,;:)]+$/, '');
  if (!EMAIL_SHAPE.test(e) || FILE_TLD.test(e)) return null;
  const [local, domain] = e.split('@');
  if (JUNK_DOMAIN.test(domain) || JUNK_LOCAL.test(local)) return null;
  return e;
}

// Addresses that are published for something else. Using them to ask about
// photos would be wrong, so they are never picked, only counted in the notes.
const ROLE_SKIP = /^(privacy|dpo|gdpr|data|dataprotection|data\.protection|data-protection|dataprivacy|careers?|jobs?|recruitment|recruit|hr|people|talent|noreply|no-reply|no\.reply|donotreply|do-not-reply|invoices?|accounts?|accountspayable|payroll|abuse|postmaster|webmaster|hostmaster|unsubscribe|legal|compliance|security|finance|billing|procurement|suppliers?|whistleblowing|allergens?|complaints?|subjectaccess|sar)$/;
const RANK_LOCAL = [
  /^(marketing|press|media|pr|partnerships?|partners?|brand|social|collab|collabs|content)$/,
  /^(hello|hi|info|information|enquiries|enquiry|inquiries|inquiry|contact|contactus|general|office|headoffice|ho|team|admin|mail)$/,
  null, // anything else
  /^(customer|customers|customerservice|customercare|feedback|support|care|guest|guests|guestrelations|bookings?|reservations?|reserve|events?|orders?|catering|delivery|takeaway)$/,
];
function rankLocal(local) {
  for (let i = 0; i < RANK_LOCAL.length; i++) if (RANK_LOCAL[i] && RANK_LOCAL[i].test(local)) return i;
  return 2;
}
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'aol.com', 'aol.co.uk', 'btinternet.com', 'sky.com', 'virginmedia.com',
  'talktalk.net', 'protonmail.com', 'proton.me', 'mail.com', 'ymail.com', 'msn.com',
]);

// --- Page text (the same reading crawl-websites.mjs does) -----------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: '-', mdash: '-', hellip: '...', pound: '£', copy: '©', commat: '@', period: '.' };
function decodeEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
    }
    return ENTITIES[e.toLowerCase()] ?? ' ';
  });
}
function htmlToText(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article|footer|header)[^>]*>/gi, '. ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(`${title} . ${body}`).replace(/\s+/g, ' ').trim();
}

/** Cloudflare's "email protection": the address is in the page, XOR-encoded. */
function cfDecode(hex) {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  } catch {
    return '';
  }
}

// In page text an address can run into the next word: "info@x.co.uk.Opening
// hours". The last label must be a real ending, or it is dropped.
const COMMON_TLD = new Set([
  'com', 'net', 'org', 'uk', 'london', 'io', 'co', 'info', 'biz', 'me', 'eu', 'restaurant', 'restaurants', 'cafe', 'kitchen',
  'menu', 'pizza', 'food', 'app', 'online', 'store', 'shop', 'ltd', 'ie', 'us', 'de', 'fr', 'ae', 'pk', 'in', 'tr', 'it', 'es',
  'nl', 'global', 'group', 'world', 'delivery', 'bar', 'grill', 'coffee', 'bio', 'site', 'website', 'email', 'live', 'tv', 'xyz',
  'agency', 'events', 'catering', 'company', 'studio', 'design', 'digital', 'nyc', 'sa', 'qa', 'kw', 'bh', 'om', 'my', 'id',
  'sg', 'hk', 'au', 'ca', 'nz', 'za', 'ng', 'ke', 'gh', 'bd', 'lk', 'lb', 'jo', 'eg', 'ma', 'tn', 'gr', 'cy', 'pt', 'be', 'ch',
  'at', 'se', 'no', 'dk', 'fi', 'pl', 'ro', 'cz', 'hu', 'gg', 'je', 'im', 'gi', 'mt', 'scot', 'wales', 'cymru',
]);
function trimGluedWord(email) {
  const [local, domain] = email.split('@');
  const labels = domain.toLowerCase().split('.');
  while (labels.length > 2 && !COMMON_TLD.has(labels[labels.length - 1])) labels.pop();
  return `${local}@${labels.join('.')}`;
}

function emailsOnPage(html, text) {
  const found = [];
  const add = (raw, how) => {
    const e = cleanEmail(raw);
    if (e) found.push({ email: e, how });
  };
  for (const m of html.matchAll(/href\s*=\s*["']\s*mailto:([^"'?\s]+)/gi)) add(decodeEntities(m[1]), 'mailto link');
  for (const m of html.matchAll(/data-cfemail\s*=\s*["']([0-9a-f]{4,})["']/gi)) add(cfDecode(m[1]), 'encoded link');
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]{4,})/gi)) add(cfDecode(m[1]), 'encoded link');
  for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const m of block[1].matchAll(/"email"\s*:\s*"([^"]+)"/gi)) add(m[1], 'structured data');
  }
  for (const m of text.matchAll(/[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi)) add(trimGluedWord(m[0]), 'page text');
  // "info [at] place [dot] co [dot] uk", written out to dodge spam bots.
  for (const m of text.matchAll(/\b([a-z0-9._%+-]+)\s*[[(]\s*at\s*[\])]\s*([a-z0-9-]+(?:\s*(?:[[(]\s*dot\s*[\])]|\.)\s*[a-z0-9-]+)+)/gi)) {
    add(`${m[1]}@${m[2].replace(/\s*(?:[[(]\s*dot\s*[\])]|\.)\s*/gi, '.')}`, 'page text');
  }
  return found;
}

function telOnPage(html) {
  for (const m of html.matchAll(/href\s*=\s*["']\s*tel:([^"']+)["']/gi)) {
    let t = m[1];
    try { t = decodeURIComponent(t); } catch { /* keep */ }
    t = t.replace(/[^\d+() -]/g, '').trim();
    if (phoneDigits(t)) return t;
  }
  return null;
}

// --- Limited company evidence, only from their own pages ------------------------------
// Names in a footer that belong to someone else: the web designer, the
// platform, the payment provider. Never evidence about the restaurant.
const NOT_THEIRS = /\b(wix|squarespace|shopify|wordpress|godaddy|flipdish|deliveroo|just ?eat|uber|google|apple|stripe|paypal|facebook|meta|amazon|microsoft|opentable|sevenrooms|slerp|touch2success|foodhub|square|zonal|epos|toast|mailchimp|cloudflare|vimeo|youtube|instagram|twitter|tiktok|trustpilot|tripadvisor|yell|kukd|yoyo|cookiebot|onetrust|klaviyo|hubspot|webflow|weebly|ionos|fasthosts|worldpay|sumup|dojo|barclays|lloyds|hsbc|natwest|santander|visa|mastercard|gofundme|eventbrite|resdiary|designmynight|tabletop|deliverect|orderpay|preoday|ordering ?stack)\b/i;
// The kind of company that runs a restaurant's ordering, website or payments,
// not the restaurant: "Nash Delivery Technologies UK Limited" on Morley's site.
const SERVICE_PROVIDER = /\b(technolog(y|ies)|tech|software|solutions|systems|digital|hosting|payments?|web|design|marketing|agency|media|delivery|logistics|platform|apps?)\b/i;
const BY_CONTEXT = /(powered|designed|developed|built|hosted|made|created|crafted|website|site|web design|photography|photos?|managed|supplied|provided)\s+(by|with)\s*:?\s*$|in partnership with\s*$|partner(ed)? with\s*$/i;
const LIMITED_NOT_A_COMPANY = /^\s+(time|edition|offer|offers|availability|number|numbers|seats|seating|space|spaces|stock|period|menu|run|release|access|warranty|liability|capacity|places|tables|supply|quantities)\b/i;
const COMPANY_NAME = /((?:(?:[A-Z0-9][\w'’&-]*|&|and|of|the)\s+){0,6}?[A-Z0-9][\w'’&-]*)\s+(Ltd\.?|LTD\.?|Limited|LIMITED|PLC|Plc|plc)(?![\w])/g;
const COMPANY_NUMBER = /\b(?:company|registration|registered|reg\.?|co\.)\s*(?:no\.?|number|num\.?|#)\s*[:.]?\s*((?:SC|NI|OC|SO|NC)?\d{6,8})\b/i;
const REGISTERED_IN = /\bregistered\s+in\s+(?:England(?:\s+(?:and|&)\s+Wales)?|Wales|Scotland|Northern Ireland)\b/i;

function companyEvidence(text) {
  let best = null;
  const consider = (score, quote) => {
    if (!best || score > best.score) best = { score, quote: quote.replace(/\s+/g, ' ').trim().slice(0, 140) };
  };
  for (const m of text.matchAll(COMPANY_NAME)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 200);
    const name = m[1].replace(/^(?:(?:copyright|all|rights|reserved|\d{4}(?:\s*[-–]\s*\d{4})?|[-–])\s+)+/i, '').trim();
    if (!name || NOT_THEIRS.test(name) || SERVICE_PROVIDER.test(name) || BY_CONTEXT.test(before)) continue;
    if (/^limited$/i.test(m[2])) {
      if (LIMITED_NOT_A_COMPANY.test(after)) continue;
      const copyrightBefore = /©|copyright|\(c\)/i.test(before);
      const companyAfter = /^\W{0,3}\s*(is\s+)?(a\s+)?(company\s+)?(registered|regist|company|trading|t\/a|all rights|vat|\(|,\s*(a|registered|company))/i.test(after);
      const allCaps = m[2] === 'LIMITED' && name === name.toUpperCase();
      if (!copyrightBefore && !companyAfter && !allCaps) continue;
    }
    const number = after.match(COMPANY_NUMBER);
    let score = 2;
    let quote = `${name} ${m[2]}`;
    if (number) { score += 2; quote += `, company no ${number[1]}`; }
    if (REGISTERED_IN.test(after)) score += 1;
    consider(score, quote);
  }
  // A company number or "registered in England" on its own counts only when
  // the words just before it are not about a platform or a supplier.
  const standalone = (re, score) => {
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
      const before = text.slice(Math.max(0, m.index - 150), m.index);
      if (NOT_THEIRS.test(before) || SERVICE_PROVIDER.test(before) || /\bby\b/i.test(before)) continue;
      consider(score, m[0]);
      return;
    }
  };
  standalone(COMPANY_NUMBER, 2);
  standalone(REGISTERED_IN, 1);
  return best;
}

// --- Polite fetching --------------------------------------------------------------------
let lastRequestAt = 0;
async function throttle() {
  const wait = lastRequestAt + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

const BLOCK_STATUS = new Set([401, 403, 406, 429, 451, 503]);
const robotsCache = new Map();

/**
 * One GET, following redirects by hand so a redirect to someone else's site
 * (a Facebook page, a delivery platform) is never fetched. Each hop waits its
 * turn, and robots.txt is checked for each hop when `robots` is true.
 */
async function request(url, { kind = 'html', robots = true } = {}) {
  let current = url;
  for (let hop = 0; hop <= 4; hop++) {
    let u;
    try { u = new URL(current); } catch { return { error: 'bad address' }; }
    if (!/^https?:$/.test(u.protocol)) return { error: 'not a web address' };
    if (!websiteHost(current)) return { error: `leads to ${u.hostname}, not their own site`, leftSite: true };
    if (robots) {
      const rules = await robotsFor(u.origin);
      if (rules === 'unreachable') return { blocked: 'robots.txt did not answer (5xx), so we stay out' };
      if (!allowedByRobots(rules, u.pathname)) return { robotsDisallowed: true, url: current };
    }
    await throttle();
    let res;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'user-agent': UA,
          accept: kind === 'html' ? 'text/html,application/xhtml+xml' : 'text/plain',
          'accept-language': 'en-GB,en;q=0.8',
        },
      });
    } catch (err) {
      return { error: String(err?.cause?.code || err?.name || err).slice(0, 60) };
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {});
      current = new URL(location, current).href;
      continue;
    }
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => {});
      const challenge = res.headers.get('cf-mitigated') ? ' (Cloudflare challenge)' : '';
      return BLOCK_STATUS.has(res.status) ? { status: res.status, blocked: `HTTP ${res.status}${challenge}` } : { status: res.status, error: `HTTP ${res.status}` };
    }
    const type = res.headers.get('content-type') || '';
    const wanted = kind === 'html' ? /html|xhtml/i : /text\/plain/i;
    if (!wanted.test(type)) {
      await res.body?.cancel().catch(() => {});
      return { status: 200, error: `not ${kind === 'html' ? 'HTML' : 'text'} (${type.split(';')[0] || 'no type'})` };
    }
    try {
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (received >= MAX_BYTES) { await reader.cancel().catch(() => {}); break; }
      }
      return { status: 200, url: current, body: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8') };
    } catch (err) {
      return { error: String(err?.cause?.code || err?.name || err).slice(0, 60) };
    }
  }
  return { error: 'too many redirects' };
}

async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const res = await request(`${origin}/robots.txt`, { kind: 'text', robots: false });
  let rules = [];
  if (res.status === 200 && res.body && !/<html/i.test(res.body.slice(0, 300))) rules = parseRobots(res.body);
  // RFC 9309: a robots.txt that cannot be reached (5xx) means stay out.
  else if (res.status >= 500) rules = 'unreachable';
  robotsCache.set(origin, rules);
  return rules;
}

// Links on the home page most likely to carry an address or the company name.
const PAGE_HINTS = [
  [/contact|get-in-touch|getintouch|reach-us|find-us/i, 10],
  [/privacy|terms|legal|imprint|cookie|company-info|conditions/i, 6],
  [/about|our-story|who-we-are|story/i, 4],
  [/franchis|head-office|headoffice|corporate|press|media|partner|work-with-us/i, 3],
];

function pickLinks(html, pageUrl, host) {
  const base = new URL(pageUrl);
  const scored = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href;
    try { href = new URL(decodeEntities(m[1]), base); } catch { continue; }
    if (!/^https?:$/.test(href.protocol)) continue;
    if (href.hostname.replace(/^www\./, '') !== host) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|docx?)$/i.test(href.pathname)) continue;
    if (/career|jobs|vacanc|recruit/i.test(href.pathname)) continue;
    const label = `${href.pathname} ${m[2].replace(/<[^>]+>/g, ' ')}`.toLowerCase();
    let score = 0;
    for (const [re, s] of PAGE_HINTS) if (re.test(label)) score = Math.max(score, s);
    const key = href.origin + href.pathname;
    if (score && key !== base.origin + base.pathname && (scored.get(key) ?? 0) < score) scored.set(key, score);
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).map(([url]) => url);
}

/** Reads a chain's or a place's own site: the home page plus at most four more. */
async function readSite(startUrl) {
  const site = { homeUrl: null, contactUrl: null, pagesRead: 0, emails: [], phone: null, evidence: null, blocked: null, error: null, notes: [] };
  const origin = new URL(startUrl).origin;
  const home = await request(`${origin}/`);
  if (home.robotsDisallowed) { site.blocked = 'robots.txt asks bots to stay out'; return site; }
  if (home.blocked) { site.blocked = home.blocked; return site; }
  if (!home.body) { site.error = home.error || 'no page'; return site; }

  const pages = [home];
  site.homeUrl = home.url;
  const host = new URL(home.url).hostname.replace(/^www\./, '');
  const links = pickLinks(home.body, home.url, host);
  const queue = links.slice(0, MAX_PAGES - 1).map((url) => ({ url }));
  // A site that links nowhere useful (often one built in JavaScript): try the
  // two usual contact addresses, and stop at the first that answers.
  if (!links.some((u) => /contact/i.test(u))) {
    const extra = [`${new URL(home.url).origin}/contact`, `${new URL(home.url).origin}/contact-us`];
    queue.splice(Math.min(queue.length, MAX_PAGES - 3), 0, ...extra.map((url) => ({ url, guess: true })));
  }
  let guessed = false;
  for (const item of queue) {
    if (pages.length >= MAX_PAGES) break;
    if (item.guess && guessed) continue;
    const page = await request(item.url);
    if (page.robotsDisallowed) { site.notes.push(`robots.txt keeps us off ${new URL(item.url).pathname}`); continue; }
    if (page.status === 429) { site.blocked = 'HTTP 429 (asked us to slow down), stopped reading'; break; }
    if (!page.body) continue;
    if (item.guess) guessed = true;
    pages.push(page);
    if (/contact|get-in-touch|getintouch|reach-us|find-us/i.test(new URL(page.url).pathname) && !site.contactUrl) site.contactUrl = page.url;
  }
  site.pagesRead = pages.length;

  for (const page of pages) {
    const text = htmlToText(page.body);
    for (const f of emailsOnPage(page.body, text)) site.emails.push({ ...f, url: page.url });
    site.phone ||= telOnPage(page.body);
    const ev = companyEvidence(text);
    if (ev && (!site.evidence || ev.score > site.evidence.score)) site.evidence = { ...ev, url: page.url };
  }
  site.host = host;
  return site;
}

/** The best address for asking about photos, and what was passed over. */
function pickEmail(found, siteHost, names) {
  const seen = new Map();
  for (const f of found) if (!seen.has(f.email)) seen.set(f.email, f);
  const ok = [];
  const role = [];
  const elsewhere = [];
  let order = 0;
  for (const f of seen.values()) {
    const [local, domain] = f.email.split('@');
    order++;
    if (ROLE_SKIP.test(local)) { role.push(f.email); continue; }
    const same = baseDomain(domain) === baseDomain(siteHost);
    const free = FREE_MAIL.has(domain);
    if (!same && !free && !hostMatchesName(domain, names)) { elsewhere.push(f.email); continue; }
    ok.push({ ...f, rank: rankLocal(local) + (same ? 0 : 0.5), order });
  }
  ok.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return { best: ok[0] ?? null, others: ok.slice(1).map((f) => f.email), role, elsewhere };
}

// --- OpenStreetMap ------------------------------------------------------------------------
async function overpass(query) {
  for (const endpoint of OVERPASS) {
    let wait = 30_000;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
        signal: AbortSignal.timeout(180_000),
      }).catch(() => null);
      if (res?.status === 200) {
        // A query that ran out of time still answers 200, with a remark and
        // only part of the results. A partial list is not trusted: retry.
        try {
          const json = await res.json();
          if (!/error/i.test(json.remark ?? '')) return json;
          console.log(`  ${endpoint.split('/')[2]} ran out of time on the query: ${String(json.remark).slice(0, 80)}`);
        } catch { /* an error page with a 200: retry */ }
      }
      if (!res || [429, 502, 503, 504].includes(res.status) || res.status === 200) {
        const retryAfter = Number(res?.headers.get('retry-after'));
        const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : wait;
        console.log(`  ${endpoint.split('/')[2]} answered ${res?.status ?? 'nothing'}, waiting ${Math.round(ms / 1000)}s`);
        await res?.body?.cancel().catch(() => {});
        await sleep(ms);
        wait *= 2;
        continue;
      }
      console.log(`  ${endpoint.split('/')[2]} answered ${res.status}, trying the next server`);
      await res.body?.cancel().catch(() => {});
      break;
    }
  }
  throw new Error('Overpass would not answer. Try again later, or run with --no-osm.');
}

/** "n123" or "node/123" to "node/123". */
function osmKey(sourceId) {
  const s = String(sourceId).trim();
  let m = s.match(/^([nwr])(\d+)$/i);
  if (m) return `${{ n: 'node', w: 'way', r: 'relation' }[m[1].toLowerCase()]}/${m[2]}`;
  m = s.match(/^(node|way|relation)\/(\d+)$/i);
  return m ? `${m[1].toLowerCase()}/${m[2]}` : null;
}

function osmEmails(tags) {
  const out = [];
  for (const key of ['email', 'contact:email']) {
    for (const part of String(tags[key] ?? '').split(/[;,\s]+/)) {
      const e = cleanEmail(part);
      if (e && !out.includes(e)) out.push(e);
    }
  }
  return out;
}

// --- CSV -------------------------------------------------------------------------------------
const COLUMNS = ['restaurant_id', 'brand_id', 'name', 'slug_or_brand_slug', 'email', 'phone', 'found_at_url', 'found_how', 'business_kind', 'company_evidence_url', 'channel', 'notes'];

// A cell starting with = + - @ is a formula to a spreadsheet. Text from other
// people's websites must never run as one, so it gets a leading apostrophe,
// which --apply takes off again.
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const uncell = (s) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  if (!header || COLUMNS.some((c) => !header.includes(c))) fail(`That CSV is not one this script wrote. It needs the columns: ${COLUMNS.join(', ')}`);
  return body.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(header.map((h, i) => [h, uncell((r[i] ?? '').trim())])));
}

// --- The rule ----------------------------------------------------------------------------------
function emailAllowed(r) {
  return Boolean(
    r.email && r.found_at_url &&
    (r.business_kind === 'chain_head_office' || (r.business_kind === 'limited_company' && r.company_evidence_url))
  );
}
const channelFor = (r) => (emailAllowed(r) ? 'email' : phoneDigits(r.phone) ? 'phone' : 'contact_form');

// =================================================================================================
// --apply: insert a checked CSV. Writes to the live database. Not run by the dry run.
// =================================================================================================
async function applyCsv(path) {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  console.log(`${rows.length} rows in ${path}`);

  const probe = await sb.from('outreach_contacts').select('id', { head: true, count: 'exact' });
  if (probe.error) fail(`outreach_contacts cannot be read (${probe.error.message}). Is migration 0054 on this database? Nothing written.`);
  // If either list cannot be read, readAll throws and nothing is written.
  const existing = await readAll('outreach_contacts', 'id, email, restaurant_id, brand_id', ['id']);
  const stops = await readAll('outreach_stop_list', 'id, email, phone, restaurant_id, brand_id', ['id']);

  const haveEmail = new Set(existing.map((c) => normEmail(c.email)).filter(Boolean));
  const haveTarget = new Set(existing.flatMap((c) => [c.restaurant_id, c.brand_id]).filter(Boolean));
  const stopEmail = new Set(stops.map((s) => normEmail(s.email)).filter(Boolean));
  const stopPhone = new Set(stops.map((s) => phoneDigits(s.phone)).filter(Boolean));
  const stopTarget = new Set(stops.flatMap((s) => [s.restaurant_id, s.brand_id]).filter(Boolean));

  const counts = { emailRows: 0, otherRows: 0, alreadyEmail: 0, alreadyTarget: 0, stopList: 0, invalid: 0, nothingToContact: 0, downgraded: 0, repeatedInFile: 0, failed: 0 };
  const inFile = new Set();
  const insert = [];
  for (const r of rows) {
    const restaurantId = isUuid(r.restaurant_id) ? r.restaurant_id : null;
    const brandId = isUuid(r.brand_id) ? r.brand_id : null;
    const foundHow = ['osm', 'own_website', 'owner', 'phone_call', 'other'].includes(r.found_how) ? r.found_how : 'other';
    const kind = ['chain_head_office', 'limited_company', 'sole_trader', 'partnership', 'unsure'].includes(r.business_kind) ? r.business_kind : 'unsure';
    if (!restaurantId && !brandId) { counts.invalid++; continue; }
    if (kind === 'chain_head_office' && !brandId) { counts.invalid++; continue; }
    const email = normEmail(r.email) || null;
    if (email && !cleanEmail(email)) { counts.invalid++; continue; }
    const row = {
      restaurant_id: kind === 'chain_head_office' ? null : restaurantId,
      brand_id: brandId,
      email,
      phone: r.phone || null,
      found_at_url: r.found_at_url || null,
      found_how: foundHow,
      business_kind: kind,
      company_evidence_url: r.company_evidence_url || null,
      notes: r.notes || null,
    };
    // The rule is checked again here: a hand-edited CSV cannot make someone
    // emailable. It only ever narrows: a row you changed to phone or contact
    // form stays that way.
    const wantsEmail = r.channel === 'email';
    row.channel = wantsEmail && emailAllowed(row) ? 'email' : r.channel === 'contact_form' ? 'contact_form' : phoneDigits(row.phone) ? 'phone' : 'contact_form';
    if (wantsEmail && row.channel !== 'email') counts.downgraded++;
    if (!row.email && !phoneDigits(row.phone) && !row.found_at_url) { counts.nothingToContact++; continue; }
    if (email && haveEmail.has(email)) { counts.alreadyEmail++; continue; }
    const target = row.restaurant_id || row.brand_id;
    if (haveTarget.has(target)) { counts.alreadyTarget++; continue; }
    if ((email && stopEmail.has(email)) || stopPhone.has(phoneDigits(row.phone)) || stopTarget.has(row.restaurant_id) || stopTarget.has(row.brand_id)) {
      counts.stopList++;
      continue;
    }
    if ((email && inFile.has(email)) || inFile.has(target)) { counts.repeatedInFile++; continue; }
    if (email) inFile.add(email);
    inFile.add(target);
    row.status = row.channel === 'email' ? 'ready' : 'new';
    insert.push(row);
  }

  for (let i = 0; i < insert.length; i += 100) {
    const batch = insert.slice(i, i + 100);
    const { error } = await sb.from('outreach_contacts').insert(batch);
    const tally = (r) => (r.channel === 'email' ? counts.emailRows++ : counts.otherRows++);
    if (!error) { batch.forEach(tally); continue; }
    // One bad row should not lose the other 99: retry them one at a time.
    for (const r of batch) {
      const one = await sb.from('outreach_contacts').insert(r);
      if (one.error) {
        counts.failed++;
        console.log(`  refused (${one.error.code || 'error'}): ${r.brand_id && !r.restaurant_id ? 'chain ' + r.brand_id : 'place ' + r.restaurant_id}`);
      } else tally(r);
    }
  }

  console.log('\nInserted into outreach_contacts:');
  console.log(`  ${counts.emailRows} email rows, status 'ready' (they wait until sending is switched on)`);
  console.log(`  ${counts.otherRows} phone or contact form rows, status 'new'`);
  console.log('Skipped:');
  console.log(`  ${counts.alreadyEmail} email already in outreach_contacts`);
  console.log(`  ${counts.alreadyTarget} place or chain already has a contact`);
  console.log(`  ${counts.stopList} on the stop list`);
  console.log(`  ${counts.repeatedInFile} repeated in this file`);
  console.log(`  ${counts.nothingToContact} no email, phone or page to contact them by`);
  console.log(`  ${counts.invalid} rows that did not make sense (no place or chain, bad email)`);
  console.log(`  ${counts.failed} refused by the database`);
  if (counts.downgraded) console.log(`${counts.downgraded} rows marked email in the CSV did not meet the rule and went in as phone or contact form.`);
}

// =================================================================================================
// Dry run: read, decide, write a CSV. Nothing is written to the database.
// =================================================================================================
async function dryRun() {
  console.log('Dry run. Reads only; writes a CSV, never the database.\n');
  const restaurants = await readAll('restaurants', 'id, name, slug, brand_id, website_url, phone', ['id'], (q) => q.eq('is_searchable', true));
  const brands = await readAll('brands', 'id, name, slug, website_url', ['id']);
  const byId = new Map(restaurants.map((r) => [r.id, r]));
  const branchesOf = new Map();
  for (const r of restaurants) if (r.brand_id) (branchesOf.get(r.brand_id) ?? branchesOf.set(r.brand_id, []).get(r.brand_id)).push(r);
  const chains = brands
    .filter((b) => (branchesOf.get(b.id)?.length ?? 0) >= 2)
    .sort((a, b) => branchesOf.get(b.id).length - branchesOf.get(a.id).length || a.name.localeCompare(b.name));
  const chainIds = new Set(chains.map((c) => c.id));
  const isBranch = (r) => r.brand_id && chainIds.has(r.brand_id);
  console.log(`${restaurants.length} searchable places, ${brands.length} brands, ${chains.length} chains (2 or more searchable branches)`);

  const rows = new Map(); // "brand:<id>" or "place:<id>"
  const placeRow = (r) => {
    const key = `place:${r.id}`;
    if (!rows.has(key)) {
      rows.set(key, {
        restaurant_id: r.id, brand_id: '', name: r.name, slug_or_brand_slug: r.slug, email: '', phone: r.phone ?? '',
        found_at_url: '', found_how: '', business_kind: 'unsure', company_evidence_url: '', channel: '', notes: [],
      });
    }
    return rows.get(key);
  };
  const blockedSites = [];
  const stats = { osmLinks: 0, osmObjectsWithEmail: 0, osmEmails: new Set(), osmPlaces: 0, osmBranchEmails: 0, osmBadIds: 0, osmUnchecked: 0 };

  // --- 1. OpenStreetMap's email tags ---------------------------------------------------------
  if (!NO_OSM) {
    const links = await readAll('restaurant_source_links', 'restaurant_id, source_id', ['source_id', 'restaurant_id'], (q) => q.eq('source', 'osm'));
    const placesByKey = new Map();
    for (const l of links) {
      if (!byId.has(l.restaurant_id)) continue;
      const key = osmKey(l.source_id);
      if (!key) { stats.osmBadIds++; continue; }
      stats.osmLinks++;
      (placesByKey.get(key) ?? placesByKey.set(key, []).get(key)).push(l.restaurant_id);
    }
    const keys = [...placesByKey.keys()];

    // What Overpass already told us in the last week is kept in out/, so a
    // re-run (or one that was cut short) never asks for the same objects twice.
    const cachePath = new URL('./out/osm-email-tags.json', import.meta.url);
    let cache = { fetchedAt: new Date().toISOString(), queried: [], tags: {} };
    if (!REFRESH_OSM && existsSync(cachePath)) {
      try {
        const old = JSON.parse(readFileSync(cachePath, 'utf8'));
        if (Date.now() - Date.parse(old.fetchedAt) < OSM_CACHE_DAYS * 86_400_000) cache = old;
      } catch { /* start again */ }
    }
    const queried = new Set(cache.queried);
    const todo = keys.filter((k) => !queried.has(k));
    console.log(`\nOpenStreetMap: ${keys.length} OSM objects behind our searchable places; ${keys.length - todo.length} already asked this week. Asking Overpass about ${todo.length}, ${Math.ceil(todo.length / OSM_BATCH)} small queries one at a time.`);
    mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
    for (let i = 0; i < todo.length; i += OSM_BATCH) {
      const batch = todo.slice(i, i + OSM_BATCH);
      const ids = { node: [], way: [], relation: [] };
      for (const k of batch) { const [type, id] = k.split('/'); ids[type].push(id); }
      // Small declared limits: Overpass hands out a slot more readily to a
      // query that promises to be quick and light, and an id lookup is both.
      let query = '[out:json][timeout:60][maxsize:67108864];\n';
      const sets = [];
      for (const type of ['node', 'way', 'relation']) {
        if (!ids[type].length) continue;
        query += `${type}(id:${ids[type].join(',')})->.${type[0]};\n`;
        sets.push(`${type}.${type[0]}["email"];${type}.${type[0]}["contact:email"];`);
      }
      query += `(${sets.join('')});\nout tags;`;
      let json;
      try {
        json = await overpass(query);
      } catch {
        // Overpass is busy. Stop asking for this run rather than push; the
        // rest are asked on the next run.
        stats.osmUnchecked = todo.length - i;
        console.log(`  Overpass is too busy. ${stats.osmUnchecked} objects left unchecked this run; run again later to fill them in.`);
        break;
      }
      for (const el of json.elements ?? []) {
        const t = el.tags ?? {};
        cache.tags[`${el.type}/${el.id}`] = Object.fromEntries(['email', 'contact:email', 'phone', 'contact:phone'].filter((k) => t[k]).map((k) => [k, t[k]]));
      }
      cache.queried.push(...batch);
      writeFileSync(cachePath, JSON.stringify(cache));
      console.log(`  query ${i / OSM_BATCH + 1}: ${(json.elements ?? []).length} with an email tag`);
      if (i + OSM_BATCH < todo.length) await sleep(OSM_PAUSE_MS);
    }
    const tagsByKey = new Map(Object.entries(cache.tags).filter(([k]) => placesByKey.has(k)));

    for (const [key, tags] of tagsByKey) {
      const emails = osmEmails(tags);
      if (!emails.length) continue;
      stats.osmObjectsWithEmail++;
      emails.forEach((e) => stats.osmEmails.add(e));
      for (const id of placesByKey.get(key) ?? []) {
        const r = byId.get(id);
        if (isBranch(r)) { stats.osmBranchEmails++; continue; }
        stats.osmPlaces++;
        const row = placeRow(r);
        row.email = emails[0];
        row.found_how = 'osm';
        row.found_at_url = `https://www.openstreetmap.org/${key}`;
        if (!row.phone) row.phone = tags.phone || tags['contact:phone'] || '';
        row.notes.push(`OSM ${tags.email ? 'email' : 'contact:email'} tag`);
        if (emails.length > 1) row.notes.push(`OSM also lists ${emails.slice(1).join(' ')}`);
        if (r.website_url && !PLACES) row.notes.push('own website not read yet (run with --places)');
      }
    }
    console.log(`  ${stats.osmObjectsWithEmail} OSM objects carry an email; ${stats.osmPlaces} single places, ${stats.osmBranchEmails} chain branches (left out: the head office row covers them)`);
  }

  let budget = LIMIT;

  // --- 2. Chains: the head office, from the chain's own site --------------------------------------
  let chainsRead = 0;
  if (!NO_CHAINS) {
    const todo = chains.slice(0, budget);
    budget -= todo.length;
    console.log(`\nChains: reading ${todo.length} of ${chains.length}, largest first, one request a second.`);
    for (const [i, chain] of todo.entries()) {
      const branches = branchesOf.get(chain.id);
      const row = {
        restaurant_id: '', brand_id: chain.id, name: chain.name, slug_or_brand_slug: chain.slug, email: '', phone: '',
        found_at_url: '', found_how: '', business_kind: 'chain_head_office', company_evidence_url: '', channel: '', notes: [`chain of ${branches.length} searchable branches`],
      };
      rows.set(`brand:${chain.id}`, row);

      // The chain's site: its brand record, or one its own branches share.
      let start = websiteUrl(chain.website_url);
      if (start) {
        if (!hostMatchesName(websiteHost(start), [chain.name])) row.notes.push('chain website does not carry the chain name, check it');
      } else {
        const hostCount = new Map();
        for (const b of branches) {
          const h = websiteHost(b.website_url);
          if (h) hostCount.set(h, (hostCount.get(h) ?? 0) + 1);
        }
        const shared = [...hostCount.entries()].filter(([h, n]) => n >= 2 && hostMatchesName(h, [chain.name])).sort((a, b) => b[1] - a[1])[0];
        if (shared) {
          start = `https://${shared[0]}/`;
          row.notes.push(`website from ${shared[1]} branch listings`);
        }
      }
      const label = `[${i + 1}/${todo.length}] ${chain.name} (${branches.length})`;
      if (!start) {
        row.found_how = 'other';
        row.notes.push('no website of its own on record');
        console.log(`${label}: no website on record`);
        continue;
      }
      chainsRead++;
      const site = await readSite(start);
      applySite(row, site, [chain.name], blockedSites, start);
      console.log(`${label} ${site.host || websiteHost(start)}: ${site.blocked ? 'blocked, ' + site.blocked : site.error ? 'no answer, ' + site.error : `${site.pagesRead} pages, ${row.email ? mask(row.email) : 'no published email'}`}`);
    }
  }

  // --- 3. Single places' own websites (only with --places) -------------------------------------
  let placesRead = 0;
  if (PLACES && budget > 0) {
    const withOsmEmail = new Set([...rows.values()].filter((r) => r.restaurant_id && r.found_how === 'osm').map((r) => r.restaurant_id));
    const byHost = new Map();
    for (const r of restaurants) {
      if (isBranch(r)) continue;
      if (PLACES === 'osm-email' && !withOsmEmail.has(r.id)) continue;
      const url = websiteUrl(r.website_url);
      const host = websiteHost(url);
      // Map data sometimes gives a place the site of the business next door.
      if (!url || !hostMatchesName(host, [r.name])) continue;
      (byHost.get(host) ?? byHost.set(host, { url, places: [] }).get(host)).places.push(r);
    }
    const todo = [...byHost.entries()]
      .sort((a, b) => Number(b[1].places.some((p) => withOsmEmail.has(p.id))) - Number(a[1].places.some((p) => withOsmEmail.has(p.id))) || a[0].localeCompare(b[0]))
      .slice(0, budget);
    console.log(`\nPlaces: reading ${todo.length} of ${byHost.size} own websites, one request a second.`);
    for (const [i, [host, { url, places }]] of todo.entries()) {
      const first = places.find((p) => withOsmEmail.has(p.id)) ?? places[0];
      const row = placeRow(first);
      if (places.length > 1) row.notes.push(`same website as ${places.length - 1} other listing(s): ${places.filter((p) => p !== first).map((p) => p.slug).slice(0, 5).join(' ')}`);
      row.notes = row.notes.filter((n) => !n.startsWith('own website not read'));
      placesRead++;
      const site = await readSite(url);
      applySite(row, site, places.map((p) => p.name), blockedSites, url);
      console.log(`[${i + 1}/${todo.length}] ${first.name} ${host}: ${site.blocked ? 'blocked, ' + site.blocked : site.error ? 'no answer, ' + site.error : `${site.pagesRead} pages, ${row.email ? mask(row.email) : 'no email'}${row.business_kind === 'limited_company' ? ', names a limited company' : ''}`}`);
    }
  }

  // --- Decide the channel, and keep each address on one row only --------------------------------
  const ordered = [...rows.values()].sort((a, b) => Number(Boolean(b.brand_id && !b.restaurant_id)) - Number(Boolean(a.brand_id && !a.restaurant_id)));
  const used = new Map();
  let repeated = 0;
  for (const r of ordered) {
    if (r.email) {
      const e = normEmail(r.email);
      if (used.has(e)) {
        r.notes.push(`same address as the row for ${used.get(e)}, left off this one`);
        r.email = '';
        repeated++;
        if (r.found_how === 'osm') { r.found_at_url = ''; r.found_how = ''; }
      } else used.set(e, r.name);
    }
    if (!r.found_how) r.found_how = r.found_at_url ? 'own_website' : 'other';
    r.channel = channelFor(r);
  }

  // --- Write the CSV --------------------------------------------------------------------------------
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const outPath = OUT_ARG && OUT_ARG !== true ? OUT_ARG : fileURLToPath(new URL(`./out/contacts-${stamp}.csv`, import.meta.url));
  mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
  const lines = [COLUMNS.join(',')];
  for (const r of ordered) lines.push(COLUMNS.map((c) => csvCell(c === 'notes' ? r.notes.join('; ') : r[c])).join(','));
  writeFileSync(outPath, '﻿' + lines.join('\r\n') + '\r\n');

  // --- Report -----------------------------------------------------------------------------------------
  const chainRows = ordered.filter((r) => r.business_kind === 'chain_head_office');
  const emailRows = ordered.filter((r) => r.channel === 'email');
  console.log('\nSummary');
  console.log(`  Chains on the site: ${chains.length}. Considered this run: ${chainRows.length}, of which ${chainsRead} had a website we tried.`);
  console.log(`  Chains with a published email: ${chainRows.filter((r) => r.email).length}`);
  if (!NO_OSM) {
    console.log(`  OSM emails for our searchable places: ${stats.osmEmails.size} addresses on ${stats.osmObjectsWithEmail} OSM objects`);
    if (stats.osmUnchecked) console.log(`    not complete: Overpass was too busy for ${stats.osmUnchecked} objects. Run again later; it only asks about those.`);
    if (stats.osmBadIds) console.log(`    ${stats.osmBadIds} OSM ids in restaurant_source_links were not in a form we read`);
    console.log(`    on single places: ${stats.osmPlaces}; on chain branches (left out): ${stats.osmBranchEmails}`);
  }
  if (PLACES) console.log(`  Single places' websites read: ${placesRead}; naming a limited company: ${ordered.filter((r) => r.business_kind === 'limited_company').length}`);
  console.log(`  Rows: ${ordered.length}. Email allowed under the rule: ${emailRows.length}. Phone: ${ordered.filter((r) => r.channel === 'phone').length}. Contact form: ${ordered.filter((r) => r.channel === 'contact_form').length}.`);
  if (repeated) console.log(`  ${repeated} rows shared an address with an earlier row and had it taken off.`);
  if (blockedSites.length) {
    console.log(`  Sites that kept us out (${blockedSites.length}):`);
    for (const b of blockedSites) console.log(`    ${b.host}: ${b.reason}`);
  } else console.log('  No site kept us out.');
  console.log(`\nCSV: ${outPath}`);
  console.log('Check it (especially the company names in the notes), then: node scripts/outreach/find-contacts.mjs --apply <that file>');
}

function applySite(row, site, names, blockedSites, start) {
  const host = site.host || websiteHost(start);
  if (site.blocked) {
    blockedSites.push({ host, reason: site.blocked });
    row.notes.push(`site kept us out: ${site.blocked}`);
  } else if (site.error) {
    row.notes.push(`site did not answer: ${site.error}`);
  }
  row.notes.push(...site.notes);
  const pick = pickEmail(site.emails, host, names);
  if (pick.best) {
    if (row.email && row.found_how === 'osm' && row.email !== pick.best.email) row.notes.push(`OSM had ${row.email}; using the address on their own site`);
    row.email = pick.best.email;
    row.found_at_url = pick.best.url;
    row.found_how = 'own_website';
    row.notes.push(`email from a ${pick.best.how}`);
  } else if (!row.email && (site.contactUrl || site.homeUrl)) {
    row.found_at_url = site.contactUrl || site.homeUrl;
    row.found_how = 'own_website';
    if (site.homeUrl) row.notes.push(site.contactUrl ? 'no email published; contact page linked' : 'no email published in the page HTML');
  }
  if (pick.others.length) row.notes.push(`also published: ${pick.others.slice(0, 4).join(' ')}`);
  if (pick.role.length) row.notes.push(`passed over (not for this): ${pick.role.slice(0, 3).join(' ')}`);
  if (pick.elsewhere.length) row.notes.push(`passed over (another company's domain): ${pick.elsewhere.slice(0, 3).join(' ')}`);
  if (!row.phone && site.phone) row.phone = site.phone;
  if (site.evidence) {
    row.company_evidence_url = site.evidence.url;
    row.notes.push(`company named on own site: "${site.evidence.quote}"`);
    if (row.business_kind !== 'chain_head_office') row.business_kind = 'limited_company';
  }
}

// Node's fetch can throw from a socket event after a response is cut off at
// the size cap. It belongs to no request, and one odd server should not end
// the run.
process.on('uncaughtException', (err) => console.error(`ignored stray ${err?.code || err?.name || 'error'}: ${String(err?.message ?? '').slice(0, 80)}`));

try {
  if (APPLY) await applyCsv(APPLY);
  else await dryRun();
} catch (err) {
  console.error(`Stopped: ${err?.message || err}`);
  process.exit(1);
}
