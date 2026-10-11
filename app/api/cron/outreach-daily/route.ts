import { NextResponse } from 'next/server';
import { cronRefusal } from '@/lib/deals/cron';
import { runOutreachDay } from '@/lib/outreach/job';

// Weekdays at 9am UTC from vercel.json: 10am in London in summer, 9am in
// winter. Watches for bounces and complaints, then sends follow ups and first
// emails, but only while sending is switched on in /admin/outreach. Add ?dry=1
// to see what it would do without writing or sending anything.

export const dynamic = 'force-dynamic';
// A GET-only route: without this, Next 14 caches every fetch in it, Resend's
// answers and the database reads included (see lib/deals/db.ts).
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

export async function GET(request: Request) {
  const refused = cronRefusal(request);
  if (refused) return refused;

  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  try {
    const result = await runOutreachDay({ dryRun });
    // One line in the function logs each run, so a stopped run can be seen.
    console.log('[cron] outreach', JSON.stringify({ ...result, skipped: Object.keys(result.skipped).length }));
    return NextResponse.json(result);
  } catch (e) {
    console.error('[cron] outreach', (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
