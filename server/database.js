
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// ─── MongoDB Connection ─────────────────────────────────────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.CONNECTION_STRING || '', {
      dbName: process.env.DB_NAME || 'furever_db',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[db] MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[db] MongoDB connection failed: ${error.message}`);
    throw error;
  }
};

// ─── Schemas ───────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
  role: { type: String, default: 'customer' },
  shippingAddress: { type: String, default: '' },
  preferredPets: { type: [String], default: [] },
  image: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationExpires: { type: Date },
  googleId: { type: String },
  pushToken: { type: String },
  loyaltyPoints: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: '' },
  icon: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  petType: { type: String, default: '' },
  price: { type: Number, default: 0 },
  countInStock: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 10 },
  image: { type: String, default: '' },
  description: { type: String, default: '' },
  barcode: { type: String, default: '', index: true },
  variants: { type: [String], default: [] },
  expirationDate: { type: String, default: '' },
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, default: '' },
  rating: { type: Number, default: 0 },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  status: { type: String, default: 'approved' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, default: '' },
  price: { type: Number, default: 0 },
  image: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shippingAddress1: { type: String, default: '' },
  shippingAddress2: { type: String, default: '' },
  phone: { type: String, default: '' },
  status: { type: String, default: 'Pending' },
  totalPrice: { type: Number, default: 0 },
  voucherDiscount: { type: Number, default: 0 },
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
  voucherCode: { type: String, default: '' },
  paymentMethod: { type: String, default: '' },
  dateOrdered: { type: Date, default: Date.now },
  items: [orderItemSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const voucherClaimSchema = new mongoose.Schema({
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  claimedAt: { type: Date, default: Date.now },
  usedAt: { type: Date },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
});

voucherClaimSchema.index({ voucherId: 1, userId: 1 }, { unique: true });

const voucherSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  promoCode: { type: String, required: true, unique: true },
  discountType: { type: String, default: 'percent' },
  discountValue: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: 0 },
  minOrderAmount: { type: Number, default: 0 },
  startsAt: { type: Date },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  maxClaims: { type: Number, default: 0 },
  claimedCount: { type: Number, default: 0 },
  createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  imageUrl: { type: String, default: '' },
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
  expiresAt: { type: Date },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// ─── Models ────────────────────────────────────────────────
const User = mongoose.model('User', userSchema);
const Category = mongoose.model('Category', categorySchema);
const Product = mongoose.model('Product', productSchema);
const Review = mongoose.model('Review', reviewSchema);
const Order = mongoose.model('Order', orderSchema);
const Voucher = mongoose.model('Voucher', voucherSchema);
const VoucherClaim = mongoose.model('VoucherClaim', voucherClaimSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// ─── Data Repair Functions ─────────────────────────────────
async function repairDataConsistency() {
  try {
    // Recalculate product ratings from reviews
    const products = await Product.find({});
    let repairedProductRatings = 0;
    for (const product of products) {
      const reviews = await Review.find({ productId: product._id });
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        await Product.updateOne(
          { _id: product._id },
          { rating: avgRating, numReviews: reviews.length, updatedAt: nowISO() }
        );
      } else {
        await Product.updateOne(
          { _id: product._id },
          { rating: 0, numReviews: 0, updatedAt: nowISO() }
        );
      }
      repairedProductRatings++;
    }

    // Recalculate order totals from order items
    const orders = await Order.find({});
    let repairedOrderTotals = 0;
    for (const order of orders) {
      const totalPrice = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      await Order.updateOne(
        { _id: order._id },
        { totalPrice, updatedAt: nowISO() }
      );
      repairedOrderTotals++;
    }

    console.log('✓ Data consistency repair completed:', { repairedOrderTotals, repairedProductRatings });
  } catch (error) {
    console.error('✗ Data consistency repair failed:', error.message);
  }
}

// ─── Helper Functions ──────────────────────────────────────
function addId(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.id = obj._id;
  return obj;
}

function addIds(docs) {
  return docs.map(addId);
}

function nowISO() {
  return new Date().toISOString();
}

module.exports = {
  connectDB,
  User,
  Category,
  Product,
  Review,
  Order,
  Voucher,
  VoucherClaim,
  Notification,
  addId,
  addIds,
  nowISO,
  repairDataConsistency,
};
