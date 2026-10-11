// What the /yes and /stop pages do (lib/outreach/actions.ts) against a fake
// database: a yes is saved before anything goes on the owner's page, taking
// it back removes what it added, and a stop that could not be saved is never
// reported as saved. Nothing here touches the network or the live database.
//
//   node scripts/outreach/tests/yes.test.cjs
//
// It uses harness.cjs: the real files compiled with their imports pointed at
// small stubs, and a fake database.
const path = require('path');
const assert = require('assert');
const { compile, makeDb } = require('./harness.cjs');

const OUT = compile(
  {
    actions: 'lib/outreach/actions.ts',
    data: 'lib/outreach/data.ts',
    words: 'lib/outreach/words.ts',
    price: 'lib/price.ts',
  },
  {
    'next/cache': './stub-next-cache',
    'next/navigation': './stub-next-navigation',
    '@/lib/notify': './stub-notify',
    '@/lib/site': './stub-site',
    '@/lib/price': './price',
    '@/lib/supabase/server': './stub-supabase-server',
    '@/lib/deals/db': './stub-db',
    './content': './stub-content',
  },
  {
    'stub-next-cache': 'exports.revalidatePath = () => {};',
    'stub-next-navigation': `exports.redirect = (url) => {
       const e = new Error('NEXT_REDIRECT');
       e.url = url;
       throw e;
     };`,
    'stub-notify': `exports.sendThroughResend = async (email) => {
       global.__sent.push({ to: email.to[0], subject: email.subject });
       return { ok: true, id: 're_' + global.__sent.length };
     };
     exports.notifyInbox = async (n) => { global.__inbox.push(n.subject); };`,
    'stub-site': "exports.SITE_URL = 'https://yepitshalal.com'; exports.INBOX = 'hello@yepitshalal.com';",
    'stub-supabase-server': 'exports.createServerSupabase = () => ({ auth: { getUser: async () => ({ data: { user: null } }) } });',
    'stub-db': 'exports.dealsDb = () => global.__db;',
    'stub-content': 'exports.removeOwnerContent = async (db, id) => { global.__removed.push(id); return global.__removeOk; };',
  }
);
const { sayYes, sayNo, takeBack, stopFromPage } = require(path.join(OUT, 'actions.js'));

