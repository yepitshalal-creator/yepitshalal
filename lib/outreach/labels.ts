import type { Channel, ContactStatus } from './data';

// The admin's words for a contact's state and for how we reach them, shared
// by the Outreach page and each restaurant's own admin page so the two never
// disagree.

export const CONTACT_STATUS: Record<ContactStatus, { label: string; tone: 'neutral' | 'good' | 'warn' | 'accent' | 'ink' }> = {
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

/**
 * A call made or a contact form sent, kept in `last_event` with a dated line
 * in the notes. Since 2026-11-01, because 940 of the 1,041 contacts are phone
 * numbers and the page had no way to say one was rung. The status stays as it
 * was: a yes comes through their yes link, and a no has its own button.
 */
export const ATTEMPT = {
  no_answer: { channel: 'phone', event: 'call: no answer', button: 'No answer', words: 'called, no answer' },
  call_back: { channel: 'phone', event: 'call: call back', button: 'Call back later', words: 'called, they asked us to ring back' },
  sent_link: {
    channel: 'phone',
    event: 'call: sent the yes link',
    button: 'Sent the yes link',
    words: 'called, they asked for the yes link and we sent it',
  },
  form_sent: { channel: 'contact_form', event: 'form: sent', button: 'Sent their form', words: 'sent a message through their contact form' },
} as const satisfies Record<string, { channel: Channel; event: string; button: string; words: string }>;

export type Attempt = keyof typeof ATTEMPT;

export const CHANNEL_LABEL: Record<Channel, string> = {
  phone: 'Phone',
  email: 'Email',
  contact_form: 'Contact form',
};
