/**
 * The large grounds the site is built on, shared by the homepage hero and every
 * page header so there is one teal, not several that nearly match.
 *
 * Since 2026-09-24 this is the logo's own ground: a deep teal that is lighter
 * in the middle and darker at the edges, like the field the logo was drawn on,
 * with the faintest lift of its lime from the top right. The darkened corner
 * was softened with the lighter teal on 2026-10-11.
 */
export const forestLights =
  'bg-[radial-gradient(90%_80%_at_45%_40%,rgba(28,92,107,0.55),transparent_68%),radial-gradient(110%_85%_at_88%_-12%,rgba(95,203,30,0.12),transparent_55%),radial-gradient(95%_85%_at_-5%_108%,rgba(12,42,50,0.75),transparent_62%)]';

/**
 * Softens the edge between a dark ground and the light page below, and nothing
 * more. 40px, and any section that uses it keeps at least 48px of bottom
 * padding so no content ever sits inside it. A fade with content in it is not
 * a fade, it is a smudge (the Popular areas chips, ca6bf7c).
 */
export const forestFade =
  'pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-sand-soft';
