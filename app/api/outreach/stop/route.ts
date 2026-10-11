import { NextResponse } from 'next/server';
import { contactByToken, outreachDb, stopContact } from '@/lib/outreach/data';

// One-click unsubscribe (RFC 8058). Mail apps such as Gmail show their own
// "Unsubscribe" button for our outreach emails and POST here when it is
// tapped. That POST comes from the mail app, never from a link checker, so it
// stops at once. A person who taps the link in the email itself lands on
// /stop/[token] instead, which asks before stopping.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const db = outreachDb();
  const contact = await contactByToken(db, token);
  // The same answer either way: nothing here says whether a token exists.
  if (contact) await stopContact(db, contact, 'stop_link');
  return NextResponse.json({ ok: true });
}
