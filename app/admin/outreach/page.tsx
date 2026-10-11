import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { CONTACT_COLUMNS, OWNER_BUCKET, longDate, outreachDb, type Contact, type ContactStatus, type Permission } from '@/lib/outreach/data';
import type { OwnerUpload } from '@/lib/outreach/content';
import { previewRun } from '@/lib/outreach/job';
import { foundWhere, TAKE_DOWN_DAYS, yesUrl } from '@/lib/outreach/words';
import { PRICE_RANGES } from '@/lib/price';
import {
  clearPause,
  markReady,
  markRemoved,
  markReplied,
  markStop,
  markTpsChecked,
  keepUpload,
  publishUpload,
  rejectUpload,
  setDailyLimit,
  setSending,
} from '@/lib/outreach/admin-actions';
import { AddContactForm } from '@/components/admin/outreach/AddContactForm';
import { SectionTabs } from '@/components/admin/SectionTabs';
import { AdminPage, Panel, List, Row, Tag, FIELD, BUTTON, BUTTON_SECONDARY } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Outreach' };

// Asking places if we may use their photos, videos, menu and logo (migration
// 0054). Sending starts switched off; the switch here is the only way on.

const STATUS: Record<ContactStatus, { label: string; tone: 'neutral' | 'good' | 'warn' | 'accent' | 'ink' }> = {
  new: { label: 'To contact', tone: 'neutral' },
  ready: { label: 'Email queued', tone: 'accent' },
  sent: { label: 'Emailed', tone: 'neutral' },
  followed_up: { label: 'Followed up', tone: 'neutral' },
  replied: { label: 'Replied', tone: 'accent' },
  said_yes: { label: 'Said yes', tone: 'good' },
  said_no: { label: 'Said no', tone: 'warn' },
  stopped: { label: 'Stopped', tone: 'warn' },
  bounced: { label: 'Bounced', tone: 'warn' },
  complained: { label: 'Marked as spam', tone: 'warn' },
};
const ORDER = Object.keys(STATUS) as ContactStatus[];

const KIND: Record<string, string> = {
  chain_head_office: 'Chain head office',
  limited_company: 'Limited company',
  sole_trader: 'Sole trader',
  partnership: 'Partnership',
  unsure: 'Not sure',
};

type Row = Contact & { restaurants: { name: string; slug: string } | null; brands: { name: string; slug: string } | null };
type PermissionRow = Permission & { restaurants: { name: string; slug: string } | null; brands: { name: string } | null };

const SMALL =
  'inline-flex min-h-[32px] items-center rounded-full border border-line bg-white px-3 text-xs font-semibold text-ink transition hover:border-ink/30';

