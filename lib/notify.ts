import { NOTIFY_TO, type Inbox } from './site';

// Email to one of the three YepItsHalal inboxes when a form is sent.
//
// Sent through Resend's HTTP API directly, so there is no new dependency.
// yepitshalal.com is verified in Resend for sending, so the sender below works
// as soon as one variable is set in Vercel:
//
//   RESEND_API_KEY      from resend.com, "Sending access" is enough
//   NOTIFY_FROM_EMAIL   optional, overrides the sender below
//
// Which route a form takes is decided by the caller, and NOTIFY_TO in
// lib/site.ts turns that into a +tagged Gmail address, so one inbox still shows
// which form it was. Every submission is stored before this runs, so a failed or
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

function escapeHtml(s: string): string {
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

export async function notifyInbox(n: Notice): Promise<NotifyResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'not_configured';

  const rows = n.fields
    .map(([label, value]) => [label, present(value)] as const)
    .filter((r): r is readonly [string, string] => r[1] !== null)
    .map(([l, v]) => [l, v] as [string, string]);

  const replyTo = n.replyTo && EMAIL.test(n.replyTo) ? n.replyTo : undefined;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || DEFAULT_FROM,
        to: [NOTIFY_TO[n.inbox]],
        subject: n.subject.slice(0, 200),
        text: renderText(n, rows),
        html: renderHtml(n, rows),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
