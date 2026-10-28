'use client';

import { useId, useState } from 'react';
import { SealCheckIcon } from './icons';
import { fieldInput } from './form';
import { Free } from './Free';

// The shared field from components/form.ts. Only the look is shared; the
// wording of this form is deliberate and stays exactly as it is.
const FIELD_CLASS = fieldInput;

export function VerificationRequestForm({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const nameId = useId();
  const emailId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function requestVerification(queueType: 'free' | 'priority') {
    setSubmitting(true);
    setResult(null);
    const res = await fetch('/api/verification-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, queueType, contactName: name, contactEmail: email }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSubmitting(false);
      setResult({ ok: false, message: json.error ?? 'Something went wrong.' });
      return;
    }
    if (json.checkoutUrl) {
      window.location.href = json.checkoutUrl;
      return;
    }
    setSubmitting(false);
    setResult({
      ok: true,
      message:
        json.status === 'queued'
          ? "You're in today's free queue. There's no set timeframe, but we'll be in touch."
          : "Today's 3 free slots are full, so you're first in line for tomorrow. No need to send it again.",
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Requesting verification for <strong className="font-semibold text-ink">{restaurantName}</strong>.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-medium text-ink">
            Your name
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-sm font-medium text-ink">
            Your email
          </label>
          <input
            id={emailId}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-line bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">
            <Free>Free</Free> verification
          </h3>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
            Joins the normal queue. There&apos;s no set timeframe: we take on about 3 <Free>free</Free>{' '}
            checks a day.
          </p>
          <button
            type="button"
            onClick={() => requestVerification('free')}
            disabled={submitting}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-ink px-4 text-[13px] font-semibold text-ink transition hover:bg-ink hover:text-white disabled:opacity-60"
          >
            Request free verification
          </button>
        </div>

        <div className="flex flex-col rounded-2xl border-2 border-ink bg-ink/[0.03] p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <SealCheckIcon className="h-4 w-4 text-accent-ink" />
            Priority Verification, £30
          </h3>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
            Moves you ahead of the free queue. We aim to review it within 48 working hours. Paying
            moves you up the queue. It never changes the answer.
          </p>
          <button
            type="button"
            onClick={() => requestVerification('priority')}
            disabled={submitting}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-ink px-4 text-[13px] font-semibold text-white transition hover:bg-accent-ink disabled:opacity-60"
          >
            Pay £30 for Priority Verification
          </button>
        </div>
      </div>

      {result && (
        <p
          role={result.ok ? 'status' : 'alert'}
          className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 ${
            result.ok
              ? 'bg-halal-fullSoft text-halal-fullInk ring-halal-full/20'
              : 'bg-halal-partialSoft text-halal-partialInk ring-halal-partial/20'
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
