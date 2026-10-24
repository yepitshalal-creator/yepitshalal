// Step 2b: read the sites that only show their words in a browser.
//
// crawl-websites.mjs fetches HTML. A large share of takeaway websites are built
// on ordering platforms and page builders that draw the menu, and often a
// "100% halal" banner, with JavaScript: fetched plainly they are an empty
// shell, and some did not answer the plain fetch at all. This pass opens each
// such site in a headless browser, lets it draw, and reads the text a visitor
// would see, with exactly the same rules as the first pass (page-text.mjs).
//
// Manners, the same as crawl-websites.mjs:
//   - robots.txt is fetched and obeyed for this crawler and for "*".
//   - The browser identifies itself with the same honest user agent.
//   - It never tries to get past a bot check: a site that refuses us is left
//     alone and recorded as refused.
//   - One site at a time per host, a handful of pages at most. Images, fonts
//     and media are not downloaded.
//   - Delivery platforms and social networks are never opened (lib.mjs).
//
// Which sites: RENDER_QUEUE=path/to/queue.json, an array of { host, url, urls? }
// (the sites of listed places that the plain passes read without finding
// halal, or could not read). `urls`, when given, are the exact pages to read,
// such as a chain's branch pages. MAX_PAGES sets pages per site (default 5).
// Output: .cache/crawl-rendered.jsonl, the same shape as crawl.jsonl, plus
// `rendered: true` and a character count per page. Resumable.
//
// SITEMAP=1 is a second, sitemap-led pass (2026-09-24): instead of the home
// page and its links, it reads the pages a site's own sitemap lists under
// FAQ, halal, allergens, dietary or about, skipping every page an earlier pass
// already read. A chain's FAQ is often three clicks from its home page ("Is
// your meat halal? All of the chicken in our restaurants is halal"). Write it
// to its own file with RENDER_OUT=crawl-rendered-2.jsonl. HALAL_CAP raises the
// number of halal mentions kept per site (default 12), so a long FAQ is not
// cut off before its last answer.
//
// Needs Playwright with Chromium. PLAYWRIGHT_PATH may point at an existing
// install (its index.mjs); otherwise `npm i -D playwright` here.
//
// Run: RENDER_QUEUE=queue.json node crawl-rendered.mjs

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { cachePath, websiteHost } from './lib.mjs';
import { allowedByRobots, CERTIFIER, contradictionsIn, DRINKS_LINK, excerptsAround, parseRobots } from './page-text.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PATH).href : 'playwright');

const USER_AGENT =
  'YepItsHalalBot/1.0 (+https://yepitshalal.com; reads restaurant sites for halal information)';
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY || 8);
const MAX_PAGES = Number(process.env.MAX_PAGES || 5);
const SITEMAP = process.env.SITEMAP === '1';
const HALAL_CAP = Number(process.env.HALAL_CAP || 12);
// The pages most likely to say what is served, as the plain deep pass picks them.
const DEEP_PATH = /halal|faq|question|about|our-?story|allergen|dietary|diet|nutrition|sourcing|our-?food|our-?meat|ingredients/i;
const NAV_TIMEOUT_MS = 20000;
const SETTLE_MS = 6000;
const HOST_BUDGET_MS = 75000;
const OUT = cachePath(process.env.RENDER_OUT || 'crawl-rendered.jsonl');

if (!process.env.RENDER_QUEUE) {
  console.error('Set RENDER_QUEUE to a JSON file of { host, url }.');
  process.exit(1);
}
const done = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line) continue;
    try { done.add(JSON.parse(line).host); } catch { /* partial last line */ }
  }
}
const queue = JSON.parse(readFileSync(process.env.RENDER_QUEUE, 'utf8'))
  // Never a delivery platform or social network, whatever the queue says.
  .filter((q) => q.host && websiteHost(q.url || `https://${q.host}/`) === q.host)
  .filter((q) => !done.has(q.host));
console.log(`to render ${queue.length}, already done ${done.size}`);

