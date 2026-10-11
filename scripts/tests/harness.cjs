// Shared by the tests in scripts/outreach/tests, scripts/stripe and
// scripts/admin. compile() turns real app/ and lib/ files into plain
// JavaScript in a temporary folder, with sucrase (installed with tailwindcss
// 3), pointing their imports at stubs. makeDb() is a fake PostgREST client over in-memory tables, enough
// for the queries those files make, and failIf(query) returns an error
// message to fail any one of them.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { transform } = require('sucrase');

const ROOT = path.resolve(__dirname, '../..');

/** files: { outName: 'lib/x.ts' }; rewrites: { '@/lib/y': './stub-y' }; stubs: { 'stub-y': 'exports...' } */
function compile(files, rewrites, stubs) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-test-'));
  for (const [name, file] of Object.entries(files)) {
    let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const [from, to] of Object.entries(rewrites)) src = src.split(`'${from}'`).join(`'${to}'`);
    fs.writeFileSync(path.join(out, name + '.js'), transform(src, { transforms: ['typescript', 'imports'] }).code);
  }
  for (const [name, code] of Object.entries(stubs)) fs.writeFileSync(path.join(out, name + '.js'), code);
  return out;
}

function parseOr(expr) {
  const parts = [];
  let cur = '';
  let quoted = false;
  for (const ch of expr) {
    if (ch === '"') quoted = !quoted;
    if (ch === ',' && !quoted) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => {
    const [col, op, ...rest] = p.split('.');
    const v = rest.join('.').replace(/^"|"$/g, '');
    return (r) => (op === 'eq' ? String(r[col]) === v : op === 'gte' ? r[col] != null && r[col] >= v : false);
  });
}

// Ids for inserted rows: unique even after deletes.
let made = 0;

function makeDb(tables, failIf) {
  return {
    // Storage buckets are tables named storage:<bucket>, each a list of paths.
    storage: {
      from(bucket) {
        const table = `storage:${bucket}`;
        const fail = (op) => {
          const err = failIf({ table, op, filters: [], keys: [], opts: {} });
          return err ? (typeof err === 'string' ? { message: err } : err) : null;
        };
        return {
          async download(p) {
            const error = fail('download');
            if (error) return { data: null, error };
            return (tables[table] ?? []).includes(p) ? { data: { path: p }, error: null } : { data: null, error: { message: 'not found' } };
          },
          async upload(p) {
            const error = fail('upload');
            if (error) return { data: null, error };
            tables[table] = [...(tables[table] ?? []).filter((x) => x !== p), p];
            return { data: { path: p }, error: null };
          },
          getPublicUrl: (p) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${p}` } }),
          async remove(paths) {
            const err = failIf({ table, op: 'remove', filters: [], keys: [], opts: {} });
            if (err) return { data: null, error: typeof err === 'string' ? { message: err } : err };
            tables[table] = (tables[table] ?? []).filter((x) => !paths.includes(x));
            return { data: paths.map((name) => ({ name })), error: null };
          },
        };
      },
    },
    from(table) {
      const q = { table, op: 'select', filters: [], keys: [], opts: {}, patch: null, limitN: null, single: false };
      const add = (key, fn) => {
        q.keys.push(key);
        q.filters.push(fn);
        return b;
      };
      const b = {
        select(cols, opts) {
          if (q.op === 'select') q.opts = opts || {};
          else q.returning = true; // insert(...).select() or update(...).select()
          return b;
        },
        upsert(row, opts) {
          q.op = 'insert';
          q.patch = row;
          // onConflict: 'a,b' updates the row with the same a and b instead.
          q.conflict = opts?.onConflict ? opts.onConflict.split(',') : null;
          q.ignoreDuplicates = !!opts?.ignoreDuplicates;
          return b;
        },
        insert(row) {
          q.op = 'insert';
          q.patch = row;
          return b;
        },
        delete() {
          q.op = 'delete';
          return b;
        },
        update(patch) {
          q.op = 'update';
          q.patch = patch;
          return b;
        },
        eq: (c, v) => add(`eq:${c}`, (r) => r[c] === v),
        neq: (c, v) => add(`neq:${c}`, (r) => r[c] !== v),
        is: (c, v) => add(`is:${c}`, (r) => (r[c] ?? null) === v),
        gte: (c, v) => add(`gte:${c}`, (r) => r[c] != null && r[c] >= v),
        lte: (c, v) => add(`lte:${c}`, (r) => r[c] != null && r[c] <= v),
        in: (c, vs) => add(`in:${c}`, (r) => vs.includes(r[c])),
        not: (c, op, v) => add(`not:${c}`, (r) => !(op === 'is' ? (r[c] ?? null) === v : false)),
        or: (expr) => {
          const any = parseOr(expr);
          return add('or', (r) => any.some((f) => f(r)));
        },
        order: () => b,
        limit(n) {
          q.limitN = n;
          return b;
        },
        range(from, to) {
          q.rangeFrom = from;
          q.limitN = to - from + 1;
          return b;
        },
        maybeSingle() {
          q.single = true;
          return b;
        },
        single() {
          q.single = true;
          return b;
        },
        then(res, rej) {
          return Promise.resolve().then(() => run(q)).then(res, rej);
        },
      };
      return b;
    },
  };
  function run(q) {
    const err = failIf(q);
    // A string, or { message, code } to stand for a particular Postgres error.
    if (err) return { data: null, count: null, error: typeof err === 'string' ? { message: err } : err };
    const all = tables[q.table] ?? (tables[q.table] = []);
    if (q.op === 'insert' && q.conflict) {
      const same = all.find((r) => q.conflict.every((c) => r[c] === q.patch[c]));
      if (same) {
        if (!q.ignoreDuplicates) Object.assign(same, q.patch);
        return { data: q.returning ? (q.single ? same : [same]) : null, error: null };
      }
    }
    if (q.op === 'insert') {
      // One row, or an array of them added together.
      const added = (Array.isArray(q.patch) ? q.patch : [q.patch]).map((p) => ({
        id: `new${++made}`,
        created_at: new Date().toISOString(),
        ...p,
      }));
      all.push(...added);
      return { data: q.returning ? (q.single ? added[0] : added) : null, error: null };
    }
    const rows = all.filter((r) => q.filters.every((f) => f(r)));
    if (q.op === 'delete') {
      tables[q.table] = all.filter((r) => !rows.includes(r));
      return { data: null, error: null };
    }
    if (q.op === 'update') {
      rows.forEach((r) => Object.assign(r, q.patch));
      return { data: q.returning ? rows : null, error: null };
    }
    if (q.opts.head) return { data: null, count: rows.length, error: null };
    const from = q.rangeFrom ?? 0;
    const data = q.limitN != null ? rows.slice(from, from + q.limitN) : rows.slice(from);
    return { data: q.single ? data[0] ?? null : data, error: null };
  }
}


module.exports = { compile, makeDb };
