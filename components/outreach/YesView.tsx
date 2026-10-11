import Link from 'next/link';
import { YesForm } from './YesForm';
import { OwnerUploads } from './OwnerUploads';
import { longDate, type Permission, type Target } from '@/lib/outreach/data';
import { PERMISSION_WORDS } from '@/lib/outreach/words';
import { sayNo, takeBack } from '@/lib/outreach/actions';
import { BLOCK_CLASS } from '@/lib/analytics/scrub';

// What /yes/[token] shows, apart from loading it, so it can be checked with
// made-up data. Two states: asking (with the words and the form), and after
// a yes (uploads, next steps, and the way to take it back).

export function YesView({
  token,
  target,
  permission,
  saidNo,
}: {
  token: string;
  target: Target;
  permission: Pick<Permission, 'given_by_name' | 'given_by_email' | 'agreed_at'> | null;
  saidNo: boolean;
}) {
  return (
    <main className={`${BLOCK_CLASS} mx-auto max-w-lg px-4 pb-28 pt-6 sm:pt-10`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{target.name}</p>
      {permission ? (
        <>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">Thank you! Your yes is saved.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
            {permission.given_by_name} said yes on {longDate(permission.agreed_at)}.
          </p>
          <div className="mt-5">
            <OwnerUploads token={token} />
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">What to do next</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80">
              <li>Add your photos and videos above, or reply to our email with them.</li>
              {!target.isChain && target.slug && (
                <li>
                  Want to change your page yourself?{' '}
                  <Link href={`/sign-in?next=/restaurant/${target.slug}`} className="font-semibold text-accent-ink underline underline-offset-2">
                    Sign in
                  </Link>{' '}
                  with {permission.given_by_email}, then tap &ldquo;Claim this restaurant&rdquo;.
                </li>
              )}
            </ul>
          </div>
          {target.slug && (
            <Link
              href={`/restaurant/${target.slug}`}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-sm font-semibold text-white"
            >
              See your page
            </Link>
          )}
          <div className="mt-10 border-t border-line pt-5">
            <h2 className="text-sm font-semibold text-ink">Changed your mind?</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Take it back and your photos come off the site straight away. We delete our posts within 14 days.
            </p>
            <form action={takeBack.bind(null, token)} className="mt-3">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink"
              >
                Take back my yes
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">
            Can we show your food on YepItsHalal?
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
            YepItsHalal is a free website that helps Muslims in London find halal food near them.{' '}
            {target.isChain ? 'Your London branches are on it.' : 'Your place is on it.'} Saying yes does not change your halal
            label. Only a check by us does that.
          </p>
          {target.slug && (
            <Link href={`/restaurant/${target.slug}`} className="mt-2 inline-block text-sm font-semibold text-accent-ink underline underline-offset-2">
              See {target.isChain ? 'one of your pages' : 'your page'}
            </Link>
          )}
          {saidNo && (
            <p className="mt-4 rounded-xl bg-black/[0.04] px-3.5 py-2.5 text-sm leading-relaxed text-ink/80">
              You told us no, so we won&apos;t contact you again. If you change your mind, you can still say yes here.
            </p>
          )}
          <div className="mt-6">
            <YesForm token={token} words={PERMISSION_WORDS} isChain={target.isChain} />
          </div>
          {!saidNo && (
            <form action={sayNo.bind(null, token)} className="mt-3">
              <button
                type="submit"
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-line bg-white px-5 text-[15px] font-semibold text-ink"
              >
                No thanks, don&apos;t contact us again
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
