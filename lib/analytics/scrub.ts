import type { CaptureResult, CapturedNetworkRequest } from 'posthog-js';

// Every event passes through here in the browser before anything is sent to
// PostHog, and what comes out is all PostHog ever receives. The privacy page
// promises three things this file keeps true: the location someone searched
// from is never stored, nothing personal is collected just by visiting, and
// the analytics does not follow anyone around. The mobile app plan in the
// vault sets the same line for the app: no coordinates, no full postcodes, no
// email addresses, no report text. Recordings of visitors who said yes are
// held to the same line by the mask functions at the end of this file.

// Pages that show someone's own details: the admin queue lists submitters'
// email addresses, /account shows yours, /manage is a restaurant owner's own
// dashboard. /yes and /stop carry an outreach token in the address, which is
// the key to that place's answer. No event that happens on them is sent at
// all, and recordings show them as an empty box (BLOCK_CLASS, below).
const PRIVATE_PATHS = ['/admin', '/account', '/manage', '/auth', '/yes', '/stop'];

// The only query parameters whose values may leave the browser. Everything
// else keeps its name and loses its value, so /search?lat=51.5&lng=-0.1
// arrives as /search?lat=&lng= and still counts as a search. An allowlist
// rather than a blocklist: a parameter added next year is private until
// someone decides otherwise.
const KEPT_PARAMS = new Set([
  'mode',
  'sort',
  'classification',
  'radius_miles',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
]);

// A name=value pair inside any URL, wherever it turns up: the page address,
// the referrer, or the href of a clicked link inside autocapture's element
// chain. The value stops at quotes and angle brackets because the element
// chain wraps attributes in double quotes.
const QUERY_PAIR = /([?&])([^=&#\s"'<>]+)=([^&#\s"'<>]*)/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// A full UK postcode, "E7 9AA", cut back to its district, "E7". It needs the
// space (or its URL encodings) between the halves, which is how the site
// prints one, so that a slug or a class name that happens to look like
// "e79aa" is left alone.
const FULL_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)(?:\s|%20|\+)+\d[A-Z]{2}\b/gi;

export function scrubText(text: string): string {
  return text
    .replace(QUERY_PAIR, (pair, separator: string, name: string) =>
      KEPT_PARAMS.has(name) ? pair : `${separator}${name}=`,
    )
    .replace(EMAIL, '[email]')
    .replace(FULL_POSTCODE, '$1');
}

// Keys as well as values: heatmap events are keyed by the page URL.
function scrubDeep(value: unknown): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [scrubText(key), scrubDeep(inner)]),
    );
  }
  return value;
}

// The page the event belongs to, from the event itself. A $pageleave for an
// admin page is captured after the browser has already moved on, so the
// current location would be the wrong page to judge it by.
function pathOf(properties: Record<string, unknown>): string {
  if (typeof properties.$pathname === 'string') return properties.$pathname;
  if (typeof properties.$current_url === 'string') {
    try {
      return new URL(properties.$current_url).pathname;
    } catch {
      // Not a full URL, so fall back to where the browser is.
    }
  }
  return typeof window === 'undefined' ? '' : window.location.pathname;
}

function isPrivate(path: string): boolean {
  return PRIVATE_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  // Recordings are filtered as they are recorded, by the mask functions
  // below, and reach this point already compressed. The patterns would find
  // nothing to hide in compressed bytes and could corrupt them. Dropping a
  // batch would break the rest of that recording, so the private pages hide
  // themselves instead, with BLOCK_CLASS.
  if (event.event === '$snapshot') return event;
  const properties = event.properties ?? {};
  if (isPrivate(pathOf(properties))) return null;
  return {
    ...event,
    // Cookieless counting drops the IP address before PostHog could look up
    // where it is. A visitor who says yes to a recording leaves cookieless
    // mode, so this tells PostHog not to look it up for them either.
    properties: { ...(scrubDeep(properties) as CaptureResult['properties']), $geoip_disable: true },
    ...(event.$set ? { $set: scrubDeep(event.$set) as CaptureResult['$set'] } : {}),
    ...(event.$set_once ? { $set_once: scrubDeep(event.$set_once) as CaptureResult['$set_once'] } : {}),
  };
}

// Session recordings, made only for visitors who say yes, capture the page
// itself rather than events, so the same rules are applied to the page as it
// is recorded:
//
// - every piece of text, and every attribute that can hold text or an
//   address, goes through scrubText, so an email address, a full postcode or
//   the searched location inside a link is hidden the same way as in events;
// - text that shows where someone is sits inside MASK_CLASS and is blanked
//   completely: the place they searched near, because a typed street
//   address matches none of the patterns above, and every distance or
//   walking time measured from it, because three of those pin down the spot;
// - the map sits inside UNRECORDED_CLASS, because its pins are drawn around
//   that spot, and the recorder replaces it with an empty box of the same
//   size;
// - pages with someone's own details sit inside BLOCK_CLASS, and are
//   replaced the same way; and
// - typing itself is never recorded (maskAllInputs in posthog.ts).
//
// Autocapture knows two of these names too. It never reads the text inside
// MASK_CLASS, and it ignores taps inside BLOCK_CLASS altogether. Taps on the
// map are still counted.
export const MASK_CLASS = 'ph-sensitive';
export const UNRECORDED_CLASS = 'ph-unrecorded';
export const BLOCK_CLASS = 'ph-no-capture';

// Attributes that can carry words or an address. The rest (class, style, the
// shapes of icons, image addresses) are left alone, so the recording still
// looks like the page.
const TEXT_ATTRIBUTES = new Set([
  'href',
  'action',
  'formaction',
  'aria-label',
  'aria-description',
  'aria-valuetext',
  'title',
  'alt',
  'value',
  'placeholder',
  'content',
  'label',
]);

function blank(text: string): string {
  return text.replace(/\S/g, '*');
}

function insideMask(element?: Element | null): boolean {
  return Boolean(element?.closest?.(`.${MASK_CLASS}`));
}

export function maskRecordedText(text: string, element?: HTMLElement): string {
  return insideMask(element) ? blank(text) : scrubText(text);
}

export function maskRecordedAttribute(name: string, value: string, element?: Element): string {
  if (!TEXT_ATTRIBUTES.has(name) && !name.startsWith('data-')) return value;
  return insideMask(element) ? blank(value) : scrubText(value);
}

// The address of each page in a recording, which carries the searched
// location on /search.
export function maskRecordedUrl(request: CapturedNetworkRequest): CapturedNetworkRequest {
  return { ...request, name: scrubText(request.name) };
}
