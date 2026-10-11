'use client';

import { useEffect, useState } from 'react';

// A new page fades in rather than cutting in (Shabir, 2026-10-11: moving
// through the site should feel smooth, like Uber Eats). A template mounts
// afresh on each move to a new part of the site, so the fade plays on every
// page change, but never on the page somebody arrived on: that one paints at
// once, and its HTML is the same as without this file.
//
// Opacity only, on purpose. A transform here would make this wrapper the frame
// for every position: fixed bar inside a page (the restaurant page's action
// bar on a phone) while it ran. Changing only the search on /search does not
// remount this, so the search keeps its state.

// True once the first page has hydrated: every later mount is a page change.
let hydrated = false;

export default function Template({ children }: { children: React.ReactNode }) {
  // Decided once, when this page mounts, so a re-render never restarts it.
  const [enter] = useState(() => hydrated);
  useEffect(() => {
    hydrated = true;
  }, []);
  return <div className={enter ? 'page-enter' : undefined}>{children}</div>;
}
