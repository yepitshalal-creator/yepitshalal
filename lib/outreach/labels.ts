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

export const CHANNEL_LABEL: Record<Channel, string> = {
  phone: 'Phone',
  email: 'Email',
  contact_form: 'Contact form',
};
