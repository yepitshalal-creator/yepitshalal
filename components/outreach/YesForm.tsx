'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sayYes, type YesState } from '@/lib/outreach/actions';
import { PRICE_RANGES } from '@/lib/price';

const FIELD =
  'w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-[16px] text-ink placeholder:text-subtle focus:border-accent-ink focus:outline-none focus:ring-2 focus:ring-accent-ink/20';
const LABEL = 'mb-1.5 block text-sm font-semibold text-ink';

function YesButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent px-5 text-[15px] font-semibold text-forest-deep shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Yes, go ahead'}
    </button>
  );
}

export function YesForm({ token, words, isChain }: { token: string; words: string; isChain: boolean }) {
  const [state, action] = useFormState<YesState, FormData>(sayYes.bind(null, token), {});

  return (
    <form action={action} className="space-y-5">
      <div className="rounded-2xl border border-line bg-sand-soft/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">What you agree to</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{words}</p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
        <input type="checkbox" name="agree" className="mt-0.5 h-5 w-5 shrink-0 accent-[#0B2F3A]" />
        <span className="text-[15px] leading-relaxed text-ink">
          Yes, I agree. I run this place, or I am allowed to say yes for it.
        </span>
      </label>

      <div className="space-y-4">
        <div>
          <label htmlFor="yes-name" className={LABEL}>
            Your name
          </label>
          <input id="yes-name" name="name" autoComplete="name" required className={FIELD} />
        </div>
        <fieldset>
          <legend className={LABEL}>You are the</legend>
          <div className="flex flex-wrap gap-2">
            {[
              ['owner', 'Owner'],
              ['manager', 'Manager'],
              ...(isChain ? [['head_office', 'Head office']] : []),
            ].map(([value, label]) => (
              <label
                key={value}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
              >
                <input type="radio" name="role" value={value} className="sr-only" required />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="yes-email" className={LABEL}>
            Your email
          </label>
          <input id="yes-email" name="email" type="email" autoComplete="email" required className={FIELD} />
          <p className="mt-1 text-xs text-muted">We send you a copy of this, with a link to take it back.</p>
        </div>
      </div>

      <details className="rounded-2xl border border-line bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Add more now (you can skip this)</summary>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="yes-price" className={LABEL}>
              Price a head
            </label>
            <select id="yes-price" name="price_range" defaultValue="" className={FIELD}>
              <option value="">Skip</option>
              {PRICE_RANGES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.signs} {p.words}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="yes-menu" className={LABEL}>
              Link to your menu
            </label>
            <input id="yes-menu" name="menu_url" inputMode="url" placeholder="yoursite.com/menu" className={FIELD} />
          </div>
          <div>
            <label htmlFor="yes-hours" className={LABEL}>
              Opening hours
            </label>
            <textarea
              id="yes-hours"
              name="hours"
              rows={3}
              placeholder="Like: Mon to Sat 12pm to 11pm, Sun 1pm to 10pm"
              className={FIELD}
            />
          </div>
        </div>
      </details>

      <p className="text-sm leading-relaxed text-muted">
        Photos and videos: you can add them as soon as you say yes.
      </p>

      {state.error && (
        <p role="alert" className="rounded-xl bg-halal-partialSoft px-3.5 py-2.5 text-sm font-medium text-halal-partialInk">
          {state.error}
        </p>
      )}

      <YesButton />
    </form>
  );
}
