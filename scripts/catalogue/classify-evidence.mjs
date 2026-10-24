// Step 3: turn sources into evidence records, at the strength each deserves.
//
// For every place this produces zero or more pieces of evidence:
//
//   Restaurant's own website   what it says, quoted, with the page it said it on
//   OpenStreetMap diet:halal   a community tag
//   Overture halal category    a third-party dataset's categorisation
//   Business name              the business calling itself halal
//
// Rules (deliberately conservative; the database turns evidence into labels):
//   - Only the restaurant's own clear words that ALL its meat is halal, with
//     nothing on its pages contradicting that (pork, non-cured-turkey bacon,
//     prosciutto, "non-halal"), become strong evidence of fully halal. Every
//     one of those is listed in review-strong.tsv for a person to confirm
//     before import; anything not confirmed is imported at moderate strength.
//   - A restaurant saying it is HMC or HFA certified is recorded as a claim of
//     certification, not as certification. It is not confirmed with the
//     certifier, so it is moderate, which cannot produce Fully Halal.
//   - "Halal options", or halal food alongside pork or non-halal wording, is
//     moderate evidence of Halal Options.
//   - A chain website saying halal is only served at some branches, without
//     saying which, records nothing for any branch: neither a listing nor a
//     claim that a branch is not halal.
//   - Names, tags and categories are weak whatever they claim: at most
//     Unverified.
//   - A branch with no website of its own takes its chain's statement, for the
//     short list of chains whose central sites were read (CHAINS below), and
//     never above moderate.
//   - Text a site builder or ordering platform repeats across the sites it
//     hosts is not any restaurant speaking, nor is a review widget, and hosts
//     listed in screened-out.json were read and found not to be the listed
//     place.
//   - On a site several places share, a page or sentence naming an area in
//     another borough is that branch's alone (see namesAnotherArea).
//
// Output: .cache/evidence.jsonl (one line per place with evidence) and review
// files. Run: node classify-evidence.mjs

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cachePath, hostMatchesName, normaliseName, readJsonl } from './lib.mjs';
import { alcoholMentions, CONTRADICTIONS } from './page-text.mjs';

const TODAY = new Date().toISOString();

const entities = readJsonl(cachePath('entities.jsonl'));
const crawl = new Map();
for (const r of readJsonl(cachePath('crawl.jsonl'))) crawl.set(r.host, r);
// The second, sitemap-led pass (crawl-websites.mjs with DEEP=1) only read sites
// the first pass found nothing on. Its pages count exactly like the first
// pass's: mentions and contradiction flags from both are judged together. So
// do the pages of the rendered pass (crawl-rendered.mjs), which read in a real
// browser the sites the plain passes found empty or could not read, and of its
// sitemap-led second pass (SITEMAP=1, crawl-rendered-2.jsonl).
// crawl-rendered-3.jsonl and -4.jsonl are the 2026-10-01 passes: -3 over sites
// that had a halal signal but whose own site we had barely read, -4 over sites
// no plain fetch ever got a page from.
for (const pass of ['crawl-deep.jsonl', 'crawl-rendered.jsonl', 'crawl-rendered-2.jsonl', 'crawl-rendered-3.jsonl', 'crawl-rendered-4.jsonl'].filter((f) => existsSync(cachePath(f)))) {
  // Blog, news and event pages are left out: "Best halal food in London" on a
  // marketing post is not a statement about what this kitchen serves.
  const EDITORIAL = /\/(blog|blogs|news|post|posts|article|articles|events?|whats-?on|journal|stories|recipes?|press|magazine|guides?)(\/|$)/i;
  for (const d of readJsonl(cachePath(pass))) {
    const r = crawl.get(d.host);
    if (!r || !d.pages.length) continue;
    const editorial = (u) => { try { return EDITORIAL.test(new URL(u).pathname); } catch { return false; } };
    r.pages = [...r.pages, ...d.pages];
    r.halal = [...r.halal, ...d.halal.filter((m) => !editorial(m.url))];
    r.flags = { ...d.flags, ...r.flags };
    r.certifierMention = r.certifierMention || d.certifierMention;
    if (d.halal.length) r.crawledAt = d.crawledAt;
  }
}
// The alcohol pass (2026-09-28) read again, drinks pages first, the sites
// behind every Fully Halal label. It adds what contradicts a claim, never a
// claim: its halal mentions are left out, so no label can gain from it.
// A site that has moved is read at its new address (waterfrontputney.co.uk
// now opens darya.london), so what is found there goes back to every place
// whose own website opens it.
const movedTo = new Map();
for (const r of crawl.values()) {
  let to;
  try {
    to = new URL(r.pages?.[0]?.finalUrl || '').hostname.replace(/^www\./, '');
  } catch {
    continue;
  }
  if (to && to !== r.host && !crawl.has(to)) movedTo.set(to, [...(movedTo.get(to) || []), r]);
}
for (const pass of ['crawl-alcohol.jsonl'].filter((f) => existsSync(cachePath(f)))) {
  for (const d of readJsonl(cachePath(pass))) {
    if (!d.pages.length) continue;
    for (const r of crawl.has(d.host) ? [crawl.get(d.host)] : movedTo.get(d.host) || []) r.flags = { ...d.flags, ...r.flags };
  }
}

const hostCount = new Map();
for (const e of entities) if (e.websiteHost) hostCount.set(e.websiteHost, (hostCount.get(e.websiteHost) || 0) + 1);

// Decisions from a person reading review-strong.tsv, per host:
//   confirm  strong evidence of fully halal
//   reject   imported as a moderate mention instead
//   options  the statement has an exception, so halal options
//   exclude  not a place to eat, or not this place: no evidence from the site
//   skip, fully, options_forced, mention  see below
// Kept in version control next to this script, so every human decision that
// shapes a label has a record. Object form: { decision, note?, excerpt?, url?,
// ignoreFlags?, shown? }. `note` is the reviewer's record; `shown` is the
// sentence the listing shows with the evidence ("The website says diners may
// bring their own alcohol.").
const reviewPath = new URL('./review-decisions.json', import.meta.url);
const decisions = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : {};

// Hosts whose pages were read and found not to be the restaurant speaking: a
// lapsed domain now showing a directory or spam, an ordering aggregator, or a
// page about other businesses. Kept apart from review-decisions.json, which
// holds decisions about what a restaurant's own words mean. This list can only
// take a website's evidence away, never add any. { host: { reason, by, at } }
const screenPath = new URL('./screened-out.json', import.meta.url);
const screened = existsSync(screenPath) ? JSON.parse(readFileSync(screenPath, 'utf8')) : {};

// --- Website language -------------------------------------------------------------

const FOOD_CONTEXT = /\b(chicken|meat|meats|lamb|beef|mutton|goat|veal|kebab|burger|menu|dish|dishes|food|serve|served|serving|cuisine|restaurant|takeaway|grill|steak|curry|biryani|wings|shawarma|doner|option|options|certified|hmc|hfa|butcher|supplier|sourced|zabiha|zabihah|hand slaughtered|hand-slaughtered|poultry)\b/i;

