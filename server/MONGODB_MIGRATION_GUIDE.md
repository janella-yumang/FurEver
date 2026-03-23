# MongoDB Migration Configuration Guide

## Completed Updates

### 1. ✅ package.json
- Replaced `better-sqlite3` with `mongoose@^8.0.0`
- Added `npm run seed` command for MongoDB seeding

### 2. ✅ database.js
- Converted to MongoDB/Mongoose connection
- Created all Mongoose schemas (User, Product, Category, Order, Voucher, etc.)
- Exported models and helper functions (`connectDB`, `addId`, `addIds`, `nowISO`, `repairDataConsistency`)

### 3. ✅ index.js
- Updated to call `connectDB()` on startup
- Changed health check endpoint to return `db: 'mongodb'`

### 4. ✅ Models Updated (Mongoose)
- `User.js` - Fully migrated with async methods
- `Category.js` - Fully migrated with async methods
- `Product.js` - Fully migrated with review handling (async methods)

### 5. ✅ seed-mongodb.js
- New MongoDB seeding script
- Initializes categories, products, users, and vouchers

## Remaining Updates Required

### Models Still Need Updating:
1. **Order.js** - Convert SQLite model to Mongoose async methods
2. **Voucher.js** - Convert SQLite model to Mongoose async methods
3. **Notification.js** - Convert SQLite model to Mongoose async methods
4. **Review handling** - Already integrated in Product.js ✅

### Routes Require Updates (work with async/await):
- `routes/users.js` - Wrap controller calls with try/catch
- `routes/products.js` - Convert db.prepare() queries to Mongoose
- `routes/orders.js` - Convert to Mongoose queries
- `routes/categories.js` - Convert to Mongoose queries
- `routes/vouchers.js` - Convert to Mongoose queries
- `routes/notifications.js` - Convert to Mongoose queries

### Migration Scripts to Update:
- `migrate-local-sqlite-to-remote.js` - Adapt for MongoDB
- `migrate-full-sqlite-to-remote.js` - Adapt for MongoDB
- `add-more-products.js` - Adapt for MongoDB
- `add-more-vouchers.js` - Adapt for MongoDB
- `add-users.js` - Adapt for MongoDB

## Environment Variables Already Set

Your `.env` file has MongoDB credentials configured:
```
CONNECTION_STRING=mongodb+srv://emmarose15pascua:mXtVxkX5UMtpjHfb@cluster0.jrkup9m.mongodb.net/?appName=Cluster0
DB_NAME=furever_db
DB_USER=emmarose15pascua
```

## Installation & Setup Steps

```bash
cd server
npm install  # This will install mongoose and remove better-sqlite3

# Seed MongoDB with initial data
npm run seed

# Start the server
npm run dev
```

## Key Changes Made

### Database Connection
```javascript
// OLD: SQLite file-based
const db = new Database(selectedDbPath);

// NEW: MongoDB Atlas connection
const conn = await mongoose.connect(process.env.CONNECTION_STRING, {
  dbName: process.env.DB_NAME,
});
```

### Data Types
- INTEGER → Number/mongoose number schema
- TEXT → String
- REAL → Number with parseFloat
- DateTime → JavaScript Date objects
- JSON strings → Arrays/Objects in MongoDB (native support)

### Query Pattern Changes
```javascript
// OLD: SQLite
db.prepare('SELECT * FROM users WHERE email = ?').get(email)

// NEW: Mongoose
await User.findOne({ email: email.toLowerCase() })
```

### Create/Update Operations
```javascript
// OLD: SQLite with db.prepare()
const info = db.prepare('INSERT INTO users ...').run(...)

// NEW: Mongoose
const user = new User({ ...data });
const saved = await user.save();
```

## Model Method Signatures Changed

All model methods are now **async**. Routes and controllers must use `await`:

```javascript
// OLD
const user = User.findById(id);

// NEW  
const user = await User.findById(id)  // Must await!
```

## Next Steps

1. **Update remaining models** (Order, Voucher, Notification)
2. **Update all routes** to handle async operations
3. **Test API endpoints** with Postman or similar
4. **Migrate data** from SQLite to MongoDB (if needed)
5. **Update authentication middleware** if it uses db queries
6. **Test push notifications** workflow

## Troubleshooting

### Connection Issues
- Verify MongoDB Atlas IP whitelist includes your current IP
- Check CONNECTION_STRING format and credentials
- Ensure network connectivity to MongoDB Atlas

### Async/Await Errors
- All database calls are now async
- Use `try/catch` blocks in routes
- Ensure `async` keyword on route handlers

### Data Type Mismatches
- Verify ObjectId references in relationships
- Use `populate()` for related documents
- Test aggregation pipelines if complex queries needed

## Files Modified

- ✅ `package.json`
- ✅ `database.js` (complete rewrite)
- ✅ `index.js` (connection initialization)
- ✅ `models/User.js`
- ✅ `models/Category.js`
- ✅ `models/Product.js`
- ✅ `seed-mongodb.js` (new file)

## Files Still To Update

- `models/Order.js`
- `models/Voucher.js`
- `models/Notification.js`
- `routes/users.js`
- `routes/products.js`
- `routes/orders.js`
- `routes/categories.js`
- `routes/vouchers.js`
- `routes/notifications.js`
- `routes/analytics.js`
- `migrate-*.js` scripts
- `add-*.js` scripts
