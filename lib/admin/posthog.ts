import { unstable_cache } from 'next/cache';

// Reading PostHog back out, for the admin's own charts.
//
// The site sends events in with the public project token. Reading them needs a
// personal API key, which is a secret, so it lives only on the server:
//
//   POSTHOG_PERSONAL_API_KEY  PostHog, Settings, Personal API keys. Scope:
//                             Query, Read. Nothing else is needed.
//   POSTHOG_PROJECT_ID        optional, 284609 is the YepItsHalal project
//   POSTHOG_APP_HOST          optional, the EU app, where the API lives
//
// Without the key every function here returns null and the admin says how to
// add it, instead of failing.
//
// What can be counted is what the site sends, and the site sends little on
// purpose: no cookies, so a visitor is a fresh hash each day, and nothing at
// all from /admin, /account, /manage or /auth (lib/analytics/scrub.ts).

const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || '284609';
const APP_HOST = (process.env.POSTHOG_APP_HOST || 'https://eu.posthog.com').replace(/\/+$/, '');

export const posthogConfigured = Boolean(KEY);
export const posthogProjectUrl = `${APP_HOST}/project/${PROJECT_ID}`;

// PostHog runs at most three queries per project at once and answers a fourth
// with an error, so the admin queues its own.
const MAX_CONCURRENT = 3;
let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

type Cell = string | number | null;

async function runQuery(query: string): Promise<Cell[][]> {
  return withSlot(async () => {
    const res = await fetch(`${APP_HOST}/api/projects/${PROJECT_ID}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query }, name: 'yepitshalal admin' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Thrown, not returned, so unstable_cache does not keep a failure for
      // five minutes.
      throw new Error(`PostHog ${res.status}: ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as { results?: Cell[][] };
    return json.results ?? [];
  });
}

// Five minutes. The charts are for spotting a trend, not watching a counter,
// and every page load would otherwise spend PostHog's hourly query allowance.
const cachedQuery = unstable_cache(runQuery, ['posthog-hogql-v1'], { revalidate: 300 });

async function hogql(query: string): Promise<Cell[][] | null> {
  if (!KEY) return null;
  try {
    return await cachedQuery(query);
  } catch (e) {
    console.error('[admin] PostHog query failed', (e as Error).message);
    return null;
  }
}

// A day, for the public search's Popular sort (lib/popular.ts). One query a
// day answers every visitor's search, however many there are.
const dailyQuery = unstable_cache(runQuery, ['posthog-hogql-daily-v1'], { revalidate: 86400 });

/** hogql(), but kept a day. Null without the key or when PostHog fails. */
export async function hogqlDaily(query: string): Promise<Cell[][] | null> {
  if (!KEY) return null;
  try {
    return await dailyQuery(query);
  } catch (e) {
    console.error('[popular] PostHog query failed', (e as Error).message);
    return null;
  }
}

const num = (v: Cell) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const str = (v: Cell) => (v === null || v === undefined ? '' : String(v));

/** Whole days only, from a short list, so nothing typed reaches a query. */
export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];
export function toRange(value: string | undefined): RangeDays {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

export interface DayPoint {
  day: string;
  visitors: number;
  pageviews: number;
}

/** One point per day, oldest first, with the empty days filled in as zero. */
export async function trafficByDay(days: RangeDays): Promise<DayPoint[] | null> {
  const rows = await hogql(`
    select toDate(timestamp) as day, uniq(distinct_id) as visitors, count() as pageviews
    from events
    where event = '$pageview' and timestamp >= toStartOfDay(now()) - interval ${days - 1} day
    group by day
    order by day
  `);
  if (!rows) return null;
  const byDay = new Map(rows.map((r) => [str(r[0]).slice(0, 10), { visitors: num(r[1]), pageviews: num(r[2]) }]));
  const out: DayPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const day = d.toISOString().slice(0, 10);
    out.push({ day, ...(byDay.get(day) ?? { visitors: 0, pageviews: 0 }) });
  }
  return out;
}

