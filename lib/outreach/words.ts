import { SITE_URL, INBOX } from '@/lib/site';

// Everything outreach says, in one place, so the words a place agrees to and
// the emails that ask for it are easy to check together. Plain words, third
// grade reading level, every promise true. Names (YepItsHalal) stay as they are.

/**
 * What a place agrees to on its /yes page, word for word. Saved in full with
 * every yes (content_permissions.words), so changing this means a new version
 * and leaves every earlier yes exactly as it was given.
 */
export const PERMISSION_WORDS =
  'You let YepItsHalal use photos, videos, your menu and your logo: the ones you send us, or that you have posted on your own website or social media. ' +
  "We can show them on yepitshalal.com and post or repost them on YepItsHalal's social media. " +
  'We always name and tag you. You confirm they are yours to share. ' +
  'You can take this back any time by email, and we take them off the site and delete our posts within 14 days.';

export const PERMISSION_WORDS_VERSION = 'v1-2026-10-10';

/** Days we have to take everything down after a yes is taken back. */
export const TAKE_DOWN_DAYS = 14;

/** Replies land in hello@, which forwards to the yepitshalal Gmail. */
export const OUTREACH_FROM = process.env.OUTREACH_FROM_EMAIL || `Shabir at YepItsHalal <${INBOX.hello}>`;
export const OUTREACH_REPLY_TO = INBOX.hello;

export const yesUrl = (token: string) => `${SITE_URL}/yes/${token}`;
export const stopUrl = (token: string) => `${SITE_URL}/stop/${token}`;
export const oneClickStopUrl = (token: string) => `${SITE_URL}/api/outreach/stop?t=${token}`;
export const placeUrl = (slug: string) => `${SITE_URL}/restaurant/${slug}`;

/** "their website" reads better than a bare URL in the line about where we found them. */
export function foundWhere(url: string | null, how: string): string {
  if (how === 'osm') return 'OpenStreetMap';
  if (!url) return 'your website';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'your website';
  }
}

export interface EmailParts {
  subject: string;
  text: string;
}

export interface FirstEmailInput {
  /** The place's name, or the chain's for a head office. */
  name: string;
  /** A page of theirs on the site. For a chain, one of its branches. */
  pageUrl: string;
  isChain: boolean;
  /** True only when the page has none of their own photos yet. */
  noOwnPhotos: boolean;
  token: string;
  foundAt: string;
}

export const FIRST_SUBJECT = 'Can we show off your food on YepItsHalal?';

export function firstEmail(i: FirstEmailInput): EmailParts {
  const onIt = i.isChain
    ? `Your London branches are already on it, like this one:\n${i.pageUrl}\n\nOne yes from you covers every branch.`
    : `You're already on it:\n${i.pageUrl}`;
  const ask = i.noOwnPhotos
    ? 'Your page has no photos of your food yet. Can we use yours?'
    : 'Can we show more of your food?';
  const text = [
    `Hi ${i.name} team,`,
    '',
    "I'm Shabir from YepItsHalal. It's a free website that helps Muslims in London find halal food near them. " + onIt,
    '',
    ask,
    '',
    'If you say yes, we can put your photos, videos, menu and logo on your page, and share them on our social media. We always name and tag you.',
    '',
    'What you get:',
    '- A better looking page, free',
    '- Your menu, opening hours and prices on it',
    '',
    `It takes one minute:\n${yesUrl(i.token)}`,
    '',
    'Saying yes does not change your halal label. Only a check by us does that.',
    '',
    'Thanks,',
    'Shabir',
    'YepItsHalal, London',
    '',
    `We found this email address on ${i.foundAt}. Don't want emails from us? Tap here and we won't write again: ${stopUrl(i.token)}`,
  ].join('\n');
  return { subject: FIRST_SUBJECT, text };
}

export function followUpEmail(i: { token: string; pageOpens: number | null }): EmailParts {
  // Only said when it is true and worth saying. Visitors are counted per day
  // without cookies, so this is page opens, not people.
  const opens =
    i.pageOpens !== null && i.pageOpens >= 5
      ? ` Your page on YepItsHalal was opened ${i.pageOpens} times in the last 30 days.`
      : '';
  const text = [
    'Hi again,',
    '',
    `Just checking you saw my email last week.${opens} Good photos help people pick you.`,
    '',
    `Can we use your photos, videos and menu? It takes one minute:\n${yesUrl(i.token)}`,
    '',
    'If not, no problem. This is the last email we will send.',
    '',
    'Shabir',
    'YepItsHalal, London',
    '',
    `Don't want emails from us? ${stopUrl(i.token)}`,
  ].join('\n');
  return { subject: `Re: ${FIRST_SUBJECT}`, text };
}

export function thankYouEmail(i: {
  givenByName: string;
  placeName: string;
  agreedOn: string;
  words: string;
  token: string;
  /** Set for a single place, so they can sign in and claim it. */
  slug: string | null;
}): EmailParts {
  const claim = i.slug
    ? `- Want to change your page yourself? Sign in with this email, then tap "Claim this restaurant":\n  ${SITE_URL}/sign-in?next=/restaurant/${i.slug}`
    : null;
  const text = [
    `Hi ${i.givenByName},`,
    '',
    `Thank you for saying yes for ${i.placeName}. Here is what you agreed to on ${i.agreedOn}:`,
    '',
    `"${i.words}"`,
    '',
    'Next:',
    `- Add your photos and videos here: ${yesUrl(i.token)}\n  Or just reply to this email with them.`,
    ...(claim ? [claim] : []),
    '',
    `Changed your mind? Take it back on the same page: ${yesUrl(i.token)}`,
    'Or just reply and tell us.',
    '',
    'Shabir',
    'YepItsHalal, London',
  ].join('\n');
  return { subject: 'Thank you! Your yes is saved', text };
}

export function takenBackEmail(i: { givenByName: string; placeName: string; byDate: string }): EmailParts {
  const text = [
    `Hi ${i.givenByName},`,
    '',
    `We got it. You took back your yes for ${i.placeName}.`,
    '',
    `We will take your photos, videos, menu and logo off yepitshalal.com, and delete our posts, by ${i.byDate}.`,
    '',
    'Shabir',
    'YepItsHalal, London',
  ].join('\n');
  return { subject: 'Your yes is taken back', text };
}

/** Plain text in a simple wrapper: links clickable, nothing that can break. */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const linked = esc(text).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#124452">${u}</a>`);
  return `<div style="max-width:560px;font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#0F252B;white-space:pre-wrap">${linked}</div>`;
}
