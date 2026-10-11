// Recording a halal check (saveCheck in lib/admin/save-check.ts, and the two
// actions that call it), against a fake database: a failure part way never
// shows more than the newest check found, the older check comes back when the
// new one will not save, and the admin is told in words what saved and what
// did not. Nothing here touches the network or the live database.
//
//   node scripts/admin/check.test.cjs
const path = require('path');
const assert = require('assert');
const { compile, makeDb } = require('../tests/harness.cjs');

const OUT = compile(
  { 'save-check': 'lib/admin/save-check.ts', 'check-actions': 'lib/admin/check-actions.ts', 'admin-actions': 'lib/admin-actions.ts' },
  {
    'next/cache': './stub-next-cache',
    '@/lib/supabase/admin': './stub-supabase',
    './supabase/admin': './stub-supabase',
    '@/lib/require-admin': './stub-admin',
    './require-admin': './stub-admin',
    './cache': './stub-cache',
    './admin/cache': './stub-cache',
    './admin/save-check': './save-check',
  },
  {
    'stub-next-cache':
      "exports.revalidatePath = (p) => global.__revalidated.push(p); exports.revalidateTag = (t) => global.__revalidated.push('tag:' + t);",
    'stub-supabase': 'exports.createAdminSupabase = () => global.__db;',
    'stub-admin': "exports.requireAdmin = async () => ({ id: 'a1' });",
    'stub-cache': "exports.ADMIN_DATA = 'admin-data'; exports.revalidateAdminPath = (p) => global.__revalidated.push(p);",
  }
);
const { saveCheck } = require(path.join(OUT, 'save-check.js'));
const { recordCheck } = require(path.join(OUT, 'check-actions.js'));
const { publishVerification } = require(path.join(OUT, 'admin-actions.js'));

function fixtures() {
  return {
    restaurants: [{ id: 'r1', slug: 'grill-house' }],
    verification_requests: [{ id: 'q1', restaurant_id: 'r1', status: 'pending' }],
    restaurant_halal_evidence: [
      { id: 'e0', restaurant_id: 'r1', kind: 'yepitshalal_check', claim: 'halal_options', strength: 'strong', is_current: false },
      { id: 'e1', restaurant_id: 'r1', kind: 'yepitshalal_check', claim: 'fully_halal', strength: 'strong', is_current: true },
      { id: 'e2', restaurant_id: 'r1', kind: 'website_statement', claim: 'fully_halal', strength: 'medium', is_current: true },
      { id: 'e3', restaurant_id: 'r2', kind: 'yepitshalal_check', claim: 'fully_halal', strength: 'strong', is_current: true },
    ],
    restaurant_halal_facts: [{ restaurant_id: 'r1', all_meat_halal: true, serves_alcohol: false }],
    verification_history: [],
  };
}
const FOUND = {
  classification: 'halal_options',
  method: 'phone',
  public_summary: 'The owner told us the chicken is halal and the lamb is not.',
  all_meat_halal: 'no',
  serves_alcohol: 'dont_know',
};
const NOT_CONFIRMED = { classification: 'unverified', method: '', public_summary: '' };

// Each step that can fail, by the query it makes.
const stepDown = (q) => q.table === 'restaurant_halal_evidence' && q.op === 'update' && q.patch.is_current === false;
const addCheck = (q) => q.table === 'restaurant_halal_evidence' && q.op === 'insert';
const stepBack = (q) => q.table === 'restaurant_halal_evidence' && q.op === 'update' && q.patch.is_current === true;
const answers = (q) => q.table === 'restaurant_halal_facts' && q.op === 'insert';
const history = (q) => q.table === 'verification_history' && q.op === 'insert';
const requestDone = (q) => q.table === 'verification_requests' && q.op === 'update';
const failing = (...steps) => (q) => (steps.some((s) => s(q)) ? 'boom' : null);
const none = () => null;