export interface Totals {
  visitors: number;
  pageviews: number;
  searches: number;
  errors: number;
  previous: { visitors: number; pageviews: number; searches: number; errors: number };
}

/** This period against the one before it, in one query. */
export async function totals(days: RangeDays): Promise<Totals | null> {
  const rows = await hogql(`
    select
      uniqIf(distinct_id, event = '$pageview' and timestamp >= now() - interval ${days} day),
      countIf(event = '$pageview' and timestamp >= now() - interval ${days} day),
      countIf(event in ('location_search_submitted', 'current_location_search_requested') and timestamp >= now() - interval ${days} day),
      countIf(event = '$exception' and timestamp >= now() - interval ${days} day),
      uniqIf(distinct_id, event = '$pageview' and timestamp < now() - interval ${days} day),
      countIf(event = '$pageview' and timestamp < now() - interval ${days} day),
      countIf(event in ('location_search_submitted', 'current_location_search_requested') and timestamp < now() - interval ${days} day),
      countIf(event = '$exception' and timestamp < now() - interval ${days} day)
    from events
    where timestamp >= now() - interval ${days * 2} day
      and event in ('$pageview', '$exception', 'location_search_submitted', 'current_location_search_requested')
  `);
  if (!rows?.[0]) return null;
  const r = rows[0];
  return {
    visitors: num(r[0]),
    pageviews: num(r[1]),
    searches: num(r[2]),
    errors: num(r[3]),
    previous: { visitors: num(r[4]), pageviews: num(r[5]), searches: num(r[6]), errors: num(r[7]) },
  };
}

export interface Journey {
  searches: number;
  placePages: number;
  directions: number;
  calls: number;
  websites: number;
}

/** From a search to going to eat: searches, then place pages opened, then
 *  taps on Directions, Call and Website or Menu. The taps come from PostHog's
 *  own click capture (autocapture), read from the link that was pressed, so
 *  the site sends nothing extra. Directions counts anywhere on the site; Call
 *  and Website count on a place page, where those buttons are. This period
 *  and the one before, in one query. */
export async function journey(days: RangeDays): Promise<{ now: Journey; before: Journey } | null> {
  const recent = `timestamp >= now() - interval ${days} day`;
  const earlier = `timestamp < now() - interval ${days} day`;
  const onPlace = `properties.$pathname like '/restaurant/%'`;
  const parts = [
    `event in ('location_search_submitted', 'current_location_search_requested')`,
    `event = '$pageview' and ${onPlace}`,
    `event = '$autocapture' and elements_chain like '%href="https://www.google.com/maps/dir/%'`,
    `event = '$autocapture' and ${onPlace} and elements_chain like '%href="tel:%'`,
    `event = '$autocapture' and ${onPlace} and (elements_chain like '%text="Website"%' or elements_chain like '%text="Menu"%')`,
  ];
  const rows = await hogql(`
    select ${[...parts.map((p) => `countIf(${p} and ${recent})`), ...parts.map((p) => `countIf(${p} and ${earlier})`)].join(', ')}
    from events
    where timestamp >= now() - interval ${days * 2} day
      and event in ('$pageview', '$autocapture', 'location_search_submitted', 'current_location_search_requested')
  `);
  if (!rows?.[0]) return null;
  const r = rows[0].map(num);
  const pick = (o: number): Journey => ({ searches: r[o], placePages: r[o + 1], directions: r[o + 2], calls: r[o + 3], websites: r[o + 4] });
  return { now: pick(0), before: pick(5) };
}

export interface Ranked {
  label: string;
  value: number;
  secondary?: number;
}

