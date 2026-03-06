const express = require('express');
const multer = require('multer');
const Product = require('../models/Product');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: extract userId from token
const getUserId = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch {
    return null;
  }
};

const safeParseArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
};

// GET all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().populate('category');
    return res.status(200).json(products);
  } catch (err) {
    console.error('Get products error:', err);
    return res.status(500).json({ message: 'Failed to fetch products.' });
  }
});

// GET all reviews across all products (admin only) — must be before /:id
router.get('/admin/reviews/all', async (req, res) => {
  try {
    const isAdmin = getIsAdmin(req);
    if (!isAdmin) return res.status(403).json({ message: 'Admin access required.' });

    const products = await Product.find({ 'reviews.0': { $exists: true } })
      .select('name image reviews')
      .populate('reviews.user', 'name email image');

    const allReviews = [];
    products.forEach((product) => {
      product.reviews.forEach((r) => {
        allReviews.push({
          _id: r._id,
          productId: product._id,
          productName: product.name,
          productImage: product.image,
          user: r.user,
          name: r.name,
          rating: r.rating,
          text: r.text,
          status: r.status || 'pending',
          date: r.createdAt ? r.createdAt.toISOString().split('T')[0] : '',
        });
      });
    });

    allReviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.status(200).json(allReviews);
  } catch (err) {
    console.error('Get all reviews error:', err);
    return res.status(500).json({ message: 'Failed to fetch reviews.' });
  }
});

// GET product by barcode — must be before /:id
router.get('/barcode/:code', async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.code }).populate('category');
    if (!product) return res.status(404).json({ message: 'No product matches this barcode.' });
    return res.status(200).json(product);
  } catch (err) {
    console.error('Barcode lookup error:', err);
    return res.status(500).json({ message: 'Barcode lookup failed.' });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.status(200).json(product);
  } catch (err) {
    console.error('Get product error:', err);
    return res.status(500).json({ message: 'Failed to fetch product.' });
  }
});

// POST create product
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const {
      name, description, price, category,
      countInStock, petType, expirationDate, variants, lowStockThreshold, barcode
    } = req.body;

    if (!name || !description || !price || !category || countInStock === undefined) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const productData = {
      name, description,
      price: Number(price),
      category,
      countInStock: Number(countInStock),
      lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 10,
      petType: petType || '',
      barcode: barcode || '',
      expirationDate: expirationDate || '',
      variants: safeParseArray(variants),
      image: '',
    };

    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      productData.image = `data:${req.file.mimetype};base64,${b64}`;
    }

    const product = new Product(productData);
    const saved = await product.save();
    const populated = await saved.populate('category');
    return res.status(201).json(populated);
  } catch (err) {
    console.error('Create product error:', err);
    return res.status(500).json({ message: 'Failed to create product.' });
  }
});

// PUT update product
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const {
      name, description, price, category,
      countInStock, petType, expirationDate, variants, lowStockThreshold, barcode
    } = req.body;

    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = Number(price);
    if (category) product.category = category;
    if (countInStock !== undefined) product.countInStock = Number(countInStock);
    if (lowStockThreshold !== undefined) product.lowStockThreshold = Number(lowStockThreshold);
    if (petType !== undefined) product.petType = petType;
    if (barcode !== undefined) product.barcode = barcode;
    if (expirationDate !== undefined) product.expirationDate = expirationDate;
    if (variants) product.variants = safeParseArray(variants);

    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      product.image = `data:${req.file.mimetype};base64,${b64}`;
    }

    const saved = await product.save();
    const populated = await saved.populate('category');
    return res.status(200).json(populated);
  } catch (err) {
    console.error('Update product error:', err);
    return res.status(500).json({ message: 'Failed to update product.' });
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.status(200).json({ message: 'Product deleted.' });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ message: 'Failed to delete product.' });
  }
});

// ─── INVENTORY MANAGEMENT ────────────────────────────────────────────────

// GET out of stock products
router.get('/inventory/out-of-stock', async (req, res) => {
  try {
    const products = await Product.find({ countInStock: 0 }).populate('category');
    return res.status(200).json(products);
  } catch (err) {
    console.error('Get out of stock products error:', err);
    return res.status(500).json({ message: 'Failed to fetch out of stock products.' });
  }
});

// GET low stock products
router.get('/inventory/low-stock', async (req, res) => {
  try {
    const products = await Product.find().populate('category');
    const lowStockProducts = products.filter(p => p.countInStock > 0 && p.countInStock <= p.lowStockThreshold);
    return res.status(200).json(lowStockProducts);
  } catch (err) {
    console.error('Get low stock products error:', err);
    return res.status(500).json({ message: 'Failed to fetch low stock products.' });
  }
});

