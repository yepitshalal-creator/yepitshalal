'use server';

import { revalidateAdminPath } from './cache';
import { createHash } from 'node:crypto';

import { requireAdmin } from '@/lib/require-admin';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { sendThroughResend } from '@/lib/notify';
import { getInboxItem, parseKey, quoteFor, replyFrom, type ReplyChannel } from './inbox';
import { renderReply } from './reply-email';

// Every action checks for an admin itself: a Server Action can be called over
// the network without the page that renders its form ever loading.

export type ReplyState =
  | { status: 'idle' }
  | { status: 'sent'; to: string; at: string }
  | { status: 'error'; message: string };

function refresh() {
  revalidateAdminPath('/admin', 'layout');
}

async function markState(key: string, patch: { read_at?: string | null; archived_at?: string | null }) {
  const parsed = parseKey(key);
  if (!parsed) return;
  const db = createAdminSupabase();
  await db.from('admin_inbox_state').upsert(
    { source: parsed.source, source_id: parsed.id, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'source,source_id' }
  );
}

export async function sendReply(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const admin = await requireAdmin();

  const key = String(formData.get('key') ?? '');
  const subject = String(formData.get('subject') ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const body = String(formData.get('body') ?? '').replace(/\r\n/g, '\n').trim().slice(0, 10000);
  const includeQuote = formData.get('include_quote') === 'on';

  if (!subject) return { status: 'error', message: 'Add a subject line.' };
  if (body.replace(/\s/g, '').length < 2) return { status: 'error', message: 'Write the reply first.' };

  // The address is read from the stored message, never from the form, so this
  // can only ever write back to the person who wrote in.
  const item = await getInboxItem(key);
  if (!item) return { status: 'error', message: 'That message could not be found. Refresh the page.' };
  if (!item.email) return { status: 'error', message: 'This person did not leave an email address.' };

  const from = replyFrom(item);
  const { text, html } = renderReply(body, includeQuote ? quoteFor(item) : null);

  // The same words to the same message send once, however often the button
  // is pressed: a retry after a timeout gets Resend's first answer back
  // instead of a second email. Changing the words makes it a new email.
  const idempotencyKey = `reply-${createHash('sha256')
    .update([key, subject, body, includeQuote ? 'q' : ''].join('\u0000'))
    .digest('hex')
    .slice(0, 40)}`;

  const result = await sendThroughResend(
    {
      from: from.header,
      to: [item.email],
      subject,
      text,
      html,
      // Their answer comes back to the address they first wrote to, and a copy
      // of what was sent lands there too, so the whole conversation is in the
      // inbox the forwarding already delivers.
      replyTo: from.address,
      bcc: [from.address],
    },
    { idempotencyKey, timeoutMs: 10000 }
  );

  if (!result.ok) {
    return {
      status: 'error',
      message:
        result.reason === 'not_configured'
          ? 'Email is not switched on yet: RESEND_API_KEY is missing in Vercel. Nothing was sent.'
          : `Resend did not confirm the email${result.detail ? ` (${result.detail})` : ''}. Pressing Send again is safe: the same reply is never sent twice.`,
    };
  }

  const db = createAdminSupabase();
  const now = new Date().toISOString();
  const { error } = await db.from('admin_replies').insert({
    source: item.source,
    source_id: item.id,
    channel: 'email',
    from_address: from.address,
    to_address: item.email,
    subject,
    body,
    resend_id: result.id ?? 'unknown',
    sent_by: admin.id,
  });
  await markState(key, { read_at: item.readAt ?? now });
  refresh();

  if (error) {
    return {
      status: 'error',
      message: `The email was sent, but saving the record failed (${error.message}). Do not send it again.`,
    };
  }
  return { status: 'sent', to: item.email, at: now };
}

/** Answered somewhere else: an Instagram message, a call, or in person. */
export async function logAnswer(formData: FormData) {
  const admin = await requireAdmin();
  const key = String(formData.get('key') ?? '');
  const channel = String(formData.get('channel') ?? 'other') as ReplyChannel;
  const note = String(formData.get('note') ?? '').trim().slice(0, 2000) || null;
  const parsed = parseKey(key);
  if (!parsed || !['instagram', 'phone', 'other'].includes(channel)) return;

  const db = createAdminSupabase();
  await db.from('admin_replies').insert({
    source: parsed.source,
    source_id: parsed.id,
    channel,
    body: note,
    sent_by: admin.id,
  });
  await markState(key, { read_at: new Date().toISOString() });
  refresh();
}

export async function markRead(key: string) {
  await requireAdmin();
  await markState(key, { read_at: new Date().toISOString() });
  refresh();
}

export async function markUnread(formData: FormData) {
  await requireAdmin();
  await markState(String(formData.get('key') ?? ''), { read_at: null });
  refresh();
}

export async function setArchived(formData: FormData) {
  await requireAdmin();
  const archive = formData.get('archive') === '1';
  await markState(String(formData.get('key') ?? ''), {
    archived_at: archive ? new Date().toISOString() : null,
  });
  refresh();
}
