// The "Nearest station" line on a place's page (lib/nearestStation.ts): the
// closest station within reach, the distance in plain words, and nothing at
// all when no station is close. Pure functions over a small made-up list, plus
// one look at the real file. No network.
//
//   node scripts/site/nearest-station.test.cjs
const path = require('path');
const assert = require('assert');
const { compile } = require('../tests/harness.cjs');

// The compiled file sits outside the project, so the station list is
// required by its full path.
const JSON_PATH = path.join(__dirname, '../../lib/data/london-stations.json').split(path.sep).join('/');
const OUT = compile({ station: 'lib/nearestStation.ts' }, { './data/london-stations.json': JSON_PATH }, {});
const { nearestStation, distanceWords, stationWords } = require(path.join(OUT, 'station.js'));

// About 111 m per 0.001 degrees of latitude.
const LIST = [
  ['Near', 51.501, -0.1, ['Underground']],
  ['Further', 51.505, -0.1, ['Rail']],
];

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

check('the closest station wins', () => {
  const s = nearestStation(51.5, -0.1, LIST);
  assert.strictEqual(s.name, 'Near');
  assert.ok(s.metres > 100 && s.metres < 120, String(s.metres));
});

check('nothing is shown when no station is close', () => {
  assert.strictEqual(nearestStation(51.6, -0.1, LIST), null);
  assert.strictEqual(nearestStation(NaN, -0.1, LIST), null);
});

check('distances read plainly', () => {
  assert.strictEqual(distanceWords(40), 'under 100 m away');
  assert.strictEqual(distanceWords(312), 'about 300 m away');
  assert.strictEqual(distanceWords(980), 'about 1 km away');
  assert.strictEqual(distanceWords(1240), 'about 1.2 km away');
});

check('names say Tube, two kinds at most, and never double brackets', () => {
  assert.strictEqual(stationWords({ name: 'Royal Oak', metres: 1, kinds: ['Underground'] }), 'Royal Oak (Tube)');
  assert.strictEqual(stationWords({ name: 'Brixton', metres: 1, kinds: ['Rail'] }), 'Brixton');
  assert.strictEqual(
    stationWords({ name: 'Stratford', metres: 1, kinds: ['Underground', 'Elizabeth line', 'Overground', 'DLR', 'Rail'] }),
    'Stratford (Tube, Elizabeth line)'
  );
  assert.strictEqual(
    stationWords({ name: 'Hammersmith (District and Piccadilly lines)', metres: 1, kinds: ['Underground'] }),
    'Hammersmith (District and Piccadilly lines)'
  );
});

check('the real file has London in it', () => {
  const s = nearestStation(51.5154, -0.1755); // by Paddington
  assert.ok(s && /Paddington/.test(s.name), JSON.stringify(s));
});

console.log(`\n${passed} of ${passed} passed`);
