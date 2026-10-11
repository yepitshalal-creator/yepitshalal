'use client';

import { useEffect, useState } from 'react';
import { NavLink } from './NavLink';
import { UserIcon } from './icons';

// Supabase keeps a signed-in visitor's session in a cookie named
// sb-<project>-auth-token, split into .0, .1 and so on when it is long. The
// PKCE helper cookie, ...-auth-token-code-verifier, is not a session.
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;

// "Sign in" or "My account", the one thing in the header that differs between
// visitors. Until 2026-10-02 the header asked Supabase on the server, which
// made every page on the site wait for that call on every visit and stopped
// Vercel from keeping a copy of any page, even the ones set to be kept for an
// hour. Now the header is the same for everybody and this link looks for the
// session cookie in the browser.
//
// It only picks a label, so the cookie being there is enough: if the session
// has expired, /account sends the visitor to sign in, as it always has. Every
// page that shows private data still checks the session on the server.
export function AccountNavLink({ className }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(SESSION_COOKIE.test(document.cookie));
  }, []);

  // Sized like the header's other links (SiteHeader): a person icon from 640
  // to 767px, "Account" (the phone tab bar's word) to 1023px, then the full
  // words. Screen readers hear the full words at every width.
  const words = signedIn ? 'My account' : 'Sign in';
  return (
    <NavLink href={signedIn ? '/account' : '/sign-in'} tone="dark" className={className}>
      <UserIcon className="h-[18px] w-[18px] md:hidden" aria-hidden="true" />
      {signedIn && (
        <span aria-hidden="true" className="hidden md:inline lg:hidden">
          Account
        </span>
      )}
      <span className={signedIn ? 'sr-only lg:not-sr-only' : 'max-md:sr-only'}>{words}</span>
    </NavLink>
  );
}
