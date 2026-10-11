import type { Config } from 'tailwindcss';

// The logo's colours, sitewide, since 2026-09-24: its deep teal ground, its
// lime pin and "ITS", and white. Sampled from the artwork Shabir chose
// (variation 4): teal #124452 in the middle of the disc, #0B2F3A at its edge,
// lime #5FCB1E.
//
// Lightened on 2026-10-11 (Shabir: "make the colour scheme more subtle... a
// little lighter (mainly the dark blueish colour)"). The ground is no longer
// the logo's exact teal but a lighter, slightly greyer one: #0B2F3A became
// #18424E and #124452 became #1F5361, the same hue. The logo files keep their
// own colours; its white ring sets it apart from the header.
//
// The token names are older than the palette and were kept so nothing had to
// be renamed: `forest` is now the logo's teal, `accent` its lime, `spice` a
// quieter teal for small emphasis, and `sand` the cool, teal-tinted neutrals
// that sit with it (the warm cream is gone).
//
// Every text token is contrast-checked against the surfaces it sits on: the
// page (#F3F7F7), card white and the band (#E4EEEE), and clears 4.5:1 on all
// three. The logo lime itself is 2:1 on white, so it is for fills, marks and
// large text on the teal only (5.2:1 on #18424E, 4.1:1 on #1F5361); on a light
// ground green text uses `accent.ink`. The unsuffixed halal `full`/`partial`/
// `unverified` values are dot and map pin colours, never text, and the halal
// colours are deliberately unchanged: they carry meaning, not brand.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Teal-black. 14.7:1 on the page.
        ink: '#0F252B',
        // Secondary body text. 6.4:1 on the page, 6.9:1 on white, 5.9:1 on the band.
        muted: '#4A5D62',
        // Tertiary/meta text, the lightest tone allowed on text. 5.0 / 5.4 / 4.6:1.
        subtle: '#5B6D72',
        paper: '#F7FAFA',
        line: 'rgba(15,37,43,0.09)',
        accent: {
          // The logo's lime. Fills, marks, and text on the teal only.
          DEFAULT: '#5FCB1E',
          // Green for text on a light ground. 5.8:1 on the page, 6.2:1 on white,
          // 5.3:1 on the band, and still 4.6:1 on the Free highlighter.
          ink: '#276F0A',
          soft: '#E8F6DC',
          // Lime for text on the teal: 4.6:1 on #1F5361, 5.8:1 on #18424E, and
          // 4.8:1 on the lit middle of a hero (forestLights).
          onDark: '#6FD52F',
        },
        // A second, quieter teal for small emphasis (labels, icons, the loop
        // steps). Not the lime, so the lime stays the one bright note, and not
        // gold, which is spoken for: halal.partial is amber and means
        // "Halal Options".
        spice: {
          // 5.5:1 against white text, so it can carry a small white label.
          DEFAULT: '#1E7384',
          // 7.9:1 on the page.
          ink: '#135463',
          soft: '#E1EEF0',
          onDark: '#8ED1DC',
        },
        sand: {
          DEFAULT: '#E4EEEE',
          soft: '#F3F7F7',
          line: 'rgba(18,68,82,0.14)',
        },
        forest: {
          // The teal, lighter than the logo's since 2026-10-11. White text is
          // 8.5:1 on DEFAULT and 10.9:1 on deep; deep text on the lime 5.2:1.
          DEFAULT: '#1F5361',
          deep: '#18424E',
        },
        halal: {
          full: '#1F7A45',
          fullInk: '#166534',
          fullSoft: '#E1F1E5',
          partial: '#A8720F',
          partialInk: '#7A5200',
          partialSoft: '#F6ECD6',
          unverified: '#6D766F',
          unverifiedInk: '#4F564F',
          unverifiedSoft: '#EBEAE3',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-sans)'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      spacing: {
        // Bottom action bars and mobile nav sit above the iOS home indicator.
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
      },
      transitionTimingFunction: {
        // Decelerating curve: things arrive quickly then settle.
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        // One step softer, with a touch of overshoot. For things that appear
        // rather than move: a modal, a stage change, a revealed section.
        arrive: 'cubic-bezier(0.22, 1.12, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'sheet-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        // The intro. A scrim that fades, a card that rises into it, and stage
        // copy that slides the way the reader is travelling.
        'scrim-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'translateY(18px) scale(0.985)' },
          to: { opacity: '1', transform: 'none' },
        },
        'stage-next': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'stage-back': {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'sheet-up': 'sheet-up 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scrim-in': 'scrim-in 220ms ease-out both',
        'modal-in': 'modal-in 380ms cubic-bezier(0.22, 1.12, 0.36, 1) both',
        'stage-next': 'stage-next 300ms cubic-bezier(0.22, 1.12, 0.36, 1) both',
        'stage-back': 'stage-back 300ms cubic-bezier(0.22, 1.12, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
