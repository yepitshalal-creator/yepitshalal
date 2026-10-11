import { hogqlDaily } from '@/lib/admin/posthog';
import { sendThroughResend } from '@/lib/notify';
import {
  CONTACT_COLUMNS,
  outreachDb,
  stopListState,
  stopContact,
  targetOf,
  type Contact,
} from './data';
import {
  FIRST_SUBJECT,
  FOLLOW_UP_SUBJECT,
  OUTREACH_FROM,
  OUTREACH_REPLY_TO,
  firstEmail,
  followUpEmail,
  foundWhere,
  oneClickStopUrl,
  placeUrl,
  textToHtml,
  type EmailParts,
} from './words';

// The daily outreach run (app/api/cron/outreach-daily). In order:
//
// 1. Watch. Read what Resend says happened to everything we sent in the last
//    14 days. A bounce or a complaint puts that address on the stop list.
// 2. Pause. Any complaint, or 3 bounces in a week, switches sending off with
//    the reason, until someone reads it in /admin/outreach and clears it.
// 3. Send, only if sending is on, nothing is paused, and step 1 could read
//    Resend at all: with no way to see bounces, nothing goes out. Follow ups
//    first (one, 7 days after the first email, only if they have not
//    answered), then first emails, up to the daily limit, one at a time.
//
// Every send checks the stop list again right before it goes.
//
// Any read that fails stops the run before anything more is sent. A count that
// could not be read is never taken as nought, and a stop list that could not
// be read never lets an email through.

const WATCH_DAYS = 14;
const FOLLOW_UP_AFTER_DAYS = 7;
const BOUNCES_TO_PAUSE = 3;
/** A gap between emails, so they go out one at a time and not as a burst. */
const GAP_MS = 3000;

export interface RunResult {
  dryRun: boolean;
  sendingOn: boolean;
  pausedReason: string | null;
  /** False when we could not see what happened to our emails, from Resend
   *  or from our own records. Nothing is sent then. */
  canWatch: boolean;
  watched: number;
  newlyBounced: number;
  newlyComplained: number;
  followUpsSent: number;
  firstsSent: number;
  /** Why a contact was skipped, by contact id. */
  skipped: Record<string, string>;
  failures: Record<string, string>;
  note?: string;
}

interface ResendListed {
  id: string;
  to?: string[];
  subject?: string;
  created_at: string;
  last_event: string | null;
}

/**
 * Resend writes times like "2026-04-03 22:13:42.674981+00", and Date.parse
 * cannot read an offset without its minutes. NaN when it still cannot.
 */
export function resendTime(s: string): number {
  return Date.parse(s.trim().replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
}

/**
 * Everything we sent in the last WATCH_DAYS, newest first, a page of 100 at a
 * time: what happened to each, and which of our outreach emails went to
 * whom (see `sentEarlier`).
 */
async function recentDeliveries(): Promise<
  { ok: true; byId: Map<string, string | null>; sent: Map<string, Sent> } | { ok: false; detail: string }
> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, detail: 'RESEND_API_KEY is not set' };
  const since = Date.now() - WATCH_DAYS * 86400000;
  const byId = new Map<string, string | null>();
  const sent = new Map<string, Sent>();
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const url = `https://api.resend.com/emails?limit=100${after ? `&after=${after}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    }).catch((e: Error) => e);
    if (res instanceof Error) return { ok: false, detail: res.message };
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, detail: body?.message ?? `Resend answered ${res.status}` };
    }
    const body = (await res.json()) as { data: ResendListed[]; has_more: boolean };
    let older = false;
    for (const e of body.data) {
      const at = resendTime(e.created_at);
      if (at < since) {
        older = true;
        continue;
      }
      byId.set(e.id, e.last_event);
      if (e.subject !== FIRST_SUBJECT && e.subject !== FOLLOW_UP_SUBJECT) continue;
      // Newest first, so the first one seen for an address is the latest.
      for (const to of e.to ?? []) {
        const key = sentKey(to, e.subject);
        if (!sent.has(key)) sent.set(key, { id: e.id, at: Number.isNaN(at) ? Date.now() : at });
      }
    }
    if (older || !body.has_more || !body.data.length) break;
    after = body.data[body.data.length - 1].id;
  }
  return { ok: true, byId, sent };
}

