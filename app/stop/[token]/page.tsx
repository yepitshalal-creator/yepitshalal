import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contactByToken, isStopped, outreachDb, targetOf } from '@/lib/outreach/data';
import { stopFromPage } from '@/lib/outreach/actions';
import { BLOCK_CLASS } from '@/lib/analytics/scrub';

// Where "Don't want emails from us?" leads. It asks before stopping, because
// some mail systems open every link in an email to check it, and that alone
// must not take a place off our list. Mail apps' own Unsubscribe button posts
// to /api/outreach/stop instead and stops at once.

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Stop emails from YepItsHalal',
  robots: { index: false, follow: false },
};

export default async function StopPage({ params }: { params: { token: string } }) {
  const db = outreachDb();
  const contact = await contactByToken(db, params.token);
  if (!contact) notFound();
  const [target, stopped] = await Promise.all([targetOf(db, contact), isStopped(db, contact)]);

  return (
    <main className={`${BLOCK_CLASS} mx-auto max-w-lg px-4 pb-28 pt-6 sm:pt-10`}>
      {target && <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{target.name}</p>}
      {stopped ? (
        <>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">Done. We won&apos;t contact you again.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
            Not by email, not by phone. Sorry for the bother. Your place stays on YepItsHalal, as it was.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">Stop emails from YepItsHalal?</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
            Tap the button and we won&apos;t email or call you again. Your place stays on YepItsHalal, as it was.
          </p>
          <form action={stopFromPage.bind(null, params.token)} className="mt-6">
            <button
              type="submit"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-white"
            >
              Stop all emails and calls
            </button>
          </form>
        </>
      )}
    </main>
  );
}
