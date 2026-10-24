// Step 2: read what restaurants say about themselves.
//
// A restaurant's own website is the strongest halal evidence available without
// a certifier's permission or a site visit, and the brief asks for first-party
// evidence first. For each distinct website this fetches the homepage and up to
// three pages whose links suggest a menu, dietary information, an about page or
// FAQs, then keeps short excerpts around every mention of "halal", plus flags
// for things that contradict an all-halal claim (pork, bacon, "non-halal").
//
// Manners, because these are small businesses' websites:
//   - robots.txt is fetched and obeyed for this crawler and for "*".
//   - The user agent names the crawler and where it comes from.
//   - One site is read at a time per host, a handful of pages at most.
//   - Delivery platforms and social networks are never fetched (lib.mjs):
//     their terms forbid it, and they are not the restaurant's own words.
//
// Resumable: hosts already in crawl.jsonl are skipped, so it can be stopped
// and restarted. Run: node crawl-websites.mjs

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { cachePath, readJsonl } from './lib.mjs';
import { allowedByRobots, CERTIFIER, contradictionsIn, DRINKS_LINK, excerptsAround, parseRobots } from './page-text.mjs';

const USER_AGENT =
  'YepItsHalalBot/1.0 (+https://yepitshalal.com; reads restaurant sites for halal information)';
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY || 48);
const TIMEOUT_MS = 10000;
const MAX_BYTES = 1_500_000;
const MAX_EXTRA_PAGES = 3;
// TEST_HOSTS=a.com,b.co.uk crawls just those, into a separate file.
const TEST_HOSTS = process.env.TEST_HOSTS ? process.env.TEST_HOSTS.split(',') : null;
// DEEP=1 is a second pass over sites that answered but never mentioned halal on
// the pages the first pass read. Many say it only on an FAQ or about page the
// homepage does not link to, so this reads the site's own sitemap and fetches
// up to four pages whose addresses suggest dietary information, skipping
// anything already read. SAMPLE=n limits it to the first n sites.
const DEEP = process.env.DEEP === '1';
const SAMPLE = Number(process.env.SAMPLE || 0);
const MAX_DEEP_PAGES = 4;
const OUT = cachePath(TEST_HOSTS ? 'crawl-test.jsonl' : DEEP ? (SAMPLE ? 'crawl-deep-sample.jsonl' : 'crawl-deep.jsonl') : 'crawl.jsonl');

// --- Work list ------------------------------------------------------------------
const entities = readJsonl(cachePath('entities.jsonl'));
const byHost = new Map();
for (const e of entities) {
  if (!e.websiteHost || !e.website) continue;
  const cur = byHost.get(e.websiteHost);
  // The shortest URL for a host is usually its homepage.
  if (!cur || e.website.length < cur.length) byHost.set(e.websiteHost, e.website);
}

const done = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line) continue;
    try { done.add(JSON.parse(line).host); } catch { /* partial last line */ }
  }
}
const firstPass = new Map();
if (DEEP) {
  for (const r of readJsonl(cachePath('crawl.jsonl'))) {
    const answered = r.pages.some((p) => p.status === 200);
    if (answered && !r.halal.length) firstPass.set(r.host, r);
  }
}
const queue = TEST_HOSTS
  ? TEST_HOSTS.map((h) => [h, byHost.get(h) || `https://${h}/`])
  : DEEP
    ? [...firstPass.keys()].filter((h) => !done.has(h)).slice(0, SAMPLE || undefined).map((h) => [h, firstPass.get(h).startUrl])
    : [...byHost.entries()].filter(([h]) => !done.has(h));
console.log(`hosts total ${byHost.size}, already crawled ${done.size}, to crawl ${queue.length}`);

// --- HTTP -----------------------------------------------------------------------
async function get(url, { accept = 'text/html' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en-GB,en;q=0.8' },
    });
    const type = res.headers.get('content-type') || '';
    if (accept === 'text/html' && !/html|xml|text\/plain/i.test(type)) {
      return { status: res.status, finalUrl: res.url, body: '' };
    }
    const reader = res.body?.getReader();
    let received = 0;
    const chunks = [];
    if (reader) {
      for (;;) {
        const { done: end, value } = await reader.read();
        if (end) break;
        received += value.byteLength;
        chunks.push(value);
        if (received > MAX_BYTES) { controller.abort(); break; }
      }
    }
    const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    return { status: res.status, finalUrl: res.url, body };
  } catch (err) {
    return { status: 0, error: String(err?.cause?.code || err?.name || err).slice(0, 60) };
  } finally {
    clearTimeout(timer);
  }
}

// --- Text -----------------------------------------------------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: '-', mdash: '-', hellip: '...', pound: '£' };

function htmlToText(html) {
  const meta = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["']/gi)]
    .map((m) => m[1]).join(' . ');
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, '. ')
    .replace(/<[^>]+>/g, ' ');
  return `${title} . ${meta} . ${body}`
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
      }
      return ENTITIES[e.toLowerCase()] ?? ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Sitemaps (deep pass) -----------------------------------------------------------
const DEEP_PATH = /halal|faq|question|about|our-?story|allergen|dietary|diet|nutrition|sourcing|our-?food|our-?meat|ingredients/i;