/** One of our outreach emails as Resend lists it. */
interface Sent {
  id: string;
  at: number;
}

const sentKey = (address: string, subject: string) => `${address.trim().toLowerCase()}\n${subject}`;

/**
 * This email to this contact, if Resend shows we already sent it: it went,
 * but the write after it failed. Resend's record, not ours, so it is still
 * seen on the next run and the email does not go twice.
 */
function sentEarlier(
  deliveries: Awaited<ReturnType<typeof recentDeliveries>>,
  c: Contact,
  subject: string
): Sent | null {
  if (!deliveries.ok || !c.email) return null;
  return deliveries.sent.get(sentKey(c.email, subject)) ?? null;
}

const PAGE_OPENS = `
select replaceRegexpOne(properties.$pathname, '^/restaurant/([^/?#]+).*$', '\\\\1') as slug, count() as opens
from events
where timestamp > now() - interval 30 day
  and event = '$pageview'
  and properties.$pathname like '/restaurant/%'
group by slug
limit 20000`;

async function pageOpens(): Promise<Map<string, number> | null> {
  const rows = await hogqlDaily(PAGE_OPENS);
  return rows ? new Map(rows.map(([slug, n]) => [String(slug), Number(n) || 0])) : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function startOfTodayLondon(): string {
  const now = new Date();
  const london = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const offset = now.getTime() - london.getTime();
  london.setHours(0, 0, 0, 0);
  return new Date(london.getTime() + offset).toISOString();
}

async function send(c: Contact, email: EmailParts, idempotencyKey: string) {
  return sendThroughResend(
    {
      from: OUTREACH_FROM,
      to: [c.email as string],
      subject: email.subject,
      text: email.text,
      html: textToHtml(email.text),
      replyTo: OUTREACH_REPLY_TO,
      headers: {
        'List-Unsubscribe': `<${oneClickStopUrl(c.token)}>, <mailto:${OUTREACH_REPLY_TO}?subject=stop>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    },
    { idempotencyKey, timeoutMs: 10000 }
  );
}

export async function runOutreachDay({ dryRun }: { dryRun: boolean }): Promise<RunResult> {
  const db = outreachDb();
  const { data: settings, error: settingsError } = await db.from('outreach_settings').select('*').eq('id', true).maybeSingle();
  if (settingsError || !settings) throw new Error(settingsError?.message ?? 'outreach_settings has no row');

  const result: RunResult = {
    dryRun,
    sendingOn: Boolean(settings.sending_on),
    pausedReason: settings.paused_reason ?? null,
    canWatch: false,
    watched: 0,
    newlyBounced: 0,
    newlyComplained: 0,
    followUpsSent: 0,
    firstsSent: 0,
    skipped: {},
    failures: {},
  };

  // 1. Watch.
  const since = new Date(Date.now() - WATCH_DAYS * 86400000).toISOString();
  const { data: recentRows, error: recentError } = await db
    .from('outreach_contacts')
    .select(CONTACT_COLUMNS)
    .or(`sent_at.gte."${since}",followed_up_at.gte."${since}"`);
  const recent = (recentRows ?? []) as Contact[];
  const deliveries = await recentDeliveries();
  result.canWatch = deliveries.ok && !recentError;
  if (recentError) {
    result.note = `Could not read the emails we sent (${recentError.message}). Nothing was sent.`;
  } else if (!deliveries.ok) {
    result.note = `Could not read delivery events from Resend (${deliveries.detail}). Nothing was sent.`;
  } else {
    for (const c of recent) {
      const ids = [c.followup_resend_id, c.resend_id].filter((x): x is string => Boolean(x));
      const events = ids.map((id) => deliveries.byId.get(id)).filter((e): e is string => Boolean(e));
      if (!events.length) continue;
      result.watched++;
      const worst = events.includes('complained') ? 'complained' : events.includes('bounced') ? 'bounced' : events[0];
      if (worst === c.last_event) continue;
      if (!dryRun) {
        await db
          .from('outreach_contacts')
          .update({ last_event: worst, last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', c.id);
      }
      if (worst === 'complained' || worst === 'bounced') {
        if (worst === 'complained') result.newlyComplained++;
        else result.newlyBounced++;
        if (!dryRun) await stopContact(db, c, worst);
      }
    }
  }

  // 2. Pause. Bounces count from a week ago, or from when someone last cleared
  // a pause, whichever is later: clearing it means the addresses were checked.
  const weekAgo = new Date(Math.max(Date.now() - 7 * 86400000, settings.resumed_at ? Date.parse(settings.resumed_at) : 0)).toISOString();
  const { count: bouncesThisWeek, error: bounceError } = await db
    .from('outreach_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('last_event', 'bounced')
    .gte('last_event_at', weekAgo);
  if (bounceError && result.canWatch) {
    result.canWatch = false;
    result.note = `Could not count this week's bounces (${bounceError.message}). Nothing was sent.`;
  }
  let pause: string | null = null;
  if (result.newlyComplained > 0) pause = 'Someone marked one of our emails as spam.';
  else if ((bouncesThisWeek ?? 0) >= BOUNCES_TO_PAUSE)
    pause = `${bouncesThisWeek} emails bounced this week. Check the addresses before sending more.`;
  if (pause && !result.pausedReason) {
    result.pausedReason = pause;
    if (!dryRun) {
      await db
        .from('outreach_settings')
        .update({ paused_reason: pause, paused_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', true);
    }
  }

  // 3. Send. A dry run carries on past a closed switch, to say what would go.
  if (!dryRun && (!result.sendingOn || result.pausedReason || !result.canWatch)) return result;

  const today = startOfTodayLondon();
  const { count: firstsToday, error: firstsError } = await db
    .from('outreach_contacts')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', today);
  const { count: followUpsToday, error: followUpsError } = await db
    .from('outreach_contacts')
    .select('id', { count: 'exact', head: true })
    .gte('followed_up_at', today);
  const countError = firstsError ?? followUpsError;
  if (countError) {
    result.note = `Could not count today's emails (${countError.message}). Nothing was sent.`;
    return result;
  }
  let budget = Math.max(0, Number(settings.daily_limit) - (firstsToday ?? 0) - (followUpsToday ?? 0));
  if (!budget) {
    result.note = 'Today\'s limit is already used.';
    return result;
  }

  const dueBefore = new Date(Date.now() - FOLLOW_UP_AFTER_DAYS * 86400000).toISOString();
  const { data: dueRows, error: dueError } = await db
    .from('outreach_contacts')
    .select(CONTACT_COLUMNS)
    .eq('channel', 'email')
    .eq('status', 'sent')
    .is('followed_up_at', null)
    .lte('sent_at', dueBefore)
    .order('sent_at')
    .limit(budget);
  if (dueError) {
    result.note = `Could not read who is due a follow up (${dueError.message}). Nothing was sent.`;
    return result;
  }
  const opens = (dueRows ?? []).length ? await pageOpens() : null;

  for (const c of (dueRows ?? []) as Contact[]) {
    if (!budget) break;
    const stop = await stopListState(db, c);
    if (stop === 'unreadable') {
      result.note = 'Could not read the stop list. Nothing more was sent.';
      return result;
    }
    if (stop === 'stopped') {
      result.skipped[c.id] = 'on the stop list';
      continue;
    }
    const earlier = sentEarlier(deliveries, c, FOLLOW_UP_SUBJECT);
    if (earlier) {
      result.skipped[c.id] = 'follow up already sent: found in Resend and written down';
      if (dryRun) continue;
      const at = new Date(earlier.at).toISOString();
      const recorded = await written(() =>
        db
          .from('outreach_contacts')
          .update({ status: 'followed_up', followed_up_at: at, followup_resend_id: earlier.id, updated_at: new Date().toISOString() })
          .eq('id', c.id)
          .eq('status', 'sent')
      );
      if (!recorded) return notRecorded(result, c);
      continue;
    }
    const target = await targetOf(db, c);
    const opened = target && !target.isChain && target.slug && opens ? opens.get(target.slug) ?? 0 : null;
    const email = followUpEmail({ token: c.token, pageOpens: opened });
    if (dryRun) {
      result.followUpsSent++;
      budget--;
      continue;
    }
    const sent = await send(c, email, `outreach-followup-${c.id}`);
    if (!sent.ok) {
      const why = sent.reason === 'not_configured' ? 'no Resend key' : sent.detail ?? 'failed';
      result.failures[c.id] = why;
      // Shown in /admin/outreach as "last: ...", so a bad address is seen, not retried in silence.
      await db
        .from('outreach_contacts')
        .update({ last_event: `not sent: ${why}`.slice(0, 200), last_event_at: new Date().toISOString() })
        .eq('id', c.id);
      continue;
    }
    const at = new Date().toISOString();
    const recorded = await written(() =>
      db
        .from('outreach_contacts')
        .update({ status: 'followed_up', followed_up_at: at, followup_resend_id: sent.id, last_event: null, updated_at: at })
        .eq('id', c.id)
        .eq('status', 'sent')
    );
    result.followUpsSent++;
    budget--;
    if (!recorded) return notRecorded(result, c);
    await sleep(GAP_MS);
  }

  if (!budget) return result;
  const { data: readyRows, error: readyError } = await db
    .from('outreach_contacts')
    .select(CONTACT_COLUMNS)
    .eq('channel', 'email')
    .eq('status', 'ready')
    .is('sent_at', null)
    .order('created_at')
    .limit(budget);
  if (readyError) {
    result.note = `Could not read who is next (${readyError.message}). Nothing more was sent.`;
    return result;
  }

  for (const c of (readyRows ?? []) as Contact[]) {
    if (!budget) break;
    const stop = await stopListState(db, c);
    if (stop === 'unreadable') {
      result.note = 'Could not read the stop list. Nothing more was sent.';
      return result;
    }
    if (stop === 'stopped') {
      result.skipped[c.id] = 'on the stop list';
      if (!dryRun) await db.from('outreach_contacts').update({ status: 'stopped' }).eq('id', c.id);
      continue;
    }
    const earlier = sentEarlier(deliveries, c, FIRST_SUBJECT);
    if (earlier) {
      result.skipped[c.id] = 'first email already sent: found in Resend and written down';
      if (dryRun) continue;
      const at = new Date(earlier.at).toISOString();
      const recorded = await written(() =>
        db
          .from('outreach_contacts')
          .update({ status: 'sent', sent_at: at, resend_id: earlier.id, updated_at: new Date().toISOString() })
          .eq('id', c.id)
          .eq('status', 'ready')
      );
      if (!recorded) return notRecorded(result, c);
      continue;
    }
    const target = await targetOf(db, c);
    if (!target?.slug) {
      result.skipped[c.id] = 'no page on the site to point to';
      continue;
    }
    const email = firstEmail({
      name: target.name,
      pageUrl: placeUrl(target.slug),
      isChain: target.isChain,
      noOwnPhotos: target.noOwnPhotos,
      token: c.token,
      foundAt: foundWhere(c.found_at_url, c.found_how),
    });
    if (dryRun) {
      result.firstsSent++;
      budget--;
      continue;
    }
    const sent = await send(c, email, `outreach-first-${c.id}`);
    if (!sent.ok) {
      const why = sent.reason === 'not_configured' ? 'no Resend key' : sent.detail ?? 'failed';
      result.failures[c.id] = why;
      // Shown in /admin/outreach as "last: ...", so a bad address is seen, not retried in silence.
      await db
        .from('outreach_contacts')
        .update({ last_event: `not sent: ${why}`.slice(0, 200), last_event_at: new Date().toISOString() })
        .eq('id', c.id);
      continue;
    }
    const at = new Date().toISOString();
    const recorded = await written(() =>
      db
        .from('outreach_contacts')
        .update({ status: 'sent', sent_at: at, resend_id: sent.id, updated_at: at })
        .eq('id', c.id)
        .eq('status', 'ready')
    );
    result.firstsSent++;
    budget--;
    if (!recorded) return notRecorded(result, c);
    await sleep(GAP_MS);
  }

  return result;
}

/** A write after a send, tried three times, a second apart. False if it never took. */
async function written(write: () => PromiseLike<{ error: { message: string } | null }>): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1000);
    const { error } = await write();
    if (!error) return true;
  }
  return false;
}

/** An email went but could not be written down: stop, and say which one. */
function notRecorded(result: RunResult, c: Contact): RunResult {
  result.failures[c.id] = 'sent, but could not be recorded';
  result.note = 'An email went out but could not be recorded, so nothing more was sent. The next run finds it in Resend and writes it down instead of sending it again.';
  return result;
}

/** For the admin page: what the next run would send, without sending. */
export async function previewRun(): Promise<RunResult> {
  return runOutreachDay({ dryRun: true });
}

