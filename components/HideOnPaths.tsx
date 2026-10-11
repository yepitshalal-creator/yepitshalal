'use client';

import { usePathname } from 'next/navigation';

// Leaves its children out on the paths given. The public header is a server
// component that reads nothing from the request (so pages stay static), and
// admin has its own chrome, so the header is wrapped in this rather than
// taught about the path itself.
export function HideOnPaths({ prefixes, children }: { prefixes: string[]; children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <>{children}</>;
}
