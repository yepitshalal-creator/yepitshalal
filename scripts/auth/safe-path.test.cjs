// Where the sign-in callback may send someone (sameSitePath in
// lib/safePath.ts): only somewhere on this site, whatever `next` says.
//
//   node scripts/auth/safe-path.test.cjs
const path = require('path');
const assert = require('assert');
const { compile } = require('../tests/harness.cjs');

const OUT = compile({ safePath: 'lib/safePath.ts' }, {}, {});
const { sameSitePath } = require(path.join(OUT, 'safePath.js'));

const ORIGIN = 'https://yepitshalal.com';
const cases = [
  // Kept: paths on this site, with their query and hash.
  ['/yep-plus', '/yep-plus'],
  ['/restaurant/kenton-spice-8q97#claim', '/restaurant/kenton-spice-8q97#claim'],
  ['/search?lat=51.5&lng=-0.07', '/search?lat=51.5&lng=-0.07'],
  // Sent home: anything that would leave the site, or is not a path.
  ['@evil.com', '/'],
  ['.evil.com', '/'],
  ['//evil.com', '/'],
  ['/\\evil.com', '/'],
  ['https://evil.com', '/'],
  ['javascript:alert(1)', '/'],
  ['', '/'],
  [null, '/'],
];

let failed = 0;
for (const [next, expected] of cases) {
  const got = sameSitePath(next, ORIGIN);
  try {
    assert.strictEqual(got, expected);
    // Whatever comes back must also land on this site once the callback adds it.
    assert.strictEqual(new URL(`${ORIGIN}${got}`).origin, ORIGIN);
    console.log(`ok   ${JSON.stringify(next)} -> ${got}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${JSON.stringify(next)} -> ${got}`);
  }
}
console.log(`\n${cases.length - failed} of ${cases.length} passed`);
process.exit(failed ? 1 : 0);
