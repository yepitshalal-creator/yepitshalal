'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/analytics/posthog';

// The last resort: shown only when the root layout itself fails, since every
// page below it is caught by app/error.tsx inside the site's own header. Until
// 2026-10-11 there was no app/error.tsx, so every failure ended here, on Next's
// black "Application error: a client-side exception has occurred" screen.
//
// It replaces the whole document, so none of the site's CSS or fonts load:
// the colours are written in, from tailwind.config.ts. PostHog is still told,
// so a crash on someone's phone is something we can see rather than guess at.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#F7FAFA',
          color: '#0F252B',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '64px 20px' }}>
          <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: '0 0 12px' }}>Sorry, this page did not load</h1>
          <p style={{ fontSize: 17, lineHeight: 1.5, margin: '0 0 28px' }}>
            Something went wrong on our side. Tap Try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 48,
              padding: '0 24px',
              border: 0,
              borderRadius: 999,
              background: '#0F252B',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
