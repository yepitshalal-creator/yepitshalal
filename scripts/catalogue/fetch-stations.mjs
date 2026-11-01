// London's stations from OpenStreetMap, saved as lib/data/london-stations.json
// for the "Nearest station" line on a place's page (lib/nearestStation.ts).
//
//   node scripts/catalogue/fetch-stations.mjs
//
// The idea comes from HalalaGo (halalago.co.uk, read 2026-11-01), whose
// listings name the nearest Tube. Stations hardly change, so the site never
// asks OpenStreetMap at page time: this file is fetched by hand now and then,
// and the site reads the copy. OpenStreetMap is one of the vault's compliant
// sources ("Only compliant data sources"); the data is ODbL, credited as
// "© OpenStreetMap contributors".
//
// One Overpass query for every node tagged railway=station (or a
// public_transport=station without it) inside Greater London. Overpass is
// often at capacity: the script waits and tries again, doubling the wait each
// time, across two servers, and gives up after about half an hour.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const UA = 'YepItsHalalBot/1.0 (+https://yepitshalal.com; nearest station on place pages)';
const QUERY = `[out:json][timeout:90];
area["name"="Greater London"]["boundary"="administrative"]["admin_level"="5"]->.a;
(node["railway"="station"](area.a);node["public_transport"="station"]["railway"!="station"](area.a););
out body;`;
const OUT = fileURLToPath(new URL('../../lib/data/london-stations.json', import.meta.url));
// Two nodes with the same name this close are one station (an Underground
// node and a rail node, say).
const SAME_STATION_M = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask() {
  let wait = 30_000;
  for (let attempt = 0; attempt < 12; attempt++) {
    const url = SERVERS[attempt % SERVERS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(150_000),
      });
      if (res.ok) return await res.json();
      console.log(`${new URL(url).host} answered ${res.status}; waiting ${wait / 1000}s`);
    } catch (e) {
      console.log(`${new URL(url).host}: ${e.message}; waiting ${wait / 1000}s`);
    }
    await sleep(wait);
    wait = Math.min(wait * 2, 300_000);
  }
  throw new Error('Overpass stayed busy. Try again later.');
}

function metres(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Every kind of train that stops here, in the words Londoners use. A big
 *  station is one node with several networks ("London Underground;Elizabeth
 *  line;National Rail"), so all of them count, not just the first. */
function kindsOf(tags) {
  const net = `${tags.network ?? ''} ${tags.operator ?? ''} ${tags.line ?? ''}`;
  const kinds = [];
  if (tags.station === 'subway' || /london underground/i.test(net)) kinds.push('Underground');
  if (/elizabeth line/i.test(net)) kinds.push('Elizabeth line');
  if (/overground/i.test(net)) kinds.push('Overground');
  if (/docklands light railway|\bdlr\b/i.test(net) || tags.station === 'light_rail') kinds.push('DLR');
  if (/tramlink/i.test(net) || tags.station === 'tram') kinds.push('Tram');
  if (!kinds.length || /national rail/i.test(net)) kinds.push('Rail');
  return kinds;
}

/** A place where a train stops for anyone with a ticket. Not a pier, a bus
 *  station, a heritage line or one still being built. */
function isTrainStation(tags) {
  if (tags.disused || tags['disused:railway'] || tags.railway === 'disused_station' || tags.construction) return false;
  if (tags.usage === 'tourism' || tags['railway:preserved'] === 'yes' || tags.station === 'miniature') return false;
  if (tags.railway === 'station') return true;
  return ['train', 'subway', 'light_rail', 'tram'].some((k) => tags[k] === 'yes');
}

// The order a station's kinds are listed in: the Tube first, plain rail last.
const ORDER = ['Underground', 'Elizabeth line', 'Overground', 'DLR', 'Tram', 'Rail'];

const body = await ask();
const found = [];
for (const e of body.elements ?? []) {
  const name = (e.tags?.name ?? '').trim();
  if (!name || typeof e.lat !== 'number' || !isTrainStation(e.tags)) continue;
  const at = { lat: e.lat, lng: e.lon };
  const kinds = kindsOf(e.tags);
  const same = found.find((s) => s.name === name && metres(s, at) < SAME_STATION_M);
  if (same) {
    for (const k of kinds) if (!same.kinds.includes(k)) same.kinds.push(k);
    continue;
  }
  found.push({ name, ...at, kinds });
}
for (const s of found) s.kinds.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
found.sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));

mkdirSync(new URL('../../lib/data/', import.meta.url), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: '© OpenStreetMap contributors, ODbL. scripts/catalogue/fetch-stations.mjs',
      fetched: new Date().toISOString().slice(0, 10),
      // [name, lat, lng, kinds]
      stations: found.map((s) => [s.name, Number(s.lat.toFixed(6)), Number(s.lng.toFixed(6)), s.kinds]),
    },
    null,
    0
  ) + '\n'
);
console.log(`${found.length} stations from ${body.elements?.length ?? 0} OSM nodes, written to ${OUT}`);
