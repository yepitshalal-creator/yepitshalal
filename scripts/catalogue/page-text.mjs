// What the crawlers share: robots.txt handling, and how they read a page's text
// for halal. crawl-websites.mjs (plain HTML) and crawl-rendered.mjs (a real
// browser) must judge text identically, so the rules live here once.

// --- robots.txt -------------------------------------------------------------------
export function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || current.rules.length) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
    } else if ((field === 'disallow' || field === 'allow') && current) {
      current.rules.push({ allow: field === 'allow', path: value });
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a.includes('yepitshalalbot')));
  const star = groups.find((g) => g.agents.includes('*'));
  return (mine || star)?.rules || [];
}

export function allowedByRobots(rules, pathname) {
  let best = null;
  for (const r of rules) {
    if (!r.path) { if (!r.allow) continue; }
    const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const anchored = pattern.endsWith('\\$') ? `^${pattern.slice(0, -2)}$` : `^${pattern}`;
    if (new RegExp(anchored).test(pathname)) {
      if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
    }
  }
  return !best || best.allow || best.path === '';
}

function snippetAt(text, index, length, width) {
  const start = Math.max(0, index - width);
  const end = Math.min(text.length, index + length + width);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = snippet.replace(/^\S*\s/, '');
  if (end < text.length) snippet = snippet.replace(/\s\S*$/, '');
  return snippet.replace(/(\s*\.\s*){2,}/g, '. ').trim();
}

export function excerptsAround(text, pattern, width = 150, max = 8) {
  const out = [];
  for (const m of text.matchAll(pattern)) {
    const snippet = snippetAt(text, m.index, m[0].length, width);
    if (!out.some((o) => o.includes(snippet) || snippet.includes(o))) out.push(snippet);
    if (out.length >= max) break;
  }
  return out;
}

// Contradictions of an all-halal claim. Bacon is only counted when it is not
// qualified as turkey, beef, chicken, veal or halal bacon, all of which exist,
// and is not Francis Bacon: a quotation of his on a restaurant's home page
// turned "Yes, we are 100% Halal certified" into halal options (2026-09-24).
export const CONTRADICTIONS = {
  pork: /\bpork\b/i,
  bacon: /\b(?<!(turkey|beef|chicken|veal|halal|veggie|vegan|vegetarian|facon|francis)\s)bacon\b/i,
  cured_pork: /\b(prosciutto|pancetta|parma ham|serrano ham|iberico|guanciale)\b/i,
  non_halal: /\bnon[- ]?halal\b|\bnot halal\b|\bisn'?t halal\b|\bno(t)? (?:all|every)[^.]{0,30}halal\b/i,
};
export const CERTIFIER = /\b(HMC|HFA|halal monitoring committee|halal food authority|halal certified|certified halal|halal certification|halal certificate)\b/i;

// Alcohol, the fourth contradiction (2026-09-28). Shabir: Halal Options is for
// places that serve halal food and also serve non-halal food, pork or alcohol.
// Only words that almost always mean a drink. Left out on purpose: sake (for
// the sake of), ale (kale, sale), pint, and BYOB, where the place serves none.
export const ALCOHOL = new RegExp(
  String.raw`\b(?:alcohol(?:ic)?|(?<!(?:ginger|root)\s)beers?|wines?(?!\s+(?:vinegar|and dine|& dine))|lagers?|ciders?(?!\s+vinegar)|` +
    String.raw`(?<!(?:prawn|shrimp|seafood|fruit|milk|dry)\s)cocktails?(?!\s+(?:sausages?|sticks?|sauces?|receptions?|samosas?|shrimps?|prawns?))|prosecco|champagne|gin|vodka|whiske?y|rum|` +
    String.raw`tequila|brandy|cognac|liqueurs?|sherry(?!\s+vinegar)|mirin|soju|martinis?|mojitos?|sangria|aperol|spritz|fully licensed|licensed bar)\b`,
  'gi'
);

