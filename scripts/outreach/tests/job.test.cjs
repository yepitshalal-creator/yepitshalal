// The daily outreach run (lib/outreach/job.ts) against a fake database, a fake
// Resend list and a fake sender, with failures injected: a failed read stops
// the run, an unreadable stop list never lets an email through, nothing is
// claimed about photos that were not read, and an email that went out but was
// not written down is never sent twice. Nothing here touches the network or
// the live database.
//
//   node scripts/outreach/tests/job.test.cjs
//
// It uses scripts/tests/harness.cjs: the real files compiled with their @/
// imports pointed at small stubs, and a fake database.
const path = require('path');
const assert = require('assert');
const { compile, makeDb } = require('../../tests/harness.cjs');

const OUT = compile(
  { job: 'lib/outreach/job.ts', data: 'lib/outreach/data.ts', words: 'lib/outreach/words.ts' },
  {
    '@/lib/admin/posthog': './stub-posthog',
    '@/lib/notify': './stub-notify',
    '@/lib/deals/db': './stub-db',
    '@/lib/site': './stub-site',
  },
  {
    'stub-posthog': 'exports.hogqlDaily = async () => null;',
    'stub-site': "exports.SITE_URL = 'https://yepitshalal.com'; exports.INBOX = 'hello@yepitshalal.com';",
    'stub-db': 'exports.dealsDb = () => global.__db;',
    'stub-notify': `exports.sendThroughResend = async (email, opts) => {
       global.__sent.push({ to: email.to[0], subject: email.subject, text: email.text, key: opts.idempotencyKey });
       return { ok: true, id: 're_' + global.__sent.length };
     };`,
  }
);

// --- fixtures --------------------------------------------------------------
const NOW = new Date().toISOString();
function fixtures(n = 2) {
  const contacts = [];
  const restaurants = [];
  for (let i = 1; i <= n; i++) {
    restaurants.push({ id: `r${i}`, name: `Place ${i}`, slug: `place-${i}`, is_listed: true });
    contacts.push({
      id: `c${i}`,
      restaurant_id: `r${i}`,
      brand_id: null,
      email: `owner${i}@example.com`,
      phone: null,
      channel: 'email',
      status: 'ready',
      sent_at: null,
      followed_up_at: null,
      token: `tok${i}`,
      found_at_url: `https://place${i}.example.com/contact`,
      found_how: 'own_website',
      last_event: null,
      created_at: `2026-10-0${i}T00:00:00.000Z`,
    });
  }
  return {
    outreach_settings: [{ id: true, sending_on: true, daily_limit: 25, paused_reason: null, resumed_at: null }],
    outreach_contacts: contacts,
    restaurants,
    restaurant_photos: [],
    outreach_stop_list: [],
    brands: [],
  };
}

let resendPages;
let resendCalls;
global.fetch = async (url) => {
  resendCalls++;
  const page = resendPages.shift() ?? { data: [], has_more: false };
  return { ok: true, status: 200, json: async () => page };
};
process.env.RESEND_API_KEY = 'test-only';
const realTimeout = global.setTimeout;
global.setTimeout = (fn) => realTimeout(fn, 0); // the job's gaps between sends

const { runOutreachDay, resendTime } = require(path.join(OUT, 'job.js'));
const { FIRST_SUBJECT, FOLLOW_UP_SUBJECT } = require(path.join(OUT, 'words.js'));

async function scenario(name, { tables = fixtures(), failIf = () => null, pages = [], dryRun = false }, check) {
  global.__db = makeDb(tables, failIf);
  global.__sent = [];
  resendPages = pages.slice();
  resendCalls = 0;
  const result = await runOutreachDay({ dryRun });
  try {
    check(result, tables, global.__sent);
    console.log('PASS', name);
  } catch (e) {
    console.log('FAIL', name, '\n  ', e.message, '\n  ', JSON.stringify(result));
    process.exitCode = 1;
  }
}

const status = (t, id) => t.outreach_contacts.find((c) => c.id === id).status;

