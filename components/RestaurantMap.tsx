'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import Supercluster from 'supercluster';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { SearchResultRestaurant } from '@/lib/types';
import { circleBounds, circlePolygon } from '@/lib/geo';
import { HALAL_DOT_COLOR, HALAL_PIN_LABEL } from './halalColors';
import { statusOf } from '@/lib/types';
import { UNRECORDED_CLASS } from '@/lib/analytics/scrub';

// The only thing this component knows is "MapLibre + a style URL." Swapping
// tile providers later is a change to NEXT_PUBLIC_MAP_STYLE_URL, nothing here.
// Pins come entirely from our own search results (lat/lng), never the tile provider.
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** The little a map needs to know about a place to pray. */
export interface MapPrayerSpace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_meters: number;
}

interface RestaurantMapProps {
  center: { lat: number; lng: number };
  restaurants: SearchResultRestaurant[];
  /** Mosques and prayer rooms, drawn in their own shape. Empty when hidden. */
  prayerSpaces?: MapPrayerSpace[];
  onSelectPrayerSpace?: (space: MapPrayerSpace) => void;
  selectedId: string | null;
  onSelect: (restaurant: SearchResultRestaurant) => void;
  /** Bump to make the map re-measure, e.g. after it is revealed from display:none. */
  resizeSignal?: number;
  /**
   * The area actually being searched, in metres. Comes from the same clamp the
   * query used, so the ring can never claim a different area to the results.
   */
  coverageRadiusMeters: number;
  /**
   * Called when a cluster cannot usefully be zoomed into any further, so the
   * only way to reach those places is to list them.
   */
  onSelectCluster?: (restaurants: SearchResultRestaurant[]) => void;
}

type ClusterProps = { restaurant?: SearchResultRestaurant };

// Sits under the HTML markers either way (those are DOM overlays), so the ring
// never competes with a pin for a tap.
const COVERAGE_SRC = 'search-coverage';
const CENTER_SRC = 'search-center';

