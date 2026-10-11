import { NextResponse } from 'next/server';
import { cronRefusal } from '@/lib/deals/cron';
import { refreshHygiene } from '@/lib/hygiene/refresh';

// Tuesdays, from vercel.json. Reads the FSA's 33 London files and updates the
// food hygiene rating of every place that has an FSA registration. Add ?dry=1
// to see what would change without writing anything.

export const dynamic = 'force-dynamic';
// A GET-only route: without this, Next 14 caches every fetch in it, the FSA
// files and the database reads included (see lib/deals/db.ts).
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

export async function GET(request: Request) {
  const refused = cronRefusal(request);
  if (refused) return refused;

  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  try {
    return NextResponse.json(await refreshHygiene({ dryRun }));
  } catch (e) {
    console.error('[cron] hygiene', (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
