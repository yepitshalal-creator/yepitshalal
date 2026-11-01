import { outreachDb, longDate } from './data';
import type { RunResult } from './job';

// What the last daily run did, kept where /admin/outreach and /admin/setup can
// read it. Until 2026-11-01 the reason a run stopped only reached Vercel's
// function logs, and three weeks of runs stopped there unseen: the Resend key
// in Vercel could send but not list emails, so the bounce watch failed and
// nothing went out, 0 of 1,041 contacts.

export const LAST_RUN_KEY = 'outreach_last_run';

export interface LastRun {
  at: string;
  sendingOn: boolean;
  pausedReason: string | null;
  canWatch: boolean;
  firstsSent: number;
  followUpsSent: number;
  failures: number;
  note: string | null;
  /** The run threw before it finished. */
  error: string | null;
}

/** Writes the run's outcome. A failed write is logged, never thrown: the run
 *  already happened, and its result still goes back to the cron. */
export async function recordRun(outcome: RunResult | { error: string }): Promise<void> {
  const value: LastRun =
    'error' in outcome
      ? { at: new Date().toISOString(), sendingOn: false, pausedReason: null, canWatch: false, firstsSent: 0, followUpsSent: 0, failures: 0, note: null, error: outcome.error }
      : {
          at: new Date().toISOString(),
          sendingOn: outcome.sendingOn,
          pausedReason: outcome.pausedReason,
          canWatch: outcome.canWatch,
          firstsSent: outcome.firstsSent,
          followUpsSent: outcome.followUpsSent,
          failures: Object.keys(outcome.failures).length,
          note: outcome.note ?? null,
          error: null,
        };
  const { error } = await outreachDb()
    .from('platform_settings')
    .upsert(
      {
        key: LAST_RUN_KEY,
        value,
        description: 'What the last outreach run did (lib/outreach/last-run.ts). Written by the weekday cron only.',
        updated_at: value.at,
      },
      { onConflict: 'key' }
    );
  if (error) console.error('[cron] outreach: could not record the run', error.message);
}

export async function lastRun(): Promise<LastRun | null> {
  const { data, error } = await outreachDb().from('platform_settings').select('value').eq('key', LAST_RUN_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  const value = data?.value;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as LastRun) : null;
}

/** A Resend key made for sending only cannot list emails, which the bounce
 *  watch needs. Resend says so in words ("restricted to only send emails"). */
export function keyCannotRead(note: string | null): boolean {
  return Boolean(note && /restricted|only send/i.test(note));
}

export const FULL_KEY_FIX =
  'The Resend key in Vercel can only send. In Resend, make a key with Full access, put it in Vercel as RESEND_API_KEY, and redeploy.';

/** The run in one or two plain sentences, for the admin. */
export function lastRunWords(run: LastRun): string {
  const when = `${longDate(run.at)}, ${new Date(run.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}`;
  if (run.error) return `Last run ${when}: it failed (${run.error}). Nothing more was sent.`;
  if (run.pausedReason) return `Last run ${when}: paused. ${run.pausedReason}`;
  if (!run.sendingOn) return `Last run ${when}: sending was off, so nothing was sent.`;
  if (!run.canWatch) {
    const why = run.note ?? 'Could not see what happened to our emails, so nothing was sent.';
    return `Last run ${when}: nothing was sent. ${why}${keyCannotRead(run.note) ? ` ${FULL_KEY_FIX}` : ''}`;
  }
  const sent = `${run.firstsSent} first ${run.firstsSent === 1 ? 'email' : 'emails'} and ${run.followUpsSent} follow ${run.followUpsSent === 1 ? 'up' : 'ups'}`;
  return `Last run ${when}: sent ${sent}.${run.failures ? ` ${run.failures} could not be sent and wait for the next run.` : ''}${run.note ? ` ${run.note}` : ''}`;
}