function addCoverageLayers(map: MapLibreMap) {

  if (!map.getSource(COVERAGE_SRC)) {
    map.addSource(COVERAGE_SRC, { type: 'geojson', data: emptyCollection() });
    map.addLayer({
      id: `${COVERAGE_SRC}-fill`,
      type: 'fill',
      source: COVERAGE_SRC,
      paint: { 'fill-color': '#5FCB1E', 'fill-opacity': 0.09 },
    });
    map.addLayer({
      id: `${COVERAGE_SRC}-line`,
      type: 'line',
      source: COVERAGE_SRC,
      paint: { 'line-color': '#276F0A', 'line-width': 2, 'line-opacity': 0.7 },
    });
  }

  if (!map.getSource(CENTER_SRC)) {
    map.addSource(CENTER_SRC, { type: 'geojson', data: emptyCollection() });
    map.addLayer({
      id: `${CENTER_SRC}-dot`,
      type: 'circle',
      source: CENTER_SRC,
      paint: {
        'circle-radius': 5,
        'circle-color': '#276F0A',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    });
  }
}

function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function setData(map: MapLibreMap, id: string, data: GeoJSON.GeoJSON) {
  const source = map.getSource(id);
  if (source && 'setData' in source) (source as maplibregl.GeoJSONSource).setData(data);
}

export function RestaurantMap({
  center,
  restaurants,
  prayerSpaces = [],
  onSelectPrayerSpace,
  selectedId,
  onSelect,
  resizeSignal = 0,
  coverageRadiusMeters,
  onSelectCluster,
}: RestaurantMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  // Their own list, so a change of restaurants never wipes them and vice versa.
  const prayerMarkersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const onSelectClusterRef = useRef(onSelectCluster);
  const onSelectPrayerSpaceRef = useRef(onSelectPrayerSpace);
  const restaurantsRef = useRef(restaurants);
  const selectedIdRef = useRef(selectedId);
  onSelectRef.current = onSelect;
  onSelectClusterRef.current = onSelectCluster;
  onSelectPrayerSpaceRef.current = onSelectPrayerSpace;
  restaurantsRef.current = restaurants;
  selectedIdRef.current = selectedId;

  // Read by the 'load' handler, which is registered once and would otherwise
  // close over the first render's radius forever.
  const coverageRef = useRef({ center, coverageRadiusMeters });
  coverageRef.current = { center, coverageRadiusMeters };

  // Refitting is keyed rather than run on every render so a user who has panned
  // away keeps their view until they actually change something.
  const lastFitRef = useRef<string>('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap | null = null;
    let basemapTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [center.lng, center.lat],
        zoom: 13.5,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;
      // The fit key outlives this effect, so a map rebuilt under a component
      // that never unmounted would otherwise match a key set for the old one
      // and open at the default camera instead of the searched area.
      lastFitRef.current = '';

      const rerender = () =>
        renderMarkers(map!, restaurantsRef.current, selectedIdRef.current, onSelectRef, markersRef, onSelectClusterRef);
      map.on('moveend', rerender);

      // 'load' waits for every tile source to resolve its metadata, so a slow or
      // unreachable tile CDN would hold back things that do not depend on it at
      // all: the pins are DOM overlays, and the coverage ring is our own data.
      // Those are exactly what a user needs when the basemap is struggling, so
      // both hang off 'styledata' (fired as soon as the style is applied) and
      // are written to be safe to run repeatedly.
      map.on('styledata', () => {
        applyCoverage(map!, coverageRef.current);
        rerender();
      });
      map.on('load', rerender);

      // The basemap comes from a free, donation-funded tile service. When it is
      // unreachable the pins and the coverage ring still draw correctly on an
      // empty background, which looks broken unless we say what happened.
      //
      // Deciding that by errors alone did not work: a blocked or throttled tile
      // request can finish quietly, and 'idle' fires as soon as the map has
      // finished drawing whatever it has, including nothing, which cleared the
      // warning the moment it was set. So the test is the honest one, did any
      // map data actually arrive, with a deadline.
      let basemapArrived = false;
      map.on('sourcedata', (e) => {
        const id = (e as unknown as { sourceId?: string }).sourceId;
        const loaded = (e as unknown as { isSourceLoaded?: boolean }).isSourceLoaded;
        // Our own coverage layers load fine whether or not the basemap does.
        if (!id || id === COVERAGE_SRC || id === CENTER_SRC || !loaded) return;
        basemapArrived = true;
        setBasemapFailed(false);
      });
      map.on('error', (e) => {
        const status = (e as unknown as { error?: { status?: number } }).error?.status;
        if (status === 404) return; // A single missing tile is not an outage.
        if (!basemapArrived) setBasemapFailed(true);
      });
      basemapTimer = setTimeout(() => {
        if (!basemapArrived) setBasemapFailed(true);
      }, 6000);
    } catch {
      // Tile source unreachable: the map simply doesn't render.
      // Search/list results are independent of this and keep working.
    }

    return () => {
      clearTimeout(basemapTimer);
      // MapLibre's remove() detaches the DOM nodes it created from the
      // container React manages. Clearing markers here too means a genuine
      // remount (e.g. Fast Refresh) starts from a clean slate instead of
      // holding references to now-orphaned marker elements.
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      for (const m of prayerMarkersRef.current) m.remove();
      prayerMarkersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coverage is data, so it only has to be pushed when it changes; MapLibre keeps
  // it registered to the right ground through every pan and zoom on its own.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyCoverage(map, { center, coverageRadiusMeters });
    // `center` itself is a fresh object each render; its two numbers fully
    // determine it, so depending on those avoids resyncing on every paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, coverageRadiusMeters]);

  // Fit to what the map is showing: the places listed so far and the point the
  // search was made from, so showing more widens the view to take them in. With
  // nothing to show it frames the searched area instead. resizeSignal is part
  // of the key because a map revealed from display:none has only just learned
  // its true size.
  const pinsKey = `${restaurants.length}:${restaurants[0]?.id}:${restaurants[restaurants.length - 1]?.id}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const key = `${center.lat},${center.lng},${coverageRadiusMeters},${resizeSignal},${pinsKey}`;
    if (key === lastFitRef.current) return;

    // A map still inside a display:none column measures zero and would fit to
    // nonsense. Leave the key unset so the next pass retries.
    if (map.getContainer().clientHeight === 0) return;

    lastFitRef.current = key;

    // An eased camera move is driven by the render loop, which does not run
    // until the map has something to draw. Animating the *first* fit would
    // therefore stall on a slow basemap and leave the ring off screen, and it
    // is motion with nothing to show continuity from in any case. Jump into
    // place first, then animate only once the map is genuinely live.
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // On a phone the map runs the full width under a fixed tab bar, and the
    // legend sits over its top-left corner, so even padding would tuck the ring
    // under both. Desktop has neither problem.
    const narrow = window.innerWidth < 640;
    map.fitBounds(viewBounds(center, coverageRadiusMeters, restaurants), {
      padding: narrow ? { top: 56, bottom: 92, left: 24, right: 24 } : 56,
      duration: map.loaded() && !reduceMotion ? 500 : 0,
      maxZoom: 16,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, coverageRadiusMeters, resizeSignal, pinsKey]);

  // MapLibre measures its container once, at construction. On mobile the map
  // starts inside a display:none column, so it comes up with a zero-height
  // canvas and stays blank when the List/Map toggle reveals it, unless it is
  // told to re-read the container size at that moment.
  useEffect(() => {
    if (!resizeSignal) return;
    // Called straight away (the effect runs after the browser has laid the
    // revealed container out) and again on a timer, because the first call can
    // land before a CSS transition has finished settling the box. Deliberately
    // not requestAnimationFrame: that never fires in a background tab, which is
    // exactly where a stale canvas would sit waiting.
    mapRef.current?.resize();
    const id = setTimeout(() => mapRef.current?.resize(), 200);
    return () => clearTimeout(id);
  }, [resizeSignal]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    renderMarkers(map, restaurants, selectedId, onSelectRef, markersRef, onSelectClusterRef);
  }, [restaurants, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of prayerMarkersRef.current) m.remove();
    prayerMarkersRef.current = [];

    for (const space of prayerSpaces) {
      const el = document.createElement('button');
      el.type = 'button';
      el.style.width = '34px';
      el.style.height = '34px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.background = 'transparent';
      el.style.border = 'none';
      el.style.padding = '0';
      el.style.cursor = 'pointer';

      // A rounded square, not a circle: at a glance it is plainly not one of
      // the food pins, which is the whole point. Colour alone would not do it.
      const mark = document.createElement('span');
      mark.style.width = '20px';
      mark.style.height = '20px';
      mark.style.borderRadius = '6px';
      mark.style.background = '#0F252B';
      mark.style.border = '2px solid #fff';
      mark.style.boxShadow = '0 1px 4px rgba(0,0,0,.35)';
      mark.style.display = 'flex';
      mark.style.alignItems = 'center';
      mark.style.justifyContent = 'center';
      mark.style.color = '#fff';
      mark.style.fontSize = '11px';
      mark.style.fontWeight = '700';
      mark.style.lineHeight = '1';
      mark.textContent = '٭';
      el.appendChild(mark);

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectPrayerSpaceRef.current?.(space);
      });

      const marker = new maplibregl.Marker({ element: el }).setLngLat([space.lng, space.lat]).addTo(map);
      el.setAttribute('aria-label', `${space.name}, a place to pray`);
      prayerMarkersRef.current.push(marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerSpaces]);

  // The map is drawn around the place someone searched from, so recordings
  // show it as an empty box (lib/analytics/scrub.ts).
  return (
    <div className={`${UNRECORDED_CLASS} relative h-full w-full`}>
      <div ref={containerRef} className="h-full w-full" />
      {basemapFailed && (
        <p className="pointer-events-none absolute inset-x-3 bottom-20 z-10 mx-auto w-fit rounded-full bg-ink/85 px-3.5 py-1.5 text-center text-xs font-medium text-white shadow-lg backdrop-blur">
          Map background didn&apos;t load. The pins are still in the right places.
        </p>
      )}
    </div>
  );
}

/** The places on the map and the point searched from, or the searched circle when there are none. */
function viewBounds(
  center: { lat: number; lng: number },
  coverageRadiusMeters: number,
  restaurants: SearchResultRestaurant[]
): [[number, number], [number, number]] {
  if (restaurants.length === 0) return circleBounds(center, coverageRadiusMeters);
  let [west, south, east, north] = [center.lng, center.lat, center.lng, center.lat];
  for (const r of restaurants) {
    west = Math.min(west, r.lng);
    east = Math.max(east, r.lng);
    south = Math.min(south, r.lat);
    north = Math.max(north, r.lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * Add the coverage layers if they are missing, then push current geometry into
 * them. Safe to call before the style is ready and safe to call repeatedly:
 * MapLibre throws if a style is not yet applied, and 'styledata' will call this
 * again the moment it is.
 */
function applyCoverage(
  map: MapLibreMap,
  state: {
    center: { lat: number; lng: number };
    coverageRadiusMeters: number;
  }
): void {
  try {
    addCoverageLayers(map);
    syncCoverage(map, state.center, state.coverageRadiusMeters);
  } catch {
    // Style not applied yet. Retried on the next 'styledata'.
  }
}

function syncCoverage(
  map: MapLibreMap,
  center: { lat: number; lng: number },
  coverageRadiusMeters: number
) {
  setData(map, COVERAGE_SRC, circlePolygon(center, coverageRadiusMeters));
  setData(map, CENTER_SRC, {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [center.lng, center.lat] },
  });
}

function renderMarkers(
  map: MapLibreMap,
  restaurants: SearchResultRestaurant[],
  selectedId: string | null,
  onSelectRef: React.MutableRefObject<(r: SearchResultRestaurant) => void>,
  markersRef: React.MutableRefObject<Marker[]>,
  onSelectClusterRef: React.MutableRefObject<((rs: SearchResultRestaurant[]) => void) | undefined>
) {
  for (const m of markersRef.current) m.remove();
  markersRef.current = [];

  // 36 rather than 50: on a London high street the difference is a screen of
  // reachable pins instead of one number you have to tap through.
  const index = new Supercluster<ClusterProps>({ radius: 36, maxZoom: 18 });
  index.load(
    restaurants.map((r) => ({
      type: 'Feature',
      properties: { restaurant: r },
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    }))
  );

  const bounds = map.getBounds();
  const bbox: [number, number, number, number] = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ];
  const zoom = Math.round(map.getZoom());
  const clusters = index.getClusters(bbox, zoom);

  for (const feature of clusters) {
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties as ClusterProps & { cluster?: boolean; point_count?: number; cluster_id?: number };
    const isCluster = Boolean(props.cluster);

    if (isCluster) {
      const count = props.point_count!;
      const size = count < 10 ? 34 : count < 30 ? 40 : 48;
      const el = document.createElement('button');
      el.type = 'button';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = '50%';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
      el.style.background = '#0F252B';
      el.style.color = 'white';
      el.style.fontFamily = 'inherit';
      el.style.fontSize = '13px';
      el.style.fontWeight = '700';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.textContent = String(count);
      el.addEventListener('click', () => {
        const expansionZoom = Math.min(index.getClusterExpansionZoom(props.cluster_id!), 20);
        // Places stacked on one address (a food court, a parade of shops) never
        // separate however far you zoom. Rather than leave a number that does
        // nothing when tapped, hand the list to whoever asked for it.
        const stuck = expansionZoom <= map.getZoom() + 0.25 || map.getZoom() >= 17.5;
        if (stuck && onSelectClusterRef.current) {
          const leaves = index.getLeaves(props.cluster_id!, 40) as unknown as { properties: ClusterProps }[];
          onSelectClusterRef.current(leaves.map((l) => l.properties.restaurant!).filter(Boolean));
          return;
        }
        map.easeTo({ center: [lng, lat], zoom: expansionZoom, duration: 350 });
      });

      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      // MapLibre stamps its own generic 'Map marker' label on the element it is
      // handed, so ours has to be written back afterwards, otherwise every pin
      // and cluster on the map announces the identical name.
      el.setAttribute('aria-label', `${count} restaurants in this area. Tap to see them`);
      markersRef.current.push(marker);
      continue;
    }

    const restaurant = props.restaurant!;
    const isSelected = restaurant.id === selectedId;
    // The visible dot stays small so a dense high street stays readable, but the
    // button around it is 40px: a 22px tap target is a coin-flip on a phone.
    // 40 rather than 44 because these boxes overlap each other, and an oversized
    // one swallows the drag gesture used to pan the map.
    const size = isSelected ? 30 : 22;
    const el = document.createElement('button');
    el.type = 'button';
    el.title = restaurant.name;
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.background = 'transparent';
    el.style.border = 'none';
    el.style.padding = '0';
    el.style.cursor = 'pointer';
    el.style.zIndex = isSelected ? '10' : '1';

    const dot = document.createElement('span');
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.borderRadius = '50%';
    dot.style.border = '2.5px solid white';
    dot.style.boxShadow = isSelected ? '0 2px 8px rgba(0,0,0,.45)' : '0 1px 4px rgba(0,0,0,.35)';
    const status = statusOf(restaurant);
    // A place not checked yet is a ring, so the eye finds places with evidence first.
    if (status === 'unknown') {
      dot.style.background = '#fff';
      dot.style.border = `3px solid ${HALAL_DOT_COLOR.unknown}`;
    } else {
      dot.style.background = HALAL_DOT_COLOR[status];
    }
    dot.style.transition = 'width 150ms ease, height 150ms ease';
    el.appendChild(dot);

    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onSelectRef.current(restaurant);
    });

    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    el.setAttribute('aria-label', `${restaurant.name}, ${HALAL_PIN_LABEL[statusOf(restaurant)]}`);
    markersRef.current.push(marker);
  }
}