// "Not halal certified" is not "not halal": a negative never matches when the
// word after "halal" is about certification.
const NEGATIVE = [
  /\b(we are|we're|we aren't|our (restaurant|kitchen|food|menu|dishes|meat|meats) (is|are)|the (restaurant|kitchen|food|menu|meat) (is|are)|this (restaurant|kitchen) is)\s+not\s+(a\s+)?halal\b(?![-\s]*(certified|certification|accredited|approved|registered))/i,
  /\b(we aren't|we're not|our (restaurants?|kitchens?|food|menu|dishes|meat|meats) (isn't|aren't))\s+(a\s+)?halal\b(?![-\s]*(certified|certification|accredited|approved|registered))/i,
  /\bnot\s+a\s+halal\s+(restaurant|kitchen|establishment|venue)\b/i,
  // "ASK Italian is not a Halal or Kosher restaurant"
  /\bnot\s+a\s+(halal\s+or\s+kosher|kosher\s+or\s+halal)\s+(restaurant|kitchen|establishment|venue)\b/i,
  // Not when one meat is named: "We do not offer halal beef at any of our
  // restaurants" is about the beef, and is PARTIAL_NOT below.
  /\b(do not|don't|does not|doesn't)\s+(serve|offer|use|sell|provide|have|stock|carry)\s+(any\s+|a\s+)?halal\b(?!\s+(beef|lamb|chicken|mutton|goat|veal|duck|turkey|burgers?|steaks?|wings|sausages?|kebabs?|doner|pepperoni|ham)\b)(?![^.]{0,30}\b(certif|accredit))/i,
  /\bnone of our (meat|meats|food|dishes)\s+(is|are)\s+halal\b/i,
  // A claim that has lapsed, or a kitchen that cannot provide it.
  /\b(is|are)\s+no\s+longer\s+halal\b/i,
  /\b(unable to|cannot|can ?not|can't|do not|don't)\s+cater\s+(for|to)\s+(a\s+)?halal\b/i,
  /\b(do not|don't|does not|doesn't)\s+(offer|serve|have)\s+any\s+[^.]{0,40}\bsuitable for\s+(a\s+)?halal\b/i,
  /\b(no|none of the) (meat|meats|dishes) (we serve|on our menu) (is|are) halal\b/i,
];

// "Our chicken wings are not halal", "We do not offer halal beef": part of the
// menu is not, so at most options.
const PARTIAL_NOT = [
  /\b(our|the)\s+[a-z ]{2,30}\s+(is|are)\s+not\s+halal\b(?![-\s]*(certified|certification|accredited|approved|registered))/i,
  /\b(do not|don't|does not|doesn't)\s+(serve|offer|use|sell|provide|have|stock|carry)\s+(any\s+)?halal\s+(beef|lamb|chicken|mutton|goat|veal|duck|turkey|burgers?|steaks?|wings|sausages?|kebabs?|doner|pepperoni|ham)\b/i,
];

// A contradiction only counts when it is not itself negated ("no pork served",
// "pork free", "zero contact with non-halal").
const NEGATED = /\b(no|never|without|free from|free of|not|don't|do not|does not|doesn't|zero|nor)\b[^.]{0,30}\b(pork|bacon|non[- ]?halal|prosciutto|pancetta)|\b(pork|bacon)[- ]free\b/i;

const CAUTION = /\b(can ?not|can'?t|unable to|do not|don'?t)\s+guarantee\b[^.]{0,40}halal|halal[^.]{0,40}\b(can ?not|can'?t)\s+be\s+guaranteed|halal[^.]{0,60}\b(can ?not|can'?t|unable to)\s+(\w+\s+)?guarantee/i;