(async () => {
  // Resend's own time format.
  const t = resendTime('2026-04-03 22:13:42.674981+00');
  assert.strictEqual(new Date(t).toISOString(), '2026-04-03T22:13:42.674Z');
  console.log('PASS resendTime reads "2026-04-03 22:13:42.674981+00"');

  await scenario('happy path: both first emails go and are recorded', {}, (r, t, sent) => {
    assert.strictEqual(r.firstsSent, 2);
    assert.strictEqual(sent.length, 2);
    assert.strictEqual(status(t, 'c1'), 'sent');
    assert.strictEqual(status(t, 'c2'), 'sent');
    assert.ok(sent[0].text.includes('no photos of your food yet'), 'says no photos when there are none');
    assert.ok(!r.note);
  });

  await scenario(
    'stop list unreadable: nothing sent, nobody marked stopped',
    { failIf: (q) => (q.table === 'outreach_stop_list' ? 'boom' : null) },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 0);
      assert.strictEqual(status(t, 'c1'), 'ready');
      assert.match(r.note, /stop list/);
    }
  );

  await scenario(
    'one on the stop list: skipped and marked, the other goes',
    {
      tables: (() => {
        const f = fixtures();
        f.outreach_stop_list.push({ id: 's1', email: 'owner1@example.com' });
        return f;
      })(),
    },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, 'owner2@example.com');
      assert.strictEqual(status(t, 'c1'), 'stopped');
    }
  );

  await scenario(
    "today's count unreadable: nothing sent",
    { failIf: (q) => (q.opts.head && q.keys.includes('gte:sent_at') ? 'boom' : null) },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 0);
      assert.match(r.note, /count today/);
    }
  );

  await scenario(
    "this week's bounces unreadable: nothing sent",
    { failIf: (q) => (q.opts.head && q.keys.includes('eq:last_event') ? 'boom' : null) },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 0);
      assert.strictEqual(r.canWatch, false);
      assert.match(r.note, /bounces/);
    }
  );

  await scenario(
    'our record of recent emails unreadable: nothing sent',
    { failIf: (q) => (q.table === 'outreach_contacts' && q.keys.includes('or') ? 'boom' : null) },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 0);
      assert.strictEqual(r.canWatch, false);
    }
  );

  await scenario(
    'photos unreadable: the email says nothing about photos',
    { failIf: (q) => (q.table === 'restaurant_photos' ? 'boom' : null) },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 2);
      assert.ok(!sent[0].text.includes('no photos'), 'no claim about photos');
      assert.ok(sent[0].text.includes('Can we show more of your food?'));
    }
  );

  await scenario(
    'daily limit: 2 a day with 1 already sent today sends 1',
    {
      tables: (() => {
        const f = fixtures(3);
        f.outreach_settings[0].daily_limit = 2;
        Object.assign(f.outreach_contacts[2], { status: 'sent', sent_at: NOW });
        return f;
      })(),
    },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, 'owner1@example.com');
    }
  );

  // Sent, then the write fails every time: stop at once.
  const lost = fixtures();
  await scenario(
    'sent but not recorded: stops after that one',
    { tables: lost, failIf: (q) => (q.op === 'update' && q.keys.includes('eq:status') ? 'boom' : null) },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(r.failures.c1, 'sent, but could not be recorded');
      assert.match(r.note, /could not be recorded/);
      assert.strictEqual(status(t, 'c1'), 'ready');
    }
  );
  // The next day the database works again, and Resend lists that email.
  await scenario(
    'the next run finds it in Resend, writes it down, does not send it again',
    {
      tables: lost,
      pages: [
        {
          data: [
            { id: 're_1', to: ['Owner1@Example.com'], subject: FIRST_SUBJECT, created_at: NOW.replace('T', ' ').replace('Z', '+00'), last_event: 'delivered' },
          ],
          has_more: false,
        },
      ],
    },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, 'owner2@example.com');
      assert.match(r.skipped.c1, /already sent/);
      const c1 = t.outreach_contacts.find((c) => c.id === 'c1');
      assert.strictEqual(c1.status, 'sent');
      assert.strictEqual(c1.resend_id, 're_1');
      assert.ok(c1.sent_at, 'sent_at written from Resend');
    }
  );

  await scenario(
    'an unrelated email to an owner does not hold back their first email',
    {
      pages: [
        {
          data: [{ id: 're_x', to: ['owner1@example.com'], subject: 'Your deal is live', created_at: NOW.replace('T', ' ').replace('Z', '+00'), last_event: 'delivered' }],
          has_more: false,
        },
      ],
    },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 2);
    }
  );

  await scenario(
    'paging stops at the first email older than 14 days',
    {
      pages: [
        { data: [{ id: 'old', to: ['someone@example.com'], created_at: '2026-01-01 10:00:00.000000+00', last_event: 'delivered' }], has_more: true },
        { data: [], has_more: false },
      ],
    },
    (r, t, sent) => {
      assert.strictEqual(resendCalls, 1);
      assert.strictEqual(sent.length, 2);
    }
  );

  // Since 2026-10-11 a place with no halal evidence has no page, so no email may
  // say it is on the site or ask for photos for it.
  await scenario(
    'a place with no halal evidence gets no first email',
    {
      tables: (() => {
        const f = fixtures();
        f.restaurants[0].is_listed = false;
        return f;
      })(),
    },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].to, 'owner2@example.com');
      assert.strictEqual(status(t, 'c1'), 'ready');
      assert.match(r.skipped.c1, /not on the site/);
    }
  );

  // Follow ups: c1 had its first email 8 days ago and has not answered.
  const DAY = 86400000;
  const firstAt = new Date(Date.now() - 8 * DAY).toISOString();
  const resendAt = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '000+00');
  const due = () => {
    const f = fixtures(1);
    Object.assign(f.outreach_contacts[0], { status: 'sent', sent_at: firstAt, resend_id: 're_first' });
    return f;
  };
  await scenario(
    'follow up: due, Resend shows the first email and an unrelated one, it goes',
    {
      tables: due(),
      pages: [
        {
          data: [
            { id: 're_x', to: ['owner1@example.com'], subject: 'Your deal is live', created_at: resendAt(Date.now() - DAY), last_event: 'delivered' },
            { id: 're_first', to: ['owner1@example.com'], subject: FIRST_SUBJECT, created_at: resendAt(Date.parse(firstAt) - 60000), last_event: 'delivered' },
          ],
          has_more: false,
        },
      ],
    },
    (r, t, sent) => {
      assert.strictEqual(r.followUpsSent, 1);
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(status(t, 'c1'), 'followed_up');
    }
  );
  await scenario(
    'follow up: a place with no halal evidence gets none',
    {
      tables: (() => {
        const f = due();
        f.restaurants[0].is_listed = false;
        return f;
      })(),
    },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 0);
      assert.strictEqual(status(t, 'c1'), 'sent');
      assert.match(r.skipped.c1, /not on the site/);
    }
  );
  await scenario(
    'follow up: Resend shows it already went, written down, not sent again',
    {
      tables: due(),
      pages: [
        {
          data: [
            { id: 're_lost', to: ['owner1@example.com'], subject: FOLLOW_UP_SUBJECT, created_at: resendAt(Date.now() - DAY), last_event: 'delivered' },
            { id: 're_first', to: ['owner1@example.com'], subject: FIRST_SUBJECT, created_at: resendAt(Date.parse(firstAt) - 60000), last_event: 'delivered' },
          ],
          has_more: false,
        },
      ],
    },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 0);
      assert.match(r.skipped.c1, /already sent/);
      const c1 = t.outreach_contacts.find((c) => c.id === 'c1');
      assert.strictEqual(c1.status, 'followed_up');
      assert.strictEqual(c1.followup_resend_id, 're_lost');
    }
  );
  await scenario(
    'follow up sent but not recorded: stops after that one',
    { tables: due(), failIf: (q) => (q.op === 'update' && q.keys.includes('eq:status') ? 'boom' : null) },
    (r, t, sent) => {
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(r.failures.c1, 'sent, but could not be recorded');
    }
  );

  // A bounce on c1's first email, two days ago; c2 is waiting for its first.
  const bounced = () => {
    const f = fixtures(2);
    Object.assign(f.outreach_contacts[0], { status: 'sent', sent_at: new Date(Date.now() - 2 * DAY).toISOString(), resend_id: 're_b' });
    return f;
  };
  const bouncePage = () => [
    {
      data: [{ id: 're_b', to: ['owner1@example.com'], subject: FIRST_SUBJECT, created_at: resendAt(Date.now() - 2 * DAY), last_event: 'bounced' }],
      has_more: false,
    },
  ];
  await scenario('a bounce puts them on the stop list and the run goes on', { tables: bounced(), pages: bouncePage() }, (r, t, sent) => {
    assert.strictEqual(r.newlyBounced, 1);
    assert.strictEqual(t.outreach_stop_list.length, 1);
    assert.strictEqual(t.outreach_stop_list[0].reason, 'bounced');
    assert.strictEqual(status(t, 'c1'), 'bounced');
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].to, 'owner2@example.com');
  });
  {
    const tables = bounced();
    global.__db = makeDb(tables, (q) => (q.table === 'outreach_stop_list' && q.op === 'insert' ? 'boom' : null));
    global.__sent = [];
    resendPages = bouncePage();
    const name = 'a bounce whose stop cannot be saved stops the whole run';
    try {
      await runOutreachDay({ dryRun: false });
      console.log('FAIL', name, '\n   the run finished instead of stopping');
      process.exitCode = 1;
    } catch (e) {
      try {
        assert.match(e.message, /Could not save the stop/);
        assert.strictEqual(global.__sent.length, 0);
        console.log('PASS', name);
      } catch (e2) {
        console.log('FAIL', name, '\n  ', e2.message);
        process.exitCode = 1;
      }
    }
  }

  await scenario('dry run sends nothing and writes nothing', { dryRun: true }, (r, t, sent) => {
    assert.strictEqual(sent.length, 0);
    assert.strictEqual(r.firstsSent, 2);
    assert.strictEqual(status(t, 'c1'), 'ready');
  });
})();
