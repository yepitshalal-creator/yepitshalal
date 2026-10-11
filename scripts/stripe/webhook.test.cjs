// The Stripe webhook (app/api/webhooks/stripe/route.ts) against a fake Stripe
// and a fake database: a supporter, a paid priority check, a refund and a deal
// top up are each recorded once, and a write that fails answers 500 so Stripe
// sends the event again. No real payment, no network, no live database: the
// account is live only, so it is never tested by paying.
//
//   node scripts/stripe/webhook.test.cjs
//
// It uses scripts/tests/harness.cjs: the real files compiled with their
// imports pointed at small stubs, and a fake database.
const path = require('path');
const assert = require('assert');
const { compile, makeDb } = require('../tests/harness.cjs');

const OUT = compile(
  {
    route: 'app/api/webhooks/stripe/route.ts',
    'stripe-events': 'lib/deals/stripe-events.ts',
    workingHours: 'lib/workingHours.ts',
  },
  {
    'next/server': './stub-next-server',
    stripe: './stub-stripe-types',
    '@/lib/stripe': './stub-stripe',
    '@/lib/supabase/admin': './stub-admin',
    '@/lib/workingHours': './workingHours',
    '@/lib/deals/stripe-events': './stripe-events',
    '@/lib/deals/db': './stub-deals-db',
  },
  {
    'stub-next-server': 'exports.NextResponse = { json: (body, init) => ({ body, status: (init && init.status) || 200 }) };',
    'stub-stripe-types': 'module.exports = {};',
    // constructEvent trusts the body: the signature check is Stripe's own code.
    'stub-stripe': `exports.getStripe = () => ({
       webhooks: { constructEvent: (body) => JSON.parse(body) },
       subscriptions: { retrieve: async (id) => global.__subscriptions[id] },
       checkout: { sessions: { list: async () => ({ data: global.__sessions }) } },
     });`,
    'stub-admin': 'exports.createAdminSupabase = () => global.__db;',
    'stub-deals-db': 'exports.dealsDb = () => ({ rpc: (fn, args) => global.__rpc(fn, args) });',
  }
);
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_only';
const { POST } = require(path.join(OUT, 'route.js'));

const deliver = (event) =>
  POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: JSON.stringify(event), headers: { 'stripe-signature': 't=1,v1=test' } }));

const SUB = {
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  created: 1791700000,
  metadata: { yepitshalal_user_id: 'user-1' },
  items: { data: [{ price: { recurring: { interval: 'month' } }, current_period_end: 1794300000 }] },
};
const supporterPaid = { type: 'checkout.session.completed', data: { object: { id: 'cs_sub', mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', metadata: { yepitshalal_user_id: 'user-1' } } } };
const priorityPaid = {
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_pri', mode: 'payment', metadata: { yepitshalal_type: 'priority_verification', restaurant_id: 'r1', contact_name: 'Amina', contact_email: 'amina@example.com' } } },
};
const priorityRefunded = { type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', metadata: {}, amount_refunded: 2500 } } };
const dealTopUp = {
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_deal', mode: 'payment', payment_status: 'paid', currency: 'gbp', amount_total: 2500, metadata: { yepitshalal_type: 'deal_credit', restaurant_id: '11111111-1111-4111-8111-111111111111' } } },
};

function fresh() {
  return { users: [{ id: 'user-1', is_yep_plus: false }], subscriptions: [], verification_requests: [], uk_bank_holidays: [] };
}

async function check(name, steps, tables = fresh()) {
  global.__subscriptions = { sub_1: SUB };
  global.__sessions = [{ id: 'cs_pri' }];
  global.__rpcCalls = [];
  try {
    for (const [event, failIf, expect] of steps) {
      global.__db = makeDb(tables, failIf);
      global.__rpc = async (fn, args) => {
        global.__rpcCalls.push(fn);
        const err = failIf({ table: `rpc:${fn}`, op: 'rpc', keys: [], opts: {} });
        return err ? { data: null, error: { message: err } } : { data: { posted: global.__rpcCalls.length === 1 }, error: null };
      };
      const res = await deliver(event);
      expect(res, tables);
    }
    console.log('PASS', name);
  } catch (e) {
    console.log('FAIL', name, '\n  ', e.message);
    process.exitCode = 1;
  }
}
const ok = () => null;
const status = (n) => (res) => assert.strictEqual(res.status, n, JSON.stringify(res.body));

(async () => {
  await check('a supporter is recorded and gets their perks', [
    [
      supporterPaid,
      ok,
      (res, t) => {
        status(200)(res);
        assert.strictEqual(t.subscriptions.length, 1);
        assert.strictEqual(t.subscriptions[0].status, 'active');
        assert.strictEqual(t.users[0].is_yep_plus, true);
      },
    ],
  ]);

  await check('the supporter write fails: 500, and the retry records them once', [
    [
      supporterPaid,
      (q) => (q.table === 'subscriptions' ? 'boom' : null),
      (res, t) => {
        status(500)(res);
        assert.strictEqual(t.users[0].is_yep_plus, false);
      },
    ],
    [
      supporterPaid,
      ok,
      (res, t) => {
        status(200)(res);
        assert.strictEqual(t.subscriptions.length, 1);
        assert.strictEqual(t.users[0].is_yep_plus, true);
      },
    ],
  ]);

  await check('the perks flag fails: 500, so the retry sets it', [
    [supporterPaid, (q) => (q.table === 'users' ? 'boom' : null), status(500)],
    [supporterPaid, ok, (res, t) => assert.strictEqual(t.users[0].is_yep_plus, true)],
  ]);

  await check('a paid priority check goes in the queue once, however often Stripe sends it', [
    [priorityPaid, ok, (res, t) => (status(200)(res), assert.strictEqual(t.verification_requests.length, 1))],
    [priorityPaid, ok, (res, t) => (status(200)(res), assert.strictEqual(t.verification_requests.length, 1))],
  ]);

  await check('the queue write fails: 500, and the retry queues it once', [
    [priorityPaid, (q) => (q.table === 'verification_requests' && q.op === 'insert' ? 'boom' : null), (res, t) => (status(500)(res), assert.strictEqual(t.verification_requests.length, 0))],
    [priorityPaid, ok, (res, t) => (status(200)(res), assert.strictEqual(t.verification_requests.length, 1))],
  ]);

  await check('the lookup before queueing fails: 500, nothing queued twice', [
    [priorityPaid, (q) => (q.table === 'verification_requests' && q.op === 'select' ? 'boom' : null), (res, t) => (status(500)(res), assert.strictEqual(t.verification_requests.length, 0))],
  ]);

  await check('a refund is noted on the check, and a failed note answers 500', [
    [priorityPaid, ok, status(200)],
    [priorityRefunded, (q) => (q.table === 'verification_requests' && q.op === 'update' ? 'boom' : null), status(500)],
    [priorityRefunded, ok, (res, t) => (status(200)(res), assert.strictEqual(t.verification_requests[0].refund_status, 'issued'))],
  ]);

  await check('a deal top up posts, and a failed post answers 500', [
    [dealTopUp, (q) => (q.table === 'rpc:post_deal_topup' ? 'boom' : null), status(500)],
    [dealTopUp, ok, status(200)],
  ]);
})();
