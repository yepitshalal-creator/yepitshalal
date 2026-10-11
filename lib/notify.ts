import { INBOX, type Inbox } from './site';

// Email to one of the three YepItsHalal inboxes when a form is sent.
//
// Sent through Resend's HTTP API directly, so there is no new dependency.
// yepitshalal.com is verified in Resend for sending, so the sender below works
// as soon as one variable is set in Vercel:
//
//   RESEND_API_KEY      from resend.com, "Sending access" is enough
//   NOTIFY_FROM_EMAIL   optional, overrides the sender below
//
// Which inbox a form lands in is decided by the caller, from INBOX in
// lib/site.ts. Every submission is stored before this runs, so a failed or
// unconfigured email never fails the request that triggered it: the row is in
// the database and visible in /admin either way.

const DEFAULT_FROM = 'YepItsHalal forms <forms@yepitshalal.com>';

type Value = string | number | boolean | null | undefined;

export interface Notice {
  inbox: Inbox;
  /** Shown in the inbox list. Keep the thing that matters first. */
  subject: string;
  /** Label and value pairs, in reading order. Empty values are dropped. */
  fields: [label: string, value: Value][];
  /** Replies go straight to the person who wrote in, when they left an address. */
  replyTo?: string | null;
  /** A link to act on it, usually the admin page for the row. */
  action?: { label: string; href: string };
}

export type NotifyResult = 'sent' | 'not_configured' | 'failed';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function present(value: Value): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const s = String(value).trim();
  return s ? s : null;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain text first: it is what a phone's preview shows, and it cannot break. */
function renderText(n: Notice, rows: [string, string][]): string {
  const width = Math.max(...rows.map(([l]) => l.length), 0);
  const lines = rows.map(([label, value]) =>
    value.includes('\n') ? `${label}:\n${value}\n` : `${label.padEnd(width)}  ${value}`
  );
  if (n.action) lines.push('', `${n.action.label}: ${n.action.href}`);
  lines.push('', 'Sent by the form on yepitshalal.com. Reply to answer the person directly.');
  return lines.join('\n');
}

/** A plain table, inline styles only, because that is all mail clients agree on. */
function renderHtml(n: Notice, rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" valign="top" style="padding:8px 16px 8px 0;font:600 13px/1.5 -apple-system,Segoe UI,sans-serif;color:#4A5D62;white-space:nowrap">${escapeHtml(label)}</th>` +
        `<td style="padding:8px 0;font:14px/1.55 -apple-system,Segoe UI,sans-serif;color:#0F252B;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
    )
    .join('');
  const action = n.action
    ? `<p style="margin:20px 0 0"><a href="${escapeHtml(n.action.href)}" style="display:inline-block;background:#0B2F3A;color:#fff;text-decoration:none;font:600 14px -apple-system,Segoe UI,sans-serif;padding:10px 18px;border-radius:999px">${escapeHtml(n.action.label)}</a></p>`
    : '';
  return (
    `<div style="max-width:620px">` +
    `<p style="margin:0 0 12px;font:600 17px/1.3 Georgia,serif;color:#124452">${escapeHtml(n.subject)}</p>` +
    `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #DDE8E8">${cells}</table>` +
    action +
    `<p style="margin:24px 0 0;font:12px -apple-system,Segoe UI,sans-serif;color:#5B6D72">Sent by the form on yepitshalal.com. Reply to answer the person directly.</p>` +
    `</div>`
  );
}

/** What Resend needs for one email. Addresses are already validated by the caller. */
export interface OutgoingEmail {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  bcc?: string[];
  /** Extra headers, such as List-Unsubscribe on outreach emails. */
  headers?: Record<string, string>;
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'not_configured' | 'failed'; detail?: string };

/** True when a Resend key is set, so the admin can say so before anyone types a reply. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * One email through Resend's HTTP API. Form alerts and admin replies both come
 * through here. An idempotency key makes a double click, or a retry after a
 * timeout, send once: Resend keeps the key for 24 hours and answers a repeat
 * with the first result instead of a second email.
 */
export async function sendThroughResend(
  email: OutgoingEmail,
  options: { idempotencyKey?: string; timeoutMs?: number } = {}
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: 'not_configured' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: email.from,
        to: email.to,
        subject: email.subject.slice(0, 200),
        text: email.text,
        html: email.html,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        ...(email.bcc?.length ? { bcc: email.bcc } : {}),
        ...(email.headers ? { headers: email.headers } : {}),
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, reason: 'failed', detail: body?.message ?? `Resend answered ${res.status}` };
    }
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: body?.id ?? null };
  } catch (e) {
    return { ok: false, reason: 'failed', detail: (e as Error).name === 'TimeoutError' ? 'Resend did not answer in time' : undefined };
  }
}

export async function notifyInbox(n: Notice): Promise<NotifyResult> {
  const rows = n.fields
    .map(([label, value]) => [label, present(value)] as const)
    .filter((r): r is readonly [string, string] => r[1] !== null)
    .map(([l, v]) => [l, v] as [string, string]);

  const replyTo = n.replyTo && EMAIL.test(n.replyTo) ? n.replyTo : undefined;

  const result = await sendThroughResend({
    from: process.env.NOTIFY_FROM_EMAIL || DEFAULT_FROM,
    to: [INBOX[n.inbox]],
    subject: n.subject,
    text: renderText(n, rows),
    html: renderHtml(n, rows),
    replyTo,
  });
  if (result.ok) return 'sent';
  return result.reason;
}