export default async function AdminOutreachPage({ searchParams }: { searchParams: { status?: string; preview?: string } }) {
  await requireAdmin();
  const db = outreachDb();
  const status = ORDER.includes(searchParams.status as ContactStatus) ? (searchParams.status as ContactStatus) : null;

  const [{ data: settings, error: settingsError }, { data: all }, list, { data: perms }, { data: uploadRows }] = await Promise.all([
    db.from('outreach_settings').select('*').eq('id', true).maybeSingle(),
    db.from('outreach_contacts').select('status').limit(20000),
    (() => {
      let q = db
        .from('outreach_contacts')
        .select(`${CONTACT_COLUMNS}, restaurants(name, slug), brands(name, slug)`)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (status) q = q.eq('status', status);
      return q;
    })(),
    db
      .from('content_permissions')
      .select('*, restaurants(name, slug), brands(name)')
      .order('agreed_at', { ascending: false })
      .limit(100),
    db
      .from('owner_uploads')
      .select('*, restaurants(name, slug), brands(name)')
      .in('status', ['waiting', 'kept'])
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  if (settingsError || !settings) {
    return (
      <AdminPage title="Outreach" tabs={<SectionTabs section="partners" current="/admin/outreach" />}>
        <Panel>
          <p className="px-5 py-8 text-sm text-muted">
            Outreach is not set up in the database yet. It needs migration 0054_outreach.
          </p>
        </Panel>
      </AdminPage>
    );
  }

  const counts = new Map<string, number>();
  for (const r of all ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const rows = (list.data ?? []) as unknown as Row[];
  const permissions = (perms ?? []) as unknown as PermissionRow[];
  const toTakeDown = permissions.filter((p) => p.withdrawn_at && !p.removed_at);
  const yeses = permissions.filter((p) => !p.withdrawn_at);
  // Owners' files are private: shown and downloaded through links that last an hour.
  const uploads = (uploadRows ?? []) as (OwnerUpload & { restaurants: { name: string } | null; brands: { name: string } | null })[];
  const wanted = uploads.flatMap((u) => [u.paths.card, u.paths.full, u.paths.video].filter(Boolean));
  const { data: signed } = wanted.length
    ? await db.storage.from(OWNER_BUCKET).createSignedUrls(wanted, 3600)
    : { data: [] };
  const link = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const preview = searchParams.preview === '1' ? await previewRun().catch((e: Error) => ({ error: e.message })) : null;

  const sendingLine = settings.paused_reason
    ? `Paused: ${settings.paused_reason}`
    : settings.sending_on
      ? `On. Up to ${settings.daily_limit} emails a weekday, at 9am UTC.`
      : 'Off. Nothing is emailed until it is switched on.';

  return (
    <AdminPage
      title="Outreach"
      width="lg"
      tabs={<SectionTabs section="partners" current="/admin/outreach" />}
      description="Asking places if we may use their photos, videos, menu and logo. Email only goes to chain head offices and limited companies whose own website says so. Everyone else gets a call or their contact form."
    >
      <div className="space-y-5">
        <Panel
          title="Sending"
          action={<Tag tone={settings.paused_reason ? 'warn' : settings.sending_on ? 'good' : 'neutral'}>{settings.paused_reason ? 'Paused' : settings.sending_on ? 'On' : 'Off'}</Tag>}
        >
          <div className="space-y-4 px-5 py-4">
            <p className="text-sm text-ink/80">{sendingLine}</p>
            <div className="flex flex-wrap items-end gap-3">
              {settings.paused_reason ? (
                <form action={clearPause}>
                  <button className={BUTTON}>I checked. Clear the pause</button>
                </form>
              ) : (
                <form action={setSending.bind(null, !settings.sending_on)}>
                  <button className={settings.sending_on ? BUTTON_SECONDARY : BUTTON}>
                    {settings.sending_on ? 'Switch sending off' : 'Switch sending on'}
                  </button>
                </form>
              )}
              <form action={setDailyLimit} className="flex items-end gap-2">
                <label className="text-sm text-ink">
                  <span className="mb-1 block text-xs font-medium text-muted">A day, at most</span>
                  <input name="daily_limit" type="number" min={0} max={50} defaultValue={settings.daily_limit} className={`${FIELD} w-24`} />
                </label>
                <button className={BUTTON_SECONDARY}>Save</button>
              </form>
              <Link href="/admin/outreach?preview=1" className={BUTTON_SECONDARY}>
                What would the next run do?
              </Link>
            </div>
            {preview && (
              <p className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-ink/80">
                {'error' in preview
                  ? `Could not check: ${preview.error}`
                  : `Would send ${preview.firstsSent} first emails and ${preview.followUpsSent} follow ups. ${
                      preview.canWatch ? 'Bounce watch works.' : 'Bounce watch does not work, so nothing would be sent.'
                    }${preview.note ? ` ${preview.note}` : ''}`}
              </p>
            )}
          </div>
        </Panel>

        {toTakeDown.length > 0 && (
          <Panel title="Take these down" action={<Tag tone="warn">{toTakeDown.length}</Tag>}>
            <List empty="">
              {toTakeDown.map((p) => {
                const by = new Date(Date.parse(p.withdrawn_at as string) + TAKE_DOWN_DAYS * 86400000);
                return (
                  <Row key={p.id} className="items-start">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium text-ink">{p.restaurants?.name ?? p.brands?.name ?? p.place_name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        Took back their yes on {longDate(p.withdrawn_at as string)}. Their photos are already off the site.
                        Delete our social media posts of their photos, videos, menu or logo by <b>{longDate(by)}</b>, then tap Done.
                      </p>
                    </div>
                    <form action={markRemoved.bind(null, p.id)}>
                      <button className={SMALL}>Done</button>
                    </form>
                  </Row>
                );
              })}
            </List>
          </Panel>
        )}

        {uploads.length > 0 && (
          <Panel title="Photos and videos from owners" action={<Tag tone="accent">{uploads.filter((u) => u.status === 'waiting').length} to look at</Tag>}>
            <ul className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              {uploads.map((u) => {
                const place = u.restaurants?.name ?? u.brands?.name ?? 'A place';
                const card = u.paths.card ? link.get(u.paths.card) : null;
                const file = link.get(u.paths.full ?? u.paths.video);
                return (
                  <li key={u.id} className="overflow-hidden rounded-xl border border-line">
                    {u.kind === 'photo' && card ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card} alt={`Photo from ${place}`} className="aspect-[4/3] w-full bg-black/5 object-cover" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-black/5 text-sm text-muted">Video</div>
                    )}
                    <div className="space-y-2 p-3 text-sm">
                      <p className="font-medium text-ink">{place}</p>
                      <p className="text-xs text-muted">
                        {longDate(u.created_at)} · {(u.bytes / 1048576).toFixed(1)} MB{u.status === 'kept' ? ' · kept for social' : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {u.kind === 'photo' && (
                          <form action={publishUpload.bind(null, u.id)}>
                            <button className={SMALL}>Put on their page</button>
                          </form>
                        )}
                        {u.status === 'waiting' && (
                          <form action={keepUpload.bind(null, u.id)}>
                            <button className={SMALL}>Keep for social</button>
                          </form>
                        )}
                        {file && (
                          <a href={file} className={SMALL} target="_blank" rel="noreferrer">
                            Download
                          </a>
                        )}
                        <form action={rejectUpload.bind(null, u.id)}>
                          <button className={SMALL}>Delete</button>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        <Panel title="Yeses" action={<Tag tone={yeses.length ? 'good' : 'neutral'}>{yeses.length}</Tag>}>
          <List empty="No yeses yet.">
            {yeses.map((p) => {
              const extras = p.extras as { price_range?: number | null; menu_url?: string | null; hours?: string | null };
              return (
                <Row key={p.id} className="items-start">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-ink">
                      {p.restaurants ? <Link href={`/restaurant/${p.restaurants.slug}`} className="hover:underline">{p.restaurants.name}</Link> : p.brands?.name ?? p.place_name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {p.given_by_name}, {p.given_by_role.replace('_', ' ')}, {p.given_by_email} · {longDate(p.agreed_at)} · words {p.words_version}
                    </p>
                    {(extras.price_range || extras.menu_url || extras.hours) && (
                      <p className="mt-1.5 rounded-xl bg-black/[0.03] px-3 py-2 text-xs leading-relaxed text-ink/80">
                        {extras.price_range ? `Price: ${PRICE_RANGES.find((x) => x.value === extras.price_range)?.words}. ` : ''}
                        {extras.menu_url ? `Menu: ${extras.menu_url}. ` : ''}
                        {extras.hours ? `Hours, to enter by hand: ${extras.hours}` : ''}
                      </p>
                    )}
                  </div>
                </Row>
              );
            })}
          </List>
        </Panel>

        <Panel title="Add a contact">
          <AddContactForm />
        </Panel>

        <Panel title="Contacts">
          <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
            <Link href="/admin/outreach" className={`${SMALL} ${!status ? 'border-ink bg-ink text-white hover:border-ink' : ''}`}>
              All {all?.length ?? 0}
            </Link>
            {ORDER.filter((s) => counts.get(s)).map((s) => (
              <Link
                key={s}
                href={`/admin/outreach?status=${s}`}
                className={`${SMALL} ${status === s ? 'border-ink bg-ink text-white hover:border-ink' : ''}`}
              >
                {STATUS[s].label} {counts.get(s)}
              </Link>
            ))}
          </div>
          <List empty="Nobody here yet.">
            {rows.map((c) => {
              const name = c.restaurants?.name ?? (c.brands ? `${c.brands.name} (head office)` : 'Unknown');
              const open = ['new', 'ready', 'sent', 'followed_up', 'replied'].includes(c.status);
              return (
                <Row key={c.id} className="flex-col items-stretch gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-ink">{name}</span>
                      <Tag tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Tag>
                      <Tag>{c.channel === 'contact_form' ? 'Contact form' : c.channel === 'phone' ? 'Phone' : 'Email'}</Tag>
                      {c.channel === 'phone' && open && !c.tps_checked_at && <Tag tone="warn">Check TPS before calling</Tag>}
                    </div>
                    <p className="mt-0.5 break-all text-xs text-muted">
                      {[c.contact_name, c.email, c.phone].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {KIND[c.business_kind]} · found on {foundWhere(c.found_at_url, c.found_how)}
                      {c.sent_at ? ` · emailed ${longDate(c.sent_at)}` : ''}
                      {c.followed_up_at ? ` · followed up ${longDate(c.followed_up_at)}` : ''}
                      {c.last_event ? ` · last: ${c.last_event}` : ''}
                    </p>
                    {open && (
                      <p className="mt-1 break-all text-xs text-ink/70">
                        Yes link: <span className="select-all font-mono">{yesUrl(c.token)}</span>
                      </p>
                    )}
                    {c.notes && <p className="mt-1 text-xs text-ink/70">{c.notes}</p>}
                  </div>
                  {open && (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {c.channel === 'phone' && !c.tps_checked_at && (
                        <form action={markTpsChecked.bind(null, c.id)}>
                          <button className={SMALL}>Not on TPS</button>
                        </form>
                      )}
                      {c.channel === 'email' && c.status === 'new' && !c.sent_at && (
                        <form action={markReady.bind(null, c.id)}>
                          <button className={SMALL}>Queue email</button>
                        </form>
                      )}
                      {c.status !== 'replied' && (
                        <form action={markReplied.bind(null, c.id)}>
                          <button className={SMALL}>Replied</button>
                        </form>
                      )}
                      <form action={markStop.bind(null, c.id, 'said_no')}>
                        <button className={SMALL}>Said no</button>
                      </form>
                      <form action={markStop.bind(null, c.id, c.channel === 'phone' ? 'asked_by_phone' : 'asked_by_email')}>
                        <button className={SMALL}>Asked to stop</button>
                      </form>
                    </div>
                  )}
                </Row>
              );
            })}
          </List>
        </Panel>
      </div>
    </AdminPage>
  );
}
