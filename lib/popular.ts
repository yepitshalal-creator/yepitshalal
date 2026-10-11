import { hogqlDaily } from './admin/posthog';
import { isStockPhoto, statusOf, type SearchResultRestaurant } from './types';

// Popular near you, from our own visit numbers in PostHog. Nothing from
// outside, and no count is ever shown: only the order, and a "Popular" badge a
// place has to earn.
//
// For each place, over the last 28 days, each visitor who opened its page adds
// 1. A visitor who also tapped directions adds 5 more, a call 4, the website
// or menu 2. Each visitor counts once, however often they tapped. Newer
// counts more: a visit two weeks ago is worth half of one today.
//
// Visitors are a fresh hash each day (the site sets no cookies), so "visitors"
// here means visitor days.

/** The fewest visitors in 28 days before a place can be called Popular. */
export const POPULAR_MIN_PEOPLE = 10;
/** Popular places in a search before the Popular order is offered at all. */
const READY_AT = 3;
/** Holds back a place seen by only a few: 1 visitor keeps a quarter of its
 *  score, 10 keep over three quarters. One lucky visit cannot top the list. */
const DAMPING = 3;
/** Every fifth spot in the Popular order goes to a place hardly anyone has
 *  seen yet, so new places are not buried under the ones already known. */
const FRESH_EVERY = 5;

// Read with the site's own PostHog key, once a day (hogqlDaily).
const QUERY = `
select slug, count() as people,
  sum(pow(0.5, dateDiff('day', t, now()) / 14) * (1 + 5 * dir + 4 * call + 2 * web)) as score
from (
  select slug, distinct_id, min(timestamp) as t,
    countIf(kind = 'dir') > 0 as dir, countIf(kind = 'call') > 0 as call, countIf(kind = 'web') > 0 as web
  from (
    select replaceRegexpOne(properties.$pathname, '^/restaurant/([^/?#]+).*$', '\\\\1') as slug, distinct_id, timestamp,
      multiIf(event = '$pageview', 'view',
        elements_chain like '%href="https://www.google.com/maps/dir/%', 'dir',
        elements_chain like '%href="tel:%', 'call',
        elements_chain like '%text="Website"%' or elements_chain like '%text="Menu"%', 'web', 'other') as kind
    from events
    where timestamp > now() - interval 28 day
      and event in ('$pageview', '$autocapture')
      and properties.$pathname like '/restaurant/%'
  )
  group by slug, distinct_id
)
group by slug
order by score desc
limit 20000`;

export interface Activity {
  people: number;
  score: number;
}

async function placeActivity(): Promise<Map<string, Activity> | null> {
  const rows = await hogqlDaily(QUERY);
  if (!rows) return null;
  return new Map(rows.map(([slug, people, score]) => [String(slug), { people: Number(people) || 0, score: Number(score) || 0 }]));
}

/** The numbers, if PostHog answers quickly. A search never waits on it: a
 *  slow answer still fills the day's cache for the next search. */
export async function placeActivityQuick(ms = 1500): Promise<Map<string, Activity> | null> {
  return Promise.race([placeActivity(), new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

const adjusted = (a: Activity | undefined) => (a ? a.score * (a.people / (a.people + DAMPING)) : 0);

/**
 * Marks the places that earned "Popular" and, when asked, puts the results in
 * Popular order. A place is Popular when at least POPULAR_MIN_PEOPLE visitors
 * opened it in 28 days and it is in the top tenth of this search.
 *
 * `ready` says whether enough places in this search are Popular for the order
 * to mean anything. Until it is, the page does not offer it.
 */
export function rankPopular<T extends SearchResultRestaurant>(
  results: T[],
  activity: Map<string, Activity> | null,
  reorder: boolean
): { results: T[]; ready: boolean } {
  if (!activity || results.length === 0) return { results, ready: false };

  const scored = results.map((r) => ({ r, a: activity.get(r.slug), s: adjusted(activity.get(r.slug)) }));
  const topTenth = Math.max(1, Math.ceil(results.length / 10));
  const cutoff = [...scored].sort((x, y) => y.s - x.s)[topTenth - 1]?.s ?? Infinity;
  const marked = scored.map((x) => ({
    ...x,
    r: { ...x.r, popular: (x.a?.people ?? 0) >= POPULAR_MIN_PEOPLE && x.s > 0 && x.s >= cutoff },
  }));
  const ready = marked.filter((x) => x.r.popular).length >= READY_AT;
  if (!reorder) return { results: marked.map((x) => x.r), ready };

  // Most popular first, nearest first among equals (and among places with no
  // visits at all, which is most of them).
  const main = [...marked].sort((x, y) => y.s - x.s || x.r.distance_meters - y.r.distance_meters);
  // Hardly seen, with a photo of their own and a halal label: the places that
  // most deserve a first look.
  const fresh = marked
    .filter((x) => (x.a?.people ?? 0) < DAMPING && x.r.primary_photo_path && !isStockPhoto(x.r.primary_photo_path) && statusOf(x.r) !== 'unknown')
    .sort((x, y) => x.r.distance_meters - y.r.distance_meters);

  const used = new Set<string>();
  const out: T[] = [];
  let m = 0;
  let f = 0;
  while (out.length < marked.length) {
    let next: (typeof marked)[number] | undefined;
    if ((out.length + 1) % FRESH_EVERY === 0) {
      while (f < fresh.length && used.has(fresh[f].r.id)) f++;
      next = fresh[f];
    }
    if (!next) {
      while (m < main.length && used.has(main[m].r.id)) m++;
      next = main[m];
    }
    if (!next) break;
    used.add(next.r.id);
    out.push(next.r);
  }
  return { results: out, ready };
}
