// Taking an owner's photos off the site when they take their yes back
// (removeOwnerContent in lib/outreach/content.ts), against a fake database
// and file store: it says all is off only when it is, and whatever failed is
// finished by running it again. Nothing here touches the network or the live
// database.
//
//   node scripts/outreach/tests/content.test.cjs
const path = require('path');
const assert = require('assert');
const { compile, makeDb } = require('./harness.cjs');

const OUT = compile(
  { content: 'lib/outreach/content.ts', data: 'lib/outreach/data.ts' },
  { '@/lib/site': './stub-site', '@/lib/deals/db': './stub-db' },
  {
    'stub-site': "exports.SITE_URL = 'https://yepitshalal.com'; exports.INBOX = 'hello@yepitshalal.com';",
    'stub-db': 'exports.dealsDb = () => global.__db;',
  }
);
const { removeOwnerContent } = require(path.join(OUT, 'content.js'));

const PUBLIC = 'https://example.supabase.co/storage/v1/object/public/restaurant-photos/';
function fixtures() {
  return {
    owner_uploads: [
      {
        id: 'u1',
        permission_id: 'p1',
        restaurant_id: 'r1',
        brand_id: null,
        kind: 'photo',
        paths: { card: 'p1/u1-card.webp', thumb: 'p1/u1-thumb.webp', full: 'p1/u1-full.webp' },
        status: 'published',
        photo_ids: ['ph1'],
      },
      { id: 'u2', permission_id: 'p1', restaurant_id: 'r1', brand_id: null, kind: 'video', paths: { video: 'p1/u2.mp4' }, status: 'kept', photo_ids: [] },
    ],
    restaurant_photos: [
      { id: 'ph0', restaurant_id: 'r1', storage_path: PUBLIC + 'representative/kebab.jpg', is_primary: false, created_at: '2026-09-01' },
      { id: 'ph1', restaurant_id: 'r1', storage_path: PUBLIC + 'owner/r1/u1.webp', is_primary: true, created_at: '2026-10-01' },
    ],
    'storage:restaurant-photos': ['owner/r1/u1.webp', 'thumb/owner/r1/u1.webp', 'representative/kebab.jpg'],
    'storage:owner-uploads': ['p1/u1-card.webp', 'p1/u1-thumb.webp', 'p1/u1-full.webp', 'p1/u2.mp4'],
  };
}
function allOff(t) {
  assert.deepStrictEqual(t.restaurant_photos.map((p) => p.id), ['ph0']);
  assert.strictEqual(t.restaurant_photos[0].is_primary, true, 'the page keeps a lead photo');
  assert.deepStrictEqual(t['storage:restaurant-photos'], ['representative/kebab.jpg']);
  assert.deepStrictEqual(t['storage:owner-uploads'], []);
  assert.deepStrictEqual(t.owner_uploads.map((u) => u.status), ['removed', 'removed']);
}

async function check(name, steps) {
  const t = fixtures();
  try {
    for (const [failIf, expect] of steps) {
      global.__db = makeDb(t, failIf);
      const off = await removeOwnerContent(global.__db, 'p1');
      expect(off, t);
    }
    console.log('PASS', name);
  } catch (e) {
    console.log('FAIL', name, '\n  ', e.message);
    process.exitCode = 1;
  }
}
const ok = () => null;
const done = (off, t) => {
  assert.strictEqual(off, true);
  allOff(t);
};

(async () => {
  await check('everything comes off and it says so', [[ok, done]]);

  await check('the public files would not delete: not off, the photo stays listed, a second run finishes', [
    [
      (q) => (q.table === 'storage:restaurant-photos' ? 'boom' : null),
      (off, t) => {
        assert.strictEqual(off, false);
        assert.ok(t.restaurant_photos.some((p) => p.id === 'ph1'), 'the row still says where the files are');
        assert.strictEqual(t.owner_uploads[0].status, 'published');
      },
    ],
    [ok, done],
  ]);

  await check('the photo row would not delete: not off, a second run finishes', [
    [
      (q) => (q.table === 'restaurant_photos' && q.op === 'delete' ? 'boom' : null),
      (off, t) => {
        assert.strictEqual(off, false);
        assert.strictEqual(t.owner_uploads[0].status, 'published');
      },
    ],
    [ok, done],
  ]);

  await check('the private files would not delete: not off, not marked removed, a second run finishes', [
    [
      (q) => (q.table === 'storage:owner-uploads' ? 'boom' : null),
      (off, t) => {
        assert.strictEqual(off, false);
        assert.deepStrictEqual(t.owner_uploads.map((u) => u.status), ['published', 'kept']);
      },
    ],
    [ok, done],
  ]);

  await check('the uploads could not be read: not off', [
    [
      (q) => (q.table === 'owner_uploads' && q.op === 'select' ? 'boom' : null),
      (off) => assert.strictEqual(off, false),
    ],
  ]);

  await check('running it again after all is off changes nothing and still says off', [
    [ok, done],
    [ok, done],
  ]);
})();
