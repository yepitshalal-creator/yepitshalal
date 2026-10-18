import type { MetadataRoute } from 'next';

// Lets a phone save the site to its home screen and open it full screen, like
// an app, with no app store and no cost (the 2026-10-12 plan, Step 3). The
// icons are the round mark already in public/: 192 for the home screen, 512
// for the splash screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YepItsHalal',
    short_name: 'YepItsHalal',
    description: 'Halal places in London, with the proof behind every label.',
    start_url: '/',
    display: 'standalone',
    background_color: '#18424E',
    theme_color: '#18424E',
    icons: [
      { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/yepitshalal-mark-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