// A bot check, not the restaurant's page. We stop there rather than get past it.
const BOT_WALL = /just a moment\.\.\.|attention required|verify you are (a )?human|checking your browser|access denied|enable javascript and cookies to continue|captcha|are you a robot/i;

async function fetchText(url, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: controller.signal, redirect: 'follow' });
    return { status: res.status, body: res.status === 200 ? await res.text() : '' };
  } catch {
    return { status: 0, body: '' };
  } finally {
    clearTimeout(timer);
  }
}

async function robotsFor(host) {
  const { status, body } = await fetchText(`https://${host}/robots.txt`);
  if (status !== 200 || /<html/i.test(body.slice(0, 200))) return { rules: [], body: '' };
  return { rules: parseRobots(body), body };
}

// The site's own sitemap, followed through at most six sitemap files, page
// sitemaps first. Returns the pages whose address says what the food is.
async function sitemapPages(host, robotsBody) {
  const listed = [...(robotsBody || '').matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  const maps = listed.length ? listed.slice(0, 3) : [`https://${host}/sitemap.xml`, `https://${host}/wp-sitemap.xml`];
  const found = new Set();
  const seen = new Set();
  while (maps.length && seen.size < 6) {
    const url = maps.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const { status, body } = await fetchText(url);
    if (status !== 200 || !/<(urlset|sitemapindex)/i.test(body)) continue;
    const locs = [...body.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
    if (/<sitemapindex/i.test(body)) {
      maps.push(...locs.sort((a, b) => Number(/page/i.test(b)) - Number(/page/i.test(a))));
    } else {
      for (const loc of locs) {
        try {
          const u = new URL(loc);
          if (u.hostname.replace(/^www\./, '') === host && DEEP_PATH.test(u.pathname)) found.add(u.origin + u.pathname);
        } catch { /* not a URL */ }
      }
    }
  }
  return [...found].sort((a, b) => Number(/halal/i.test(b)) - Number(/halal/i.test(a)) || Number(/faq|question/i.test(b)) - Number(/faq|question/i.test(a)) || a.length - b.length);
}

// Pages any earlier pass already read, per host, so the sitemap pass only
// reads new ones.
const pageKey = (u) => {
  try {
    const x = new URL(u);
    return x.origin.replace('://www.', '://').replace('http://', 'https://') + x.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
};
const readBefore = new Map();
if (SITEMAP) {
  for (const file of ['crawl.jsonl', 'crawl-deep.jsonl', 'crawl-rendered.jsonl']) {
    if (!existsSync(cachePath(file))) continue;
    for (const line of readFileSync(cachePath(file), 'utf8').split('\n')) {
      if (!line) continue;
      let r;
      try { r = JSON.parse(line); } catch { continue; }
      const set = readBefore.get(r.host) || new Set();
      for (const p of r.pages || []) for (const u of [p.url, p.finalUrl]) { const k = u && pageKey(u); if (k) set.add(k); }
      readBefore.set(r.host, set);
    }
  }
}

async function readPage(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  // Let the site draw: most ordering platforms fill the page after load.
  await page.waitForLoadState('networkidle', { timeout: SETTLE_MS }).catch(() => {});
  const got = await page.evaluate(() => {
    const meta = [...document.querySelectorAll('meta[name="description"], meta[property="og:description"]')]
      .map((m) => m.getAttribute('content') || '').join(' . ');
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, label: (a.textContent || '').trim().slice(0, 80) }));
    return { title: document.title || '', meta, body: document.body ? document.body.innerText : '', links };
  });
  const text = `${got.title} . ${got.meta} . ${got.body}`.replace(/\s+/g, ' ').trim();
  return { status: res ? res.status() : 0, finalUrl: page.url(), text, links: got.links };
}

