const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    petType: { type: String, default: '' },
    price: { type: Number, required: true, default: 0 },
    countInStock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    image: { type: String, default: '' },
    description: { type: String, required: true },
    barcode: { type: String, default: '' },
    variants: { type: [String], default: [] },
    expirationDate: { type: String, default: '' },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],
  },
  { timestamps: true }
);

productSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

productSchema.virtual('isOutOfStock').get(function () {
  return this.countInStock === 0;
});

productSchema.virtual('isLowStock').get(function () {
  return this.countInStock > 0 && this.countInStock <= this.lowStockThreshold;
});

productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