const TOKEN = 'a'.repeat(32);
function fixtures() {
  return {
    outreach_contacts: [
      { id: 'c1', restaurant_id: 'r1', brand_id: null, email: 'owner@example.com', phone: null, status: 'sent', token: TOKEN, answered_at: null },
    ],
    restaurants: [{ id: 'r1', name: 'Place One', slug: 'place-one', price_range: null, menu_url: null }],
    restaurant_photos: [],
    content_permissions: [],
    outreach_stop_list: [],
  };
}
function yesForm(extra = {}) {
  const f = new FormData();
  const fields = { agree: 'on', name: 'Amina Khan', role: 'owner', email: 'amina@example.com', price_range: '2', menu_url: 'https://place-one.example.com/menu', ...extra };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

async function check(name, tables, failIf, run, verify) {
  global.__db = makeDb(tables, failIf);
  global.__sent = [];
  global.__inbox = [];
  global.__removed = [];
  global.__removeOk = global.__nextRemoveOk ?? true;
  global.__nextRemoveOk = undefined;
  let out;
  let thrown = null;
  try {
    out = await run();
  } catch (e) {
    thrown = e;
  }
  try {
    verify(out, tables, thrown);
    console.log('PASS', name);
  } catch (e) {
    console.log('FAIL', name, '\n  ', e.message, thrown ? `\n   threw: ${thrown.message}` : '');
    process.exitCode = 1;
  }
}
const ok = () => null;

(async () => {
  await check('a yes is saved and puts the price and menu on the page', fixtures(), ok, () => sayYes(TOKEN, {}, yesForm()), (out, t) => {
    assert.deepStrictEqual(out, {});
    assert.strictEqual(t.content_permissions.length, 1);
    assert.deepStrictEqual(t.content_permissions[0].extras.applied, { price_range: true, menu_url: true });
    assert.strictEqual(t.restaurants[0].price_range, 2);
    assert.strictEqual(t.restaurants[0].price_range_source, 'owner');
    assert.strictEqual(t.restaurants[0].menu_url, 'https://place-one.example.com/menu');
    assert.strictEqual(t.outreach_contacts[0].status, 'said_yes');
    assert.strictEqual(global.__sent.length, 1, 'a thank you email');
  });

  await check(
    'a yes that could not be saved leaves the page as it was',
    fixtures(),
    (q) => (q.table === 'content_permissions' && q.op === 'insert' ? 'boom' : null),
    () => sayYes(TOKEN, {}, yesForm()),
    (out, t) => {
      assert.match(out.error, /Something went wrong/);
      assert.strictEqual(t.restaurants[0].price_range, null);
      assert.strictEqual(t.restaurants[0].menu_url, null);
      assert.strictEqual(t.outreach_contacts[0].status, 'sent');
      assert.strictEqual(global.__sent.length, 0, 'no thank you email');
    }
  );

  {
    const t = fixtures();
    t.restaurants[0].menu_url = 'https://already.example.com/menu';
    await check('a menu link already there is kept, and the yes says so', t, ok, () => sayYes(TOKEN, {}, yesForm()), (out, t2) => {
      assert.strictEqual(t2.restaurants[0].menu_url, 'https://already.example.com/menu');
      assert.strictEqual(t2.content_permissions[0].extras.applied.menu_url, false);
      assert.strictEqual(t2.content_permissions[0].extras.applied.price_range, true);
    });
  }

  {
    // Say yes, then take it back: the menu link we added comes off, and they are stopped.
    const t = fixtures();
    await check('setup: yes', t, ok, () => sayYes(TOKEN, {}, yesForm()), (out) => assert.deepStrictEqual(out, {}));
    await check('taking the yes back removes what it added and stops emails', t, ok, () => takeBack(TOKEN), (out, t2) => {
      assert.ok(t2.content_permissions[0].withdrawn_at, 'withdrawn');
      assert.strictEqual(t2.restaurants[0].menu_url, null);
      assert.deepStrictEqual(global.__removed, [t2.content_permissions[0].id]);
      assert.strictEqual(t2.outreach_stop_list.length, 1);
      assert.strictEqual(t2.outreach_stop_list[0].reason, 'said_no');
      assert.strictEqual(t2.outreach_contacts[0].status, 'said_no');
      assert.match(global.__inbox[0], /Delete our posts by/);
    });
  }

  {
    // The same, but some of their photos would not come off: the inbox must not say they did.
    const t = fixtures();
    await check('setup: yes', t, ok, () => sayYes(TOKEN, {}, yesForm()), (out) => assert.deepStrictEqual(out, {}));
    global.__nextRemoveOk = false;
    await check('a take-back whose photos would not all come off says so', t, ok, () => takeBack(TOKEN), (out, t2) => {
      assert.match(global.__inbox[0], /Some photos are still on the site/);
      assert.ok(t2.content_permissions[0].withdrawn_at, 'still withdrawn');
      assert.strictEqual(t2.outreach_stop_list.length, 1, 'still stopped');
    });
  }

  await check('no thanks puts them on the stop list', fixtures(), ok, () => sayNo(TOKEN), (out, t) => {
    assert.strictEqual(t.outreach_stop_list.length, 1);
    assert.strictEqual(t.outreach_contacts[0].status, 'said_no');
  });

  await check('the stop page saves a stop', fixtures(), ok, () => stopFromPage(TOKEN), (out, t, thrown) => {
    assert.strictEqual(thrown, null);
    assert.strictEqual(t.outreach_stop_list.length, 1);
    assert.strictEqual(t.outreach_stop_list[0].reason, 'stop_link');
    assert.strictEqual(t.outreach_contacts[0].status, 'stopped');
  });

  await check(
    'a stop that could not be saved goes back to the page with a message, never "Done"',
    fixtures(),
    (q) => (q.table === 'outreach_stop_list' && q.op === 'insert' ? 'boom' : null),
    () => stopFromPage(TOKEN),
    (out, t, thrown) => {
      assert.ok(thrown, 'it did not carry on as if saved');
      assert.strictEqual(thrown.url, `/stop/${TOKEN}?failed=1`);
      assert.strictEqual(t.outreach_stop_list.length, 0);
    }
  );

  await check(
    'a contact that could not be read is not taken for an unknown link',
    fixtures(),
    (q) => (q.table === 'outreach_contacts' && q.op === 'select' ? 'boom' : null),
    () => stopFromPage(TOKEN),
    (out, t, thrown) => {
      assert.ok(thrown && thrown.url, 'sent back with a message');
      assert.match(thrown.url, /failed=1/);
    }
  );

  {
    // Already on the list by this address: the unique index answers 23505, which is fine.
    const t = fixtures();
    await check(
      'already on the stop list counts as saved',
      t,
      (q) => (q.table === 'outreach_stop_list' && q.op === 'insert' ? { message: 'duplicate key', code: '23505' } : null),
      () => stopFromPage(TOKEN),
      (out, t2, thrown) => {
        assert.strictEqual(thrown, null);
        assert.strictEqual(t2.outreach_contacts[0].status, 'stopped');
      }
    );
  }
})();