async function sitemapPages(host, robotsBody) {
  const listed = [...(robotsBody || '').matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  const candidates = listed.length ? listed.slice(0, 3) : [`https://${host}/sitemap.xml`, `https://${host}/wp-sitemap.xml`];
  const found = new Set();
  const seenMaps = new Set();
  const queueMaps = [...candidates];
  while (queueMaps.length && seenMaps.size < 6) {
    const url = queueMaps.shift();
    if (seenMaps.has(url)) continue;
    seenMaps.add(url);
    const res = await get(url, { accept: 'application/xml' });
    if (res.status !== 200 || !/<(urlset|sitemapindex)/i.test(res.body || '')) continue;
    const locs = [...res.body.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
    if (/<sitemapindex/i.test(res.body)) {
      // Page sitemaps first: product and post sitemaps are rarely about the food.
      queueMaps.push(...locs.sort((a, b) => Number(/page/i.test(b)) - Number(/page/i.test(a))));
    } else {
      for (const loc of locs) {
        try {
          const u = new URL(loc);
          if (u.hostname.replace(/^www\./, '') === host && DEEP_PATH.test(u.pathname)) found.add(u.origin + u.pathname);
        } catch { /* not a URL */ }
      }
    }
  }
  return [...found].sort((a, b) => Number(/halal/i.test(b)) - Number(/halal/i.test(a)) || a.length - b.length);
}

// --- One host ----------------------------------------------------------------------
async function crawlHost(host, startUrl) {
  const record = { host, startUrl, crawledAt: new Date().toISOString(), pages: [], halal: [], flags: {}, certifierMention: false };

  let rules = [];
  const robots = await get(`https://${host}/robots.txt`, { accept: 'text/plain' });
  const robotsBody = robots.status === 200 && robots.body && !/<html/i.test(robots.body.slice(0, 200)) ? robots.body : '';
  if (robotsBody) rules = parseRobots(robotsBody);

  const visited = new Set();
  const queuePages = [startUrl];
  if (new URL(startUrl).pathname !== '/') queuePages.push(`https://${host}/`);
  let pageLimit = 1 + MAX_EXTRA_PAGES;

  if (DEEP) {
    const before = firstPass.get(host);
    for (const p of before?.pages || []) {
      for (const u of [p.url, p.finalUrl].filter(Boolean)) {
        try { const x = new URL(u); visited.add(x.origin.replace('://www.', '://') + x.pathname.replace(/\/$/, '')); } catch { /* skip */ }
      }
    }
    queuePages.length = 0;
    queuePages.push(...(await sitemapPages(host, robotsBody)));
    pageLimit = MAX_DEEP_PAGES;
  }

  while (queuePages.length && record.pages.length < pageLimit) {
    const url = queuePages.shift();
    let parsed;
    try { parsed = new URL(url); } catch { continue; }
    const key = DEEP ? parsed.origin.replace('://www.', '://') + parsed.pathname.replace(/\/$/, '') : parsed.origin + parsed.pathname;
    if (visited.has(key)) continue;
    visited.add(key);
    if (!allowedByRobots(rules, parsed.pathname)) { record.pages.push({ url, robotsBlocked: true }); continue; }

    const page = await get(url);
    record.pages.push({ url, status: page.status, finalUrl: page.finalUrl, error: page.error });
    if (page.status !== 200 || !page.body) continue;

    const text = htmlToText(page.body);
    const finalUrl = page.finalUrl || url;
    for (const ex of excerptsAround(text, /\bhalal\b/gi)) {
      if (record.halal.length < 12) record.halal.push({ url: finalUrl, excerpt: ex });
    }
    for (const [flag, v] of Object.entries(contradictionsIn(text, finalUrl))) record.flags[flag] = record.flags[flag] || v;
    if (CERTIFIER.test(text)) record.certifierMention = true;

    // Only on the first page: pick the internal links most likely to say what
    // is served. Same host only, no files, no query-string duplicates.
    if (!DEEP && record.pages.length === 1) {
      const base = new URL(finalUrl);
      const scored = [];
      for (const m of page.body.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        let href;
        try { href = new URL(m[1], base); } catch { continue; }
        if (href.hostname.replace(/^www\./, '') !== host) continue;
        if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4)$/i.test(href.pathname)) continue;
        const label = `${href.pathname} ${m[2].replace(/<[^>]+>/g, ' ')}`.toLowerCase();
        let score = 0;
        if (/halal/.test(label)) score += 5;
        if (/menu|food|eat|dish/.test(label)) score += 3;
        if (/faq|allergen|dietary|about|our-story|story/.test(label)) score += 2;
        if (DRINKS_LINK.test(label)) score += 3;
        if (score) scored.push({ url: href.origin + href.pathname, score });
      }
      scored.sort((a, b) => b.score - a.score);
      for (const s of scored) if (!queuePages.includes(s.url)) queuePages.push(s.url);
    }
  }
  return record;
}

// --- Run --------------------------------------------------------------------------
// Node's fetch can throw an internal assertion from a socket event when a
// response is aborted mid-stream. It belongs to no request we can catch, and
// one misbehaving server should not end a crawl of thousands.
process.on('uncaughtException', (err) => {
  console.error(`ignored uncaught ${err?.code || err?.name || 'error'}`);
});

let next = 0;
let finished = 0;
let withHalal = 0;
const started = Date.now();

async function worker() {
  while (next < queue.length) {
    const [host, url] = queue[next++];
    let rec;
    try {
      rec = await crawlHost(host, url);
    } catch (err) {
      rec = { host, startUrl: url, crawledAt: new Date().toISOString(), error: String(err).slice(0, 120), pages: [], halal: [], flags: {} };
    }
    appendFileSync(OUT, JSON.stringify(rec) + '\n');
    finished++;
    if (rec.halal.length) withHalal++;
    if (finished % 500 === 0) {
      const rate = finished / ((Date.now() - started) / 60000);
      console.log(`${finished}/${queue.length} hosts, ${withHalal} mention halal, ${rate.toFixed(0)}/min, eta ${((queue.length - finished) / rate).toFixed(0)} min`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: ${finished} hosts crawled, ${withHalal} mention halal`);
