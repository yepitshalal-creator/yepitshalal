/**
 * A path on this site to send someone on to, or '/' for anything else.
 *
 * The sign-in callback used to glue `next` onto the site's address, so
 * "@evil.com" became https://yepitshalal.com@evil.com (the browser goes to
 * evil.com) and ".evil.com" became yepitshalal.com.evil.com. Resolving it
 * against the site and keeping it only when it stays here closes that, and
 * "//evil.com" and "/\evil.com" with it.
 */
export function sameSitePath(next: string | null | undefined, origin: string): string {
  if (!next || !next.startsWith('/')) return '/';
  try {
    const url = new URL(next, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}
