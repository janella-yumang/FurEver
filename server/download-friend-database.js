#!/usr/bin/env node
/**
 * Download database from friend's Render deployment and import it locally
 * 
 * Usage:
 *   node download-friend-database.js --remote https://furever-1-lekw.onrender.com
 *   node download-friend-database.js --remote https://furever-1-lekw.onrender.com --secret migration-import-secret
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DEFAULT_REMOTE = String(process.env.API_URL || 'https://furever-1-lekw.onrender.com').trim();
const DEFAULT_SECRET = String(process.env.MIGRATION_IMPORT_SECRET || '').trim();

function parseArgs(argv) {
  const out = {
    remote: DEFAULT_REMOTE,
    secret: DEFAULT_SECRET,
    save: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--remote' && argv[i + 1]) {
      out.remote = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (token === '--secret' && argv[i + 1]) {
      out.secret = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (token === '--save') {
      out.save = true;
    }
  }

  return out;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.remote) {
    console.error('❌ Remote URL is required. Usage: node download-friend-database.js --remote https://furever-1-lekw.onrender.com');
    process.exit(1);
  }

  const exportUrl = `${args.remote.replace(/\/$/, '')}/api/v1/migration/export`;
  console.log(`📥 Downloading database from: ${exportUrl}`);

  try {
    // Download data
    const response = await axios.get(exportUrl, {
      timeout: 30000,
      headers: args.secret ? { 'x-migration-secret': args.secret } : {},
    });

    const data = response.data;
    console.log('✅ Database downloaded successfully!');

    // Summary
    console.log('\n📊 Downloaded data:');
    console.log(`  - Categories: ${(data.categories || []).length}`);
    console.log(`  - Users: ${(data.users || []).length}`);
    console.log(`  - Products: ${(data.products || []).length}`);
    console.log(`  - Orders: ${(data.orders || []).length}`);
    console.log(`  - Vouchers: ${(data.vouchers || []).length}`);
    console.log(`  - Reviews: ${(data.reviews || []).length}`);
    console.log(`  - Notifications: ${(data.notifications || []).length}`);

    // Save to file if requested
    if (args.save) {
      const filename = `furever-export-${new Date().toISOString().split('T')[0]}.json`;
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`\n💾 Saved to: ${filename}`);
    }

    // Import locally
    console.log('\n🔄 Importing into local database...');
    const { db } = require('./database');

    // Clear all tables
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

    const tx = db.transaction(() => {
      db.pragma('foreign_keys = OFF');
      for (const table of CLEAR_ORDER) {
        db.prepare(`DELETE FROM ${table}`).run();
        db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
      }
      db.pragma('foreign_keys = ON');
    });
    tx();

    // Insert data
    const insertData = (table, rows) => {
      if (!rows || !Array.isArray(rows) || rows.length === 0) return 0;

      const stmts = {
        categories: db.prepare(`INSERT INTO categories (id, name, color, icon, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`),
        users: db.prepare(`INSERT INTO users (id, name, email, password, phone, isAdmin, role, shippingAddress, preferredPets, image, isActive, emailVerified, verificationCode, verificationExpires, googleId, pushToken, loyaltyPoints, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        products: db.prepare(`INSERT INTO products (id, name, category, petType, price, countInStock, lowStockThreshold, image, description, barcode, variants, expirationDate, rating, numReviews, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        vouchers: db.prepare(`INSERT INTO vouchers (id, title, message, imageUrl, promoCode, discountType, discountValue, maxDiscount, minOrderAmount, startsAt, expiresAt, isActive, maxClaims, claimedCount, createdByUserId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        orders: db.prepare(`INSERT INTO orders (id, shippingAddress1, shippingAddress2, phone, status, totalPrice, voucherDiscount, voucherId, voucherCode, paymentMethod, userId, dateOrdered, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        order_items: db.prepare(`INSERT INTO order_items (id, orderId, productId, name, price, image, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)`),
        reviews: db.prepare(`INSERT INTO reviews (id, productId, userId, name, rating, text, image, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        notifications: db.prepare(`INSERT INTO notifications (id, userId, type, title, message, orderId, productId, imageUrl, voucherId, expiresAt, read, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        voucher_claims: db.prepare(`INSERT INTO voucher_claims (id, voucherId, userId, claimedAt, usedAt, orderId) VALUES (?, ?, ?, ?, ?, ?)`),
      };

      const stmt = stmts[table];
      if (!stmt) return 0;

      const insertTx = db.transaction(() => {
        for (const row of rows) {
          if (!row) continue;

          if (table === 'categories') {
            stmt.run(row.id, row.name || '', row.color || '', row.icon || '', row.createdAt || null, row.updatedAt || null);
          } else if (table === 'users') {
            stmt.run(row.id, row.name || '', row.email || '', row.password || '', row.phone || '', row.isAdmin || 0, row.role || 'customer', row.shippingAddress || '', row.preferredPets || '[]', row.image || '', row.isActive === 0 ? 0 : 1, row.emailVerified || 0, row.verificationCode || null, row.verificationExpires || null, row.googleId || null, row.pushToken || null, row.loyaltyPoints || 0, row.createdAt || null, row.updatedAt || null);
          } else if (table === 'products') {
            stmt.run(row.id, row.name || '', row.category || null, row.petType || '', row.price || 0, row.countInStock || 0, row.lowStockThreshold || 10, row.image || '', row.description || '', row.barcode || '', row.variants || '[]', row.expirationDate || '', row.rating || 0, row.numReviews || 0, row.createdAt || null, row.updatedAt || null);
          } else if (table === 'vouchers') {
            stmt.run(row.id, row.title || '', row.message || '', row.imageUrl || '', row.promoCode || '', row.discountType || 'percent', row.discountValue || 0, row.maxDiscount || 0, row.minOrderAmount || 0, row.startsAt || null, row.expiresAt || null, row.isActive || 0, row.maxClaims || 0, row.claimedCount || 0, row.createdByUserId || null, row.createdAt || null, row.updatedAt || null);
          } else if (table === 'orders') {
            stmt.run(row.id, row.shippingAddress1 || '', row.shippingAddress2 || '', row.phone || '', row.status || 'Pending', row.totalPrice || 0, row.voucherDiscount || 0, row.voucherId || null, row.voucherCode || '', row.paymentMethod || '', row.userId || null, row.dateOrdered || null, row.createdAt || null, row.updatedAt || null);
          } else if (table === 'order_items') {
            stmt.run(row.id, row.orderId, row.productId || null, row.name || '', row.price || 0, row.image || '', row.quantity || 1);
          } else if (table === 'reviews') {
            stmt.run(row.id, row.productId, row.userId || null, row.name || '', row.rating || 0, row.text || '', row.image || '', row.status || 'approved', row.createdAt || null, row.updatedAt || null);
          } else if (table === 'notifications') {
            stmt.run(row.id, row.userId, row.type || 'system', row.title || '', row.message || '', row.orderId || null, row.productId || null, row.imageUrl || '', row.voucherId || null, row.expiresAt || null, row.read || 0, row.createdAt || null, row.updatedAt || null);
          } else if (table === 'voucher_claims') {
            stmt.run(row.id, row.voucherId, row.userId, row.claimedAt || null, row.usedAt || null, row.orderId || null);
          }
        }
      });

      insertTx();
      return rows.length;
    };

    // Insert all data
    const summary = {
      categories: insertData('categories', data.categories),
      users: insertData('users', data.users),
      products: insertData('products', data.products),
      vouchers: insertData('vouchers', data.vouchers),
      orders: insertData('orders', data.orders),
      order_items: insertData('order_items', data.order_items),
      reviews: insertData('reviews', data.reviews),
      notifications: insertData('notifications', data.notifications),
      voucher_claims: insertData('voucher_claims', data.voucher_claims),
    };

    console.log('\n✅ Import completed successfully!');
    console.log('\n📈 Imported to local database:');
    console.log(`  - Categories: ${summary.categories}`);
    console.log(`  - Users: ${summary.users}`);
    console.log(`  - Products: ${summary.products}`);
    console.log(`  - Orders: ${summary.orders}`);
    console.log(`  - Vouchers: ${summary.vouchers}`);
    console.log(`  - Reviews: ${summary.reviews}`);
    console.log(`  - Notifications: ${summary.notifications}`);

    console.log('\n✨ Your local database now has your friend\'s data!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

run();
