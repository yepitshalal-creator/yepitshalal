// The at-a-glance tiles on a place's page (lib/halalGlance.ts): each says only
// what the evidence says, unknown is never "No", and the unread word-match
// notes ("also mentions pork") are never shown. Pure functions, no network.
//
//   node scripts/site/glance.test.cjs
const path = require('path');
const assert = require('assert');
const { compile } = require('../tests/harness.cjs');

const OUT = compile({ glance: 'lib/halalGlance.ts' }, {}, {});
const { alcoholTile, certificateTile, halalTile, certifierIn } = require(path.join(OUT, 'glance.js'));

const ev = (o) => ({ id: 'e', kind: 'first_party_statement', claim: 'halal_options', strength: 'moderate', source_name: "The restaurant's website", source_url: null, excerpt: null, notes: null, checked_at: '2026-10-24', ...o });
const facts = (o) => ({ serves_alcohol: null, has_certification: null, certification_body: null, ...o });

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

check('nothing known says "Not known", never no', () => {
  for (const status of ['halal_options', 'unverified']) {
    assert.strictEqual(alcoholTile(status, null, []).value, 'Not known');
    assert.notStrictEqual(alcoholTile(status, null, []).tone, 'good');
  }
  assert.strictEqual(certificateTile(null, []).value, 'Not known');
});

check('an unread word match about pork never shows as alcohol or anything else', () => {
  const t = alcoholTile('halal_options', null, [ev({ notes: 'The same website also mentions pork.' })]);
  assert.strictEqual(t.value, 'Not known');
});

check('the alcohol pass notes show where they came from', () => {
  assert.deepStrictEqual(
    [alcoholTile('halal_options', null, [ev({ notes: 'The same website also mentions alcohol.' })]).value],
    ['Mentioned']
  );
  assert.strictEqual(alcoholTile('halal_options', null, [ev({ notes: 'The website says diners may bring their own alcohol.' })]).value, 'Bring your own');
});

check('Fully Halal rules alcohol out, and says so from its own website when it can', () => {
  const site = alcoholTile('fully_halal', null, [ev({ claim: 'fully_halal', strength: 'strong' })]);
  assert.strictEqual(site.value, 'No sign of it');
  assert.strictEqual(site.source, 'On its website');
  const other = alcoholTile('fully_halal', null, [ev({ kind: 'certification', claim: 'fully_halal', strength: 'strong' })]);
  assert.strictEqual(other.source, 'Fully Halal rules it out');
});

check('our own check wins over anything a website says', () => {
  const t = alcoholTile('halal_options', facts({ serves_alcohol: false }), [ev({ notes: 'The same website also mentions alcohol.' })]);
  assert.strictEqual(t.value, 'Not served');
  assert.strictEqual(alcoholTile('fully_halal', facts({ serves_alcohol: true }), []).value, 'Served');
});

check('a certificate is only "Confirmed" from the certifier\'s own list', () => {
  assert.strictEqual(certificateTile(null, [ev({ kind: 'certification', claim: 'fully_halal', source_name: 'HMC' })]).value, 'Confirmed');
  const claim = certificateTile(null, [ev({ kind: 'certification_claim', claim: 'fully_halal', excerpt: 'We are HMC certified' })]);
  assert.strictEqual(claim.value, 'They say so');
  assert.strictEqual(claim.source, 'HMC, not checked');
  assert.strictEqual(certificateTile(facts({ has_certification: true }), []).value, 'They say so');
});

check('only HMC and HFA are named from a claim', () => {
  assert.strictEqual(certifierIn('Certified by the Halal Food Authority'), 'HFA');
  assert.strictEqual(certifierIn('halal monitoring committee approved'), 'HMC');
  assert.strictEqual(certifierIn('Certified halal by our supplier'), null);
  assert.strictEqual(certifierIn(null), null);
});

check('the halal tile follows the label', () => {
  assert.strictEqual(halalTile('fully_halal').value, 'All the meat');
  assert.strictEqual(halalTile('halal_options').value, 'Some of it');
  assert.strictEqual(halalTile('unverified').value, 'Not confirmed');
});

console.log(`\n${passed} of ${passed} passed`);
