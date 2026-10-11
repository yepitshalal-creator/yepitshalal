import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { publishVerification } from '@/lib/admin-actions';
import { HalalBadge } from '@/components/HalalBadge';
import { ArrowUpRightIcon, InfoIcon } from '@/components/icons';
import {
  AdminPage,
  Panel,
  Field,
  Tag,
  QueueStatusTag,
  FIELD,
  BUTTON,
} from '@/components/admin/ui';
import { ActionForm } from '@/components/admin/ActionForm';
import type { HalalClassification, TriState } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Check request' };

function TriSelect({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: TriState;
}) {
  const value = defaultValue === true ? 'yes' : defaultValue === false ? 'no' : 'unknown';
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={name} className="text-sm text-ink/80">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={value}
        className={`${FIELD} w-auto min-w-[7.5rem] shrink-0`}
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
        <option value="unknown">Unknown</option>
      </select>
    </div>
  );
}

function claimValue(v: TriState): string {
  return v === true ? 'Yes' : v === false ? 'No' : 'Unknown';
}

export default async function ReviewVerificationPage({ params }: { params: { id: string } }) {
  // The layout checks too, but a layout is not always re-run when moving
  // between admin pages.
  await requireAdmin();
  const supabase = createAdminSupabase();
  const { data: request } = await supabase
    .from('verification_requests')
    .select(
      'id, queue_type, status, contact_name, contact_email, restaurant_id, restaurants(id, name, slug, halal_classification)'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!request) notFound();

  const { data: claims } = await supabase
    .from('restaurant_claims')
    .select('*')
    .eq('restaurant_id', request.restaurant_id)
    .order('submitted_at', { ascending: false })
    .limit(1);

  const claim = claims?.[0];
  const restaurant = request.restaurants as unknown as {
    id: string;
    name: string;
    slug: string;
    halal_classification: HalalClassification;
  };

  const publishWithId = publishVerification.bind(null, request.id);

  return (
    <AdminPage
      title={restaurant.name}
      width="sm"
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Tag tone={request.queue_type === 'priority' ? 'ink' : 'neutral'}>
            {request.queue_type === 'priority' ? '£30 Priority' : 'Free'}
          </Tag>
          <QueueStatusTag status={request.status} />
          <span className="text-muted">currently</span>
          <HalalBadge classification={restaurant.halal_classification} size="sm" />
        </span>
      }
      action={
        <Link
          href={`/restaurant/${restaurant.slug}`}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-soft"
        >
          View listing
          <ArrowUpRightIcon className="h-4 w-4" />
        </Link>
      }
    >
      <div className="space-y-5">
        {claim && (
          <Panel title="Restaurant's own claim">
            <div className="px-5 py-4">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
                What the owner told us. Not evidence: check it, don&apos;t copy it.
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {[
                  ['All meat halal', claim.all_meat_halal],
                  ['Non-halal meat', claim.serves_non_halal_meat],
                  ['Pork', claim.serves_pork],
                  ['Alcohol', claim.serves_alcohol],
                  ['Certified', claim.has_certification],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between gap-3 border-b border-line py-1 last:border-0 sm:border-0">
                    <dt className="text-muted">{label as string}</dt>
                    <dd className="font-medium text-ink">{claimValue(value as TriState)}</dd>
                  </div>
                ))}
              </dl>
              {claim.certification_body && (
                <p className="mt-2 text-sm text-ink/80">
                  Certification body: <strong className="font-semibold">{claim.certification_body}</strong>
                </p>
              )}
              {claim.evidence_note && (
                <p className="mt-2 rounded-xl bg-black/[0.03] px-3 py-2 text-sm leading-relaxed text-ink/80">
                  {claim.evidence_note}
                </p>
              )}
            </div>
          </Panel>
        )}

        <ActionForm action={publishWithId}>
          <Panel title="Verified facts">
            <div className="space-y-4 px-5 py-4">
              <TriSelect
                name="all_meat_halal"
                label="All meat halal?"
                defaultValue={claim?.all_meat_halal}
              />
              <TriSelect
                name="serves_non_halal_meat"
                label="Serves non-halal meat?"
                defaultValue={claim?.serves_non_halal_meat}
              />
              <TriSelect
                name="serves_pork"
                label="Serves pork?"
                defaultValue={claim?.serves_pork}
              />
              <TriSelect
                name="serves_alcohol"
                label="Serves alcohol?"
                defaultValue={claim?.serves_alcohol}
              />
              <TriSelect
                name="has_certification"
                label="Halal certified?"
                defaultValue={claim?.has_certification}
              />

              <Field label="Certification body" htmlFor="certification_body">
                <input
                  id="certification_body"
                  name="certification_body"
                  defaultValue={claim?.certification_body ?? ''}
                  placeholder="e.g. HMC, HFA"
                  className={FIELD}
                />
              </Field>

              <Field label="How did you check?" htmlFor="method">
                <select id="method" name="method" required className={FIELD} defaultValue="">
                  <option value="" disabled>
                    Choose one
                  </option>
                  <option value="visit">Visited in person</option>
                  <option value="phone">Spoke to the restaurant</option>
                  <option value="documents">Saw documents (certificate, supplier invoices)</option>
                  <option value="certifier_register">Found it on the certifier&apos;s own register</option>
                </select>
              </Field>

              <Field
                label="What you found, for the public"
                htmlFor="public_summary"
                hint="One or two plain sentences shown on the restaurant page as the evidence. No private details."
              >
                <input id="public_summary" name="public_summary" maxLength={280} required className={FIELD} />
              </Field>

              <Field
                label="Source link"
                htmlFor="source_url"
                hint="Optional. For example the certifier's register page for this outlet."
              >
                <input id="source_url" name="source_url" type="url" className={FIELD} />
              </Field>

              <Field
                label="Internal notes"
                htmlFor="notes"
                hint="Never shown publicly. What you checked and how."
              >
                <textarea id="notes" name="notes" rows={3} className={FIELD} />
              </Field>

              <Field
                label="Classification"
                htmlFor="classification"
                hint="This is the label the public sees. Unable to verify records the attempt and changes nothing public."
              >
                <select id="classification" name="classification" required className={FIELD}>
                  <option value="fully_halal">Fully Halal</option>
                  <option value="halal_options">Halal food available</option>
                  <option value="unverified">Unable to Verify</option>
                </select>
              </Field>

              <button type="submit" className={`${BUTTON} w-full`}>
                Publish result
              </button>
            </div>
          </Panel>
        </ActionForm>
      </div>
    </AdminPage>
  );
}
