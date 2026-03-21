/*
  One-time migration helper:
  Sync local SQLite categories/products into remote API.

  Usage (from server folder):
    node migrate-local-sqlite-to-remote.js --remote https://furever-1-lekw.onrender.com

  Optional:
    --db ./furever.db
    --dry-run
*/

require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_REMOTE = String(process.env.API_URL || '').trim();
const DEFAULT_DB_PATH = path.resolve(__dirname, 'furever.db');

function parseArgs(argv) {
  const out = {
    remote: DEFAULT_REMOTE,
    dbPath: DEFAULT_DB_PATH,
    dryRun: false,
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
    if (token === '--dry-run') {
      out.dryRun = true;
    }
  }

  return out;
}

function normalizeApiBase(url) {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

function byLowerName(items) {
  const map = new Map();
  for (const item of items || []) {
    const key = String(item?.name || '').trim().toLowerCase();
    if (!key) continue;
    if (!map.has(key)) map.set(key, item);
  }
  return map;
}

function parseVariants(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${label} failed (${res.status}): ${body.slice(0, 250)}`);
  }
  return res.json();
}

async function postJson(url, payload, label) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${label} failed (${res.status}): ${body.slice(0, 250)}`);
  }
  return res.json();
}

async function putJson(url, payload, label) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${label} failed (${res.status}): ${body.slice(0, 250)}`);
  }
  return res.json();
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const apiBase = normalizeApiBase(args.remote);

  if (!apiBase) {
    throw new Error('Remote API URL is required. Pass --remote <url> or set API_URL in server/.env');
  }

  const db = new Database(args.dbPath, { readonly: true, fileMustExist: true });
  try {
    const localCategories = db.prepare('SELECT id, name, color, icon FROM categories ORDER BY id ASC').all();
    const localProducts = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.category,
        p.petType,
        p.price,
        p.countInStock,
        p.lowStockThreshold,
        p.image,
        p.description,
        p.barcode,
        p.variants,
        p.expirationDate,
        c.name AS categoryName
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      ORDER BY p.id ASC
    `).all();

    console.log(`Local DB: ${localCategories.length} categories, ${localProducts.length} products`);
    console.log(`Remote API: ${apiBase}`);
    if (args.dryRun) {
      console.log('Dry run mode enabled: no remote writes will happen.');
    }

    const remoteCategories = await getJson(`${apiBase}/categories`, 'Fetch remote categories');
    const remoteProducts = await getJson(`${apiBase}/products`, 'Fetch remote products');

    const remoteCategoriesByName = byLowerName(remoteCategories);
    const remoteProductsByBarcode = new Map();
    for (const p of remoteProducts || []) {
      const key = String(p?.barcode || '').trim();
      if (!key) continue;
      if (!remoteProductsByBarcode.has(key)) remoteProductsByBarcode.set(key, p);
    }

    const categoryIdByLocalId = new Map();
    let createdCategories = 0;

    for (const lc of localCategories) {
      const key = String(lc.name || '').trim().toLowerCase();
      if (!key) continue;

      let remoteCat = remoteCategoriesByName.get(key);
      if (!remoteCat) {
        if (!args.dryRun) {
          remoteCat = await postJson(
            `${apiBase}/categories`,
            { name: lc.name, color: lc.color || '', icon: lc.icon || '' },
            `Create category ${lc.name}`
          );
        } else {
          remoteCat = { id: `dry-${lc.id}`, _id: `dry-${lc.id}`, name: lc.name };
        }
        remoteCategoriesByName.set(key, remoteCat);
        createdCategories += 1;
      }

      const remoteCatId = remoteCat?.id || remoteCat?._id;
      if (remoteCatId !== undefined && remoteCatId !== null) {
        categoryIdByLocalId.set(lc.id, remoteCatId);
      }
    }

    let createdProducts = 0;
    let updatedProducts = 0;
    let skippedProducts = 0;

    for (const lp of localProducts) {
      const remoteCategoryId = categoryIdByLocalId.get(lp.category) || null;
      const payload = {
        name: lp.name,
        description: lp.description || '',
        price: Number(lp.price) || 0,
        category: remoteCategoryId,
        countInStock: Number(lp.countInStock) || 0,
        lowStockThreshold: Number(lp.lowStockThreshold) || 10,
        barcode: lp.barcode || '',
        petType: lp.petType || '',
        variants: parseVariants(lp.variants),
        expirationDate: lp.expirationDate || '',
        image: lp.image || '',
      };

      const barcodeKey = String(lp.barcode || '').trim();
      const remoteExisting = barcodeKey ? remoteProductsByBarcode.get(barcodeKey) : null;

      if (remoteExisting) {
        const remoteId = remoteExisting.id || remoteExisting._id;
        if (!remoteId) {
          skippedProducts += 1;
          continue;
        }

        if (!args.dryRun) {
          await putJson(`${apiBase}/products/${remoteId}`, payload, `Update product ${lp.name}`);
        }
        updatedProducts += 1;
      } else {
        if (!args.dryRun) {
          await postJson(`${apiBase}/products`, payload, `Create product ${lp.name}`);
        }
        createdProducts += 1;
      }
    }

    const finalRemoteProducts = await getJson(`${apiBase}/products`, 'Fetch final remote products');

    console.log('\nMigration summary');
    console.log(`Categories created: ${createdCategories}`);
    console.log(`Products created:   ${createdProducts}`);
    console.log(`Products updated:   ${updatedProducts}`);
    console.log(`Products skipped:   ${skippedProducts}`);
    console.log(`Final remote count: ${Array.isArray(finalRemoteProducts) ? finalRemoteProducts.length : 0}`);
  } finally {
    db.close();
  }
}

run().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exitCode = 1;
});
