'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics/posthog';
import { CheckIcon } from './icons';
import { choicePill, fieldGroup, fieldHint, fieldInput, fieldLabel, formError } from './form';
import { ctaPrimary, ctaSecondary } from './cta';
import { Swap } from './motion/Swap';

// Field styles live in components/form.ts, shared with every other form.
const FIELD_CLASS = fieldInput;
const LABEL_CLASS = fieldLabel;

function Field({
  label,
  name,
  hint,
  ...props
}: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
        {props.required && (
          <span className="ml-0.5 text-halal-partialInk" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input id={id} name={name} aria-describedby={hintId} className={FIELD_CLASS} {...props} />
      {hint && (
        <p id={hintId} className={fieldHint}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Choice({
  name,
  label,
  options,
  required,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const labelId = useId();
  return (
    <fieldset>
      <legend id={labelId} className={LABEL_CLASS}>
        {label}
        {required && (
          <span className="ml-0.5 text-halal-partialInk" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={choicePill}
          >
            <input type="radio" name={name} value={opt.value} required={required} className="sr-only" />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: "Don't know" },
];

export interface ExistingPlace {
  slug: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  website: string;
  cuisine: string;
  /** Filled in when someone tapped "It has closed" on the place page. */
  notes?: string;
}

export function SubmitRestaurantForm({
  cuisines,
  existing = null,
}: {
  cuisines: { id: number; name: string }[];
  /** Set when suggesting an edit to a place we already have. */
  existing?: ExistingPlace | null;
}) {
  const cuisineId = useId();
  const notesId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; duplicate: { name: string; slug: string } | null } | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch('/api/restaurants/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.');
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      track('restaurant_submission_created', {
        submission_type: existing ? 'listing_edit' : 'new_restaurant',
        relationship: String(data.relationship ?? 'not_provided'),
        halal_claim: String(data.halal_claim ?? 'not_provided'),
      });
      setDone({ name: String(data.name), duplicate: json.duplicate ?? null });
      requestAnimationFrame(() => {
        doneRef.current?.focus();
        doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch {
      setError('Something went wrong sending the form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Swap id="done">
      <div
        ref={doneRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl border border-line bg-white p-6 shadow-sm focus:outline-none"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <CheckIcon className="h-5 w-5" />
        </span>
        <h2 className="mt-3 font-display text-xl font-semibold text-ink">Thanks, we&apos;ve got it</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {existing
            ? `We check every suggestion before it changes a listing, so ${existing.name} won't update straight away.`
            : `We check every restaurant before it appears on YepItsHalal, so ${done.name} won't show up straight away.`}{' '}
          If you left an email, we may get in touch with a question.
        </p>
        {done.duplicate && !existing && (
          <p className="mt-3 rounded-xl bg-halal-partialSoft px-4 py-3 text-sm text-halal-partialInk ring-1 ring-halal-partial/20">
            We may already list this restaurant as{' '}
            <Link href={`/restaurant/${done.duplicate.slug}`} className="font-semibold underline">
              {done.duplicate.name}
            </Link>
            . We&apos;ll use your details to update it if it&apos;s the same place.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/"
            className={ctaPrimary}
          >
            Back to search
          </Link>
          <button
            type="button"
            onClick={() => setDone(null)}
            className={ctaSecondary}
          >
            Add another
          </button>
        </div>
      </div>
      </Swap>
    );
  }

  return (
    <Swap id="form">
    <form onSubmit={handleSubmit} className="space-y-6" noValidate={false}>
      <input type="text" name="company_website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {existing && <input type="hidden" name="update_slug" value={existing.slug} />}

      <p className="text-xs text-muted">
        <span className="text-halal-partialInk" aria-hidden="true">*</span> Required
      </p>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-ink">The restaurant</h2>
        <Field label="Restaurant name" name="name" required minLength={2} maxLength={120} autoComplete="organization" defaultValue={existing?.name} />
        <Field label="Street address" name="address" required minLength={5} maxLength={300} autoComplete="street-address" placeholder="Number and street" defaultValue={existing?.address} />
        <Field
          label="Postcode"
          name="postcode"
          required
          maxLength={10}
          autoComplete="postal-code"
          hint="We use this to place it on the map, so it needs to be the restaurant's full postcode."
          defaultValue={existing?.postcode}
          className={`${FIELD_CLASS} uppercase sm:max-w-[12rem]`}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            hint="How we check: we ring and ask."
            defaultValue={existing?.phone}
          />
          <div>
            <label htmlFor={cuisineId} className={LABEL_CLASS}>
              Cuisine
            </label>
            <select id={cuisineId} name="cuisine" className={FIELD_CLASS} defaultValue={cuisines.some((c) => c.name === existing?.cuisine) ? existing!.cuisine : ''}>
              <option value="">Choose one</option>
              {cuisines.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Website" name="website" type="url" inputMode="url" placeholder="https://" defaultValue={existing?.website} />
          <Field label="Instagram" name="instagram" placeholder="@handle" />
        </div>
      </section>

      <section className={fieldGroup}>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Halal information</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Tell us what you know. We show where information came from, so a listing that rests on
            a form alone can never show as more than Unverified until something stronger arrives.
          </p>
        </div>
        <Choice
          name="halal_claim"
          label="What best describes the food?"
          options={[
            { value: 'fully_halal', label: 'All meat is halal' },
            { value: 'halal_options', label: 'Some halal options' },
            { value: 'unknown', label: 'Not sure' },
          ]}
        />
        <Choice name="serves_pork" label="Is pork served?" options={YES_NO} />
        <Choice name="serves_alcohol" label="Is alcohol served?" options={YES_NO} />
        <Field label="Halal certifier, if any" name="certification_body" placeholder="For example HMC or HFA" maxLength={80} />
        <Field
          label="Link that shows it"
          name="evidence_url"
          type="url"
          inputMode="url"
          placeholder="https://"
          hint="A menu, certificate or post that mentions halal. This is what lets us check it quickly."
        />
      </section>

      {/* Nobody publishes this and everybody wants to know it, so it comes from
          the people who actually go. Kept out of the halal section on purpose:
          a prayer room is not evidence about meat, and putting the two
          questions in one box would invite somebody to read it as if it were. */}
      <section className={fieldGroup}>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Somewhere to pray</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            If you&apos;ve been, this is the thing nobody else will tell you. It goes on the listing
            as something a visitor said, with the date, and it never affects the halal label.
          </p>
        </div>
        <Choice
          name="prayer_facility"
          label="Is there anywhere to pray inside?"
          options={[
            { value: 'prayer_room', label: 'A prayer room' },
            { value: 'space', label: 'Somewhere, not a room' },
            { value: 'none', label: 'Nowhere' },
            { value: 'unknown', label: "Didn't notice" },
          ]}
        />
        <Field
          label="Where is it, and anything worth knowing?"
          name="prayer_facility_note"
          maxLength={200}
          placeholder="Upstairs past the counter, ask a member of staff"
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-ink">About you</h2>
        <Choice
          name="relationship"
          label="How do you know this restaurant?"
          required
          options={[
            { value: 'owner', label: 'I run it' },
            { value: 'staff', label: 'I work there' },
            { value: 'customer', label: "I've eaten there" },
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Your name" name="contact_name" required autoComplete="name" minLength={2} maxLength={100} />
          <Field
            label="Your email"
            name="contact_email"
            type="email"
            required
            autoComplete="email"
            maxLength={200}
            hint="Only used to ask about this listing. Never published, never sold."
          />
        </div>
        <div>
          <label htmlFor={notesId} className={LABEL_CLASS}>
            Anything else we should know?
          </label>
          <textarea id={notesId} name="notes" rows={3} maxLength={1000} className={FIELD_CLASS} defaultValue={existing?.notes} />
        </div>
      </section>

      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className={formError}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={`${ctaPrimary} w-full`}
      >
        {submitting ? 'Sending…' : existing ? 'Send the edit for review' : 'Send for review'}
      </button>
    </form>
    </Swap>
  );
}
