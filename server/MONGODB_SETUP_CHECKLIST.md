/**
 * QUICK START GUIDE - MongoDB Configuration Complete
 * 
 * Your FurEver backend is now configured for MongoDB!
 */

## Status Summary

### ✅ Completed
- MongoDB Mongoose connection setup in database.js
- Mongoose schemas created for all collections
- User, Category, and Product models converted ✓
- index.js configured for MongoDB startup
- package.json dependencies updated (removed SQLite, added Mongoose)
- seed-mongodb.js script created for initial data
- Comprehensive MONGODB_MIGRATION_GUIDE.md created

### 🔄 In Progress - Need Your Action

## CRITICAL: Update Routes to Use Async Methods

All model methods are NOW ASYNC. Every route that calls a model must use `await`:

### Example: Before and After

**OLD (SQLite - synchronous):**
```javascript
// routes/users.js
const user = User.findById(req.params.id);
res.json(user);
```

**NEW (MongoDB - asynchronous):**
```javascript
// routes/users.js
try {
  const user = await User.findById(req.params.id);  // Must await!
  res.json(user);
} catch (error) {
  res.status(500).json({ error: error.message });
}
```

## Remaining Tasks (Priority Order)

### 1. Replace Order.js with Template Contents
File: `server/models/Order.js.template` → Copy to `server/models/Order.js`

### 2. Create Voucher.js and Notification.js
Use templates provided or refer to database.js schemas

### 3. Update All Routes
Critical routes to update:
- `/server/routes/users.js` - Add await/try-catch
- `/server/routes/products.js` - Add await/try-catch  
- `/server/routes/orders.js` - Add await/try-catch
- `/server/routes/categories.js` - Add await/try-catch
- `/server/routes/vouchers.js` - Add await/try-catch
- `/server/routes/notifications.js` - Add await/try-catch

### 4. Test Authentication
Make sure JWT middleware works with async calls

## Installation & First Run

```bash
cd server
npm install mongoose  # Already done!

# Seed MongoDB with initial data
npm run seed

# Start development server
npm run dev

# Test the connection
curl http://localhost:4001/api/v1/health
# Should return: { "status": "ok", "db": "mongodb", "connected": true }
```

## Common Errors & Solutions

### Error: "Cannot read property 'toObject' of null"
Fix: Check if document exists before calling methods
```javascript
const doc = await User.findById(id);
if (!doc) return res.status(404).json({ error: 'Not found' });
```

### Error: "User.create(...) is not a function"
Fix: Model method is now async - you forgot `await`
```javascript
const user = await User.create(data);  // Add await!
```

### Error: "Cannot read property 'user' of undefined"
Fix: Express route handler must be async
```javascript
// Before
router.get('/users/:id', (req, res) => {
  
// After
router.get('/users/:id', async (req, res) => {
```

### MongoDB Connection Error
- Check IP allowlist in MongoDB Atlas dashboard
- Verify CONNECTION_STRING in .env file
- Ensure network connectivity to cluster0.mongodb.net

## Authentication Middleware Update

If you have auth middleware using database queries, it needs `await`:

```javascript
// middleware/auth.js example
module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);  // Must await!
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

## File Locations & Next Steps

**Already Completed:**
- ✅ `/server/database.js` - Full Mongoose setup
- ✅ `/server/models/User.js` - Mongoose async version
- ✅ `/server/models/Category.js` - Mongoose async version
- ✅ `/server/models/Product.js` - Mongoose async version (with reviews)
- ✅ `/server/seed-mongodb.js` - MongoDB seeding script
- ✅ `/server/package.json` - Dependencies updated
- ✅ `/server/index.js` - Connection initialization

**Templates Provided:**
- 📄 `/server/models/Order.js.template` - Ready to use
- 📄 `/server/MONGODB_MIGRATION_GUIDE.md` - Reference guide

**Still Need Updating:**
- `/server/models/Voucher.js` - Create from template
- `/server/models/Notification.js` - Create from template  
- `/server/models/Review.js` - Already integrated in Product.js
- All route files - Add await/try-catch wrapping

## Testing Checklist

Before deploying to production:

- [ ] Run `npm run seed` successfully
- [ ] Start server: `npm run dev`
- [ ] Test health endpoint: GET /api/v1/health returns `"db": "mongodb"`
- [ ] Create user via API
- [ ] Read user from MongoDB
- [ ] Update user 
- [ ] Delete user
- [ ] List products with pagination
- [ ] Create order with items
- [ ] Push notifications still work
- [ ] Authentication middleware works
- [ ] All routes handle errors properly

## Monitoring & Logs

Check MongoDB logs and Node server logs:

```bash
# Terminal 1: Watch Node logs
npm run dev

# Terminal 2: Check MongoDB activity (if you have MongoDB CLI)
mongo "mongodb+srv://emmarose15pascua:..." --eval "db.currentOp()"
```

## Support Resources

- MongoDB Documentation: https://docs.mongodb.com
- Mongoose Documentation: https://mongoosejs.com
- Your current .env already has MongoDB credentials configured ✅

## Next Meeting Items

1. Confirm Order, Voucher, Notification models are updated
2. Test all API endpoints with Postman
3. Verify push notifications work with MongoDB
4. Set up MongoDB backups
5. Performance optimization if needed

---

**Summary:** Your backend is ~70% migrated. Focus on updating routes to use async/await, then test thoroughly before production deployment.
