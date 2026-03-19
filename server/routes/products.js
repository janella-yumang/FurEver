const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const { db } = require('../database');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fieldSize: 10 * 1024 * 1024 } });
const JWT_SECRET = process.env.JWT_SECRET || 'furever-dev-jwt-secret-change-me';

// ─── ADMIN: ALL REVIEWS (must be before /:id) ───────────────
router.get('/reviews/all', (req, res) => {
  try {
    const reviews = Product.getAllReviews();
    return res.status(200).json(reviews);
  } catch (err) {
    console.error('Get all reviews error:', err);
    return res.status(500).json({ message: 'Failed to fetch all reviews.' });
  }
});

// ─── INVENTORY: OUT OF STOCK (must be before /:id) ──────────
router.get('/inventory/out-of-stock', (req, res) => {
  try {
    const products = db.prepare(
      `SELECT p.*, c.name AS categoryName, c.color AS categoryColor, c.icon AS categoryIcon
       FROM products p LEFT JOIN categories c ON p.category = c.id
       WHERE p.countInStock = 0`
    ).all();
    return res.status(200).json(products.map(Product._parseRow));
  } catch (err) {
    console.error('Out of stock error:', err);
    return res.status(500).json({ message: 'Failed to fetch out-of-stock products.' });
  }
});

// ─── INVENTORY: LOW STOCK (must be before /:id) ─────────────
router.get('/inventory/low-stock', (req, res) => {
  try {
    const products = db.prepare(
      `SELECT p.*, c.name AS categoryName, c.color AS categoryColor, c.icon AS categoryIcon
       FROM products p LEFT JOIN categories c ON p.category = c.id
       WHERE p.countInStock > 0 AND p.countInStock <= p.lowStockThreshold`
    ).all();
    return res.status(200).json(products.map(Product._parseRow));
  } catch (err) {
    console.error('Low stock error:', err);
    return res.status(500).json({ message: 'Failed to fetch low-stock products.' });
  }
});

// ─── INVENTORY: SUMMARY (must be before /:id) ───────────────
router.get('/inventory/summary', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) AS cnt FROM products').get().cnt;
    const outOfStock = db.prepare('SELECT COUNT(*) AS cnt FROM products WHERE countInStock = 0').get().cnt;
    const lowStock = db.prepare('SELECT COUNT(*) AS cnt FROM products WHERE countInStock > 0 AND countInStock <= lowStockThreshold').get().cnt;
    const inStock = total - outOfStock - lowStock;
    return res.status(200).json({ totalProducts: total, inStock, lowStock, outOfStock });
  } catch (err) {
    console.error('Inventory summary error:', err);
    return res.status(500).json({ message: 'Failed to fetch inventory summary.' });
  }
});

// ─── GET ALL PRODUCTS ───────────────────────────────────────
router.get('/', (req, res) => {
  try {
    let products;
    if (req.query.categories) {
      const catIds = req.query.categories.split(',').map(Number).filter(Boolean);
      products = Product.find({ categoryIds: catIds });
    } else {
      products = Product.find();
    }
    return res.status(200).json(products);
  } catch (err) {
    console.error('Get products error:', err);
    return res.status(500).json({ message: 'Failed to fetch products.' });
  }
});

// ─── GET SINGLE PRODUCT ─────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const product = Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.status(200).json(product);
  } catch (err) {
    console.error('Get product error:', err);
    return res.status(500).json({ message: 'Failed to fetch product.' });
  }
});

// ─── CREATE PRODUCT ─────────────────────────────────────────
router.post('/', upload.single('image'), (req, res) => {
  try {
    const { name, description, price, category, countInStock, lowStockThreshold, barcode, petType, variants, expirationDate } = req.body;
    if (!name || !description || price == null) {
      return res.status(400).json({ message: 'Name, description and price are required.' });
    }
    if (category) {
      const cat = Category.findById(category);
      if (!cat) return res.status(400).json({ message: 'Invalid category.' });
    }

    let image = '';
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      image = `data:${req.file.mimetype};base64,${b64}`;
    } else if (req.body.image) {
      image = req.body.image;
    }

    let parsedVariants = [];
    if (variants) {
      try { parsedVariants = JSON.parse(variants); } catch { parsedVariants = []; }
    }

    const product = Product.create({
      name, description, price: parseFloat(price),
      category: category ? parseInt(category) : null,
      countInStock: parseInt(countInStock) || 0,
      lowStockThreshold: parseInt(lowStockThreshold) || 10,
      barcode: barcode || '', petType: petType || '',
      variants: parsedVariants, expirationDate: expirationDate || '', image,
    });
    return res.status(201).json(product);
  } catch (err) {
    console.error('Create product error:', err);
    return res.status(500).json({ message: 'Failed to create product.' });
  }
});

