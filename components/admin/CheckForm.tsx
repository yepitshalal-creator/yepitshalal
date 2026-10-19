import { Field, FIELD, BUTTON } from './ui';
import { ActionForm } from './ActionForm';
import type { TriState } from '@/lib/types';
import type { ActionState } from '@/lib/admin/action-state';

// The form for writing down a halal check we made ourselves. The rules it
// feeds are in lib/admin/save-check.ts; this only asks the questions.

// FIELD is full width; a yes/no/don't know picker beside its question is not.
const TRI_FIELD = `${FIELD.replace('w-full ', '')} w-36 shrink-0`;

function TriSelect({ name, label, defaultValue }: { name: string; label: string; defaultValue?: TriState }) {
  const value = defaultValue === true ? 'yes' : defaultValue === false ? 'no' : 'unknown';
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={`check-${name}`} className="text-sm text-ink/80">
        {label}
      </label>
      <select id={`check-${name}`} name={name} defaultValue={value} className={TRI_FIELD}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
        <option value="unknown">Don&apos;t know</option>
      </select>
    </div>
  );
}

// Shared with the queue page's form, which saves through the same saveCheck.
export const CERTIFICATION_BODY_HINT =
  "Only if they named one. The public page says Certified only when you found them on the certifier's own register. Any other way, it says the restaurant says so.";

export interface KnownFacts {
  all_meat_halal: TriState;
  serves_non_halal_meat: TriState;
  serves_pork: TriState;
  serves_alcohol: TriState;
  has_certification: TriState;
  certification_body: string | null;
}

export function CheckForm({
  action,
  facts,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  facts?: KnownFacts | null;
}) {
  return (
    <ActionForm action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="How did you check?" htmlFor="check-method">
          <select id="check-method" name="method" required className={FIELD} defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            <option value="phone">Spoke to the restaurant</option>
            <option value="visit">Visited in person</option>
            <option value="documents">Saw documents (certificate, supplier invoices)</option>
            <option value="certifier_register">Found it on the certifier&apos;s own register</option>
          </select>
        </Field>
        <Field label="What did you find?" htmlFor="check-classification">
          <select id="check-classification" name="classification" required className={FIELD} defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            <option value="fully_halal">Fully Halal: all the meat is halal</option>
            <option value="halal_options">Halal food available: some of it is halal</option>
            <option value="not_halal">They told us it is not halal</option>
            <option value="unverified">Couldn&apos;t confirm either way</option>
          </select>
        </Field>
      </div>

      <Field
        label="What you found, for the public"
        htmlFor="check-summary"
        hint="One or two plain sentences, shown on the restaurant page as the evidence. Not needed if you couldn't confirm. No private details."
      >
        <input id="check-summary" name="public_summary" maxLength={280} className={FIELD} placeholder="The manager told us on the phone that all their chicken and lamb is halal." />
      </Field>

      <fieldset className="rounded-xl bg-sand-soft/70 p-4">
        <legend className="px-1 text-sm font-semibold text-ink">What they told you</legend>
        <p className="mb-3 text-xs text-muted">
          Leave a question at Don&apos;t know unless you asked it. Not finding them on one certifier&apos;s register is
          Don&apos;t know, not No.
        </p>
        <div className="space-y-3">
          <TriSelect name="all_meat_halal" label="All meat halal?" defaultValue={facts?.all_meat_halal} />
          <TriSelect name="serves_non_halal_meat" label="Serves non-halal meat?" defaultValue={facts?.serves_non_halal_meat} />
          <TriSelect name="serves_pork" label="Serves pork?" defaultValue={facts?.serves_pork} />
          <TriSelect name="serves_alcohol" label="Serves alcohol?" defaultValue={facts?.serves_alcohol} />
          <TriSelect name="has_certification" label="Halal certified?" defaultValue={facts?.has_certification} />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="Certification body" htmlFor="check-body" hint={CERTIFICATION_BODY_HINT}>
          <input id="check-body" name="certification_body" defaultValue={facts?.certification_body ?? ''} placeholder="For example HMC or HFA" className={FIELD} />
        </Field>
        <Field label="Source link" htmlFor="check-source" hint="Optional. The certifier's register page for this outlet.">
          <input id="check-source" name="source_url" type="url" placeholder="https://" className={FIELD} />
        </Field>
      </div>

      <Field label="Private notes" htmlFor="check-notes" hint="Never shown publicly. Who you spoke to, when.">
        <textarea id="check-notes" name="notes" rows={2} className={FIELD} />
      </Field>

      <button type="submit" className={BUTTON}>
        Save the check
      </button>
    </ActionForm>
  );
}
