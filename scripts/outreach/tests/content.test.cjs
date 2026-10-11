// Taking an owner's photos off the site when they take their yes back
// (removeOwnerContent in lib/outreach/content.ts), against a fake database
// and file store: it says all is off only when it is, and whatever failed is
// finished by running it again. Nothing here touches the network or the live
// database.
//
//   node scripts/outreach/tests/content.test.cjs
const path = require('path');
const assert = require('assert');
const { compile, makeDb } = require('../../tests/harness.cjs');

const OUT = compile(
  { content: 'lib/outreach/content.ts', data: 'lib/outreach/data.ts' },
  { '@/lib/site': './stub-site', '@/lib/deals/db': './stub-db' },
  {
    'stub-site': "exports.SITE_URL = 'https://yepitshalal.com'; exports.INBOX = 'hello@yepitshalal.com';",
    'stub-db': 'exports.dealsDb = () => global.__db;',
  }
);
const { publishOwnerPhoto, removeOwnerContent } = require(path.join(OUT, 'content.js'));

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

  // Publishing one photo from a chain's head office to both its branches.
  const chain = () => ({
    restaurants: [
      { id: 'r1', name: 'Branch One', slug: 'branch-one', brand_id: 'b1', is_searchable: true, website_url: 'https://chain.example.com' },
      { id: 'r2', name: 'Branch Two', slug: 'branch-two', brand_id: 'b1', is_searchable: true, website_url: 'https://chain.example.com' },
    ],
    restaurant_photos: [
      { id: 'lead1', restaurant_id: 'r1', storage_path: PUBLIC + 'representative/a.jpg', is_logo: false, is_primary: true, created_at: '2026-09-01' },
      { id: 'lead2', restaurant_id: 'r2', storage_path: PUBLIC + 'representative/b.jpg', is_logo: false, is_primary: true, created_at: '2026-09-01' },
    ],
    owner_uploads: [
      { id: 'u3', permission_id: 'p3', restaurant_id: null, brand_id: 'b1', kind: 'photo', paths: { card: 'p3/u3/card.webp', thumb: 'p3/u3/thumb.webp' }, status: 'waiting', photo_ids: [] },
    ],
    'storage:owner-uploads': ['p3/u3/card.webp', 'p3/u3/thumb.webp'],
    'storage:restaurant-photos': ['representative/a.jpg', 'representative/b.jpg'],
  });
  const leads = (t) => t.restaurant_photos.filter((p) => p.is_primary).map((p) => p.id).sort();
  async function publish(name, failIf, verify) {
    const t = chain();
    global.__db = makeDb(t, failIf);
    let ids = null;
    let thrown = null;
    try {
      ids = await publishOwnerPhoto(global.__db, t.owner_uploads[0]);
    } catch (e) {
      thrown = e;
    }
    try {
      verify(t, ids, thrown);
      console.log('PASS', name);
    } catch (e) {
      console.log('FAIL', name, '\n  ', e.message, thrown ? `\n   threw: ${thrown.message}` : '');
      process.exitCode = 1;
    }
    return t;
  }

  const published = await publish('a chain photo goes on both branches and is recorded', ok, (t, ids, thrown) => {
    assert.strictEqual(thrown, null);
    assert.strictEqual(ids.length, 2);
    assert.deepStrictEqual(leads(t), ids.slice().sort(), 'their photo leads on both pages');
    assert.strictEqual(t.owner_uploads[0].status, 'published');
    assert.deepStrictEqual(t.owner_uploads[0].photo_ids, ids);
  });
  // And taking the yes back later finds both rows through that record.
  global.__db = makeDb(published, ok);
  try {
    assert.strictEqual(await removeOwnerContent(global.__db, 'p3'), true);
    assert.deepStrictEqual(published.restaurant_photos.map((p) => p.id).sort(), ['lead1', 'lead2']);
    assert.deepStrictEqual(leads(published), ['lead1', 'lead2']);
    console.log('PASS taking the yes back takes it off both branches and gives the leads back');
  } catch (e) {
    console.log('FAIL taking the yes back takes it off both branches\n  ', e.message);
    process.exitCode = 1;
  }

  await publish(
    'the second branch fails: nothing stays up, both pages get their lead back',
    (q) => (q.table === 'restaurant_photos' && q.op === 'insert' && q.patch.restaurant_id === 'r2' ? 'boom' : null),
    (t, ids, thrown) => {
      assert.ok(thrown, 'it says it failed');
      assert.match(thrown.message, /not on their page/);
      assert.deepStrictEqual(t.restaurant_photos.map((p) => p.id).sort(), ['lead1', 'lead2']);
      assert.deepStrictEqual(leads(t), ['lead1', 'lead2']);
      assert.strictEqual(t.owner_uploads[0].status, 'waiting');
    }
  );

  await publish(
    'the record would not save: nothing stays up that a take-back could not find',
    (q) => (q.table === 'owner_uploads' && q.op === 'update' ? 'boom' : null),
    (t, ids, thrown) => {
      assert.ok(thrown, 'it says it failed');
      assert.deepStrictEqual(t.restaurant_photos.map((p) => p.id).sort(), ['lead1', 'lead2']);
      assert.deepStrictEqual(leads(t), ['lead1', 'lead2']);
      assert.strictEqual(t.owner_uploads[0].status, 'waiting');
    }
  );
})();
