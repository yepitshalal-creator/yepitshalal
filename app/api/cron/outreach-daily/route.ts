import { NextResponse } from 'next/server';
import { cronRefusal } from '@/lib/deals/cron';
import { runOutreachDay } from '@/lib/outreach/job';

// Weekdays at 10am London time in winter (9am UTC), from vercel.json. Watches
// for bounces and complaints, then sends follow ups and first emails, but only
// while sending is switched on in /admin/outreach. Add ?dry=1 to see what it
// would do without writing or sending anything.

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
    return NextResponse.json(await runOutreachDay({ dryRun }));
  } catch (e) {
    console.error('[cron] outreach', (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
