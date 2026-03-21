const express = require('express');
const { db } = require('../database');

const router = express.Router();

const IMPORT_SECRET = String(process.env.MIGRATION_IMPORT_SECRET || '').trim();
const ENABLE_IMPORT = /^(1|true|yes)$/i.test(String(process.env.ENABLE_MIGRATION_IMPORT || ''));

const TABLE_ORDER = [
  'categories',
  'users',
  'products',
  'vouchers',
  'orders',
  'order_items',
  'reviews',
  'notifications',
  'voucher_claims',
];

const CLEAR_ORDER = [
  'notifications',
  'voucher_claims',
  'reviews',
  'order_items',
  'orders',
  'products',
  'vouchers',
  'categories',
  'users',
];

const importState = {
  active: false,
  maxIds: {},
};

function requireImportSecret(req, res, next) {
  if (!ENABLE_IMPORT) {
    return res.status(404).json({ message: 'Not found.' });
  }

  if (!IMPORT_SECRET) {
    return res.status(500).json({ message: 'Migration import secret is not configured.' });
  }

  const provided = String(req.headers['x-migration-secret'] || '').trim();
  if (!provided || provided !== IMPORT_SECRET) {
    return res.status(401).json({ message: 'Invalid migration secret.' });
  }

  return next();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getMaxId(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  return rows.reduce((max, row) => {
    const id = Number(row?.id) || 0;
    return id > max ? id : max;
  }, 0);
}

function initMaxIds() {
  importState.maxIds = {};
  for (const table of TABLE_ORDER) {
    importState.maxIds[table] = 0;
  }
}

function recordMaxId(table, id) {
  const numericId = Number(id) || 0;
  if (!importState.maxIds[table]) {
    importState.maxIds[table] = numericId;
    return;
  }
  if (numericId > importState.maxIds[table]) {
    importState.maxIds[table] = numericId;
  }
}

const insertCategory = db.prepare(`
  INSERT INTO categories (id, name, color, icon, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertUser = db.prepare(`
  INSERT INTO users (
    id, name, email, password, phone, isAdmin, role, shippingAddress, preferredPets,
    image, isActive, emailVerified, verificationCode, verificationExpires, googleId,
    pushToken, loyaltyPoints, createdAt, updatedAt
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertProduct = db.prepare(`
  INSERT INTO products (
    id, name, category, petType, price, countInStock, lowStockThreshold,
    image, description, barcode, variants, expirationDate, rating, numReviews,
    createdAt, updatedAt
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertVoucher = db.prepare(`
  INSERT INTO vouchers (
    id, title, message, imageUrl, promoCode, discountType, discountValue,
    maxDiscount, minOrderAmount, startsAt, expiresAt, isActive, maxClaims,
    claimedCount, createdByUserId, createdAt, updatedAt
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertOrder = db.prepare(`
  INSERT INTO orders (
    id, shippingAddress1, shippingAddress2, phone, status, totalPrice,
    voucherDiscount, voucherId, voucherCode, paymentMethod, userId,
    dateOrdered, createdAt, updatedAt
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertOrderItem = db.prepare(`
  INSERT INTO order_items (id, orderId, productId, name, price, image, quantity)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertReview = db.prepare(`
  INSERT INTO reviews (id, productId, userId, name, rating, text, image, status, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertNotification = db.prepare(`
  INSERT INTO notifications (
    id, userId, type, title, message, orderId, productId, imageUrl,
    voucherId, expiresAt, read, createdAt, updatedAt
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertVoucherClaim = db.prepare(`
  INSERT INTO voucher_claims (id, voucherId, userId, claimedAt, usedAt, orderId)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function insertRows(table, rows) {
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const id = Number(row.id) || 0;

      if (table === 'categories') {
        insertCategory.run(id, row.name || '', row.color || '', row.icon || '', row.createdAt || null, row.updatedAt || null);
      } else if (table === 'users') {
        insertUser.run(
          id,
          row.name || '',
          String(row.email || '').toLowerCase(),
          row.password || '',
          row.phone || '',
          Number(row.isAdmin) ? 1 : 0,
          row.role || 'customer',
          row.shippingAddress || '',
          row.preferredPets || '[]',
          row.image || '',
          row.isActive === 0 ? 0 : 1,
          Number(row.emailVerified) ? 1 : 0,
          row.verificationCode || null,
          row.verificationExpires || null,
          row.googleId || null,
          row.pushToken || null,
          Number(row.loyaltyPoints) || 0,
          row.createdAt || null,
          row.updatedAt || null
        );
      } else if (table === 'products') {
        insertProduct.run(
          id,
          row.name || '',
          row.category ? Number(row.category) : null,
          row.petType || '',
          Number(row.price) || 0,
          Number(row.countInStock) || 0,
          Number(row.lowStockThreshold) || 10,
          row.image || '',
          row.description || '',
          row.barcode || '',
          row.variants || '[]',
          row.expirationDate || '',
          Number(row.rating) || 0,
          Number(row.numReviews) || 0,
          row.createdAt || null,
          row.updatedAt || null
        );
      } else if (table === 'vouchers') {
        insertVoucher.run(
          id,
          row.title || '',
          row.message || '',
          row.imageUrl || '',
          String(row.promoCode || '').toUpperCase(),
          row.discountType || 'percent',
          Number(row.discountValue) || 0,
          Number(row.maxDiscount) || 0,
          Number(row.minOrderAmount) || 0,
          row.startsAt || null,
          row.expiresAt || null,
          row.isActive === 0 ? 0 : 1,
          Number(row.maxClaims) || 0,
          Number(row.claimedCount) || 0,
          row.createdByUserId ? Number(row.createdByUserId) : null,
          row.createdAt || null,
          row.updatedAt || null
        );
      } else if (table === 'orders') {
        insertOrder.run(
          id,
          row.shippingAddress1 || '',
          row.shippingAddress2 || '',
          row.phone || '',
          row.status || 'Pending',
          Number(row.totalPrice) || 0,
          Number(row.voucherDiscount) || 0,
          row.voucherId ? Number(row.voucherId) : null,
          row.voucherCode || '',
          row.paymentMethod || '',
          row.userId ? Number(row.userId) : null,
          row.dateOrdered || null,
          row.createdAt || null,
          row.updatedAt || null
        );
      } else if (table === 'order_items') {
        insertOrderItem.run(
          id,
          Number(row.orderId),
          row.productId ? Number(row.productId) : null,
          row.name || '',
          Number(row.price) || 0,
          row.image || '',
          Number(row.quantity) || 1
        );
      } else if (table === 'reviews') {
        insertReview.run(
          id,
          Number(row.productId),
          row.userId ? Number(row.userId) : null,
          row.name || '',
          Number(row.rating) || 0,
          row.text || '',
          row.image || '',
          row.status || 'approved',
          row.createdAt || null,
          row.updatedAt || null
        );
      } else if (table === 'notifications') {
        insertNotification.run(
          id,
          Number(row.userId),
          row.type || 'system',
          row.title || '',
          row.message || '',
          row.orderId ? Number(row.orderId) : null,
          row.productId ? Number(row.productId) : null,
          row.imageUrl || '',
          row.voucherId ? Number(row.voucherId) : null,
          row.expiresAt || null,
          Number(row.read) ? 1 : 0,
          row.createdAt || null,
          row.updatedAt || null
        );
      } else if (table === 'voucher_claims') {
        insertVoucherClaim.run(
          id,
          Number(row.voucherId),
          Number(row.userId),
          row.claimedAt || null,
          row.usedAt || null,
          row.orderId ? Number(row.orderId) : null
        );
      } else {
        throw new Error(`Unsupported table: ${table}`);
      }

      recordMaxId(table, id);
    }
  });

  tx();
}

function clearAllTables() {
  const tx = db.transaction(() => {
    db.pragma('foreign_keys = OFF');
    for (const table of CLEAR_ORDER) {
      db.prepare(`DELETE FROM ${table}`).run();
      db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
    }
    db.pragma('foreign_keys = ON');
  });

  tx();
}

function finalizeSequences() {
  const tx = db.transaction(() => {
    const upsertSeq = db.prepare(`
      INSERT INTO sqlite_sequence (name, seq)
      VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET seq = excluded.seq
    `);

    for (const table of TABLE_ORDER) {
      const seq = Number(importState.maxIds[table]) || 0;
      if (seq > 0) {
        upsertSeq.run(table, seq);
      }
    }
  });

  tx();
}

router.post('/full-import', requireImportSecret, (req, res) => {
  const { confirmReplaceAll, payload } = req.body || {};
  const dryRun = !!req.body?.dryRun;

  if (confirmReplaceAll !== 'REPLACE_ALL_DATA') {
    return res.status(400).json({ message: 'Missing confirmation token.' });
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ message: 'Payload object is required.' });
  }

  const categories = toArray(payload.categories);
  const users = toArray(payload.users);
  const products = toArray(payload.products);
  const vouchers = toArray(payload.vouchers);
  const orders = toArray(payload.orders);
  const orderItems = toArray(payload.orderItems);
  const voucherClaims = toArray(payload.voucherClaims);
  const notifications = toArray(payload.notifications);
  const reviews = toArray(payload.reviews);

  const summary = {
    categories: categories.length,
    users: users.length,
    products: products.length,
    vouchers: vouchers.length,
    orders: orders.length,
    orderItems: orderItems.length,
    voucherClaims: voucherClaims.length,
    notifications: notifications.length,
    reviews: reviews.length,
  };

  if (dryRun) {
    return res.status(200).json({ message: 'Dry run only. No changes written.', summary });
  }

  try {
    clearAllTables();
    initMaxIds();

    insertRows('categories', categories);
    insertRows('users', users);
    insertRows('products', products);
    insertRows('vouchers', vouchers);
    insertRows('orders', orders);
    insertRows('order_items', orderItems);
    insertRows('reviews', reviews);
    insertRows('notifications', notifications);
    insertRows('voucher_claims', voucherClaims);

    finalizeSequences();
    importState.active = false;

    return res.status(200).json({
      message: 'Full import completed successfully.',
      summary,
    });
  } catch (err) {
    console.error('Full import failed:', err);
    return res.status(500).json({ message: 'Full import failed.', error: err.message });
  }
});

router.post('/chunked-import/start', requireImportSecret, (req, res) => {
  const { confirmReplaceAll } = req.body || {};
  if (confirmReplaceAll !== 'REPLACE_ALL_DATA') {
    return res.status(400).json({ message: 'Missing confirmation token.' });
  }

  try {
    clearAllTables();
    initMaxIds();
    importState.active = true;
    return res.status(200).json({ message: 'Chunked import started.', tableOrder: TABLE_ORDER });
  } catch (err) {
    console.error('Chunked import start failed:', err);
    return res.status(500).json({ message: 'Chunked import start failed.', error: err.message });
  }
});

router.post('/chunked-import/table/:table', requireImportSecret, (req, res) => {
  if (!importState.active) {
    return res.status(409).json({ message: 'No active chunked import session.' });
  }

  const table = String(req.params.table || '').trim();
  if (!TABLE_ORDER.includes(table)) {
    return res.status(400).json({ message: `Unsupported table: ${table}` });
  }

  const rows = toArray(req.body?.rows);
  if (!rows.length) {
    return res.status(200).json({ message: 'No rows received.', table, inserted: 0 });
  }

  try {
    insertRows(table, rows);
    return res.status(200).json({ message: 'Chunk inserted.', table, inserted: rows.length });
  } catch (err) {
    console.error('Chunk insert failed:', err);
    return res.status(500).json({ message: 'Chunk insert failed.', table, error: err.message });
  }
});

router.post('/chunked-import/finalize', requireImportSecret, (_req, res) => {
  if (!importState.active) {
    return res.status(409).json({ message: 'No active chunked import session.' });
  }

  try {
    finalizeSequences();
    importState.active = false;
    return res.status(200).json({ message: 'Chunked import finalized.', maxIds: importState.maxIds });
  } catch (err) {
    console.error('Chunked import finalize failed:', err);
    return res.status(500).json({ message: 'Chunked import finalize failed.', error: err.message });
  }
});

module.exports = router;