// GET inventory summary
router.get('/inventory/summary', async (req, res) => {
  try {
    const products = await Product.find();
    
    const outOfStock = products.filter(p => p.countInStock === 0);
    const lowStock = products.filter(p => p.countInStock > 0 && p.countInStock <= p.lowStockThreshold);
    const inStock = products.filter(p => p.countInStock > p.lowStockThreshold);
    
    const summary = {
      total: products.length,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      inStock: inStock.length,
      totalInventoryValue: products.reduce((sum, p) => sum + (p.price * p.countInStock), 0),
      totalStockCount: products.reduce((sum, p) => sum + p.countInStock, 0),
      outOfStockProducts: outOfStock.map(p => ({
        id: p._id,
        name: p.name,
        image: p.image,
      })),
      lowStockProducts: lowStock.map(p => ({
        id: p._id,
        name: p.name,
        image: p.image,
        countInStock: p.countInStock,
        lowStockThreshold: p.lowStockThreshold,
      })),
    };
    
    return res.status(200).json(summary);
  } catch (err) {
    console.error('Get inventory summary error:', err);
    return res.status(500).json({ message: 'Failed to fetch inventory summary.' });
  }
});

// ─── REVIEWS ────────────────────────────────────────────────

// Helper: check if user is admin from token
const getIsAdmin = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.isAdmin === true;
  } catch {
    return false;
  }
};

// GET reviews for a product (all reviews are public)
router.get('/:id/reviews', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('reviews.user', 'name image');
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const reviews = product.reviews
      .map((r) => ({
        _id: r._id,
        user: r.user,
        name: r.name,
        rating: r.rating,
        text: r.text,
        status: r.status,
        date: r.createdAt ? r.createdAt.toISOString().split('T')[0] : '',
      }));
    return res.status(200).json(reviews);
  } catch (err) {
    console.error('Get reviews error:', err);
    return res.status(500).json({ message: 'Failed to fetch reviews.' });
  }
});

// PUT edit a review (owner only)
router.put('/:productId/reviews/:reviewId', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Login required.' });

    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const review = product.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found.' });

    // Only the review owner can edit
    if (review.user.toString() !== userId) {
      return res.status(403).json({ message: 'You can only edit your own reviews.' });
    }

    const { rating, text } = req.body;
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
      }
      review.rating = Number(rating);
    }
    if (text !== undefined) {
      review.text = text;
    }

    // Recalculate product rating
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : 0;

    await product.save();
    return res.status(200).json({ message: 'Review updated.' });
  } catch (err) {
    console.error('Update review error:', err);
    return res.status(500).json({ message: 'Failed to update review.' });
  }
});

// DELETE a review (owner or admin)
router.delete('/:productId/reviews/:reviewId', async (req, res) => {
  try {
    const userId = getUserId(req);
    const isAdmin = getIsAdmin(req);

    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const review = product.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found.' });

    // Allow only the review owner or admin to delete
    if (!isAdmin && (!userId || review.user.toString() !== userId)) {
      return res.status(403).json({ message: 'You can only delete your own reviews.' });
    }

    review.deleteOne();

    // Recalculate rating
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : 0;

    await product.save();
    return res.status(200).json({ message: 'Review deleted.' });
  } catch (err) {
    console.error('Delete review error:', err);
    return res.status(500).json({ message: 'Failed to delete review.' });
  }
});

// POST review (only if user has purchased the product)
router.post('/:id/reviews', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Login required to review.' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === userId
    );
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You have already reviewed this product.' });
    }

    // Check if user has purchased this product
    const orders = await Order.find({
      user: userId,
      status: { $in: ['Delivered', 'Shipped', 'Completed'] },
    });

    const hasPurchased = orders.some((order) =>
      order.orderItems.some(
        (oi) => oi.product.toString() === req.params.id
      )
    );

    if (!hasPurchased) {
      return res.status(403).json({
        message: 'You can only review products you have purchased.',
      });
    }

    const { rating, text } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    // Look up user name
    const User = require('../models/User');
    const user = await User.findById(userId);

    product.reviews.push({
      user: userId,
      name: user ? user.name : 'Anonymous',
      rating: Number(rating),
      text: text || '',
      status: 'approved',
    });

    // Recalculate product rating based on all reviews
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : 0;

    await product.save();

    return res.status(201).json({ message: 'Review submitted successfully!' });
  } catch (err) {
    console.error('Post review error:', err);
    return res.status(500).json({ message: 'Failed to submit review.' });
  }
});

module.exports = router;
