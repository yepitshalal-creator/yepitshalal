'use server';

import { revalidateAdminPath } from '@/lib/admin/cache';
import { requireAdmin } from '@/lib/require-admin';
import {
  CONTACT_COLUMNS,
  OWNER_BUCKET,
  isStopped,
  normEmail,
  outreachDb,
  phoneDigits,
  stopContact,
  type BusinessKind,
  type Channel,
  type Contact,
} from './data';
import { publishOwnerPhoto, removeOwnerContent, type OwnerUpload } from './content';

// Everything /admin/outreach can do. Each action checks the admin itself:
// a server action is a public endpoint, whatever page it sits on.

const PATH = '/admin/outreach';

export interface AddState {
  error?: string;
  ok?: string;
}

const KINDS: BusinessKind[] = ['chain_head_office', 'limited_company', 'sole_trader', 'partnership', 'unsure'];
const CHANNELS: Channel[] = ['email', 'phone', 'contact_form'];
const FOUND_HOW = ['osm', 'own_website', 'owner', 'phone_call', 'other'];

function url(raw: FormDataEntryValue | null): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.toString();
  } catch {
    return null;
  }
}

/** A place's slug, or its page address pasted from the site. */
function slugFrom(raw: string): string {
  const v = raw.trim();
  const m = v.match(/\/restaurant\/([^/?#]+)/);
  return (m ? m[1] : v).toLowerCase();
}

export async function addContact(_prev: AddState, formData: FormData): Promise<AddState> {
  await requireAdmin();
  const db = outreachDb();

  const kind = String(formData.get('business_kind') ?? 'unsure') as BusinessKind;
  const channel = String(formData.get('channel') ?? 'phone') as Channel;
  const foundHow = String(formData.get('found_how') ?? 'own_website');
  if (!KINDS.includes(kind) || !CHANNELS.includes(channel) || !FOUND_HOW.includes(foundHow)) return { error: 'Pick from the lists.' };

  let restaurantId: string | null = null;
  let brandId: string | null = null;
  const place = String(formData.get('place') ?? '').trim();
  const brand = String(formData.get('brand') ?? '').trim();
  if (kind === 'chain_head_office') {
    if (!brand) return { error: 'A head office needs the chain (its brand slug).' };
    const { data } = await db.from('brands').select('id').eq('slug', brand.toLowerCase()).maybeSingle();
    if (!data) return { error: `No chain with the slug "${brand}".` };
    brandId = data.id;
  } else {
    if (!place) return { error: 'Add the place: its page address or slug.' };
    const { data } = await db.from('restaurants').select('id').eq('slug', slugFrom(place)).maybeSingle();
    if (!data) return { error: 'No place with that page address.' };
    restaurantId = data.id;
  }

  const email = normEmail(String(formData.get('email') ?? ''));
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const foundAt = url(formData.get('found_at_url'));
  const evidence = url(formData.get('company_evidence_url'));

  // The same rule the database holds, said in words before it refuses.
  if (channel === 'email') {
    if (!email) return { error: 'An email contact needs an email address.' };
    if (!foundAt) return { error: 'Add the page where we found the address. Every email says where.' };
    if (kind !== 'chain_head_office' && kind !== 'limited_company')
      return { error: 'Only a chain head office or a limited company can be emailed. Call this one, or use their contact form.' };
    if (kind === 'limited_company' && !evidence)
      return { error: 'Add the page on their own website that names the limited company.' };
  }
  if (channel === 'phone' && !phoneDigits(phone)) return { error: 'A phone contact needs a phone number.' };

  if (await isStopped(db, { email, phone, restaurant_id: restaurantId, brand_id: brandId })) {
    return { error: 'They are on the stop list. We never contact them again.' };
  }

  const { error } = await db.from('outreach_contacts').insert({
    restaurant_id: restaurantId,
    brand_id: brandId,
    contact_name: String(formData.get('contact_name') ?? '').trim() || null,
    email,
    phone,
    found_at_url: foundAt,
    found_how: foundHow,
    business_kind: kind,
    company_evidence_url: evidence,
    channel,
    status: channel === 'email' ? 'ready' : 'new',
    notes: String(formData.get('notes') ?? '').trim() || null,
  });
  if (error) {
    if (error.code === '23505') return { error: 'That email address is already on the list.' };
    if (error.code === '23514') return { error: 'The database refused it: this one cannot be emailed under our rules.' };
    return { error: error.message };
  }
  revalidateAdminPath(PATH);
  return { ok: channel === 'email' ? 'Added. It goes out with the next send, if sending is on.' : 'Added.' };
}

async function contact(id: string): Promise<Contact> {
  const { data } = await outreachDb().from('outreach_contacts').select(CONTACT_COLUMNS).eq('id', id).maybeSingle();
  if (!data) throw new Error('Contact not found.');
  return data as Contact;
}

export async function markReplied(id: string) {
  await requireAdmin();
  const now = new Date().toISOString();
  await outreachDb()
    .from('outreach_contacts')
    .update({ status: 'replied', replied_at: now, updated_at: now })
    .eq('id', id)
    .in('status', ['new', 'ready', 'sent', 'followed_up']);
  revalidateAdminPath(PATH);
}

/** They said no, or asked us to stop, by email or on the phone. For good. */
export async function markStop(id: string, how: 'said_no' | 'asked_by_email' | 'asked_by_phone') {
  await requireAdmin();
  await stopContact(outreachDb(), await contact(id), how);
  revalidateAdminPath(PATH);
}

export async function markTpsChecked(id: string) {
  await requireAdmin();
  await outreachDb().from('outreach_contacts').update({ tps_checked_at: new Date().toISOString() }).eq('id', id);
  revalidateAdminPath(PATH);
}

/** Back in the queue: only an email contact that has not been sent anything yet. */
export async function markReady(id: string) {
  await requireAdmin();
  const c = await contact(id);
  if (c.channel !== 'email' || c.sent_at) throw new Error('Only an unsent email contact can be queued.');
  if (await isStopped(outreachDb(), c)) throw new Error('They are on the stop list.');
  await outreachDb().from('outreach_contacts').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', id);
  revalidateAdminPath(PATH);
}

/** A take-down done. Anything still on the site is tried again first, and it is not Done until that worked. */
export async function markRemoved(permissionId: string) {
  await requireAdmin();
  const db = outreachDb();
  const allOff = await removeOwnerContent(db, permissionId);
  revalidateAdminPath('/restaurant/[slug]', 'page');
  if (!allOff) throw new Error('Some of their photos would not come off the site. Try again in a minute.');
  await db.from('content_permissions').update({ removed_at: new Date().toISOString() }).eq('id', permissionId);
  revalidateAdminPath(PATH);
}

export async function setSending(on: boolean) {
  await requireAdmin();
  await outreachDb().from('outreach_settings').update({ sending_on: on, updated_at: new Date().toISOString() }).eq('id', true);
  revalidateAdminPath(PATH);
}

export async function setDailyLimit(formData: FormData) {
  await requireAdmin();
  const n = Math.round(Number(formData.get('daily_limit')));
  if (!Number.isFinite(n) || n < 0 || n > 50) throw new Error('Pick a number from 0 to 50.');
  await outreachDb().from('outreach_settings').update({ daily_limit: n, updated_at: new Date().toISOString() }).eq('id', true);
  revalidateAdminPath(PATH);
}

export async function clearPause() {
  await requireAdmin();
  const now = new Date().toISOString();
  await outreachDb()
    .from('outreach_settings')
    .update({ paused_reason: null, paused_at: null, resumed_at: now, updated_at: now })
    .eq('id', true);
  revalidateAdminPath(PATH);
}

async function upload(id: string): Promise<OwnerUpload> {
  const { data } = await outreachDb().from('owner_uploads').select('*').eq('id', id).maybeSingle();
  if (!data) throw new Error('Upload not found.');
  return data as OwnerUpload;
}

/** An owner's photo onto their page (or every branch, for a chain). */
export async function publishUpload(id: string) {
  await requireAdmin();
  const db = outreachDb();
  const u = await upload(id);
  if (u.status !== 'waiting' && u.status !== 'kept') throw new Error('Only a photo waiting for a look can be published.');
  const { data: permission } = await db.from('content_permissions').select('withdrawn_at').eq('id', u.permission_id).maybeSingle();
  if (!permission || permission.withdrawn_at) throw new Error('They took their yes back. This cannot go on the site.');
  // Marks it published with its photo ids too, or takes it all off again and throws.
  await publishOwnerPhoto(db, u);
  revalidateAdminPath(PATH);
  revalidateAdminPath('/restaurant/[slug]', 'page');
}

/** Kept for our social media, not put on the page. Videos always land here. */
export async function keepUpload(id: string) {
  await requireAdmin();
  await outreachDb().from('owner_uploads').update({ status: 'kept', reviewed_at: new Date().toISOString() }).eq('id', id).eq('status', 'waiting');
  revalidateAdminPath(PATH);
}

/** Not usable: deleted from storage straight away. */
export async function rejectUpload(id: string) {
  await requireAdmin();
  const db = outreachDb();
  const u = await upload(id);
  if (u.status === 'published') throw new Error('It is on their page. Take it off from the restaurant page first.');
  await db.storage.from(OWNER_BUCKET).remove(Object.values(u.paths));
  await db.from('owner_uploads').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id);
  revalidateAdminPath(PATH);
}
