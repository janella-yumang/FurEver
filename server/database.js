const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Allow overriding SQLite location in production (e.g. Render persistent disk).
const requestedDbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : null;
const IS_PRODUCTION = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

const bundledDbPath = path.resolve(__dirname, 'furever.db');
const persistentTargetPath = requestedDbPath || (process.env.RENDER ? '/var/data/furever.db' : null);
const forceBundledSync = /^(1|true|yes)$/i.test(String(process.env.SQLITE_FORCE_BUNDLED_SNAPSHOT || ''));

function getDbStats(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) return null;

  const tempDb = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const getCount = (tableName) => {
      try {
        return tempDb.prepare(`SELECT COUNT(*) AS cnt FROM ${tableName}`).get().cnt;
      } catch {
        return 0;
      }
    };

    return {
      products: getCount('products'),
      vouchers: getCount('vouchers'),
      users: getCount('users'),
      orders: getCount('orders')
    };
  } finally {
    tempDb.close();
  }
}

// If persistent DB is empty on first boot, bootstrap it from the bundled DB snapshot.
if (persistentTargetPath) {
  try {
    fs.mkdirSync(path.dirname(persistentTargetPath), { recursive: true });
    if (!fs.existsSync(persistentTargetPath) && fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, persistentTargetPath);
      console.log(`[db] Seeded persistent DB from bundled snapshot: ${persistentTargetPath}`);
    } else if (fs.existsSync(persistentTargetPath) && fs.existsSync(bundledDbPath)) {
      const persistentStats = getDbStats(persistentTargetPath);
      const bundledStats = getDbStats(bundledDbPath);

      const looksLikeStarterData =
        persistentStats &&
        persistentStats.products > 0 &&
        persistentStats.products <= 10 &&
        persistentStats.vouchers <= 2;

      const bundledHasRicherData =
        persistentStats &&
        bundledStats &&
        bundledStats.products > persistentStats.products &&
        bundledStats.vouchers > persistentStats.vouchers;

      const shouldAutoSyncInDev = !IS_PRODUCTION && looksLikeStarterData && bundledHasRicherData;

      if (forceBundledSync || shouldAutoSyncInDev) {
        const backupPath = `${persistentTargetPath}.bak-${Date.now()}`;
        fs.copyFileSync(persistentTargetPath, backupPath);
        fs.copyFileSync(bundledDbPath, persistentTargetPath);
        console.log(`[db] Replaced persistent DB with bundled snapshot (backup at ${backupPath})`);
      }
    }
  } catch (error) {
    console.warn(`[db] Could not seed persistent DB at ${persistentTargetPath}: ${error.message}`);
  }
}

const dbCandidates = [
  persistentTargetPath,
  bundledDbPath,
  '/tmp/furever.db',
  requestedDbPath
].filter(Boolean);

let db;
let selectedDbPath = null;
let lastDbError = null;

for (const candidatePath of dbCandidates) {
  try {
    fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
    db = new Database(candidatePath);
    selectedDbPath = candidatePath;
    break;
  } catch (error) {
    lastDbError = error;
  }
}

if (!db) {
  throw lastDbError;
}