// A mention of alcohol is not a sign that it is served: "we do not serve
// alcohol" and "alcohol-free" say the opposite. Each mention is judged on the
// words round it, within its own sentence.
// Sites type the apostrophe both ways: "don't" and "don’t".
const DENIED_BEFORE = /\b(?:no|none|never|without|not|don['’]?t|do not|doesn['’]?t|does not|zero|nor|virgin|non|who needs|free of)\b[^.!?\n]{0,30}$/i;
// Invitations that only look negative: "Why not try our cocktails", "Don't
// miss our wine list".
const INVITATION = /\b(?:why not|not only|not just|don['’]?t (?:miss|forget|wait)|never miss|no better|no need)\b/gi;
const FREE_BEFORE = /(?:alcohol[- ]free|non[- ]?alcoholic|de-?alcoholi[sz]ed|0(?:\.0)?\s?%)\s*$/i;
const DENIED_AFTER = /^(?:[\s-]*(?:free\b|0\.0|0\s?%)|\s*[:-]\s*no\b|\s+(?:is|are)\s+not\b|\s+(?:isn['’]?t|aren['’]?t)\b|\s+(?:is\s+|are\s+)?not\s+(?:served|sold|allowed|permitted|available)\b)/i;
// An FAQ question ("Do you serve alcohol?", "Can we bring alcohol?") is not a
// claim either way. Its answer, when it follows at once, is, even behind a tick
// or a cross ("? ❌ No").
const ASKED_BEFORE = /\b(?:do|does|can|could|is|are|will|may)\s+[\w'’-]+\b[^.!?\n]{0,30}$/i;
const ANSWER_AFTER = /^[^.!?\n]{0,40}\?\s*(?:[^\w\s]{1,3}\s*)?(?:(yes)|(no))?\b/i;
// An allergen list naming wine or beer as a source of sulphites.
const ASIDE_BEFORE = /\b(?:sulphites?|sulfites?)\b[^.!?\n]{0,40}$/i;

// A link to the drinks list, where alcohol is named if it is anywhere.
export const DRINKS_LINK = /drink|wine|cocktail|beverage|\bbar\b/;

/**
 * Each alcohol mention in `text`: `served` when it says alcohol is there,
 * `denied` when its sentence says it isn't, and neither for a question with no
 * answer or an allergen list.
 */
export function alcoholMentions(text) {
  const out = [];
  for (const m of text.matchAll(ALCOHOL)) {
    const before = text.slice(Math.max(0, m.index - 60), m.index).split(/[.!?\n]/).pop().replace(INVITATION, ' ');
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 50);
    const answer = ASKED_BEFORE.test(before) ? after.match(ANSWER_AFTER) : null;
    const denied = answer ? Boolean(answer[2]) : DENIED_BEFORE.test(before) || FREE_BEFORE.test(before) || DENIED_AFTER.test(after);
    const served = answer ? Boolean(answer[1]) : !denied && !ASIDE_BEFORE.test(before);
    out.push({ word: m[0], index: m.index, length: m[0].length, served, denied });
  }
  return out;
}

/**
 * The contradictions of an all-halal claim found in one page's text, as
 * { flag: { url, excerpt } }. Both crawlers call this, so a page reads the
 * same in either. `alcohol_denied` is not a contradiction: it keeps one
 * "no alcohol" sentence so a person can check the call was right.
 */
export function contradictionsIn(text, url) {
  const flags = {};
  for (const [flag, re] of Object.entries(CONTRADICTIONS)) {
    if (re.test(text)) flags[flag] = { url, excerpt: excerptsAround(text, new RegExp(re.source, 'gi'), 80, 1)[0] };
  }
  const mentions = alcoholMentions(text);
  const served = mentions.find((m) => m.served);
  const denied = mentions.find((m) => m.denied);
  if (served) flags.alcohol = { url, excerpt: snippetAt(text, served.index, served.length, 80), word: served.word };
  if (denied) flags.alcohol_denied = { url, excerpt: snippetAt(text, denied.index, denied.length, 80), word: denied.word };
  return flags;
}