export async function topPages(days: RangeDays, limit = 10): Promise<Ranked[] | null> {
  const rows = await hogql(`
    select properties.$pathname as path, count() as views, uniq(distinct_id) as visitors
    from events
    where event = '$pageview' and timestamp >= now() - interval ${days} day
    group by path
    order by views desc
    limit ${limit}
  `);
  return rows?.map((r) => ({ label: str(r[0]) || '/', value: num(r[1]), secondary: num(r[2]) })) ?? null;
}

/** Where people arrived from. Moving between pages of the site is not a source. */
export async function topSources(days: RangeDays, limit = 8): Promise<Ranked[] | null> {
  const rows = await hogql(`
    select coalesce(nullIf(properties.$referring_domain, ''), '$direct') as source, uniq(distinct_id) as visitors
    from events
    where event = '$pageview' and timestamp >= now() - interval ${days} day
      and coalesce(properties.$referring_domain, '') not like '%yepitshalal.com'
    group by source
    order by visitors desc
    limit ${limit}
  `);
  return rows?.map((r) => ({ label: str(r[0]), value: num(r[1]) })) ?? null;
}

export async function devices(days: RangeDays): Promise<Ranked[] | null> {
  const rows = await hogql(`
    select coalesce(properties.$device_type, 'Unknown') as device, uniq(distinct_id) as visitors
    from events
    where event = '$pageview' and timestamp >= now() - interval ${days} day
    group by device
    order by visitors desc
  `);
  return rows?.map((r) => ({ label: str(r[0]), value: num(r[1]) })) ?? null;
}

/** The site's own events, the ones lib/analytics/posthog.ts track() sends. */
export async function customEvents(days: RangeDays): Promise<Ranked[] | null> {
  const rows = await hogql(`
    select event, count() as times
    from events
    where timestamp >= now() - interval ${days} day and not startsWith(event, '$')
    group by event
    order by times desc
    limit 20
  `);
  return rows?.map((r) => ({ label: str(r[0]), value: num(r[1]) })) ?? null;
}

export interface Vitals {
  lcp: number | null;
  fcp: number | null;
  inp: number | null;
  cls: number | null;
  samples: number;
}

/** The 75th percentile, the figure Google judges a page by. */
export async function webVitals(days: RangeDays): Promise<Vitals | null> {
  const rows = await hogql(`
    select
      quantile(0.75)(toFloat(properties.$web_vitals_LCP_value)),
      quantile(0.75)(toFloat(properties.$web_vitals_FCP_value)),
      quantile(0.75)(toFloat(properties.$web_vitals_INP_value)),
      quantile(0.75)(toFloat(properties.$web_vitals_CLS_value)),
      count()
    from events
    where event = '$web_vitals' and timestamp >= now() - interval ${days} day
  `);
  if (!rows?.[0]) return null;
  const r = rows[0];
  const val = (v: Cell) => (v === null || Number.isNaN(Number(v)) ? null : Number(v));
  return { lcp: val(r[0]), fcp: val(r[1]), inp: val(r[2]), cls: val(r[3]), samples: num(r[4]) };
}

/** Pages where something broke in the browser, most first. */
export async function errorPages(days: RangeDays, limit = 6): Promise<Ranked[] | null> {
  const rows = await hogql(`
    select coalesce(properties.$pathname, '/') as path, count() as times
    from events
    where event = '$exception' and timestamp >= now() - interval ${days} day
    group by path
    order by times desc
    limit ${limit}
  `);
  return rows?.map((r) => ({ label: str(r[0]), value: num(r[1]) })) ?? null;
}

export type RecordingAnswers = { yes: number; no: number };

/** How visitors answered the recording question (lib/analytics/posthog.ts). */
export async function recordingAnswers(days: RangeDays): Promise<RecordingAnswers | null> {
  const rows = await hogql(`
    select countIf(properties.allowed = true), countIf(properties.allowed = false)
    from events
    where event = 'recording_choice' and timestamp >= now() - interval ${days} day
  `);
  if (!rows) return null;
  return { yes: num(rows[0]?.[0]), no: num(rows[0]?.[1]) };
}
