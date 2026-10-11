import type { SupabaseClient } from '@supabase/supabase-js';
import { dealsDb } from '@/lib/deals/db';

// Reads and writes for outreach (migration 0054). Every table is private, so
// all of it goes through the service role, fresh each time (see lib/deals/db).

export const outreachDb = dealsDb;

/** Private bucket for what owners send from /yes (0054). */
export const OWNER_BUCKET = 'owner-uploads';

export type ContactStatus =
  | 'new'
  | 'ready'
  | 'sent'
  | 'followed_up'
  | 'replied'
  | 'said_yes'
  | 'said_no'
  | 'stopped'
  | 'bounced'
  | 'complained';

export type BusinessKind = 'chain_head_office' | 'limited_company' | 'sole_trader' | 'partnership' | 'unsure';
export type Channel = 'email' | 'phone' | 'contact_form';

export interface Contact {
  id: string;
  restaurant_id: string | null;
  brand_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  found_at_url: string | null;
  found_how: string;
  business_kind: BusinessKind;
  company_evidence_url: string | null;
  channel: Channel;
  status: ContactStatus;
  token: string;
  tps_checked_at: string | null;
  sent_at: string | null;
  resend_id: string | null;
  followed_up_at: string | null;
  followup_resend_id: string | null;
  last_event: string | null;
  last_event_at: string | null;
  replied_at: string | null;
  answered_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  contact_id: string | null;
  restaurant_id: string | null;
  brand_id: string | null;
  place_name: string;
  given_by_name: string;
  given_by_role: string;
  given_by_email: string;
  words: string;
  words_version: string;
  agreed_at: string;
  extras: Record<string, unknown>;
  withdrawn_at: string | null;
  withdrawn_how: string | null;
  removed_at: string | null;
}

/** Who a contact is about: one place, or a chain and one of its branches. */
export interface Target {
  name: string;
  /** The place's slug, or a branch's slug for a chain. Null if a chain has no branch on the site. */
  slug: string | null;
  isChain: boolean;
  /** None of the place's photos are its own yet (stock pictures and logos do not count). */
  noOwnPhotos: boolean;
}

export const CONTACT_COLUMNS =
  'id, restaurant_id, brand_id, contact_name, email, phone, found_at_url, found_how, business_kind, company_evidence_url, channel, status, token, tps_checked_at, sent_at, resend_id, followed_up_at, followup_resend_id, last_event, last_event_at, replied_at, answered_at, notes, created_at';

export const normEmail = (e: string | null | undefined) => (e ?? '').trim().toLowerCase() || null;
export const phoneDigits = (p: string | null | undefined) => {
  const d = (p ?? '').replace(/\D/g, '').replace(/^44/, '0');
  return d.length >= 10 ? d : null;
};

/** A token is 32 hex characters. Anything else is not worth a database read. */
export const isToken = (t: string) => /^[0-9a-f]{32}$/.test(t);

/** The contact a link belongs to, or null: an unknown link, or one that could not be read. */
export async function contactByToken(db: SupabaseClient, token: string): Promise<Contact | null> {
  if (!isToken(token)) return null;
  const { data } = await db.from('outreach_contacts').select(CONTACT_COLUMNS).eq('token', token).maybeSingle();
  return (data as Contact | null) ?? null;
}

/** For a stop: as contactByToken, but a read that fails throws, so it is never taken for an unknown link. */
export async function contactToStop(db: SupabaseClient, token: string): Promise<Contact | null> {
  if (!isToken(token)) return null;
  const { data, error } = await db.from('outreach_contacts').select(CONTACT_COLUMNS).eq('token', token).maybeSingle();
  if (error) throw new Error(`Could not read the contact: ${error.message}`);
  return (data as Contact | null) ?? null;
}

export async function targetOf(db: SupabaseClient, c: Pick<Contact, 'restaurant_id' | 'brand_id'>): Promise<Target | null> {
  if (c.restaurant_id) {
    const { data: r } = await db.from('restaurants').select('id, name, slug').eq('id', c.restaurant_id).maybeSingle();
    if (!r) return null;
    return { name: r.name, slug: r.slug, isChain: false, noOwnPhotos: await hasNoOwnPhotos(db, [r.id]) };
  }
  if (c.brand_id) {
    const { data: b } = await db.from('brands').select('name').eq('id', c.brand_id).maybeSingle();
    if (!b) return null;
    const { data: branches } = await db
      .from('restaurants')
      .select('id, slug')
      .eq('brand_id', c.brand_id)
      .eq('is_searchable', true)
      .order('slug')
      .limit(200);
    const ids = (branches ?? []).map((x) => x.id);
    return { name: b.name, slug: branches?.[0]?.slug ?? null, isChain: true, noOwnPhotos: await hasNoOwnPhotos(db, ids) };
  }
  return null;
}

