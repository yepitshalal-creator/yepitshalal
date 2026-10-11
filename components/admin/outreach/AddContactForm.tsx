'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { addContact, type AddState } from '@/lib/outreach/admin-actions';
import { Field, FIELD, BUTTON } from '@/components/admin/ui';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={BUTTON}>
      {pending ? 'Adding…' : 'Add contact'}
    </button>
  );
}

/** `place` fills in the place, for a form opened from that restaurant's admin page. */
export function AddContactForm({ place }: { place?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useFormState<AddState, FormData>(async (prev, formData) => {
    const next = await addContact(prev, formData);
    if (next.ok) ref.current?.reset();
    return next;
  }, {});

  return (
    <form ref={ref} action={action} className="space-y-4 px-5 py-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Who they are" htmlFor="business_kind" hint="Not sure? Pick not sure. It means a call, not an email.">
          <select id="business_kind" name="business_kind" defaultValue="unsure" className={FIELD}>
            <option value="unsure">Not sure</option>
            <option value="sole_trader">Sole trader</option>
            <option value="partnership">Partnership</option>
            <option value="limited_company">Limited company (their website says so)</option>
            <option value="chain_head_office">Chain head office</option>
          </select>
        </Field>
        <Field label="How we contact them" htmlFor="channel">
          <select id="channel" name="channel" defaultValue="phone" className={FIELD}>
            <option value="phone">Phone call</option>
            <option value="contact_form">Their contact form</option>
            <option value="email">Email (chains and limited companies only)</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Place" htmlFor="place" hint="Its page address on our site, or its slug.">
          <input id="place" name="place" defaultValue={place} placeholder="yepitshalal.com/restaurant/…" className={FIELD} />
        </Field>
        <Field label="Chain (head office only)" htmlFor="brand" hint="The chain's brand slug.">
          <input id="brand" name="brand" className={FIELD} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="contact_name">
          <input id="contact_name" name="contact_name" className={FIELD} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" className={FIELD} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <input id="phone" name="phone" type="tel" className={FIELD} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Where we found it" htmlFor="found_at_url" hint="The public page with the address or number.">
          <input id="found_at_url" name="found_at_url" placeholder="https://" className={FIELD} />
        </Field>
        <Field label="Found on" htmlFor="found_how">
          <select id="found_how" name="found_how" defaultValue="own_website" className={FIELD}>
            <option value="own_website">Their own website</option>
            <option value="osm">OpenStreetMap</option>
            <option value="owner">The owner gave it to us</option>
            <option value="phone_call">On a call</option>
            <option value="other">Somewhere else</option>
          </select>
        </Field>
      </div>
      <Field label="Page that names the limited company" htmlFor="company_evidence_url" hint="Only for a limited company: the page on their own site, often the footer or terms.">
        <input id="company_evidence_url" name="company_evidence_url" placeholder="https://" className={FIELD} />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <input id="notes" name="notes" className={FIELD} />
      </Field>
      {state.error && <p role="alert" className="text-sm font-medium text-halal-partialInk">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm font-medium text-halal-fullInk">{state.ok}</p>}
      <Submit />
    </form>
  );
}
