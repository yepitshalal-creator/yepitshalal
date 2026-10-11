import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { getFounderAvailability } from '@/lib/founders-data';
import {
  approveFounderApplication,
  linkFounderListing,
  rejectFounderApplication,
  restoreFounderApplication,
} from '@/lib/founder-actions';
import { AdminPage, BUTTON_SECONDARY, FIELD, List, Panel, Row, Tag } from '@/components/admin/ui';
import { ConfirmSubmitButton } from '@/components/admin/ConfirmSubmitButton';
import { FOUNDERS_CAP } from '@/lib/founders';
import { SectionTabs } from '@/components/admin/SectionTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Founders', robots: { index: false } };

// Who has joined the 100 Founders Club, and in what order. The count at the
// top is the same number /founders shows, read the same way: Founder
// applications that have not been rejected (0050). The Supabase dashboard has
// the same list as a view, founders_club.

interface Application {
  id: string;
  created_at: string;
  tier: 'founder' | 'standard';
  founder_number: number | null;
  status: 'pending' | 'approved' | 'rejected';
  business_name: string;
  location: string;
  postcode: string | null;
  borough: string | null;
  contact_name: string;
  contact: string;
  instagram: string | null;
  phone: string | null;
  source: string | null;
  restaurant_id: string | null;
  review_note: string | null;
}

const STATUS = {
  pending: { label: 'Not checked yet', tone: 'warn' },
  approved: { label: 'Checked', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'neutral' },
} as const;

