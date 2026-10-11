// Geodesic helpers for drawing a real-world radius on the map.
//
// The coverage ring is a genuine geographic polygon, not a pixel-radius circle
// layer. A pixel circle has to be recomputed on every zoom and drifts whenever
// the map is mid-animation; a polygon in lng/lat is simply map data, so MapLibre
// keeps it correctly positioned through panning, zooming and rotation for free.

/** IUGG mean Earth radius, the same figure PostGIS geography uses for distance. */
const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Point reached by travelling `distanceMeters` from `origin` on `bearingDeg`. */
function destination(origin: LatLng, distanceMeters: number, bearingDeg: number): [number, number] {
  const angular = distanceMeters / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [toDeg(lng2), toDeg(lat2)];
}

export type CirclePolygon = GeoJSON.Feature<GeoJSON.Polygon>;

/**
 * A closed ring approximating the set of points exactly `radiusMeters` from
 * `center`. 96 steps keeps the edge smooth at the zoom a 0.5 mile circle is
 * viewed at, without producing a polygon large enough to be worth simplifying.
 */
export function circlePolygon(center: LatLng, radiusMeters: number, steps = 96): CirclePolygon {
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    ring.push(destination(center, radiusMeters, (i * 360) / steps));
  }
  ring.push(ring[0]);

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

/** Bounding box of that ring, as MapLibre's [[w, s], [e, n]]. */
export function circleBounds(
  center: LatLng,
  radiusMeters: number
): [[number, number], [number, number]] {
  const north = destination(center, radiusMeters, 0)[1];
  const south = destination(center, radiusMeters, 180)[1];
  const east = destination(center, radiusMeters, 90)[0];
  const west = destination(center, radiusMeters, 270)[0];
  return [
    [west, south],
    [east, north],
  ];
}

/** Great-circle distance in metres, the same sphere PostGIS geography measures on. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