console.log(`[db] SQLite path: ${selectedDbPath}`);
if (process.env.RENDER && !selectedDbPath.startsWith('/var/data/')) {
  console.warn('[db] Running on non-persistent storage. Mount Render disk at /var/data to keep data after restarts.');
}

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Create tables ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    isAdmin INTEGER DEFAULT 0,
    role TEXT DEFAULT 'customer',
    shippingAddress TEXT DEFAULT '',
    preferredPets TEXT DEFAULT '[]',
    image TEXT DEFAULT '',
    isActive INTEGER DEFAULT 1,
    emailVerified INTEGER DEFAULT 0,
    verificationCode TEXT,
    verificationExpires TEXT,
    googleId TEXT,
    pushToken TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    petType TEXT DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    countInStock INTEGER NOT NULL DEFAULT 0,
    lowStockThreshold INTEGER DEFAULT 10,
    image TEXT DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    barcode TEXT DEFAULT '',
    variants TEXT DEFAULT '[]',
    expirationDate TEXT DEFAULT '',
    rating REAL DEFAULT 0,
    numReviews INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 0,
    text TEXT DEFAULT '',
    status TEXT DEFAULT 'approved',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shippingAddress1 TEXT DEFAULT '',
    shippingAddress2 TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending',
    totalPrice REAL DEFAULT 0,
    voucherDiscount REAL DEFAULT 0,
    voucherId INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
    voucherCode TEXT DEFAULT '',
    paymentMethod TEXT DEFAULT '',
    userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
    dateOrdered TEXT DEFAULT (datetime('now')),
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    productId INTEGER REFERENCES products(id) ON DELETE SET NULL,
    name TEXT DEFAULT '',
    price REAL DEFAULT 0,
    image TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    orderId INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    productId INTEGER REFERENCES products(id) ON DELETE SET NULL,
    imageUrl TEXT DEFAULT '',
    voucherId INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
    expiresAt TEXT,
    read INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT DEFAULT '',
    imageUrl TEXT DEFAULT '',
    promoCode TEXT UNIQUE NOT NULL,
    discountType TEXT NOT NULL DEFAULT 'percent',
    discountValue REAL NOT NULL DEFAULT 0,
    maxDiscount REAL DEFAULT 0,
    minOrderAmount REAL DEFAULT 0,
    startsAt TEXT,
    expiresAt TEXT,
    isActive INTEGER DEFAULT 1,
    maxClaims INTEGER DEFAULT 0,
    claimedCount INTEGER DEFAULT 0,
    createdByUserId INTEGER REFERENCES users(id) ON DELETE SET NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS voucher_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucherId INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claimedAt TEXT DEFAULT (datetime('now')),
    usedAt TEXT,
    orderId INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    UNIQUE(voucherId, userId)
  );
`);

// ─── DB consistency triggers ───────────────────────────────
db.exec(`
  CREATE TRIGGER IF NOT EXISTS trg_order_items_after_insert
  AFTER INSERT ON order_items
  BEGIN
    UPDATE orders
    SET totalPrice = COALESCE((
      SELECT SUM(COALESCE(price, 0) * COALESCE(quantity, 1))
      FROM order_items
      WHERE orderId = NEW.orderId
    ), 0),
    updatedAt = datetime('now')
    WHERE id = NEW.orderId;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_order_items_after_update
  AFTER UPDATE ON order_items
  BEGIN
    UPDATE orders
    SET totalPrice = COALESCE((
      SELECT SUM(COALESCE(price, 0) * COALESCE(quantity, 1))
      FROM order_items
      WHERE orderId = NEW.orderId
    ), 0),
    updatedAt = datetime('now')
    WHERE id = NEW.orderId;

    UPDATE orders
    SET totalPrice = COALESCE((
      SELECT SUM(COALESCE(price, 0) * COALESCE(quantity, 1))
      FROM order_items
      WHERE orderId = OLD.orderId
    ), 0),
    updatedAt = datetime('now')
    WHERE id = OLD.orderId;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_order_items_after_delete
  AFTER DELETE ON order_items
  BEGIN
    UPDATE orders
    SET totalPrice = COALESCE((
      SELECT SUM(COALESCE(price, 0) * COALESCE(quantity, 1))
      FROM order_items
      WHERE orderId = OLD.orderId
    ), 0),
    updatedAt = datetime('now')
    WHERE id = OLD.orderId;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_reviews_after_insert
  AFTER INSERT ON reviews
  BEGIN
    UPDATE products
    SET numReviews = (SELECT COUNT(*) FROM reviews WHERE productId = NEW.productId),
        rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE productId = NEW.productId), 0),
        updatedAt = datetime('now')
    WHERE id = NEW.productId;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_reviews_after_update
  AFTER UPDATE ON reviews
  BEGIN
    UPDATE products
    SET numReviews = (SELECT COUNT(*) FROM reviews WHERE productId = NEW.productId),
        rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE productId = NEW.productId), 0),
        updatedAt = datetime('now')
    WHERE id = NEW.productId;

    UPDATE products
    SET numReviews = (SELECT COUNT(*) FROM reviews WHERE productId = OLD.productId),
        rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE productId = OLD.productId), 0),
        updatedAt = datetime('now')
    WHERE id = OLD.productId;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_reviews_after_delete
  AFTER DELETE ON reviews
  BEGIN
    UPDATE products
    SET numReviews = (SELECT COUNT(*) FROM reviews WHERE productId = OLD.productId),
        rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE productId = OLD.productId), 0),
        updatedAt = datetime('now')
    WHERE id = OLD.productId;
  END;
