import data from './data/london-stations.json';

// The nearest station to a place, for the line under its address. From
// OpenStreetMap, saved by scripts/catalogue/fetch-stations.mjs, so nothing is
// asked of anyone at page time. Idea from HalalaGo's "Nearest Metro".
//
// The distance is a straight line, so the words say "away", never a walking
// time: a straight line is shorter than any route, and a walk would be a claim
// we have not checked.

type Station = [name: string, lat: number, lng: number, kinds: string[]];

// JSON arrays type as plain arrays, not tuples, so this goes through unknown.
const STATIONS = (data as unknown as { stations: Station[] }).stations;

/** Further than this, a station is no help to someone looking for the door. */
const MAX_METRES = 1500;

export interface NearStation {
  name: string;
  metres: number;
  kinds: string[];
}

function metres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function nearestStation(lat: number, lng: number, stations: Station[] = STATIONS): NearStation | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: NearStation | null = null;
  for (const [name, sLat, sLng, kinds] of stations) {
    const m = metres(lat, lng, sLat, sLng);
    if (m <= MAX_METRES && (!best || m < best.metres)) best = { name, metres: m, kinds };
  }
  return best;
}

/** "under 100 m away", "about 300 m away", "about 1 km away", "about 1.2 km away". */
export function distanceWords(m: number): string {
  if (m < 100) return 'under 100 m away';
  const rounded = Math.round(m / 50) * 50;
  if (rounded < 1000) return `about ${rounded} m away`;
  return `about ${Number((m / 1000).toFixed(1))} km away`;
}

/** What Londoners call each kind. */
const SAY: Record<string, string> = { Underground: 'Tube' };

/** The station's name as people say it: "Royal Oak (Tube)". Plain rail needs
 *  no word, a big station names two kinds at most (the file lists the Tube
 *  first), and a name that already has brackets gets no more. */
export function stationWords(s: NearStation): string {
  const named = s.kinds.filter((k) => k !== 'Rail').slice(0, 2).map((k) => SAY[k] ?? k);
  return named.length && !s.name.includes('(') ? `${s.name} (${named.join(', ')})` : s.name;
}
