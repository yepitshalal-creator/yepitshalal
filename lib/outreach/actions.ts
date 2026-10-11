'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyInbox, sendThroughResend } from '@/lib/notify';
import { SITE_URL } from '@/lib/site';
import { PRICE_RANGES } from '@/lib/price';
import { createServerSupabase } from '@/lib/supabase/server';
import { removeOwnerContent } from './content';
import {
  activePermission,
  contactByToken,
  contactToStop,
  longDate,
  outreachDb,
  stopContact,
  targetOf,
} from './data';
import {
  OUTREACH_FROM,
  OUTREACH_REPLY_TO,
  PERMISSION_WORDS,
  PERMISSION_WORDS_VERSION,
  TAKE_DOWN_DAYS,
  takenBackEmail,
  textToHtml,
  thankYouEmail,
} from './words';

// What the /yes and /stop pages do. Nobody signs in: the token in the link is
// the key, and it only ever went to the address the place published. Each
// action reads the contact again from the token, so a page left open cannot
// act on anyone else.

export interface YesState {
  error?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = ['owner', 'manager', 'head_office'] as const;

function cleanUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

export async function sayYes(token: string, _prev: YesState, formData: FormData): Promise<YesState> {
  const db = outreachDb();
  const contact = await contactByToken(db, token);
  if (!contact) return { error: 'This link does not work any more. Email hello@yepitshalal.com and we will help.' };
  if (await activePermission(db, contact.id)) {
    revalidatePath(`/yes/${token}`);
    return {};
  }

  if (formData.get('agree') !== 'on') return { error: 'Tick the box to say yes.' };
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  if (name.length < 2) return { error: 'Add your name.' };
  const role = String(formData.get('role') ?? '');
  if (!(ROLES as readonly string[]).includes(role)) return { error: 'Pick your role.' };
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  if (!EMAIL.test(email)) return { error: 'Add an email we can reach you on.' };

  const price = Number(formData.get('price_range'));
  const priceRange = PRICE_RANGES.some((p) => p.value === price) ? price : null;
  const menuRaw = String(formData.get('menu_url') ?? '');
  const menuUrl = cleanUrl(menuRaw);
  if (menuRaw.trim() && !menuUrl) return { error: 'That menu link does not look right. Leave it empty if you are not sure.' };
  const hours = String(formData.get('hours') ?? '').trim().slice(0, 400) || null;

  const target = await targetOf(db, contact);
  if (!target) return { error: 'We could not find your page. Email hello@yepitshalal.com and we will help.' };

  // Owner facts go straight onto the page, but never over something already
  // there: a price or menu link set earlier stays until someone changes it.
  // The yes is saved first, with what it puts on the page, so a failed save
  // leaves the page as it was, and taking the yes back knows what to remove.
  const now = new Date().toISOString();
  const places = contact.restaurant_id
    ? db.from('restaurants').select('id, price_range, menu_url').eq('id', contact.restaurant_id)
    : db.from('restaurants').select('id, price_range, menu_url').eq('brand_id', contact.brand_id as string);
  const { data: placeRows } = await places;
  const rows = (placeRows ?? []) as { id: string; price_range: number | null; menu_url: string | null }[];
  const ids = rows.map((r) => r.id);
  const applied = {
    price_range: Boolean(priceRange) && rows.some((r) => r.price_range == null),
    menu_url: Boolean(menuUrl) && rows.some((r) => r.menu_url == null),
  };

  const { error } = await db.from('content_permissions').insert({
    contact_id: contact.id,
    restaurant_id: contact.restaurant_id,
    brand_id: contact.brand_id,
    place_name: target.name,
    given_by_name: name,
    given_by_role: role,
    given_by_email: email,
    words: PERMISSION_WORDS,
    words_version: PERMISSION_WORDS_VERSION,
    extras: { price_range: priceRange, menu_url: menuUrl, hours, applied },
  });
  if (error) return { error: 'Something went wrong saving that. Try again in a minute.' };

  if (applied.price_range) {
    await db
      .from('restaurants')
      .update({ price_range: priceRange, price_range_source: 'owner', price_range_at: now })
      .in('id', ids)
      .is('price_range', null);
  }
  if (applied.menu_url) {
    await db.from('restaurants').update({ menu_url: menuUrl }).in('id', ids).is('menu_url', null);
  }

  await db
    .from('outreach_contacts')
    .update({ status: 'said_yes', answered_at: now, updated_at: now })
    .eq('id', contact.id);

  // Joined to the owner claim: someone already signed in says yes and claims
  // the place in the same step. The claim still waits for an admin, as every
  // claim does. Anyone else is offered the claim when they sign in with the
  // email they gave here (components/OwnershipCta).
  if (contact.restaurant_id) {
    const {
      data: { user },
    } = await createServerSupabase().auth.getUser();
    if (user) {
      await db.from('restaurant_ownership_claims').upsert(
        {
          restaurant_id: contact.restaurant_id,
          user_id: user.id,
          contact_note: `Said yes to photos on ${longDate(now)} as ${name}, ${role.replace('_', ' ')}, ${email}.`,
          status: 'pending',
        },
        { onConflict: 'restaurant_id,user_id', ignoreDuplicates: true }
      );
      revalidatePath('/admin/claims');
    }
  }

  const thanks = thankYouEmail({
    givenByName: name,
    placeName: target.name,
    agreedOn: longDate(now),
    words: PERMISSION_WORDS,
    token,
    slug: target.isChain ? null : target.slug,
  });
  await sendThroughResend(
    { from: OUTREACH_FROM, to: [email], subject: thanks.subject, text: thanks.text, html: textToHtml(thanks.text), replyTo: OUTREACH_REPLY_TO },
    { idempotencyKey: `outreach-yes-${contact.id}` }
  );
  await notifyInbox({
    inbox: 'info',
    subject: `Said yes to photos: ${target.name}`,
    fields: [
      ['Place', target.name],
      ['Page', target.slug ? `${SITE_URL}/restaurant/${target.slug}` : null],
      ['Name', name],
      ['Role', role.replace('_', ' ')],
      ['Email', email],
      ['Price a head', priceRange ? PRICE_RANGES.find((p) => p.value === priceRange)?.words : null],
      ['Menu link', menuUrl],
      ['Opening hours, in their words', hours],
    ],
    replyTo: email,
    action: { label: 'Open outreach', href: `${SITE_URL}/admin/outreach` },
  });

  if (target.slug) revalidatePath(`/restaurant/${target.slug}`);
  revalidatePath(`/yes/${token}`);
  return {};
}

export async function sayNo(token: string): Promise<void> {
  const db = outreachDb();
  const contact = await contactByToken(db, token);
  if (contact && contact.status !== 'said_yes') await stopContact(db, contact, 'said_no');
  revalidatePath(`/yes/${token}`);
}

export async function takeBack(token: string): Promise<void> {
  const db = outreachDb();
  const contact = await contactByToken(db, token);
  if (!contact) return;
  const permission = await activePermission(db, contact.id);
  if (!permission) return;

  const now = new Date();
  await db.from('content_permissions').update({ withdrawn_at: now.toISOString(), withdrawn_how: 'yes_page' }).eq('id', permission.id);
  // Off the site at once: their photos, and everything they sent us.
  await removeOwnerContent(db, permission.id);
  // A menu link we added because of this yes comes off with it.
  const extras = permission.extras as { menu_url?: string | null; applied?: { menu_url?: boolean } };
  if (extras.applied?.menu_url && extras.menu_url) {
    const q = db.from('restaurants').update({ menu_url: null }).eq('menu_url', extras.menu_url);
    await (contact.restaurant_id ? q.eq('id', contact.restaurant_id) : q.eq('brand_id', contact.brand_id as string));
  }
  await stopContact(db, contact, 'said_no');
  await db.from('outreach_contacts').update({ status: 'said_no', updated_at: now.toISOString() }).eq('id', contact.id);

  const target = await targetOf(db, contact);
  const byDate = longDate(new Date(now.getTime() + TAKE_DOWN_DAYS * 86400000));
  const mail = takenBackEmail({ givenByName: permission.given_by_name, placeName: target?.name ?? 'your place', byDate });
  await sendThroughResend(
    { from: OUTREACH_FROM, to: [permission.given_by_email], subject: mail.subject, text: mail.text, html: textToHtml(mail.text), replyTo: OUTREACH_REPLY_TO },
    { idempotencyKey: `outreach-takeback-${permission.id}` }
  );
  await notifyInbox({
    inbox: 'info',
    subject: `Took back their yes: ${target?.name ?? 'a place'}. Delete our posts by ${byDate}`,
    fields: [
      ['Place', target?.name],
      ['Page', target?.slug ? `${SITE_URL}/restaurant/${target.slug}` : null],
      ['Already done', 'Their photos are off the site and their files are deleted.'],
      ['Still to do by ' + byDate, 'Delete our social media posts of their photos, videos, menu or logo.'],
      ['Email', permission.given_by_email],
    ],
    replyTo: permission.given_by_email,
    action: { label: 'Open outreach', href: `${SITE_URL}/admin/outreach` },
  });
  if (target?.slug) revalidatePath(`/restaurant/${target.slug}`);
  revalidatePath(`/yes/${token}`);
}

export async function stopFromPage(token: string): Promise<void> {
  const db = outreachDb();
  try {
    const contact = await contactToStop(db, token);
    if (contact) await stopContact(db, contact, 'stop_link');
  } catch (e) {
    console.error('[outreach] stop from page', (e as Error).message);
    // Back to the page with a message, never to "Done".
    redirect(`/stop/${encodeURIComponent(token)}?failed=1`);
  }
  revalidatePath(`/stop/${token}`);
}