`);

// ─── One-time/startup data repair ──────────────────────────
function repairDataConsistency() {
  const tx = db.transaction(() => {
    const fixedOrderItemProductIds = db.prepare(`
      UPDATE order_items
      SET productId = (
        SELECT p.id
        FROM products p
        WHERE LOWER(TRIM(COALESCE(p.name, ''))) = LOWER(TRIM(COALESCE(order_items.name, '')))
        LIMIT 1
      )
      WHERE productId IS NULL
        AND COALESCE(TRIM(name), '') <> ''
    `).run().changes;

    const repairedOrderTotals = db.prepare(`
      UPDATE orders
      SET totalPrice = COALESCE((
          SELECT SUM(COALESCE(oi.price, 0) * COALESCE(oi.quantity, 1))
          FROM order_items oi
          WHERE oi.orderId = orders.id
        ), 0),
        updatedAt = datetime('now')
    `).run().changes;

    const repairedProductRatings = db.prepare(`
      UPDATE products
      SET numReviews = (
          SELECT COUNT(*) FROM reviews r WHERE r.productId = products.id
        ),
        rating = COALESCE((
          SELECT AVG(r.rating) FROM reviews r WHERE r.productId = products.id
        ), 0),
        updatedAt = datetime('now')
    `).run().changes;

    return { fixedOrderItemProductIds, repairedOrderTotals, repairedProductRatings };
  });

  try {
    const result = tx();
    console.log('✓ Data consistency repair completed:', result);
  } catch (error) {
    console.error('✗ Data consistency repair failed:', error.message);
  }
}

repairDataConsistency();

// Ensure newly introduced columns exist for older local DB files.
function migrateSchemaIfNeeded() {
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const hasPushToken = userColumns.some((col) => col.name === 'pushToken');
    if (!hasPushToken) {
      db.exec('ALTER TABLE users ADD COLUMN pushToken TEXT');
      console.log('✓ Migration applied: users.pushToken added');
    }

    const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
    if (!orderColumns.some((col) => col.name === 'voucherDiscount')) {
      db.exec('ALTER TABLE orders ADD COLUMN voucherDiscount REAL DEFAULT 0');
      console.log('✓ Migration applied: orders.voucherDiscount added');
    }
    if (!orderColumns.some((col) => col.name === 'voucherId')) {
      db.exec('ALTER TABLE orders ADD COLUMN voucherId INTEGER');
      console.log('✓ Migration applied: orders.voucherId added');
    }
    if (!orderColumns.some((col) => col.name === 'voucherCode')) {
      db.exec("ALTER TABLE orders ADD COLUMN voucherCode TEXT DEFAULT ''");
      console.log('✓ Migration applied: orders.voucherCode added');
    }

    const notificationColumns = db.prepare("PRAGMA table_info(notifications)").all();
    if (!notificationColumns.some((col) => col.name === 'imageUrl')) {
      db.exec("ALTER TABLE notifications ADD COLUMN imageUrl TEXT DEFAULT ''");
      console.log('✓ Migration applied: notifications.imageUrl added');
    }
    if (!notificationColumns.some((col) => col.name === 'voucherId')) {
      db.exec('ALTER TABLE notifications ADD COLUMN voucherId INTEGER');
      console.log('✓ Migration applied: notifications.voucherId added');
    }
    if (!notificationColumns.some((col) => col.name === 'expiresAt')) {
      db.exec('ALTER TABLE notifications ADD COLUMN expiresAt TEXT');
      console.log('✓ Migration applied: notifications.expiresAt added');
    }

    // ─── Review photos ──────────────────────────────────────
    const reviewColumns = db.prepare("PRAGMA table_info(reviews)").all();
    if (!reviewColumns.some((col) => col.name === 'image')) {
      db.exec("ALTER TABLE reviews ADD COLUMN image TEXT DEFAULT ''");
      console.log('✓ Migration applied: reviews.image added');
    }

    // ─── Loyalty points ─────────────────────────────────────
    if (!userColumns.some((col) => col.name === 'loyaltyPoints')) {
      db.exec('ALTER TABLE users ADD COLUMN loyaltyPoints INTEGER DEFAULT 0');
      console.log('✓ Migration applied: users.loyaltyPoints added');
    }
  } catch (error) {
    console.error('✗ Schema migration failed:', error.message);
  }
}

migrateSchemaIfNeeded();

function ensureBaselineData() {
  try {
    const now = new Date().toISOString();
    const categoryDefs = [
      { name: 'Pet Food', color: '#FF8C42', icon: 'food-drumstick' },
      { name: 'Treats', color: '#FFA726', icon: 'cookie' },
      { name: 'Toys', color: '#66BB6A', icon: 'gamepad-variant' },
      { name: 'Grooming', color: '#42A5F5', icon: 'content-cut' },
      { name: 'Health', color: '#EF5350', icon: 'medical-bag' },
      { name: 'Accessories', color: '#AB47BC', icon: 'collar' },
      { name: 'Habitat', color: '#8D6E63', icon: 'home' }
    ];

    const categoryIdsByName = {};
    for (const category of categoryDefs) {
      const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1').get(category.name);
      if (existing) {
        categoryIdsByName[category.name] = existing.id;
        continue;
      }

      const inserted = db.prepare(`
        INSERT INTO categories (name, color, icon, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(category.name, category.color, category.icon, now, now);
      categoryIdsByName[category.name] = inserted.lastInsertRowid;
    }

    const totalProducts = db.prepare('SELECT COUNT(*) AS cnt FROM products').get().cnt;
    if (totalProducts === 0) {
      const starterProducts = [
        {
          name: 'Chicken & Rice Dog Food', categoryName: 'Pet Food', petType: 'Dog', price: 34.99,
          countInStock: 80, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&q=80',
          description: 'Premium dry dog food made with real chicken and brown rice.', barcode: 'FE-FOOD-001',
          variants: ['2kg', '5kg', '10kg'], expirationDate: '2026-08-15'
        },
        {
          name: 'Salmon Pate Cat Food', categoryName: 'Pet Food', petType: 'Cat', price: 27.49,
          countInStock: 65, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=400&q=80',
          description: 'Grain-free wet cat food with wild-caught salmon.', barcode: 'FE-FOOD-002',
          variants: ['85g can', '156g can', '12-pack'], expirationDate: '2026-05-20'
        },
        {
          name: 'Crunchy Peanut Butter Dog Treats', categoryName: 'Treats', petType: 'Dog', price: 11.99,
          countInStock: 120, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&q=80',
          description: 'All-natural baked dog treats with peanut butter.', barcode: 'FE-TREAT-001',
          variants: ['100g', '250g', '500g'], expirationDate: '2026-03-10'
        },
        {
          name: 'Interactive Feather Wand Cat Toy', categoryName: 'Toys', petType: 'Cat', price: 8.99,
          countInStock: 90, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1531209869568-96b8fd6b7e78?w=400&q=80',
          description: 'Telescoping feather wand toy to stimulate your cat\'s hunting instincts.', barcode: 'FE-TOY-001',
          variants: [], expirationDate: ''
        },
        {
          name: 'Oatmeal & Aloe Dog Shampoo', categoryName: 'Grooming', petType: 'Dog', price: 16.99,
          countInStock: 45, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80',
          description: 'Gentle, soap-free shampoo for sensitive skin.', barcode: 'FE-GROOM-001',
          variants: ['250ml', '500ml', '1L'], expirationDate: ''
        },
        {
          name: 'Multivitamin Chews for Cats', categoryName: 'Health', petType: 'Cat', price: 19.99,
          countInStock: 55, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&q=80',
          description: 'Daily multivitamin soft chews supporting immune health.', barcode: 'FE-HEALTH-001',
          variants: ['30 chews', '60 chews', '120 chews'], expirationDate: '2026-11-30'
        },
        {
          name: 'Adjustable Nylon Dog Harness', categoryName: 'Accessories', petType: 'Dog', price: 22.99,
          countInStock: 35, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1570649889742-f049cd451bba?w=400&q=80',
          description: 'No-pull dog harness with breathable mesh padding.', barcode: 'FE-ACC-001',
          variants: ['XS', 'S', 'M', 'L', 'XL'], expirationDate: ''
        },
        {
          name: 'Tropical Fish Food Pellets', categoryName: 'Pet Food', petType: 'Fish', price: 9.99,
          countInStock: 100, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1546696418-0dffeefbbe9b?w=400&q=80',
          description: 'Slow-sinking micro pellets for tropical freshwater fish.', barcode: 'FE-FOOD-003',
          variants: ['50g', '100g', '200g'], expirationDate: '2027-01-15'
        },
        {
          name: 'Wooden Hideout for Small Pets', categoryName: 'Habitat', petType: 'Hamster', price: 14.49,
          countInStock: 40, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1425082661507-3f9c4cba2aae?w=400&q=80',
          description: 'Natural pine wood hideout for hamsters, gerbils, and mice.', barcode: 'FE-HAB-001',
          variants: ['Small', 'Medium'], expirationDate: ''
        },
        {
          name: 'Colorful Rope Perch for Birds', categoryName: 'Accessories', petType: 'Bird', price: 12.49,
          countInStock: 50, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&q=80',
          description: 'Flexible cotton rope perch in vibrant colors.', barcode: 'FE-ACC-002',
          variants: ['Small (30cm)', 'Large (60cm)'], expirationDate: ''
        }
      ];

      const insertProduct = db.prepare(`
        INSERT INTO products (
          name, category, petType, price, countInStock, lowStockThreshold,
          image, description, barcode, variants, expirationDate,
          rating, numReviews, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const product of starterProducts) {
        insertProduct.run(
          product.name,
          categoryIdsByName[product.categoryName] || null,
          product.petType,
          product.price,
          product.countInStock,
          product.lowStockThreshold,
          product.image,
          product.description,
          product.barcode,
          JSON.stringify(product.variants || []),
          product.expirationDate || '',
          0,
          0,
          now,
          now
        );
      }

      console.log(`✓ Starter catalog seeded: ${starterProducts.length} products`);
    }

    const totalUsers = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
    if (totalUsers === 0) {
      const defaultPassword = bcrypt.hashSync('password123', 10);
      const insertUser = db.prepare(`
        INSERT INTO users (
          name, email, password, phone, isAdmin, role, shippingAddress,
          preferredPets, image, isActive, emailVerified, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const users = [
        {
          name: 'Jannella Yumang', email: 'admin@furever.com', phone: '09181234567',
          isAdmin: 1, role: 'admin', shippingAddress: '123 FurEver HQ, Quezon City, Metro Manila, 1100',
          preferredPets: []
        },
        {
          name: 'Emma Pascua', email: 'user@furever.com', phone: '09171234567',
          isAdmin: 0, role: 'customer', shippingAddress: '456 Pet Lover Ave, Makati City, Metro Manila, 1200',
          preferredPets: ['Dog', 'Cat']
        },
        {
          name: 'Juan Dela Cruz', email: 'juan@furever.com', phone: '09191234567',
          isAdmin: 0, role: 'customer', shippingAddress: '789 Sampaguita St, Cebu City, Cebu, 6000',
          preferredPets: ['Fish', 'Bird']
        }
      ];

      for (const user of users) {
        insertUser.run(
          user.name,
          user.email,
          defaultPassword,
          user.phone,
          user.isAdmin,
          user.role,
          user.shippingAddress,
          JSON.stringify(user.preferredPets || []),
          '',
          1,
          1,
          now,
          now
        );
      }

      console.log('✓ Default users seeded (admin + 2 customers)');
    }

    const totalVouchers = db.prepare('SELECT COUNT(*) AS cnt FROM vouchers').get().cnt;
    if (totalVouchers === 0) {
      const admin = db.prepare('SELECT id FROM users WHERE isAdmin = 1 ORDER BY id ASC LIMIT 1').get();
      const adminId = admin ? admin.id : null;

      const insertVoucher = db.prepare(`
        INSERT INTO vouchers (
          title, message, imageUrl, promoCode, discountType, discountValue,
          maxDiscount, minOrderAmount, startsAt, expiresAt, isActive,
          maxClaims, claimedCount, createdByUserId, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertVoucher.run(
        'Welcome 10% Off',
        'Use this voucher on your first purchase.',
        '',
        'WELCOME10',
        'percent',
        10,
        150,
        0,
        now,
        '2027-12-31T23:59:59.000Z',
        1,
        0,
        0,
        adminId,
        now,
        now
      );

      insertVoucher.run(
        'Free Shipping Boost',
        'Get a fixed discount to offset shipping for minimum spend.',
        '',
        'SHIP50',
        'fixed',
        50,
        50,
        499,
        now,
        '2027-12-31T23:59:59.000Z',
        1,
        0,
        0,
        adminId,
        now,
        now
      );

      console.log('✓ Starter vouchers seeded: 2 active vouchers');
    }
  } catch (error) {
    console.error('✗ Baseline data seed failed:', error.message);
  }
}

ensureBaselineData();

// ─── Helper: add _id alias to match Mongoose-style responses ─
function addId(row) {
  if (!row) return null;
  return { ...row, _id: String(row.id) };
}

function addIds(rows) {
  return rows.map(addId);
}

function nowISO() {
  return new Date().toISOString();
}

module.exports = { db, addId, addIds, nowISO };
