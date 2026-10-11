import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { approveSubmission, mergeSubmission, rejectSubmission } from '@/lib/submission-actions';
import { AdminPage, Panel, Tag, BUTTON, BUTTON_SECONDARY, FIELD } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review submission', robots: { index: false } };

interface Candidate {
  id: string;
  name: string;
  slug: string;
  address: string;
  postcode: string | null;
  is_listed: boolean;
  distance_meters: number;
  similarity: number;
}

const yesNo = (v: boolean | null) => (v === true ? 'Yes' : v === false ? 'No' : 'Not stated');

export default async function SubmissionPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const supabase = createAdminSupabase();
  const { data: s } = await supabase.from('restaurant_submissions').select('*').eq('id', params.id).maybeSingle();
  if (!s) notFound();

  const candidates = (Array.isArray(s.duplicate_candidates) ? s.duplicate_candidates : []) as Candidate[];
  const pending = s.status === 'pending';

  const details: [string, React.ReactNode][] = [
    ['Address', `${s.address}, ${s.postcode}`],
    ['Borough', s.borough],
    ['Map', <a key="map" className="underline" href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=18/${s.lat}/${s.lng}`} target="_blank" rel="noreferrer">Postcode location</a>],
    ['Phone', s.phone ?? 'Not given'],
    ['Website', s.website ? <a key="w" className="underline" href={s.website} target="_blank" rel="noreferrer">{s.website}</a> : 'Not given'],
    ['Instagram', s.instagram ?? 'Not given'],
    ['Cuisine', s.cuisine ?? 'Not given'],
    ['Sent by', `${s.relationship}${s.contact_name ? `, ${s.contact_name}` : ''}${s.contact_email ? ` (${s.contact_email})` : ''}`],
    ['Halal', s.halal_claim === 'fully_halal' ? 'All meat halal' : s.halal_claim === 'halal_options' ? 'Some halal options' : 'Not sure'],
    ['Pork served', yesNo(s.serves_pork)],
    ['Alcohol served', yesNo(s.serves_alcohol)],
    ['Certifier', s.certification_body ?? 'None given'],
    ['Evidence link', s.evidence_url ? <a key="e" className="underline" href={s.evidence_url} target="_blank" rel="noreferrer">{s.evidence_url}</a> : 'None given'],
    [
      'Somewhere to pray',
      s.prayer_facility === 'prayer_room' ? 'A prayer room'
        : s.prayer_facility === 'space' ? 'Somewhere, not a dedicated room'
        : s.prayer_facility === 'none' ? 'Nowhere'
        : 'Not answered',
    ],
    ['Prayer note', s.prayer_facility_note ?? 'None'],
    ['Notes', s.notes ?? 'None'],
    ['Received', new Date(s.created_at).toLocaleString('en-GB')],
  ];

  return (
    <AdminPage
      title={s.name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Tag tone={pending ? 'warn' : 'neutral'}>{s.status}</Tag>
          {s.restaurant_id && (
            <Link href={`/admin/restaurants/${s.restaurant_id}`} className="underline">
              Open listing
            </Link>
          )}
        </span>
      }
      width="lg"
      action={<Link href="/admin/submissions" className={BUTTON_SECONDARY}>All submissions</Link>}
    >
      <div className="space-y-5">
        <Panel title="What they sent">
          <dl className="divide-y divide-line">
            {details.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 px-5 py-2.5 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className="min-w-0 break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        {s.restaurant_id && pending && (
          <Panel title="Suggested edit to a listing we have">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <p className="text-sm text-muted">
                The visitor started from{' '}
                <Link href={`/admin/restaurants/${s.restaurant_id}`} className="font-medium text-ink underline">
                  this listing
                </Link>
                . Applying fills in details it is missing and records any halal information as weak evidence.
              </p>
              <form action={mergeSubmission.bind(null, s.id, s.restaurant_id)}>
                <button className={BUTTON}>Apply to that listing</button>
              </form>
            </div>
          </Panel>
        )}

        <Panel title="Already listed nearby?">
          {candidates.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No similar listing within 250 m or at this postcode.</p>
          ) : (
            <ul className="divide-y divide-line">
              {candidates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <a href={`/restaurant/${c.slug}`} target="_blank" rel="noreferrer" className="font-medium text-ink underline">
                      {c.name}
                    </a>
                    <p className="text-xs text-muted">
                      {c.address} · {c.distance_meters} m away · name match {Math.round(c.similarity * 100)}%
                      {c.is_listed ? '' : ' · not currently listed'}
                    </p>
                  </div>
                  {pending && (
                    <form action={mergeSubmission.bind(null, s.id, c.id)}>
                      <button className={BUTTON_SECONDARY}>Same place: merge</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {pending && (
          <Panel title="Decision">
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm leading-relaxed text-muted">
                Approving creates a listing labelled Unverified, with this submission shown as its
                evidence. It cannot show as Fully Halal or Halal food available until stronger evidence is
                added, such as the restaurant&apos;s own published statement or a check by us.
              </p>
              <form action={approveSubmission.bind(null, s.id)}>
                <button className={BUTTON}>Approve as a new listing</button>
              </form>
              <form action={rejectSubmission.bind(null, s.id)} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] flex-1">
                  <label htmlFor="note" className="mb-1.5 block text-sm font-medium text-ink">
                    Reason for rejecting (private)
                  </label>
                  <input id="note" name="note" className={FIELD} maxLength={500} />
                </div>
                <button className={BUTTON_SECONDARY}>Reject</button>
              </form>
            </div>
          </Panel>
        )}
      </div>
    </AdminPage>
  );
}
