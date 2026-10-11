import type { Metadata } from 'next';
import { IBM_Plex_Sans, Newsreader } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { HideOnPaths } from '@/components/HideOnPaths';
import { BottomNav } from '@/components/BottomNav';
import { SITE_URL } from '@/lib/site';
import { MotionRoot } from '@/components/motion/MotionRoot';
import { PostHogInit } from '@/components/PostHogInit';
import { RecordingConsent } from '@/components/RecordingConsent';

// Newsreader and IBM Plex Sans, replacing Fraunces and Inter on 2026-09-22.
//
// Inter was the one that had to go. It is the default of nearly every site
// built quickly in the last three years, to the point that it reads as a
// signal about how a site was made rather than about what it is for, and this
// site's whole argument is that somebody actually did the work.
//
// IBM Plex Sans is the deliberate answer to that: humanist, a little tighter
// than Inter, with letterforms that have an opinion, and a register that reads
// institutional rather than launched. It is a typeface commissioned to sit on
// documentation, which is what most of this site is.
//
// Newsreader replaces Fraunces for the same reason in the other direction.
// Fraunces is a lovely, slightly boutique display serif, and boutique is the
// wrong note for a site whose pitch is "here is the evidence and the date it
// was read". Newsreader was drawn for long-form reading, carries an optical
// size axis, and puts the headings in the same register as a newspaper
// standfirst. That is the voice the copy has always had.
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
  display: 'swap',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  // Without this, the generated OG/Twitter image URLs stay relative and no
  // scraper can resolve them.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'YepItsHalal: Find halal food near you',
    template: '%s | YepItsHalal',
  },
  description:
    'Find halal restaurants in London, with the evidence behind every label and the date it was checked.',
  // Declared by hand, as static files, for two reasons Google cares about.
  //
  // Next's generated icon routes hang a content hash off the URL
  // (/icon?c22bee58af459c4e), so the favicon's address changed with every
  // deploy that touched it, and a crawler that caches favicons by URL was
  // never looking at the same one twice. These paths never change.
  //
  // And the sizes here are the sizes of the files. The generated favicon.ico
  // was declared 32x32, which is below the 48px Google will use, so the one
  // icon sitting at the root of the domain was advertising itself as too small
  // to show.
  //
  // Moved once, on 2026-09-24, to new addresses: Google Search was still
  // showing the old green pin with a tick hours after the new logo went live,
  // and a fresh address cannot be answered from its cache. Every size is the
  // halal pin with حلال on the teal disc (48px and up is what Google shows); the
  // Arabic-free "C" of the first set is gone. Keep these addresses from now on.
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    type: 'website',
    siteName: 'YepItsHalal',
    locale: 'en_GB',
  },
  twitter: { card: 'summary_large_image' },
};

// The longest any page is kept before Vercel rebuilds it. Pages that read the
// database say for themselves how long they may be kept, or that they must be
// read fresh on every visit; this is the ceiling for anything that does not,
// so no page waits for the next deploy to change.
export const revalidate = 3600;

export const viewport = {
  themeColor: '#0B2F3A',
  // Explicitly leaves pinch-zoom enabled: locking it out is an accessibility
  // failure for anyone who needs to magnify a menu photo or address.
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${newsreader.variable} ${plex.variable}`}>
      <head>
        {/* Scroll reveals start hidden and are shown by a script. Without one,
            everything must simply be there: a decorative entrance is never a
            good enough reason for a blank page. */}
        <noscript>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: '.reveal{opacity:1!important;transform:none!important}' }} />
        </noscript>
      </head>
      <body className="min-h-screen bg-sand-soft font-sans text-ink antialiased">
        {/* It always appears over the teal header, so it is the header's lime
            button, with the lime ring every control on the teal gets. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-forest-deep focus-visible:outline-accent-onDark"
        >
          Skip to content
        </a>
        <MotionRoot>
          {/* Admin draws its own sidebar and top bar (app/admin/layout.tsx). */}
          <HideOnPaths prefixes={['/admin']}>
            <SiteHeader />
          </HideOnPaths>
          {/* The tab bar is fixed over the page on a phone, and on an iPhone it
              sits above the home indicator, so the page has to end above both. */}
          <main id="main" className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
            {children}
          </main>
          <SiteFooter />
          <BottomNav />
        </MotionRoot>
        <Analytics />
        <PostHogInit />
        <RecordingConsent />
      </body>
    </html>
  );
}