// ─── UPDATE PRODUCT ─────────────────────────────────────────
router.put('/:id', upload.single('image'), (req, res) => {
  try {
    const existing = Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Product not found.' });

    const updates = {};
    const fields = ['name', 'description', 'price', 'category', 'countInStock', 'lowStockThreshold', 'barcode', 'petType', 'expirationDate'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (['price'].includes(f)) updates[f] = parseFloat(req.body[f]);
        else if (['countInStock', 'lowStockThreshold', 'category'].includes(f)) updates[f] = parseInt(req.body[f]) || 0;
        else updates[f] = req.body[f];
      }
    }
    if (req.body.variants) {
      try { updates.variants = JSON.parse(req.body.variants); } catch { }
    }
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      updates.image = `data:${req.file.mimetype};base64,${b64}`;
    } else if (req.body.image) {
      updates.image = req.body.image;
    }

    const product = Product.update(req.params.id, updates);
    return res.status(200).json(product);
  } catch (err) {
    console.error('Update product error:', err);
    return res.status(500).json({ message: 'Failed to update product.' });
  }
});

// ─── DELETE PRODUCT ─────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const deleted = Product.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Product not found.' });
    return res.status(200).json({ message: 'Product deleted.' });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ message: 'Failed to delete product.' });
  }
});

// ─── SIMILAR PRODUCTS ──────────────────────────────────────
router.get('/:id/similar', (req, res) => {
  try {
    const product = Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const categoryId = product.category?.id || product.category;
    let similar = [];
    if (categoryId) {
      similar = Product.find({ categoryIds: [categoryId] })
        .filter(p => String(p.id) !== String(req.params.id))
        .slice(0, 8);
    }
    if (similar.length < 4) {
      const extra = Product.find()
        .filter(p => String(p.id) !== String(req.params.id) && !similar.find(s => s.id === p.id))
        .slice(0, 8 - similar.length);
      similar = [...similar, ...extra];
    }
    return res.status(200).json(similar);
  } catch (err) {
    console.error('Similar products error:', err);
    return res.status(500).json({ message: 'Failed to fetch similar products.' });
  }
});

// ─── REVIEWS: GET FOR PRODUCT ────────────────────────────────────
router.get('/:id/reviews', (req, res) => {
  try {
    const reviews = Product.getReviews(req.params.id);
    return res.status(200).json(reviews);
  } catch (err) {
    console.error('Get reviews error:', err);
    return res.status(500).json({ message: 'Failed to fetch reviews.' });
  }
});

// ─── REVIEWS: ADD ───────────────────────────────────────────
router.post('/:id/reviews', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No auth token.' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check: has user purchased this product?
    const userId = parseInt(decoded.userId);
    const productId = parseInt(req.params.id);
    const purchased = db.prepare(
      `SELECT 1
       FROM order_items oi
       JOIN orders o ON oi.orderId = o.id
       LEFT JOIN products p ON p.id = ?
       WHERE o.userId = ?
         AND o.status = 'Delivered'
         AND (
           oi.productId = ?
           OR (
             oi.productId IS NULL
             AND p.id IS NOT NULL
             AND LOWER(TRIM(COALESCE(oi.name, ''))) = LOWER(TRIM(COALESCE(p.name, '')))
           )
         )
       LIMIT 1`
    ).get(productId, userId, productId);
    if (!purchased) {
      return res.status(403).json({ message: 'You can only review products you have purchased and received.' });
    }

    const { rating, text, image } = req.body;
    if (!rating) return res.status(400).json({ message: 'Rating is required.' });

    const review = Product.addReview(productId, {
      userId: userId, name: decoded.name || 'User', rating: parseInt(rating), text: text || '',
      image: image || '',
    });
    return res.status(201).json({ message: 'Review added.', review });
  } catch (err) {
    console.error('Add review error:', err);
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token.' });
    return res.status(500).json({ message: 'Failed to add review.' });
  }
});

// ─── REVIEWS: UPDATE ────────────────────────────────────────
router.put('/:productId/reviews/:reviewId', (req, res) => {
  try {
    const { rating, text, status, image } = req.body;
    const updates = {};
    if (rating) updates.rating = parseInt(rating);
    if (text !== undefined) updates.text = text;
    if (status) updates.status = status;
    if (image !== undefined) updates.image = image;
    const review = Product.updateReview(req.params.reviewId, updates, parseInt(req.params.productId));
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    return res.status(200).json({ message: 'Review updated.', review });
  } catch (err) {
    console.error('Update review error:', err);
    return res.status(500).json({ message: 'Failed to update review.' });
  }
});

// ─── REVIEWS: DELETE ────────────────────────────────────────
router.delete('/:productId/reviews/:reviewId', (req, res) => {
  try {
    const deleted = Product.deleteReview(req.params.reviewId, parseInt(req.params.productId));
    if (!deleted) return res.status(404).json({ message: 'Review not found.' });
    return res.status(200).json({ message: 'Review deleted.' });
  } catch (err) {
    console.error('Delete review error:', err);
    return res.status(500).json({ message: 'Failed to delete review.' });
  }
});

module.exports = router;