// Words that turn a clause around. A clause is the stretch between commas,
// semicolons, colons or a joining word, so "no pork, all halal" keeps its halal
// clause and "our meat is not halal, but we offer fish" does not gain one.
// Only words before "halal" in the clause count: "halal chicken with spice
// levels from Not Hot to Reaper" is not negated. "Without" is left out, since
// "halal option available without wine" is a halal option.
const NEGATION = /\b(not|no|never|none|nor|neither|cannot|can't|can not|don't|do not|doesn't|does not|didn't|isn't|aren't|won't|unable|unfortunately)\b|n't\b/i;
const CLAUSE_SPLIT = /[,;:()]|\s[-–]\s|\b(?:but|however|although|whereas|while|and)\b/i;

/** At least one clause mentioning halal says it without negating it. */
function affirmsHalal(text) {
  return text
    .split(CLAUSE_SPLIT)
    .filter((c) => c && /\bhalal\b/i.test(c))
    .some((c) => !NEGATION.test(c.slice(0, c.search(/\bhalal\b/i))));
}

const BRANCH_SPECIFIC = /\b(selected|some of our|certain|participating|specific|a number of|a few of our|a handful of)\s+(our\s+)?(restaurants|branches|stores|sites|locations|outlets)\b|\bnot all (of )?our (restaurants|branches|stores|sites|locations)\b|\bcheck (with )?(your|the) (local )?(restaurant|branch)\b/i;

const FULLY = [
  /\ball\s+(of\s+)?(our\s+)?(meat|meats)\s+(is|are|we serve|served|used|that we (serve|use))?\s*(100\s?%\s*)?(hmc\s+|hfa\s+)?(certified\s+)?halal\b/i,
  /\b(100\s?%|fully|completely|entirely|totally)\s+halal\b/i,
  /\b(everything|all (the )?(items|dishes|food))\s+(on\s+)?(our\s+)?(menu\s+)?(is|are)\s+(100\s?%\s*)?halal\b/i,
  /\b(we\s+)?only\s+(serve|use|sell|source|buy|cook with)\s+(fresh\s+)?halal\b/i,
  /\ball\s+(of\s+)?our\s+(food|dishes|products|ingredients)\s+(is|are)\s+(100\s?%\s*)?halal\b/i,
  /\b(a|an|our)\s+(fully\s+)?halal\s+(restaurant|kitchen|takeaway|establishment)\b/i,
  // The same claim in the words London restaurants actually use. Added on
  // 2026-10-01 after reading the crawled text: each of these was a kitchen
  // saying all of its meat is halal, in a phrasing the rules above walked
  // past. They widen what is recognised, not what qualifies. A match still
  // needs nothing on the site contradicting it, and a person's confirmation
  // in review-decisions.json, before it can be strong.
  /\bstrictly\s+halal\b|\bhalal[- ]only\b/i,
  /\b100\s+per\s?cent\s+halal\b/i,
  /\b(our\s+|the\s+)?(entire|whole|full)\s+menu\s+(is|are)\s+(100\s?%\s*)?halal\b/i,
  // "All meat served is halal", "all meats used in his restaurants are halal",
  // "All the meat is halal": the first rule with a verb or an article in the way.
  /\ball\s+(of\s+)?(our\s+|the\s+)?(meat|meats)\b[^.,;!?]{0,40}?\bhalal\b/i,
  // "Is the meat halal? Yes, the meat is halal."
  /\b(our|the)\s+(meat|meats)\s+(is|are)\s+(all\s+)?(100\s?%\s*)?halal\b/i,
];

const CERT_CLAIM = /\b(hmc|hfa|halal monitoring committee|halal food authority)\b[^.]{0,60}\b(certified|approved|accredited|certification|registered)\b|\b(certified|approved|accredited)\b[^.]{0,40}\b(hmc|hfa|halal monitoring committee|halal food authority)\b|\bhalal certificate\b|\bhalal[- ]certified\s+(meat|meats|chicken|lamb|beef|restaurant|kitchen|takeaway|supplier|suppliers|butcher)\b/i;

const OPTIONS = [
  /\bhalal\s+(options?|alternatives?|choices?|menu|versions?)\b/i,
  /\bhalal\s+(chicken|meat|lamb|beef|burgers?|option)\s+(is\s+|are\s+)?(available|on request|upon request)\b/i,
  /\b(we\s+)?(also\s+)?(offer|serve|have|provide)\s+(a\s+)?(selection|range|choice)\s+of\s+halal\b/i,
  /\bsome\s+(of\s+)?our\s+(dishes|meat|meats|food|menu)\s+(is|are)\s+halal\b/i,
  /\b(can|could) be (made|prepared|cooked) halal\b/i,
];

const clip = (s, n = 280) => (s.length <= n ? s : `${s.slice(0, n - 3).replace(/\s\S*$/, '')}...`);

// Navigation menus repeat themselves ("CONTACT US. CONTACT US."); keep the
// sentence around the match, without the repetition.
function tidyExcerpt(text, re) {
  const cleaned = text.replace(/(\b[\w' ]{3,40}\.\s)(\1)+/g, '$1').replace(/\s{2,}/g, ' ').trim();
  const m = re ? cleaned.match(re) : null;
  if (!m) return clip(cleaned);
  const start = Math.max(0, cleaned.lastIndexOf('.', m.index - 1) + 1);
  const endDot = cleaned.indexOf('.', m.index + m[0].length);
  const sentence = cleaned.slice(start, endDot < 0 ? undefined : endDot + 1).trim();
  return clip(sentence.length >= 12 ? sentence : cleaned);
}

// Every sentence on the crawled pages that contains the word "halal". Patterns
// are judged on the sentence, not on a window of surrounding text, so a menu link
// ("Allergens . Halal") or a neighbouring FAQ answer cannot lend a sentence
// words it does not contain.
// Reviews a site embeds from elsewhere ("Nice halal pizza takeaway. Posted on
// Google. Trustindex verifies that the original source of the review is
// Google") are customers talking, whatever page they sit on.
const REVIEW_WIDGET = /\b(trustindex|posted on (google|facebook|tripadvisor|trustpilot|yelp)|google reviews?|verified (review|customer)|reviewed on)\b/i;

function halalSentences(mentions) {
  const out = [];
  const seen = new Set();
  for (const m of mentions) {
    const text = m.excerpt.replace(/\s+\.\s+/g, '. ');
    const review = REVIEW_WIDGET.test(text);
    for (const hit of text.matchAll(/\bhalal\b/gi)) {
      const before = text.slice(0, hit.index);
      const start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('? '), before.lastIndexOf('! '), before.lastIndexOf(' · '), before.lastIndexOf(' | ')) + 1;
      const rest = text.slice(hit.index);
      const endRel = rest.search(/[.?!](\s|$)|\s·\s|\s\|\s/);
      const end = endRel < 0 ? text.length : hit.index + endRel + 1;
      const sentence = text.slice(start, end).replace(/^[\s·|.]+/, '').trim();
      if (sentence.length < 6) continue;
      const key = sentence.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Each window of text around a mention can cut a sentence at its edge, and
      // the next window may hold the same sentence whole ("...diner-style food
      // in" and then "...diner-style food in Ealing with a focus on burgers").
      // The whole one is kept, in the cut one's place.
      if (out.some((o) => o.raw && o.raw.includes(key))) continue;
      const cut = out.findIndex((o) => o.raw && key.includes(o.raw));
      // "?." because block elements end with an inserted ". " during extraction.
      const question = /\?[\s.]*$/.test(sentence) || (/^(is|are|do|does|can|will|have)\b[^.]*\bhalal\b/i.test(sentence) && sentence.includes('?'));
      // The crawler keeps a window of text around each mention, so the first
      // sentence can be cut off mid-way ("have a separate supply chain to
      // transport halal products", after "we do not"). A fragment can still be
      // a negative or a question, but not the grounds for a halal claim when so
      // little of it survives before "halal" that a "not" could be just out of view.
      const wordsBefore = sentence.slice(0, sentence.search(/\bhalal\b/i)).trim().split(/\s+/).filter(Boolean).length;
      const fragment = start === 0 && /^[a-z]/.test(sentence) && wordsBefore < 8;
      const entry = { url: m.url, s: clip(sentence), question, fragment, raw: key, review };
      if (cut >= 0) out[cut] = entry;
      else out.push(entry);

      // An FAQ answer often never repeats the word: "Is your meat halal? Yes,
      // all of it." The question and its answer are kept together as one
      // statement, in the restaurant's own words, when the answer opens with a
      // plain yes or no.
      if (question) {
        const after = text.slice(end).replace(/^[\s.]+/, '');
        const answerEnd = after.search(/[.?!](\s|$)/);
        const answer = (answerEnd < 0 ? after : after.slice(0, answerEnd + 1)).trim();
        // No first: "We do not have…" also starts with "we do".
        const kind = QA_NO.test(answer) ? 'no' : QA_YES.test(answer) ? 'yes' : null;
        if (kind && answer.length <= 240) {
          const s = clip(`${sentence.replace(/\?[\s.]*$/, '?')} ${answer}`);
          const qaKey = s.toLowerCase();
          if (!seen.has(qaKey)) {
            seen.add(qaKey);
            out.push({ url: m.url, s, question: false, qa: kind, q: sentence, a: answer, review });
          }
        }
      }
    }
  }
  return out;
}

// Only a plain yes. "Are your cakes halal? All of our cakes are vegetarian" is
// not one, and an answer that states its own halal claim is judged as a
// sentence in its own right anyway.
const QA_YES = /^(yes|yep|yeah|absolutely|of course|indeed|certainly|definitely|we do\b)/i;
const QA_NO = /^(no\b|nope|unfortunately|sadly|sorry|i'?m afraid|we don'?t|we do not|we are not|we'?re not|we aren'?t|our (meat|food|dishes|menu) (is|are) not|not at the moment|not currently)/i;
// A question about all of the food, as opposed to one meat or one option.
const QA_ALL = /\b(is|are)\s+(all\s+)?(of\s+)?(your|the|our)\s+(meat|meats|food|menu|restaurant|restaurants|kitchen|dishes|everything)\s+(100\s?%\s+|fully\s+|completely\s+|all\s+)?halal\b|\bis\s+(everything|it all|all (the|your) (food|meat))\s+halal\b|\bdo\s+you\s+(only\s+(serve|use|cook with)|(serve|use|cook with)\s+only)\s+halal\s+(meat|meats|food|chicken and meat)\b|\bis\s+(?![\w'&. ]{0,40}\b(chicken|lamb|beef|mutton|goat|duck|turkey|veal|sauces?|cakes?|cheesecakes?|pizzas?|burgers?|steaks?|wings|gelatine?|sweets|ice cream|gelato|tea|coffee|shellfish|seafood|sushi|products?|ingredients|cheese|chocolate|doughnuts?|donuts?)\b)[\w'&. ]{2,40}\s+(a\s+)?(fully\s+)?halal(\s+(restaurant|kitchen))?\s*\?/i;
const QA_EXCEPTION = /\b(except|apart from|other than|with the exception|but|however|although|when|not all|some of|most of|majority|only (our|the) chicken)\b|^(yes,?\s+)?(all\s+)?(of\s+)?(our|the)\s+(chicken|lamb|beef|poultry)\b/i;

// Halal said as a fact about the food, not just the word appearing. The last
// alternative lets a cuisine sit between: "Halal indian & Sri Lankan Food
// restaurant Wembley" is a restaurant calling itself halal.
const POSITIVE = /\b(is|are|all|100\s?%|fully|completely|only)\s+(\S+\s+){0,3}halal\b|\bhalal[- ]?(chicken|meat|meats|beef|lamb|mutton|burgers?|kebabs?|food|menu|options?|certified|certification|approved|dishes|kitchens?|restaurants?|takeaways?|range)\b|\b(serve|serves|served|use|uses|used|offer|offers|provide|provides|sell|sells|source|sources|sourced)\s+(\S+\s+){0,2}halal\b|\bhalal\s+(?:[a-z&'-]+\s+){1,4}(?:food|cuisine|restaurant|takeaway)\b/i;

const norm = (t) => (t || '').replace(/[‘’ʼ]/g, "'");

// Text an ordering platform or site builder puts on every site it hosts. In
// September 2026 twenty London restaurants' sites, a vegetarian one among
// them, were one platform's sites, and every halal sentence on them was the
// platform's: adverts for two other businesses ("Biryani Bhaijaan Birmingham
// serves authentic halal biryani...", "Tasty Chicken Lower Clapton serves
// halal fried chicken..."), a review shown on four of them, and a wholesaler's
// advert for "pork belly" that made each one look as if it served pork.
//
// A long sentence that appears word for word on three or more sites, never
// says "we", "our" or "I", and names neither the site's business nor this
// place, is someone else speaking, and counts for none of them. A site that
// carries one is a platform's site, and anything else repeated on three or more
// of those sites, however short, and any contradiction quoted identically on
// three or more, is the platform's too. A group's own wording shared across
// its sites ("I'm afraid our meat is not halal", on six pubs) says "our", and
// still counts.
const SHARED_MIN_SITES = 3;
const SHARED_MIN_WORDS = 12;
const FIRST_PERSON = /\b(we|we're|we've|we'll|our|ours|us|i|i'm|i've|my)\b/i;
const sentencesBySite = new Map();
for (const r of crawl.values()) {
  if (!r.halal?.length) continue;
  const said = halalSentences(r.halal.map((m) => ({ ...m, excerpt: norm(m.excerpt) }))).map((x) => x.s);
  sentencesBySite.set(r.host, [...new Set(said.map((s) => s.toLowerCase()))]);
}
function sitesPerSentence(hosts, minWords) {
  const out = new Map();
  for (const host of hosts) {
    for (const s of sentencesBySite.get(host) || []) {
      if (s.split(/\s+/).length >= minWords) out.set(s, (out.get(s) || 0) + 1);
    }
  }
  return out;
}
const notTheirs = (sentence, host, names = []) =>
  !FIRST_PERSON.test(sentence) &&
  !hostMatchesName(host, [sentence]) &&
  !names.some((n) => {
    // Whole words only: "Hala" is not named in "halal".
    const name = normaliseName(n);
    return name.length >= 4 && ` ${normaliseName(sentence)} `.includes(` ${name} `);
  });
const longShared = sitesPerSentence(sentencesBySite.keys(), SHARED_MIN_WORDS);
const platformSites = new Set(
  [...sentencesBySite.keys()].filter((host) =>
    sentencesBySite.get(host).some((s) => (longShared.get(s) || 0) >= SHARED_MIN_SITES && notTheirs(s, host))
  )
);
const platformShared = sitesPerSentence(platformSites, 1);
const platformFlagCount = new Map();
for (const host of platformSites) {
  for (const [flag, v] of Object.entries(crawl.get(host).flags || {})) {
    if (flag === 'alcohol_denied') continue;
    const k = norm(v.excerpt).toLowerCase();
    platformFlagCount.set(k, (platformFlagCount.get(k) || 0) + 1);
  }
}
function someoneElsesWords(sentence, host, names) {
  const k = sentence.toLowerCase();
  if ((longShared.get(k) || 0) >= SHARED_MIN_SITES && notTheirs(sentence, host, names)) return true;
  return platformSites.has(host) && (platformShared.get(k) || 0) >= SHARED_MIN_SITES && notTheirs(sentence, host, names);
}
const platformsFlag = (host, excerpt) =>
  platformSites.has(host) && (platformFlagCount.get(norm(excerpt).toLowerCase()) || 0) >= SHARED_MIN_SITES;

// A sentence on a site shared by several places that says where it is ("a
// proud Halal-certified restaurant in Fulham") speaks for the place there, not
// for the chain's other branches (Band of Burgers, 2026-09-24). Only names of
// London areas count, so "in London" or "in town" says nothing about where.
const LONDON_AREAS = [
  'Barking', 'Dagenham', 'Barnet', 'Bexley', 'Brent', 'Bromley', 'Camden', 'Croydon', 'Ealing', 'Enfield', 'Greenwich', 'Hackney',
  'Hammersmith', 'Fulham', 'Haringey', 'Harrow', 'Havering', 'Hillingdon', 'Hounslow', 'Islington', 'Kensington', 'Chelsea',
  'Kingston', 'Lambeth', 'Lewisham', 'Merton', 'Newham', 'Redbridge', 'Richmond', 'Southwark', 'Sutton', 'Tower Hamlets',
  'Waltham Forest', 'Wandsworth', 'Westminster', 'Soho', 'Mayfair', 'Marylebone', 'Fitzrovia', 'Holborn', 'Covent Garden',
  'Shoreditch', 'Whitechapel', 'Aldgate', 'Stratford', 'Walthamstow', 'Leyton', 'Leytonstone', 'Ilford', 'Wembley', 'Southall',
  'Hayes', 'Uxbridge', 'Tooting', 'Brixton', 'Clapham', 'Balham', 'Streatham', 'Peckham', 'Camberwell', 'Brick Lane', 'Bethnal Green',
  'Mile End', 'Stepney', 'Poplar', 'Canary Wharf', 'East Ham', 'West Ham', 'Forest Gate', 'Plaistow', 'Upton Park', 'Green Street',
  'Edgware', 'Edgware Road', 'Paddington', 'Bayswater', 'Kilburn', 'Willesden', 'Harlesden', 'Acton', 'Chiswick', 'Hammersmith',
  'Shepherds Bush', "Shepherd's Bush", 'Wood Green', 'Tottenham', 'Finsbury Park', 'Holloway', 'Archway', 'Kentish Town',
  'Hampstead', 'Golders Green', 'Hendon', 'Colindale', 'Kingsbury', 'Neasden', 'Tolworth', 'Surbiton', 'Wimbledon', 'Mitcham',
  'Morden', 'Norbury', 'Thornton Heath', 'Lewisham', 'Catford', 'Deptford', 'Woolwich', 'Eltham', 'Beckton', 'Canning Town',
  'Dalston', 'Stoke Newington', 'Hoxton', 'Old Street', 'Angel', 'Euston', 'Kings Cross', "King's Cross", 'Victoria', 'Pimlico',
  'Knightsbridge', 'Earls Court', "Earl's Court", 'Notting Hill', 'Ladbroke Grove', 'Battersea', 'Putney', 'Hounslow', 'Feltham',
  'Twickenham', 'Romford', 'Hornchurch', 'Chingford', 'Palmers Green', 'Edmonton', 'Ponders End', 'Seven Kings', 'Goodmayes',
  'Chadwell Heath', 'Barkingside', 'Gants Hill', 'Wanstead', 'Woodford', 'South Woodford', 'Rainham', 'Grays', 'Elephant and Castle',
  'Borough', 'Bermondsey', 'Rotherhithe', 'Waterloo', 'South Bank', 'Leicester Square', 'Oxford Street', 'Bond Street', 'Baker Street',
  'Southgate', 'Earlsfield', 'Camden Town', 'Chalk Farm', 'Swiss Cottage', 'Belsize Park', 'Highgate', 'Muswell Hill', 'Crouch End',
  'Hornsey', 'Harringay', 'Green Lanes', 'Turnpike Lane', 'Seven Sisters', 'Stamford Hill', 'Clapton', 'Homerton', 'Bow', 'Limehouse',
  'Wapping', 'Shadwell', 'Liverpool Street', 'Moorgate', 'Farringdon', 'Clerkenwell', 'Highbury', 'Stroud Green', 'Manor House',
  'Bounds Green', 'Winchmore Hill', 'Cockfosters', 'New Southgate', 'Arnos Grove', 'Burnt Oak', 'Mill Hill', 'Finchley', 'Whetstone',
  'Cricklewood', 'Brent Cross', 'Dollis Hill', 'Queensbury', 'Stanmore', 'Wealdstone', 'Pinner', 'Northolt', 'Greenford', 'Perivale',
  'Hanwell', 'West Ealing', 'Brentford', 'Isleworth', 'Heston', 'Cranford', 'West Drayton', 'Yiewsley', 'Ruislip', 'Ickenham',
  'Eastcote', 'Northwood', 'Kew', 'Mortlake', 'Barnes', 'Teddington', 'Hampton', 'Whitton', 'East Sheen', 'Roehampton', 'Southfields',
  'Nine Elms', 'Vauxhall', 'Kennington', 'Oval', 'Stockwell', 'Herne Hill', 'Dulwich', 'East Dulwich', 'Forest Hill', 'Sydenham',
  'Crystal Palace', 'Penge', 'Anerley', 'Beckenham', 'Orpington', 'Petts Wood', 'Chislehurst', 'Sidcup', 'Bexleyheath', 'Welling',
  'Erith', 'Belvedere', 'Abbey Wood', 'Thamesmead', 'Plumstead', 'Charlton', 'Blackheath', 'Hither Green', 'Brockley', 'New Cross',
  'Nunhead', 'Surrey Quays', 'Canada Water', 'Kensal Rise', 'Kensal Green', 'Queens Park', 'Maida Vale', "St John's Wood",
  'West Hampstead', 'Park Royal', 'Hanger Lane', 'White City', 'Holland Park', 'South Kensington', 'Gloucester Road', 'West Brompton',
  'Parsons Green', 'Brook Green', 'Ravenscourt Park', 'Gunnersbury', 'Turnham Green', 'Bedfont', 'Worcester Park', 'Cheam',
  'Carshalton', 'Wallington', 'Purley', 'Coulsdon', 'Addiscombe', 'Norwood', 'South Norwood', 'West Norwood', 'Tulse Hill',
  'Colliers Wood', 'Raynes Park', 'New Malden', 'Chessington', 'Norbiton', 'Upminster', 'Harold Wood', 'Hainault', 'Chigwell',
  'Loughton', 'Buckhurst Hill', 'Lea Bridge', 'Manor Park', 'Silvertown', 'Custom House', 'Royal Docks', 'Becontree', 'Collier Row',
  'Harold Hill', 'Elm Park', 'Enfield Town', 'Southall Broadway', 'Ealing Broadway', 'Tooting Broadway', 'Tooting Bec',
];
// And places outside London, where chains with London branches also trade:
// "HALAL RESTAURANT IN NOTTINGHAM" is no London branch's statement.
const ELSEWHERE = [
  'Birmingham', 'Manchester', 'Leeds', 'Bradford', 'Leicester', 'Nottingham', 'Sheffield', 'Liverpool', 'Glasgow', 'Edinburgh',
  'Cardiff', 'Bristol', 'Luton', 'Slough', 'Reading', 'Milton Keynes', 'Coventry', 'Wolverhampton', 'Derby', 'Blackburn', 'Bolton',
  'Oldham', 'Preston', 'Newcastle', 'Sunderland', 'Middlesbrough', 'Huddersfield', 'Dewsbury', 'Peterborough', 'Northampton',
  'Oxford', 'Cambridge', 'Brighton', 'Southampton', 'Portsmouth', 'Watford', 'Crawley', 'Chatham', 'Leigh-on-Sea', 'Southend',
  'Chelmsford', 'Colchester', 'Ipswich', 'Norwich', 'Stoke', 'Walsall', 'Dudley', 'Burnley', 'Rochdale', 'Stockport', 'Wigan',
  'Kent', 'Essex', 'Surrey', 'Hertfordshire', 'Clacton', 'Basildon', 'Dartford', 'Gravesend', 'High Wycombe', 'Aylesbury',
];
const escapeRe = (a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "'?");
const AREA_NAMES = [...LONDON_AREAS, ...ELSEWHERE].sort((a, b) => b.length - a.length);
const AREA_IN = new RegExp(`\\b(?:in|across|around|near|throughout) (?:the heart of )?(${AREA_NAMES.map(escapeRe).join('|')})\\b`, 'i');
const AREA_WORDS = AREA_NAMES.map((a) => ({ name: a, words: ` ${normaliseName(a)} ` }));
const OUTSIDE_LONDON = new Set(ELSEWHERE.map((a) => ` ${normaliseName(a)} `));

// Which borough each area is in, learned from the addresses of every place we
// hold (Soho: Westminster, Stratford: Newham), because a branch's street address
// rarely names its district: Kricket Soho is at 12 Denman Street. An area names
// another branch only when it is in another borough, so two branches in one
// borough still share their pages.
const BOROUGH_PARTS = { hammersmith: 'Hammersmith and Fulham', fulham: 'Hammersmith and Fulham', kensington: 'Kensington and Chelsea', chelsea: 'Kensington and Chelsea', barking: 'Barking and Dagenham', dagenham: 'Barking and Dagenham', kingston: 'Kingston upon Thames', richmond: 'Richmond upon Thames' };
const areaBorough = new Map();
{
  const tally = new Map();
  for (const e of entities) {
    if (!e.address || !e.borough) continue;
    const here = ` ${normaliseName(e.address)} `;
    for (const a of AREA_WORDS) {
      if (OUTSIDE_LONDON.has(a.words) || !here.includes(a.words)) continue;
      const t = tally.get(a.words) ?? new Map();
      t.set(e.borough, (t.get(e.borough) || 0) + 1);
      tally.set(a.words, t);
    }
  }
  const boroughs = new Set(entities.map((e) => e.borough).filter(Boolean));
  for (const b of boroughs) areaBorough.set(` ${normaliseName(b)} `, b);
  for (const [part, b] of Object.entries(BOROUGH_PARTS)) areaBorough.set(` ${part} `, b);
  for (const [words, t] of tally) {
    if (areaBorough.has(words)) continue;
    const [best, n] = [...t.entries()].sort((x, y) => y[1] - x[1])[0];
    const total = [...t.values()].reduce((s, v) => s + v, 0);
    // Only where the addresses agree: a street name found all over London
    // ("Broadway", "Green Lanes") says nothing about one borough.
    if (n >= 3 && n / total >= 0.6) areaBorough.set(words, best);
  }
}
function elsewhere(areaWords, entity) {
  if (OUTSIDE_LONDON.has(areaWords)) return true;
  const b = areaBorough.get(areaWords);
  return Boolean(b && entity.borough && b !== entity.borough);
}
function namesAnotherArea(sentence, entity) {
  const m = sentence.match(AREA_IN);
  return Boolean(m) && elsewhere(` ${normaliseName(m[1])} `, entity);
}
// A branch page says where it is in its address too (/band-of-burgers-southgate/,
// /locations/woodgreen/): on a shared site, a page named after an area in
// another borough is that branch's, whatever its sentences say.
function pageOfAnotherArea(url, entity) {
  let path;
  try {
    path = ` ${normaliseName(decodeURIComponent(new URL(url).pathname).replace(/[-_/.]+/g, ' '))} `;
  } catch {
    return false;
  }
  const squashed = path.replace(/ /g, '');
  const named = AREA_WORDS.find((a) => path.includes(a.words) || (a.words.trim().includes(' ') && squashed.includes(a.words.replace(/ /g, ''))));
  return Boolean(named) && elsewhere(named.words, entity);
}

function websiteEvidence(entity) {
  // A single place whose website link was found to be someone else's
  // (screened-out.json, keyed "key:<entity key>").
  if (screened[`key:${entity.key}`]) return { skip: true, reason: 'screened_out' };
  const rec = entity.websiteHost && crawl.get(entity.websiteHost);
  const names = [entity.name, ...entity.sources.fsa.map((f) => f.name), ...entity.sources.overture.map((o) => o.name), entity.sources.osm?.name].filter(Boolean);
  // A website only speaks for a place whose name it plausibly belongs to. Map
  // data sometimes carries the website of a neighbour or of the building.
  if (rec?.halal?.length && !hostMatchesName(entity.websiteHost, names)) return { skip: true, reason: 'website_not_this_place' };
  if (!rec || !rec.halal?.length) return null;
  // A screened host is left out whole, or only on the paths listed for it
  // ("/locations/" on a chain whose branch pages each describe their
  // neighbours too, while its FAQ speaks for every branch).
  const screen = screened[entity.websiteHost];
  if (screen && !screen.paths) return { skip: true, reason: 'screened_out' };
  const onScreenedPath = (url) => {
    try {
      return Boolean(screen?.paths?.some((p) => new URL(url).pathname.startsWith(p)));
    } catch {
      return false;
    }
  };
  const mentions = rec.halal.filter((m) => !onScreenedPath(m.url)).map((m) => ({ ...m, excerpt: norm(m.excerpt) }));
  if (!mentions.length) return { skip: true, reason: 'screened_out' };
  // A flag recorded by an earlier crawl is read again with today's rules, so a
  // rule fixed since (Francis Bacon) does not wait for the next crawl.
  // "alcohol_denied" is a "no alcohol" sentence kept for checking, not a flag.
  const flags = Object.fromEntries(
    Object.entries(rec.flags || {})
      .filter(([k, v]) => k !== 'alcohol_denied' && !onScreenedPath(v.url))
      .map(([k, v]) => [k, { ...v, excerpt: norm(v.excerpt) }])
      .filter(([k, v]) => (k === 'alcohol' ? alcoholMentions(v.excerpt).some((m) => m.served) : !CONTRADICTIONS[k] || CONTRADICTIONS[k].test(v.excerpt)))
      .filter(([, v]) => !platformsFlag(entity.websiteHost, v.excerpt))
  );
  const decisionRaw = decisions[entity.websiteHost];
  const decision = typeof decisionRaw === 'object' && decisionRaw ? decisionRaw.decision : decisionRaw;
  // A person read a flag and found it wrong: "ignoreFlags": ["alcohol"] with a
  // note saying why ("the only mention is 'ginger wine' in a sauce").
  const ignored = new Set((typeof decisionRaw === 'object' && decisionRaw?.ignoreFlags) || []);
  // NEGATED is about pork; alcohol carries its own reading of "no alcohol".
  const liveFlags = Object.entries(flags)
    .filter(([k, v]) => !ignored.has(k) && (k === 'alcohol' || !NEGATED.test(v.excerpt)))
    .map(([k]) => k);
  const contradicted = liveFlags.length > 0;
  const chain = (hostCount.get(entity.websiteHost) || 0) > 3;
  const base = { kind: 'first_party_statement', source_name: "The restaurant's website", checked_at: rec.crawledAt || TODAY };
  const ALSO = { pork: 'pork', bacon: 'bacon', cured_pork: 'cured pork', non_halal: 'non-halal food', alcohol: 'alcohol' };
  const alsoMentions = () => `The same website also mentions ${liveFlags.map((f) => ALSO[f]).join(' and ')}.`;
  // A person reading the site found it is not a place to eat, or not this place.
  if (decision === 'exclude') return { skip: true, exclude: true, reason: 'excluded_in_review' };
  // The site's wording, read by a person, says nothing usable about this place's food.
  if (decision === 'skip') return { skip: true, reason: 'skipped_in_review' };

  // A person read the site and decided what it says. Used for chain websites,
  // where one misreading would repeat on every branch. An object form carries a
  // verbatim quote chosen by the reviewer when the automatic sentence is not the
  // one that supports the decision.
  const review = typeof decisionRaw === 'object' && decisionRaw ? decisionRaw : null;
  const FORCED = {
    fully: ['fully_halal', 'strong'],
    options_forced: ['halal_options', 'moderate'],
    mention: ['halal_mentioned', 'moderate'],
  };
  if (FORCED[decision]) {
    const [claim, strength] = FORCED[decision];
    const pool = halalSentences(mentions).filter((x) => !x.question && x.qa !== 'no' && affirmsHalal(x.qa ? (/\bhalal\b/i.test(x.a) ? x.a : x.q) : x.s));
    const x = review?.excerpt
      ? { url: review.url || mentions[0].url, s: review.excerpt }
      : pool.find((p) => POSITIVE.test(p.s)) || pool[0];
    // Every "fully" here was decided before alcohol was read for (2026-09-28).
    // Alcohol found since takes it to options, unless a person has ruled on it.
    // The note names alcohol only: the person who decided "fully" had already
    // read the other flags and overruled them (Thunderbird's "Not halal
    // options" is not non-halal food).
    if (x && decision === 'fully' && liveFlags.includes('alcohol')) {
      return { ...base, claim: 'halal_options', strength: 'moderate', source_url: x.url, excerpt: x.s, notes: 'The same website also mentions alcohol.', reason: 'forced_fully_alcohol' };
    }
    if (x) return { ...base, claim, strength, source_url: x.url, excerpt: x.s, ...(review?.shown ? { notes: review.shown } : {}), reason: `forced_${decision}` };
  }

  // Statements only. A question ("Is your food halal?") says nothing on its own,
  // a customer review quoted on the site ("they have halal meat") is not the
  // restaurant's own word, and "we are not halal certified" is not a claim of
  // anything halal.
  // A diner writing in the first person is a review too: "so I am so happy to
  // find a PURE VEG restaurant, I hope it stays this way", on a vegetarian
  // restaurant's home page, or "I had a lovely experience at Baba Ghanouj, this
  // place is a must-visit", is not that restaurant saying anything about halal.
  const TESTIMONIAL = /\b(they (have|had|serve|served|do|did|were|are|use)|the food was|we loved|i loved|loved (it|the)|highly recommend|would recommend|nice touch|five stars|5 stars)\b|^["“]|\bi\s+(am|was)\s+so\b|\bi'?m\s+so\s+(happy|glad|pleased)\b|\bi\s+(hope|found|had|tried|visited|ordered|went|came|ate|enjoyed)\b|\bthis place (is|was)\b|\bmust[- ]visit\b/i;
  // Saying there is no certificate is not saying anything about the food:
  // "Our food does not have Halal or Kosher certification", "None of our
  // products are certified Halal".
  const NOT_CERTIFIED = /\bnot\s+(been\s+|yet\s+|currently\s+|officially\s+)?(a\s+)?(halal[- ]certified|certified\s+halal)\b|\bhas\s+not\s+been\s+halal\b|\b(no|none|not|don't|do not|doesn't|does not)\b(?:(?!\b(but|however|although|also|instead)\b)[^.]){0,50}\b(halal[- ](or[- ]kosher[- ])?certifi\w*|certified[- ](halal|kosher)|halal\s+(or\s+kosher\s+)?certificat\w*)\b/i;
  // A person's decision about a site (review-decisions.json) covers every place
  // that carries it, so the branch rules below do not second-guess it.
  const shared = (hostCount.get(entity.websiteHost) || 0) > 1 && !decisions[entity.websiteHost];
  const all = halalSentences(mentions).filter(
    (x) =>
      !someoneElsesWords(x.s, entity.websiteHost, names) &&
      !x.review &&
      !(shared && (namesAnotherArea(x.s, entity) || pageOfAnotherArea(x.url, entity)))
  );
  // A site covering several branches says something about each. When its
  // sentences carry more than one postcode, the one carrying this listing's
  // postcode goes first, so the Ealing branch quotes "Halal-certified American
  // diner-style food in Ealing", not the branch on the Kent coast. Only the
  // choice of quote changes, never the claim.
  const postcode = (entity.postcode || '').toUpperCase().replace(/\s+/g, '');
  const postcodesIn = (s) => [...s.toUpperCase().matchAll(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/g)].map((m) => m[1] + m[2]);
  const here = (x) => (postcodesIn(x.s).includes(postcode) ? 0 : 1);
  let statements = all.filter((x) => !x.question && !TESTIMONIAL.test(x.s) && !NOT_CERTIFIED.test(x.s));
  const branches = new Set(statements.flatMap((x) => postcodesIn(x.s)));
  if (postcode.length >= 5 && branches.has(postcode) && branches.size > 1) {
    statements = statements
      .map((x, i) => ({ x, i }))
      .sort((a, b) => here(a.x) - here(b.x) || a.i - b.i)
      .map(({ x }) => x);
  }
  // Statements that say halal without negating it. Only these can support a
  // halal claim; negatives are still looked for in every statement.
  const affirmative = statements.filter((x) => {
    if (x.qa === 'no' || x.fragment) return false;
    if (x.qa === 'yes') return affirmsHalal(/\bhalal\b/i.test(x.a) ? x.a : x.q);
    return affirmsHalal(x.s);
  });
  const flagSentences = Object.values(flags).map((v) => ({ url: v.url, s: clip(v.excerpt || ''), question: false }));
  const find = (patterns, pool = statements) => {
    for (const x of pool) for (const re of [].concat(patterns)) if (re.test(x.s)) return x;
    return null;
  };
  const record = (claim, strength, x, extra = {}) => ({ ...base, claim, strength, source_url: x.url, excerpt: x.s, ...extra });

  // Checked before negatives: "Our restaurants aren't halal, but a number of
  // them serve halal chicken" is about some branches, not this one, so it must
  // not become a claim that this branch is not halal.
  if (find(BRANCH_SPECIFIC)) return { skip: true, reason: 'branch_specific' };

  // "Is your meat halal? No." A no with a halal exception in the answer ("No,
  // but our chicken is") is options; a no about all of the food is not halal.
  // A no about one item ("Is your bacon halal? No") says nothing about the rest.
  const qaNo = statements.find((x) => x.qa === 'no' && QA_ALL.test(x.q));
  if (qaNo) {
    if (affirmsHalal(qaNo.a)) {
      return { ...record('halal_options', 'moderate', qaNo, { notes: 'The website says not everything is halal.' }), reason: 'qa_no_but' };
    }
    return { ...record('not_halal', 'moderate', qaNo), reason: 'qa_negative' };
  }

  const neg = find(NEGATIVE) || find(NEGATIVE, flagSentences);
  if (neg) return { ...record('not_halal', 'moderate', neg), reason: 'negative' };

  // "Is all your meat halal? Yes." counts as saying so, with the same review
  // and contradiction checks as the sentence would get.
  const qaYesAll = affirmative.find((x) => x.qa === 'yes' && QA_ALL.test(x.q) && !QA_EXCEPTION.test(x.a));
  const qaYesExcept = affirmative.find((x) => x.qa === 'yes' && QA_ALL.test(x.q) && QA_EXCEPTION.test(x.a));
  if (qaYesExcept) {
    return { ...record('halal_options', 'moderate', qaYesExcept, { notes: 'The website makes an exception to its halal answer.' }), reason: 'qa_yes_except' };
  }

  const fully = find(FULLY, affirmative) || qaYesAll;
  const cert = find(CERT_CLAIM, affirmative);
  const options = find(OPTIONS, affirmative);
  const caution = find(CAUTION);
  const positive = find(POSITIVE, affirmative);
  const partial = find(PARTIAL_NOT) || find(PARTIAL_NOT, flagSentences);

  // "Our chicken wings are not halal" only means options when something else is
  // said to be halal. "Our beef is not halal", alone, at a steakhouse, does not.
  if (partial) {
    const positiveElsewhere = [fully, options, positive, cert].find((x) => x && x.s !== partial.s);
    if (!positiveElsewhere) return { skip: true, reason: 'partial_without_positive' };
    // A quote cut off at the edge of the crawler's window ("We do not offer
    // halal beef at") reads badly; the halal statement it qualifies is quoted.
    const quote = /[.!?]["”']?$/.test(partial.s.trim()) ? partial : positiveElsewhere;
    return { ...record('halal_options', 'moderate', quote, { notes: 'The website says some items are not halal.' }), reason: 'partial_not' };
  }

  if (fully && decision === 'options') {
    return { ...record('halal_options', 'moderate', fully, { notes: 'The website makes an exception to its halal statement.' }), reason: 'options_in_review' };
  }

  if (fully && !contradicted && !caution) {
    if (decision === 'reject') return { ...record('halal_mentioned', 'moderate', fully), reason: 'fully_rejected_in_review' };
    const confirmed = decision === 'confirm';
    return {
      ...record('fully_halal', confirmed ? 'strong' : 'moderate', fully, { notes: chain ? 'Statement on a website shared by several branches.' : null }),
      reason: confirmed ? 'fully_confirmed' : 'fully_unreviewed',
    };
  }

  if (cert && !contradicted) {
    return { ...record('fully_halal', 'moderate', cert, { kind: 'certification_claim', notes: 'Not confirmed with the certifier.' }), reason: 'cert_claim' };
  }

  // A site that also says all of it is halal is options for what it lists, so
  // the listing says what that is.
  if (options) return { ...record('halal_options', 'moderate', options, fully && contradicted ? { notes: alsoMentions() } : {}), reason: 'options' };

  // A statement that all of it is halal counts as positive here, so a site
  // that says so and also lists wine is options, not left without a label.
  if ((positive || fully) && contradicted) {
    return { ...record('halal_options', 'moderate', positive || fully, { notes: alsoMentions() }), reason: 'mixed' };
  }

  if (positive) {
    return { ...record('halal_mentioned', caution ? 'weak' : 'moderate', positive, { notes: caution ? 'The website says halal cannot be guaranteed.' : null }), reason: caution ? 'caution' : 'mention' };
  }

  // The word appears, but not as a statement about the food: a menu heading, a
  // link, a question. Not evidence.
  return { skip: true, reason: all.length && !statements.length ? 'question_only' : 'no_statement' };
}

// --- Other sources ------------------------------------------------------------------

function otherEvidence(entity) {
  const out = [];
  const osm = entity.sources.osm;
  if (osm?.dietHalal) {
    const v = String(osm.dietHalal).toLowerCase();
    const osmUrl = `https://www.openstreetmap.org/${{ n: 'node', w: 'way', r: 'relation' }[osm.id[0]]}/${osm.id.slice(1)}`;
    if (v === 'only' || v === 'yes') {
      out.push({
        kind: 'community_tag',
        claim: v === 'only' ? 'fully_halal' : 'halal_mentioned',
        strength: 'weak',
        source_name: 'OpenStreetMap contributors',
        source_url: osmUrl,
        excerpt: v === 'only' ? 'Tagged as serving only halal food.' : 'Tagged as serving halal food.',
        checked_at: TODAY,
      });
    } else if (v === 'no') {
      out.push({ kind: 'community_tag', claim: 'not_halal', strength: 'weak', source_name: 'OpenStreetMap contributors', source_url: osmUrl, excerpt: 'Tagged as not serving halal food.', checked_at: TODAY });
    }
  }
  if (entity.signals.overtureHalalCategory) {
    out.push({
      kind: 'directory_category',
      claim: 'halal_mentioned',
      strength: 'weak',
      source_name: 'Overture Maps place data',
      source_url: null,
      excerpt: 'Categorised as a halal restaurant.',
      checked_at: TODAY,
    });
  }
  const halalName = [entity.name, ...entity.sources.fsa.map((f) => f.name), ...entity.sources.overture.map((o) => o.name)]
    .filter(Boolean)
    .find((n) => /\bhalal\b/i.test(n));
  if (halalName) {
    const fsaId = entity.sources.fsa.find((f) => /\bhalal\b/i.test(f.name))?.id;
    out.push({
      kind: 'business_name',
      claim: 'halal_mentioned',
      strength: 'weak',
      source_name: fsaId ? 'Food hygiene register' : 'Business name',
      source_url: fsaId ? `https://ratings.food.gov.uk/business/${fsaId}` : null,
      excerpt: `Trades as "${halalName.slice(0, 120)}".`,
      checked_at: TODAY,
    });
  }
  return out;
}

// --- Chains -----------------------------------------------------------------------------
//
// A branch with no website of its own says nothing on its own behalf, but its
// chain may have said something for every branch. For these chains only, the
// central site was read and its statement is about all branches (chat ad44ae56,
// 2026-09-24), so a branch named exactly as the chain, or the chain and its own
// area ("Chicken Cottage Ealing", checked against its address and borough), and
// with no website of its own, gets that statement as evidence. "Sams Chicken &
// Pizza", "MGM Chicken Cottage" or a kitchen trading as five brands does not.
//
// Never above moderate. The chain's word is not a check of this kitchen, so it
// can make a branch Unverified, never Fully Halal.
const CHAINS = [
  { label: "Sam's Chicken", host: 'samschicken.com', names: ['sams chicken'] },
  { label: 'German Doner Kebab', host: 'gdk.com', names: ['german doner kebab', 'gdk'] },
  { label: 'Chicken Cottage', host: 'chickencottage.com', names: ['chicken cottage'] },
  { label: "Shah's Halal Food", host: 'shahshalalfood.co.uk', names: ['shahs halal food', 'shahs halal'] },
  { label: "Dave's Hot Chicken", host: 'daveshotchickenuk.com', names: ['daves hot chicken'] },
  { label: 'Wrapchic', host: 'wrapchic.co.uk', names: ['wrapchic', 'wrap chic'] },
  { label: 'Thunderbird', host: 'thunderbirdckn.co.uk', names: ['thunderbird', 'thunderbird fried chicken'] },
  { label: "Rio's Piri Piri", host: 'riospiripiri.com', names: ['rios piri piri', 'rios peri peri'] },
  { label: 'Tinseltown', host: 'tinseltown.co.uk', names: ['tinseltown'] },
  { label: 'Gökyüzü', host: 'gokyuzurestaurant.co.uk', names: ['gokyuzu'] },
];

function chainOf(entity) {
  if (entity.websiteHost) return null;
  const address = normaliseName(`${entity.address || ''} ${entity.borough || ''}`);
  const chainNamed = (raw) => {
    const name = normaliseName(raw);
    // An address can open with the trading names themselves ("Tinseltown/King
    // of Wings/Dog 'N' Bun/protein Push, Unit 4 ..."), which are not an area.
    const area = ` ${address.replace(name, ' ')} `;
    return CHAINS.find((chain) =>
      chain.names.some((n) => {
        if (name === n) return true;
        const rest = name.startsWith(`${n} `) ? name.slice(n.length + 1).split(' ') : null;
        return rest && rest.length <= 3 && rest.every((w) => area.includes(` ${w} `));
      })
    );
  };
  const chain = chainNamed(entity.name);
  if (!chain) return null;
  // Every name it trades under must be the chain's: a kitchen registered as
  // "Wrap Chic, Behrouz, Indian Lunchbox, Faasos, Wings Shack" is not a branch.
  const traded = [...entity.sources.fsa.map((f) => f.name), ...entity.sources.overture.map((o) => o.name), entity.sources.osm?.name].filter(Boolean);
  return traded.every((n) => chainNamed(n) === chain) ? chain : null;
}

// What each chain's own site says, read once.
const chainSays = new Map();
for (const chain of CHAINS) {
  for (const site of entities.filter((e) => e.websiteHost === chain.host)) {
    const web = websiteEvidence(site);
    if (web && !web.skip) {
      const { reason, ...record } = web;
      chainSays.set(chain.host, record);
      break;
    }
  }
}

function chainEvidence(entity) {
  const chain = chainOf(entity);
  const said = chain && chainSays.get(chain.host);
  if (!said) return null;
  return {
    ...said,
    strength: said.strength === 'strong' ? 'moderate' : said.strength,
    source_name: "The chain's website",
    notes: [
      `${chain.label}'s own website, speaking for all its branches. Not confirmed at this branch.`,
      said.kind === 'certification_claim' ? 'Not confirmed with the certifier.' : null,
    ].filter(Boolean).join(' '),
  };
}

// --- Run --------------------------------------------------------------------------------

const results = [];
const reasons = {};
const reviewRows = [];
for (const entity of entities) {
  const evidence = [];
  const web = websiteEvidence(entity);
  if (web?.exclude) {
    reasons[web.reason] = (reasons[web.reason] || 0) + 1;
    continue;
  }
  if (web?.skip) {
    reasons[web.reason] = (reasons[web.reason] || 0) + 1;
  } else if (web) {
    reasons[web.reason] = (reasons[web.reason] || 0) + 1;
    if (web.reason === 'fully_unreviewed' || web.reason === 'fully_confirmed') {
      reviewRows.push([entity.websiteHost, entity.name, entity.borough, web.excerpt.replace(/\t|\n/g, ' '), web.source_url, (typeof decisions[entity.websiteHost] === 'object' ? decisions[entity.websiteHost]?.decision : decisions[entity.websiteHost]) || '']);
    }
    const { reason, ...record } = web;
    evidence.push(record);
  }
  const fromChain = chainEvidence(entity);
  if (fromChain) {
    reasons.chain_statement = (reasons.chain_statement || 0) + 1;
    evidence.push(fromChain);
  }
  evidence.push(...otherEvidence(entity));
  if (evidence.length) results.push({ key: entity.key, evidence });
}

// OUT_SUFFIX=-new writes evidence-new.jsonl and review-strong-new.tsv instead,
// so a run can be compared with the current evidence before it replaces it.
const SUFFIX = process.env.OUT_SUFFIX || '';
writeFileSync(cachePath(`evidence${SUFFIX}.jsonl`), results.map((r) => JSON.stringify(r)).join('\n'));

// One review line per host: a chain's statement is judged once.
const seenHosts = new Set();
const uniqueReview = reviewRows.filter((r) => (seenHosts.has(r[0]) ? false : seenHosts.add(r[0])));
writeFileSync(
  cachePath(`review-strong${SUFFIX}.tsv`),
  ['host\tname\tborough\texcerpt\turl\tdecision', ...uniqueReview.map((r) => r.join('\t'))].join('\n')
);

const claimCount = {};
for (const r of results) for (const e of r.evidence) claimCount[`${e.kind}:${e.claim}:${e.strength}`] = (claimCount[`${e.kind}:${e.claim}:${e.strength}`] || 0) + 1;
console.log('crawled hosts read:', crawl.size);
console.log('places with any evidence:', results.length);
console.log('website outcomes:', reasons);
console.log('evidence by kind:claim:strength:', claimCount);
console.log('hosts awaiting review for Fully Halal:', uniqueReview.filter((r) => !r[5]).length);
console.log('chains whose own site said something:', [...chainSays.keys()].join(', ') || 'none');