function form(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
/** The evidence rows for r1 the label is derived from (new rows are current by default). */
const current = (t) => t.restaurant_halal_evidence.filter((e) => e.restaurant_id === 'r1' && e.is_current !== false);

let logged = [];
console.error = (...args) => logged.push(args.join(' '));

async function save(t, failIf, fields = FOUND, allowNotHalal = true) {
  global.__db = makeDb(t, failIf);
  return saveCheck({ restaurantId: 'r1', requestId: null, formData: form(fields), adminId: 'a1', allowNotHalal });
}

const checks = [
  [
    'a check that found something replaces the older one, and only that',
    async () => {
      const t = fixtures();
      assert.deepStrictEqual(await save(t, none), { outcome: 'halal_options', verified: true });
      assert.deepStrictEqual(current(t).map((e) => e.id).sort(), ['e2', t.restaurant_halal_evidence[4].id].sort());
      assert.strictEqual(t.restaurant_halal_evidence[4].claim, 'halal_options');
      assert.strictEqual(t.restaurant_halal_evidence[0].is_current, false, 'an older check stays stepped down');
      assert.strictEqual(t.restaurant_halal_evidence[3].is_current, true, 'another place is untouched');
      assert.strictEqual(t.restaurant_halal_facts[0].all_meat_halal, false);
      assert.strictEqual(t.restaurant_halal_facts[0].serves_alcohol, null, '"Don\'t know" stays unknown');
      assert.strictEqual(t.verification_history.length, 1);
    },
  ],
  [
    'if the new check will not save, the older one steps back up and nothing else changes',
    async () => {
      const t = fixtures();
      await assert.rejects(save(t, failing(addCheck)), { message: 'Nothing was saved. Try again.' });
      assert.deepStrictEqual(t, fixtures());
    },
  ],
  [
    'if the older one cannot step back up either, the page shows less, never more, and the admin is told',
    async () => {
      const t = fixtures();
      await assert.rejects(save(t, failing(addCheck, stepBack)), /could not be put back, so the page shows less than it did/);
      assert.deepStrictEqual(current(t).map((e) => e.id), ['e2']);
      assert.deepStrictEqual(t.restaurant_halal_facts, fixtures().restaurant_halal_facts, 'no new answers beside an old label');
    },
  ],
  [
    'if the older checks cannot step down, nothing is saved',
    async () => {
      const t = fixtures();
      await assert.rejects(save(t, failing(stepDown)), { message: 'Nothing was saved. Try again.' });
      assert.deepStrictEqual(t, fixtures());
    },
  ],
  [
    'if the answers to each question will not save, the admin hears the label did',
    async () => {
      const t = fixtures();
      await assert.rejects(save(t, failing(answers)), { message: 'The label is saved, but not the answers to each question. Save it again.' });
      assert.strictEqual(current(t).some((e) => e.claim === 'halal_options'), true);
      assert.deepStrictEqual(t.restaurant_halal_facts, fixtures().restaurant_halal_facts);
    },
  ],
  [
    'if the history line will not save after a finding, the admin hears the check did',
    async () => {
      const t = fixtures();
      await assert.rejects(save(t, failing(history)), { message: 'The check is saved, but not its line in the history. Save it again.' });
      assert.strictEqual(current(t).some((e) => e.claim === 'halal_options'), true);
    },
  ],
  [
    "couldn't confirm leaves everything public untouched and writes only the history",
    async () => {
      const t = fixtures();
      assert.deepStrictEqual(await save(t, none, NOT_CONFIRMED), { outcome: 'unverified', verified: false });
      assert.deepStrictEqual(t.restaurant_halal_evidence, fixtures().restaurant_halal_evidence);
      assert.deepStrictEqual(t.restaurant_halal_facts, fixtures().restaurant_halal_facts);
      assert.strictEqual(t.verification_history[0].classification_result, 'unverified');
    },
  ],
  [
    "couldn't confirm with a failed history line says nothing was saved",
    async () => {
      await assert.rejects(save(fixtures(), failing(history), NOT_CONFIRMED), { message: 'Nothing was saved. Try again.' });
    },
  ],
  [
    'a finding without how or what is refused before anything is written',
    async () => {
      const t = fixtures();
      await assert.rejects(save(t, none, { ...FOUND, method: '' }), /Say how you checked and what you found/);
      await assert.rejects(save(t, none, { ...FOUND, classification: 'not_halal' }, false), { message: 'Choose what the check found.' });
      assert.deepStrictEqual(t, fixtures());
    },
  ],
  [
    "certification is recorded only from the certifier's register",
    async () => {
      const cert = { ...FOUND, classification: 'fully_halal', has_certification: 'yes', certification_body: 'HMC' };
      const byPhone = fixtures();
      await save(byPhone, none, cert);
      assert.strictEqual(current(byPhone).some((e) => e.kind === 'certification'), false);
      const byRegister = fixtures();
      await save(byRegister, none, { ...cert, method: 'certifier_register' });
      assert.strictEqual(current(byRegister).some((e) => e.kind === 'certification' && e.source_name === 'HMC'), true);
    },
  ],
  [
    'recording a check answers in words, and refreshes both pages either way',
    async () => {
      for (const [failIf, expected] of [
        [none, { ok: 'Saved. The page shows it now.' }],
        [failing(addCheck), { error: 'Nothing was saved. Try again.' }],
      ]) {
        const t = fixtures();
        global.__db = makeDb(t, failIf);
        global.__revalidated = [];
        assert.deepStrictEqual(await recordCheck('r1', {}, form(FOUND)), expected);
        assert.deepStrictEqual(global.__revalidated, ['tag:admin-data', '/admin/restaurants/r1', '/restaurant/grill-house']);
      }
      global.__db = makeDb(fixtures(), none);
      assert.deepStrictEqual(await recordCheck('r1', {}, form({ classification: '' })), { error: 'Choose what the check found.' });
      assert.deepStrictEqual(await recordCheck('nope', {}, form(FOUND)), { error: 'Restaurant not found.' });
    },
  ],
  [
    'publishing a request closes it, and says so when only the check saved',
    async () => {
      const done = fixtures();
      global.__db = makeDb(done, none);
      global.__revalidated = [];
      assert.deepStrictEqual(await publishVerification('q1', {}, form(FOUND)), { ok: 'Published. The request is done.' });
      assert.strictEqual(done.verification_requests[0].status, 'completed');
      assert.strictEqual(done.verification_requests[0].outcome_classification, 'halal_options');
      assert.deepStrictEqual(global.__revalidated, ['/admin/queue', '/admin/queue/q1']);

      const unsure = fixtures();
      global.__db = makeDb(unsure, none);
      await publishVerification('q1', {}, form(NOT_CONFIRMED));
      assert.strictEqual(unsure.verification_requests[0].status, 'unable_to_verify');

      const halfway = fixtures();
      global.__db = makeDb(halfway, failing(requestDone));
      const res = await publishVerification('q1', {}, form(FOUND));
      assert.match(res.error, /The check is saved, but the request still shows as waiting/);
      assert.strictEqual(halfway.verification_requests[0].status, 'pending');
      assert.strictEqual(current(halfway).some((e) => e.claim === 'halal_options'), true);

      const failed = fixtures();
      global.__db = makeDb(failed, failing(addCheck));
      assert.deepStrictEqual(await publishVerification('q1', {}, form(FOUND)), { error: 'Nothing was saved. Try again.' });
      assert.strictEqual(failed.verification_requests[0].status, 'pending');

      assert.deepStrictEqual(await publishVerification('nope', {}, form(FOUND)), { error: 'Verification request not found.' });
    },
  ],
];

(async () => {
  let failed = 0;
  for (const [name, run] of checks) {
    logged = [];
    try {
      await run();
      console.log(`ok   ${name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${name}\n     ${e.message.split('\n').join('\n     ')}`);
    }
  }
  console.log(`\n${checks.length - failed} of ${checks.length} passed`);
  process.exit(failed ? 1 : 0);
})();