// `urls`: pages to read, when the queue names them (a chain's branch pages).
async function renderHost(browser, host, startUrl, urls = null) {
  const record = { host, startUrl, crawledAt: new Date().toISOString(), rendered: true, ...(SITEMAP ? { sitemap: true } : {}), pages: [], halal: [], flags: {}, certifierMention: false };
  const { rules, body: robotsBody } = await robotsFor(host);
  // The sitemap pass reads only pages no earlier pass has read.
  let fromSitemap = null;
  if (SITEMAP) {
    const before = readBefore.get(host) || new Set();
    fromSitemap = (await sitemapPages(host, robotsBody)).filter((u) => !before.has(pageKey(u)));
    if (!fromSitemap.length) return record;
  }
  const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'en-GB', viewport: { width: 1280, height: 900 } });
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    return ['image', 'media', 'font'].includes(type) ? route.abort() : route.continue();
  });
  const page = await context.newPage();
  const started = Date.now();
  const visited = new Set();
  const queuePages = fromSitemap ?? (urls ? [...urls] : [startUrl]);
  if (!fromSitemap && !urls && new URL(startUrl).pathname !== '/') queuePages.push(`https://${host}/`);
  try {
    while (queuePages.length && record.pages.length < MAX_PAGES && Date.now() - started < HOST_BUDGET_MS) {
      const url = queuePages.shift();
      let parsed;
      try { parsed = new URL(url); } catch { continue; }
      const key = parsed.origin.replace('://www.', '://') + parsed.pathname.replace(/\/$/, '');
      if (visited.has(key)) continue;
      visited.add(key);
      if (!allowedByRobots(rules, parsed.pathname)) { record.pages.push({ url, robotsBlocked: true }); continue; }

      let got;
      try {
        got = await readPage(page, url);
      } catch (err) {
        record.pages.push({ url, status: 0, error: String(err?.name || err).slice(0, 60) });
        continue;
      }
      const wall = got.text.length < 1500 && BOT_WALL.test(got.text);
      record.pages.push({ url, status: got.status, finalUrl: got.finalUrl, chars: got.text.length, ...(wall ? { botWall: true } : {}) });
      if (wall) break;
      if (got.status !== 200) continue;

      for (const ex of excerptsAround(got.text, /\bhalal\b/gi, 150, Math.max(8, HALAL_CAP))) {
        if (record.halal.length < HALAL_CAP) record.halal.push({ url: got.finalUrl, excerpt: ex });
      }
      for (const [flag, v] of Object.entries(contradictionsIn(got.text, got.finalUrl))) record.flags[flag] = record.flags[flag] || v;
      if (CERTIFIER.test(got.text)) record.certifierMention = true;

      // From the first page only: the internal links most likely to say what is
      // served, scored exactly as the plain crawler scores them. The sitemap
      // pass has its pages already.
      if (record.pages.length === 1 && !fromSitemap && !urls) {
        const scored = [];
        for (const l of got.links) {
          let href;
          try { href = new URL(l.href); } catch { continue; }
          if (href.hostname.replace(/^www\./, '') !== host) continue;
          if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4)$/i.test(href.pathname)) continue;
          const label = `${href.pathname} ${l.label}`.toLowerCase();
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
  } finally {
    await context.close().catch(() => {});
  }
  return record;
}

const browser = await chromium.launch();
let next = 0;
let finished = 0;
let withHalal = 0;
let walls = 0;
const started = Date.now();

async function worker() {
  while (next < queue.length) {
    const { host, url, urls } = queue[next++];
    let rec;
    try {
      rec = await renderHost(browser, host, url || `https://${host}/`, urls);
    } catch (err) {
      rec = { host, startUrl: url, crawledAt: new Date().toISOString(), rendered: true, error: String(err).slice(0, 120), pages: [], halal: [], flags: {} };
    }
    appendFileSync(OUT, JSON.stringify(rec) + '\n');
    finished++;
    if (rec.halal.length) withHalal++;
    if (rec.pages.some((p) => p.botWall)) walls++;
    if (finished % 100 === 0 || finished === queue.length) {
      const rate = finished / ((Date.now() - started) / 60000);
      console.log(`${finished}/${queue.length} sites, ${withHalal} mention halal, ${walls} refused us, ${rate.toFixed(1)}/min, eta ${((queue.length - finished) / rate).toFixed(0)} min`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await browser.close();
console.log(`done: ${finished} sites rendered, ${withHalal} mention halal, ${walls} refused us`);
