const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'furever.db');

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
    read INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );
`);

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