// Stock pictures (representative/) and logos are not the place's own photos
// of its food, so the email can truthfully say "no photos of your food yet".
async function hasNoOwnPhotos(db: SupabaseClient, restaurantIds: string[]): Promise<boolean> {
  if (!restaurantIds.length) return true;
  const { data, error } = await db
    .from('restaurant_photos')
    .select('storage_path, is_logo')
    .in('restaurant_id', restaurantIds)
    .limit(500);
  // Unread is not the same as none: the email then says nothing about photos.
  if (error) return false;
  return !(data ?? []).some(
    (p: { storage_path: string; is_logo: boolean | null }) =>
      !p.is_logo &&
      !p.storage_path.includes('business-logo/') &&
      !p.storage_path.includes('representative/') &&
      !p.storage_path.includes('unsplash')
  );
}

/** On the stop list, not on it, or the list could not be read just now. */
export type StopListState = 'stopped' | 'clear' | 'unreadable';

/** On the stop list by address, number, place or chain: any one match means never contact. */
export async function stopListState(
  db: SupabaseClient,
  c: Pick<Contact, 'email' | 'phone' | 'restaurant_id' | 'brand_id'>
): Promise<StopListState> {
  const ors: string[] = [];
  const email = normEmail(c.email);
  const phone = phoneDigits(c.phone);
  // Values are quoted for PostgREST's or(); an address with a quote, comma or
  // bracket in it is not a real one and is left out. The ids are uuids.
  if (email && !/[(),"]/.test(email)) ors.push(`email.eq."${email}"`);
  if (phone) ors.push(`phone.eq.${phone}`);
  if (c.restaurant_id) ors.push(`restaurant_id.eq.${c.restaurant_id}`);
  if (c.brand_id) ors.push(`brand_id.eq.${c.brand_id}`);
  if (!ors.length) return 'clear';
  const { data, error } = await db.from('outreach_stop_list').select('id').or(ors.join(',')).limit(1);
  if (error) return 'unreadable';
  return (data ?? []).length > 0 ? 'stopped' : 'clear';
}

/** True unless the stop list was read and they are not on it: never risk it. */
export async function isStopped(
  db: SupabaseClient,
  c: Pick<Contact, 'email' | 'phone' | 'restaurant_id' | 'brand_id'>
): Promise<boolean> {
  return (await stopListState(db, c)) !== 'clear';
}

export type StopReason = 'stop_link' | 'asked_by_email' | 'asked_by_phone' | 'said_no' | 'bounced' | 'complained';

/**
 * Puts a contact on the stop list for good and marks the contact. Safe to
 * repeat. Throws if the stop list row could not be saved, so whoever asked is
 * never told it worked. The stop list is what every send checks; the contact's
 * status only tidies the admin list.
 */
export async function stopContact(db: SupabaseClient, c: Contact, reason: StopReason): Promise<void> {
  const email = normEmail(c.email);
  const row = {
    email,
    phone: phoneDigits(c.phone),
    restaurant_id: c.restaurant_id,
    brand_id: c.brand_id,
    reason,
  };
  if (email) {
    const { data: existing, error } = await db.from('outreach_stop_list').select('id').eq('email', email).maybeSingle();
    if (error) throw new Error(`Could not save the stop: ${error.message}`);
    if (!existing) await saveStop(db, row);
  } else {
    await saveStop(db, row);
  }
  const status: ContactStatus =
    reason === 'said_no' ? 'said_no' : reason === 'bounced' ? 'bounced' : reason === 'complained' ? 'complained' : 'stopped';
  // A yes stays a yes on the contact: the permission row is what counts, and
  // taking that back is its own step.
  if (c.status !== 'said_yes') {
    await db
      .from('outreach_contacts')
      .update({ status, answered_at: c.answered_at ?? new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', c.id);
  }
}

async function saveStop(db: SupabaseClient, row: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('outreach_stop_list').insert(row);
  // 23505: the address is on the list already, which is what was wanted.
  if (error && error.code !== '23505') throw new Error(`Could not save the stop: ${error.message}`);
}

export async function activePermission(db: SupabaseClient, contactId: string): Promise<Permission | null> {
  const { data } = await db
    .from('content_permissions')
    .select('*')
    .eq('contact_id', contactId)
    .is('withdrawn_at', null)
    .order('agreed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Permission | null) ?? null;
}

/** "10 October 2026" in London time. */
export function longDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
}
