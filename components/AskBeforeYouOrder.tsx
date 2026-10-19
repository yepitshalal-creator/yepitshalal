import Link from 'next/link';
import { PhoneIcon } from './icons';
import { formatUkPhone } from '@/lib/phone';

// "Just ask" is the advice people give most when someone asks how to know a
// place is halal (the 2026-10-12 plan, Step 2). This makes asking easy: the
// four questions that settle it, and the number to ring. It needs no data
// about the place, so it can never overstate anything.

const QUESTIONS = [
  'Is all the meat halal?',
  'Who certifies it? HMC, HFA, or someone else?',
  'Is the halal food cooked apart from the rest?',
  'Do you serve alcohol?',
];

export function AskBeforeYouOrder({ phone }: { phone: string | null }) {
  return (
    <section aria-labelledby="ask-first" className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 id="ask-first" className="font-display text-base font-semibold text-ink">
        Before you order, ask
      </h2>
      <p className="mt-1 text-sm text-muted">Staff can answer these in a minute.</p>
      <ul className="mt-3 space-y-1.5">
        {QUESTIONS.map((q) => (
          <li key={q} className="flex gap-2.5 text-[15px] leading-snug text-ink/85">
            <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-ink/60" />
            {q}
          </li>
        ))}
      </ul>
      <Link
        href="/how-we-check/hmc-and-hfa"
        className="mt-3 block w-fit text-sm font-medium text-accent-ink underline decoration-accent-ink/30 underline-offset-2 hover:decoration-accent-ink"
      >
        What HMC and HFA each allow
      </Link>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-ink active:scale-[0.98]"
        >
          <PhoneIcon className="h-4 w-4" />
          Call {formatUkPhone(phone)}
        </a>
      )}
    </section>
  );
}
