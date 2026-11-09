import type { SceneArt } from '@/components/media/SceneMedia';

// Every picture made for the site, in one place, so the homepage, Discover,
// Add a restaurant and Support show the same street, the same room and the
// same loop rather than three versions of each. All were generated for
// YepItsHalal (see /image-credits): none shows a real restaurant, mosque or
// person, and none is ever used as a photo of a listed place.
//
// Widths are the files that exist in /public/media. A phone gets the tall
// composition where there is one: the street was recomposed vertically, with
// calm sky at the top and dark pavement at the bottom, so words can sit on it.
//
// The loops are the generated originals, untouched: 1276x720 (the tall street
// 720x1276), five seconds, 4.5 to 13 Mbps (2026-09-24). The first versions
// were re-recorded through a canvas at about 1.5 Mbps and cut to three
// seconds, and Shabir saw it at once: "horrific, rendered down". Phones get
// the same files, not smaller copies. The seam where a clip starts again is
// hidden by a crossfade in the page (SceneMedia), not baked into the file.

/** The London high street at dusk. The site's one recurring moving picture. */
export const STREET: SceneArt = {
  still: '/media/london-high-street-wide',
  widths: [640, 1120, 1600, 2400],
  alt: 'A London high street at dusk after rain, food shopfronts lit up',
  video: '/media/london-high-street.mp4',
  videoLabel: 'Evening on a wet London high street, people walking past lit food shopfronts',
  narrow: {
    still: '/media/london-high-street-tall',
    widths: [640, 1080],
    video: '/media/london-high-street-tall.mp4',
    below: 768,
  },
};

/** The same street in its wide composition only, for a frame that is wide on every screen. */
export const STREET_WIDE: SceneArt = { ...STREET, narrow: undefined };

export const PRAYER_ROOM: SceneArt = {
  still: '/media/prayer-room-wide',
  widths: [960, 1600],
  alt: 'An empty prayer room with a green striped carpet and a shoe rack by the door',
};

/** The same room, closer: the prayer rows in the carpet and the shoe rack. For a wide band. */
export const PRAYER_CARPET: SceneArt = {
  still: '/media/prayer-room-carpet',
  widths: [960, 1600],
  alt: 'The green carpet of a prayer room, with its prayer rows, and a shoe rack by the door',
};

export const EVIDENCE: SceneArt = {
  still: '/media/reading-the-evidence-wide',
  widths: [960, 1600],
  alt: 'A takeaway menu, an order pad with handwritten notes and a pen on a wooden counter',
};

export const KITCHEN: SceneArt = {
  still: '/media/kitchen-pass-wide',
  widths: [960, 1600],
  alt: 'A plate of grilled lamb chops and saffron rice on a restaurant kitchen pass',
  video: '/media/kitchen-pass.mp4',
  videoLabel: 'A plate of lamb chops and saffron rice set down on a kitchen pass, steam rising',
};

/** Support, "what checking involves": someone writing it down. */
export const NOTES: SceneArt = {
  still: '/media/keeping-notes',
  widths: [640, 1120, 1600],
  alt: 'Hands writing notes in a notebook at a desk, beside a takeaway menu, a phone and a mug of tea',
  video: '/media/keeping-notes.mp4',
  videoLabel: 'A hand writing a few words in a notebook under a desk lamp',
};

/** Support, "why it matters": a table deciding together. */
export const TABLE: SceneArt = {
  still: '/media/shared-table',
  widths: [640, 1120, 1600],
  alt: 'Hands sharing grilled chicken, lamb, saffron rice and salads across a restaurant table',
  video: '/media/shared-table.mp4',
  videoLabel: 'Hands reaching across a shared restaurant table, steam rising from the rice',
};

// Added 2026-11-06 (Nano Banana Pro, 2K). Like the rest: generated, no real
// place, no face, nothing legible. Each was cut from the scene side of a
// two-panel render, so the widths stop where the scene does.

/** A neighbourhood high street on an autumn afternoon. The borough pages.
 *  Still only: its loop drew a bus stop roundel and shop lettering. */
export const HIGH_STREET_AUTUMN: SceneArt = {
  still: '/media/high-street-autumn-wide',
  widths: [960, 1600],
  alt: 'A London neighbourhood high street on an autumn afternoon, crates of fruit outside a grocer',
};

/** Rain on a takeaway window, its sticker too blurred to read. Corrections. */
export const TAKEAWAY_WINDOW: SceneArt = {
  still: '/media/takeaway-window-wide',
  widths: [960, 1600],
  alt: 'Rain on the front window of a takeaway at night, a round green sticker on the glass out of focus',
  video: '/media/takeaway-window.mp4',
  videoLabel: 'Rain running down a takeaway window at night, steam rising in the kitchen behind',
};

/** A takeaway at dusk with its shutter half down. The page that is not found. */
export const SHUTTER_DOWN: SceneArt = {
  still: '/media/shutter-down-wide',
  widths: [960, 1440],
  alt: 'A takeaway at dusk with its shutter half down and a blank sheet of paper taped to it',
};

/** Skewers over charcoal. The kinds of food index, and the grill-type pages. */
export const CHARCOAL_GRILL: SceneArt = {
  still: '/media/charcoal-grill-wide',
  widths: [960, 1600],
  alt: 'Skewers of kofta and chicken over glowing charcoal, flames rising in a restaurant kitchen',
  video: '/media/charcoal-grill.mp4',
  videoLabel: 'Flames rising between skewers over glowing charcoal',
};