// Set by lib/founder-actions.ts when something could not be done.
const NOTICES: Record<string, string> = {
  'restore-taken': 'That one cannot be restored: its Founder spot, or the same business, has been taken by another application since.',
  'no-listing': 'There is no listing at that address. Copy the restaurant page address from the site and try again.',
  failed: 'That did not save. Try again in a moment.',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

export default async function FoundersAdminPage({ searchParams }: { searchParams: { notice?: string } }) {
  await requireAdmin();
  const notice = searchParams.notice ? NOTICES[searchParams.notice] : undefined;
  const supabase = createAdminSupabase();

  const [availability, { data }] = await Promise.all([
    getFounderAvailability(),
    supabase
      .from('founder_applications')
      .select(
        'id, created_at, tier, founder_number, status, business_name, location, postcode, borough, contact_name, contact, instagram, phone, source, restaurant_id, review_note'
      )
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);
  const rows = (data ?? []) as Application[];

  const founders = rows
    .filter((r) => r.tier === 'founder' && r.status !== 'rejected')
    .sort((a, b) => (a.founder_number ?? 0) - (b.founder_number ?? 0));
  const standard = rows.filter((r) => r.tier === 'standard' && r.status !== 'rejected');
  const rejected = rows.filter((r) => r.status === 'rejected');

  const linkedIds = [...new Set(rows.map((r) => r.restaurant_id).filter((id): id is string => Boolean(id)))];
  const { data: listingRows } = linkedIds.length
    ? await supabase.from('restaurants').select('id, slug, name').in('id', linkedIds)
    : { data: [] as { id: string; slug: string; name: string }[] };
  const listings = new Map((listingRows ?? []).map((l) => [l.id, l]));

  const claimed = availability?.claimed ?? founders.length;
  const cap = availability?.cap ?? FOUNDERS_CAP;

  return (
    <AdminPage
      tabs={<SectionTabs section="partners" current="/admin/founders" />}
      title="Founders"
      width="lg"
      description={
        <>
          The 100 Founders Club, from{' '}
          <Link href="/founders" className="font-semibold text-accent-ink hover:underline">
            /founders
          </Link>
          . Rejecting a Founder frees their spot straight away, and the next business to claim one
          takes it. Nothing here changes a halal label.
        </>
      }
    >
      {notice && (
        <p role="alert" className="mb-4 rounded-xl bg-halal-partialSoft px-4 py-3 text-sm font-medium text-halal-partialInk ring-1 ring-halal-partial/20">
          {notice}
        </p>
      )}

      <Panel>
        <dl className="grid grid-cols-3 divide-x divide-line">
          <Stat label="Founders" value={`${claimed} of ${cap}`} />
          <Stat label="Standard listings" value={String(standard.length)} />
          <Stat label="Rejected" value={String(rejected.length)} />
        </dl>
      </Panel>
      <p className="mt-2 text-xs text-muted">
        Also in the Supabase dashboard: Table Editor, the founders_club view.
      </p>

      <Panel title="Founders, in order" className="mt-6">
        <List empty="No Founders yet.">
          {founders.map((r) => (
            <ApplicationRow key={r.id} row={r} listing={r.restaurant_id ? listings.get(r.restaurant_id) : undefined} />
          ))}
        </List>
      </Panel>

      <Panel title="Standard free listings" className="mt-6">
        <List empty="None yet. These start once all 100 Founder spots are taken.">
          {standard.map((r) => (
            <ApplicationRow key={r.id} row={r} listing={r.restaurant_id ? listings.get(r.restaurant_id) : undefined} />
          ))}
        </List>
      </Panel>

      {rejected.length > 0 && (
        <Panel title="Rejected" className="mt-6">
          <List empty="">
            {rejected.map((r) => (
              <ApplicationRow key={r.id} row={r} listing={undefined} />
            ))}
          </List>
        </Panel>
      )}
    </AdminPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function ApplicationRow({
  row: r,
  listing,
}: {
  row: Application;
  listing: { id: string; slug: string; name: string } | undefined;
}) {
  const status = STATUS[r.status];
  const isFounder = r.tier === 'founder';
  const place = [r.location, r.postcode && !r.location.toUpperCase().includes(r.postcode) ? r.postcode : null, r.borough]
    .filter(Boolean)
    .join(', ');

  return (
    <Row className="flex-wrap items-start">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          {isFounder && r.founder_number !== null && (
            <span className="font-display text-base font-semibold tabular-nums text-ink">#{r.founder_number}</span>
          )}
          <span className="font-medium text-ink">{r.business_name}</span>
          <Tag tone={status.tone}>{status.label}</Tag>
          {!isFounder && <Tag>Standard</Tag>}
        </p>
        <p className="mt-0.5 text-xs text-muted">{place}</p>
        <p className="mt-0.5 text-xs text-muted">
          {r.contact_name},{' '}
          {r.instagram ? (
            <a href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink hover:underline">
              @{r.instagram}
            </a>
          ) : r.phone ? (
            <a href={`tel:${r.phone}`} className="font-semibold text-accent-ink hover:underline">
              {r.phone}
            </a>
          ) : (
            r.contact
          )}
          , {when(r.created_at)}
          {r.source ? `, via ${r.source}` : ''}
        </p>
        {listing && (
          <p className="mt-1 text-xs">
            Listing:{' '}
            <Link href={`/restaurant/${listing.slug}`} className="font-semibold text-accent-ink hover:underline">
              {listing.name}
            </Link>
            {isFounder ? ', 3 reel slots' : ''}
          </p>
        )}
        {r.status === 'rejected' && r.review_note && <p className="mt-1 text-xs text-subtle">Why: {r.review_note}</p>}
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {r.status === 'rejected' ? (
          <form action={restoreFounderApplication.bind(null, r.id)}>
            <button type="submit" className={BUTTON_SECONDARY}>
              Restore
            </button>
          </form>
        ) : (
          <>
            {r.status === 'pending' && (
              <form action={approveFounderApplication.bind(null, r.id)}>
                <button type="submit" className={BUTTON_SECONDARY}>
                  Mark as checked
                </button>
              </form>
            )}
            <details className="group">
              <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center rounded-full px-3 text-sm font-semibold text-accent-ink hover:bg-accent-soft">
                {listing ? 'Change listing' : 'Link listing'}
              </summary>
              <form action={linkFounderListing.bind(null, r.id)} className="mt-2 flex gap-2">
                <label htmlFor={`listing-${r.id}`} className="sr-only">
                  Listing address or slug
                </label>
                <input
                  id={`listing-${r.id}`}
                  name="listing"
                  defaultValue={listing?.slug ?? ''}
                  placeholder="/restaurant/..."
                  className={`${FIELD} min-w-0 sm:w-56`}
                />
                <button type="submit" className={BUTTON_SECONDARY}>
                  Save
                </button>
              </form>
            </details>
            <form action={rejectFounderApplication.bind(null, r.id)} className="flex items-center gap-2">
              <label htmlFor={`note-${r.id}`} className="sr-only">
                Why is it being rejected?
              </label>
              <input id={`note-${r.id}`} name="note" placeholder="Why (optional)" className={`${FIELD} w-36`} />
              <ConfirmSubmitButton
                message={
                  isFounder
                    ? `Reject ${r.business_name}? Founder spot #${r.founder_number} goes back to the next business that claims one.`
                    : `Reject ${r.business_name}?`
                }
                className="inline-flex min-h-[40px] items-center rounded-full px-3 text-sm font-semibold text-halal-partialInk hover:bg-halal-partialSoft"
              >
                Reject
              </ConfirmSubmitButton>
            </form>
          </>
        )}
      </div>
    </Row>
  );
}
