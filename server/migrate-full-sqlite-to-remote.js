/*
  Full SQLite -> remote DB migration.
  Replaces remote users, products, vouchers, orders, notifications, and related tables.

  Usage:
    node migrate-full-sqlite-to-remote.js --remote https://furever-1-lekw.onrender.com --secret <MIGRATION_IMPORT_SECRET>

  Optional:
    --db ./furever.db
    --dry-run
*/

require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_REMOTE = String(process.env.API_URL || '').trim();
const DEFAULT_DB_PATH = path.resolve(__dirname, 'furever.db');
const DEFAULT_SECRET = String(process.env.MIGRATION_IMPORT_SECRET || '').trim();

function parseArgs(argv) {
  const out = {
    remote: DEFAULT_REMOTE,
    dbPath: DEFAULT_DB_PATH,
    secret: DEFAULT_SECRET,
    dryRun: false,
    includeNotifications: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--remote' && argv[i + 1]) {
      out.remote = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (token === '--db' && argv[i + 1]) {
      out.dbPath = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === '--secret' && argv[i + 1]) {
      out.secret = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (token === '--dry-run') {
      out.dryRun = true;
    }
    if (token === '--include-notifications') {
      out.includeNotifications = true;
    }
  }

  return out;
}

function normalizeApiBase(url) {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

function isNonFatalFinalizeError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('chunked import finalize failed') &&
    (message.includes('on conflict clause does not match any primary key or unique constraint') ||
      message.includes('sqlite_sequence'))
  );
}

function selectAll(db, tableName) {
  return db.prepare(`SELECT * FROM ${tableName}`).all();
}

function summaryFromPayload(payload) {
  return {
    categories: payload.categories.length,
    users: payload.users.length,
    products: payload.products.length,
    vouchers: payload.vouchers.length,
    orders: payload.orders.length,
    orderItems: payload.orderItems.length,
    voucherClaims: payload.voucherClaims.length,
    notifications: payload.notifications.length,
    reviews: payload.reviews.length,
  };
}

function buildChunks(rows, maxBytes = 1024 * 1024, maxRows = 100) {
  const chunks = [];
  let current = [];
  let currentBytes = 0;

  for (const row of rows) {
    const approxBytes = Buffer.byteLength(JSON.stringify(row), 'utf8');
    const exceedsBytes = currentBytes + approxBytes > maxBytes;
    const exceedsRows = current.length >= maxRows;

    if (current.length > 0 && (exceedsBytes || exceedsRows)) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(row);
    currentBytes += approxBytes;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${JSON.stringify(data).slice(0, 500)}`);
  }

  return data;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const apiBase = normalizeApiBase(args.remote);

  if (!apiBase) {
    throw new Error('Remote API URL is required. Pass --remote <url> or set API_URL in server/.env');
  }

  if (!args.secret) {
    throw new Error('Migration secret is required. Pass --secret <value> or set MIGRATION_IMPORT_SECRET.');
  }

  const db = new Database(args.dbPath, { readonly: true, fileMustExist: true });

  try {
    const payload = {
      categories: selectAll(db, 'categories'),
      users: selectAll(db, 'users'),
      products: selectAll(db, 'products'),
      vouchers: selectAll(db, 'vouchers'),
      orders: selectAll(db, 'orders'),
      orderItems: selectAll(db, 'order_items'),
      voucherClaims: selectAll(db, 'voucher_claims'),
      notifications: selectAll(db, 'notifications'),
      reviews: selectAll(db, 'reviews'),
    };

    if (!args.includeNotifications) {
      payload.notifications = [];
    }

    const localSummary = summaryFromPayload(payload);

    console.log('Local snapshot summary:');
    Object.entries(localSummary).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    if (!args.includeNotifications) {
      console.log('  notifications migration: skipped by default');
    }

    if (args.dryRun) {
      console.log('\nDry run enabled. No remote requests were made.');
      return;
    }

    const headers = { 'x-migration-secret': args.secret };

    const startResult = await postJson(
      `${apiBase}/migration/chunked-import/start`,
      { confirmReplaceAll: 'REPLACE_ALL_DATA' },
      headers
    );
    console.log('\nChunked import start:');
    console.log(JSON.stringify(startResult, null, 2));

    const tablePayloadMap = [
      ['categories', payload.categories],
      ['users', payload.users],
      ['products', payload.products],
      ['vouchers', payload.vouchers],
      ['orders', payload.orders],
      ['order_items', payload.orderItems],
      ['reviews', payload.reviews],
      ['notifications', payload.notifications],
      ['voucher_claims', payload.voucherClaims],
    ];

    for (const [table, rows] of tablePayloadMap) {
      const chunks = buildChunks(rows, 1024 * 1024, 75);
      console.log(`\nImporting table ${table}: ${rows.length} rows in ${chunks.length} chunk(s)`);

      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const result = await postJson(
          `${apiBase}/migration/chunked-import/table/${table}`,
          { rows: chunk },
          headers
        );
        console.log(`  chunk ${i + 1}/${chunks.length}: ${result.inserted} rows`);
      }
    }

    try {
      const finalizeResult = await postJson(
        `${apiBase}/migration/chunked-import/finalize`,
        {},
        headers
      );

      console.log('\nFinalize response:');
      console.log(JSON.stringify(finalizeResult, null, 2));
    } catch (error) {
      if (!isNonFatalFinalizeError(error)) {
        throw error;
      }

      // Older SQLite builds can reject sqlite_sequence updates; imported rows remain valid.
      console.warn('\nFinalize warning: non-fatal sequence update error detected.');
      console.warn(String(error.message || error));
      console.warn('Migration data import completed, but auto-increment sequences were not finalized.');
    }
  } finally {
    db.close();
  }
}

run().catch((err) => {
  console.error('\nFull migration failed:', err.message);
  process.exitCode = 1;
});
