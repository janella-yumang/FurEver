const Database = require('better-sqlite3');
const path = require('path');

// Allow overriding SQLite location in production (e.g. Render persistent disk).
const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(__dirname, 'furever.db');

const db = new Database(DB_PATH);

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
