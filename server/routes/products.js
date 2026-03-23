const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/User');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fieldSize: 10 * 1024 * 1024 } });
const JWT_SECRET = process.env.JWT_SECRET || 'furever-dev-jwt-secret-change-me';

// ─── MIDDLEWARE ─────────────────────────────────────────────
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.warn('[CRUD/Auth] Missing authorization token');
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      console.warn('[CRUD/Auth] Empty token string');
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const user = await User.findById(userId);

    if (!user) {
      console.warn('[CRUD/Auth] User not found for token:', { userId });
      return res.status(401).json({ message: 'User not found.' });
    }
    
    if (!user.isAdmin) {
      console.warn('[CRUD/Auth] Non-admin attempted product access:', { userId, name: user.name, isAdmin: user.isAdmin });
      return res.status(403).json({ message: 'Admin access required to create/edit products.' });
    }
    
    if (user.isActive === false) {
      console.warn('[CRUD/Auth] Inactive admin attempted product access:', { userId });
      return res.status(403).json({ message: 'Your account is inactive.' });
    }

    req.user = user;
    console.log('[CRUD/Product] Admin authenticated for operation:', { userId, name: user.name });
    return next();
  } catch (err) {
    console.error('[CRUD/Auth] Token verification failed:', { errorName: err?.name, message: err?.message, tokenPreview: err?.message?.includes('expired') ? 'EXPIRED' : 'INVALID' });
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }
    return res.status(401).json({ message: 'Authentication failed: ' + err?.message });
  }
}

// ─── ADMIN: ALL REVIEWS (must be before /:id) ───────────────
router.get('/reviews/all', async (req, res) => {
  try {
    const reviews = await Product.getAllReviews();
    return res.status(200).json(reviews);
  } catch (err) {
    console.error('Get all reviews error:', err);
    return res.status(500).json({ message: 'Failed to fetch all reviews.' });
  }
});

// ─── INVENTORY: OUT OF STOCK (must be before /:id) ──────────
router.get('/inventory/out-of-stock', async (req, res) => {
  try {
    const products = await Product.find();
    return res.status(200).json(products.filter((p) => Number(p.countInStock || 0) === 0));
  } catch (err) {
    console.error('Out of stock error:', err);
    return res.status(500).json({ message: 'Failed to fetch out-of-stock products.' });
  }
});

// ─── INVENTORY: LOW STOCK (must be before /:id) ─────────────
router.get('/inventory/low-stock', async (req, res) => {
  try {
    const products = await Product.find();
    return res.status(200).json(
      products.filter((p) => Number(p.countInStock || 0) > 0 && Number(p.countInStock || 0) <= Number(p.lowStockThreshold || 0))
    );
  } catch (err) {
    console.error('Low stock error:', err);
    return res.status(500).json({ message: 'Failed to fetch low-stock products.' });
  }
});

// ─── INVENTORY: SUMMARY (must be before /:id) ───────────────
router.get('/inventory/summary', async (req, res) => {
  try {
    const products = await Product.find();
    const total = products.length;
    const outOfStock = products.filter((p) => Number(p.countInStock || 0) === 0).length;
    const lowStock = products.filter((p) => Number(p.countInStock || 0) > 0 && Number(p.countInStock || 0) <= Number(p.lowStockThreshold || 0)).length;
    const inStock = total - outOfStock - lowStock;
    return res.status(200).json({ totalProducts: total, inStock, lowStock, outOfStock });
  } catch (err) {
    console.error('Inventory summary error:', err);
    return res.status(500).json({ message: 'Failed to fetch inventory summary.' });
  }
});

// ─── GET ALL PRODUCTS ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let products;
    if (req.query.categories) {
      const catIds = req.query.categories.split(',').map(Number).filter(Boolean);
      products = await Product.find({ categoryIds: catIds });
      console.log('[CRUD] GET products by categories:', { categories: catIds, count: products.length });
    } else {
      products = await Product.find();
      console.log('[CRUD] GET all products:', { count: products.length });
    }
    return res.status(200).json(products);
  } catch (err) {
    console.error('[CRUD] Get products error:', { message: err.message });
    return res.status(500).json({ message: 'Failed to fetch products.' });
  }
});

// ─── GET SINGLE PRODUCT ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    console.log('[CRUD] GET single product:', { id: req.params.id, found: !!product });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    return res.status(200).json(product);
  } catch (err) {
    console.error('[CRUD] Get product error:', { id: req.params.id, message: err.message });
    return res.status(500).json({ message: 'Failed to fetch product.' });
  }
});

// ─── CREATE PRODUCT ─────────────────────────────────────────
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category, countInStock, lowStockThreshold, barcode, petType, variants, expirationDate } = req.body;
    
    console.log('[CRUD] CREATE request:', { 
      admin: req.user?.name || req.user?.id,
      name, 
      price, 
      category,
      hasImage: !!req.file,
      bodyKeys: Object.keys(req.body)
    });

    if (!name || !description || price == null) {
      const missing = [];
      if (!name) missing.push('name');
      if (!description) missing.push('description');
      if (price == null) missing.push('price');
      console.warn('[CRUD/CREATE] ❌ Validation FAILED:', { missing, receivedFields: Object.keys(req.body) });
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }
    
    if (category) {
      const cat = await Category.findById(category);
      if (!cat) {
        console.warn('[CRUD] Invalid category:', { categoryId: category });
        return res.status(400).json({ message: 'Invalid category.' });
      }
    }

    let image = '';
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      image = `data:${req.file.mimetype};base64,${b64}`;
      console.log('[CRUD] Image processed:', { size: req.file.size, type: req.file.mimetype });
    } else if (req.body.image) {
      image = req.body.image;
      console.log('[CRUD] Using image from body');
    }

    let parsedVariants = [];
    if (variants) {
      try { parsedVariants = JSON.parse(variants); } catch (e) { 
        console.warn('[CRUD] Variant parse error:', e.message);
        parsedVariants = []; 
      }
    }

    const product = await Product.create({
      name, description, price: parseFloat(price),
      category: category || null,
      countInStock: parseInt(countInStock) || 0,
      lowStockThreshold: parseInt(lowStockThreshold) || 10,
      barcode: barcode || '', petType: petType || '',
      variants: parsedVariants, expirationDate: expirationDate || '', image,
    });
    
    console.log('=====================================================================================================');
    console.log('✅ [CRUD/CREATE] SUCCESS - PRODUCT SAVED TO DATABASE');
    console.log('=====================================================================================================');
    console.log('[CRUD/CREATE] Saved product:', { 
      id: product.id, 
      name: product.name, 
      price: product.price,
      countInStock: product.countInStock,
      category: product.category,
      petType: product.petType,
      hasImage: !!product.image,
      createdBy: req.user?.name,
      timestamp: new Date().toISOString()
    });
    console.log('=====================================================================================================');
    return res.status(201).json(product);
  } catch (err) {
    console.error('[CRUD] Create product error:', { message: err.message, stack: err.stack });
    return res.status(500).json({ message: 'Failed to create product: ' + err.message });
  }
});

// ─── UPDATE PRODUCT ─────────────────────────────────────────
router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('[CRUD] UPDATE request:', { admin: req.user?.name, productId, bodyKeys: Object.keys(req.body) });
    
    const existing = await Product.findById(productId);
    if (!existing) {
      console.warn('[CRUD] Product not found:', { productId });
      return res.status(404).json({ message: 'Product not found.' });
    }

    const updates = {};
    const fields = ['name', 'description', 'price', 'category', 'countInStock', 'lowStockThreshold', 'barcode', 'petType', 'expirationDate'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (['price'].includes(f)) updates[f] = parseFloat(req.body[f]);
        else if (['countInStock', 'lowStockThreshold'].includes(f)) updates[f] = parseInt(req.body[f], 10) || 0;
        else if (f === 'category') updates[f] = req.body[f] || null;
        else updates[f] = req.body[f];
      }
    }
    if (req.body.variants) {
      try { updates.variants = JSON.parse(req.body.variants); } catch (e) { 
        console.warn('[CRUD] Variant parse error on update:', e.message);
      }
    }
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      updates.image = `data:${req.file.mimetype};base64,${b64}`;
      console.log('[CRUD] Image updated:', { size: req.file.size, type: req.file.mimetype });
    } else if (req.body.image) {
      updates.image = req.body.image;
    }
    
    console.log('[CRUD] Applying updates:', { fields: Object.keys(updates) });

    const product = await Product.update(productId, updates);
    console.log('=====================================================================================================');
    console.log('✅ [CRUD/UPDATE] SUCCESS - PRODUCT UPDATED IN DATABASE');
    console.log('=====================================================================================================');
    console.log('[CRUD/UPDATE] Updated product:', { 
      id: product.id,
      name: product.name,
      price: product.price,
      countInStock: product.countInStock,
      category: product.category,
      updatedBy: req.user?.name,
      fieldsChanged: Object.keys(updates),
      timestamp: new Date().toISOString()
    });
    console.log('=====================================================================================================');
    return res.status(200).json(product);
  } catch (err) {
    console.error('[CRUD] Update product error:', { message: err.message, stack: err.stack });
    return res.status(500).json({ message: 'Failed to update product: ' + err.message });
  }
});

// ─── DELETE PRODUCT ─────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('[CRUD] DELETE request:', { admin: req.user?.name, productId });
    
    const deleted = await Product.delete(productId);
    if (!deleted) {
      console.warn('[CRUD] Product not found for deletion:', { productId });
      return res.status(404).json({ message: 'Product not found.' });
    }
    
    console.log('=====================================================================================================');
    console.log('✅ [CRUD/DELETE] SUCCESS - PRODUCT REMOVED FROM DATABASE');
    console.log('=====================================================================================================');
    console.log('[CRUD/DELETE] Deleted product:', { 
      id: productId,
      deletedBy: req.user?.name,
      timestamp: new Date().toISOString()
    });
    console.log('=====================================================================================================');
    return res.status(200).json({ message: 'Product deleted.' });
  } catch (err) {
    console.error('[CRUD] Delete product error:', { message: err.message, stack: err.stack });
    return res.status(500).json({ message: 'Failed to delete product: ' + err.message });
  }
});

// ─── SIMILAR PRODUCTS ──────────────────────────────────────
router.get('/:id/similar', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const categoryId = product.category?.id || product.category;
    let similar = [];
    if (categoryId) {
      similar = (await Product.find({ categoryIds: [categoryId] }))
        .filter(p => String(p.id) !== String(req.params.id))
        .slice(0, 8);
    }
    if (similar.length < 4) {
      const extra = (await Product.find())
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
router.get('/:id/reviews', async (req, res) => {
  try {
    const reviews = await Product.getReviews(req.params.id);
    return res.status(200).json(reviews);
  } catch (err) {
    console.error('Get reviews error:', err);
    return res.status(500).json({ message: 'Failed to fetch reviews.' });
  }
});

// ─── REVIEWS: ADD ───────────────────────────────────────────
router.post('/:id/reviews', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No auth token.' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check: has user purchased this product?
    const userId = decoded.userId;
    const productId = req.params.id;
    const deliveredOrders = await Order.find({ userId, status: 'Delivered' });
    const purchased = deliveredOrders.some((order) =>
      (order.orderItems || []).some((item) => String(item.productId || item.product || '') === String(productId))
    );
    if (!purchased) {
      return res.status(403).json({ message: 'You can only review products you have purchased and received.' });
    }

    const { rating, text, image } = req.body;
    if (!rating) return res.status(400).json({ message: 'Rating is required.' });

    const review = await Product.addReview(productId, {
      userId: userId, name: decoded.name || 'User', rating: parseInt(rating, 10), text: text || '',
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
router.put('/:productId/reviews/:reviewId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No auth token.' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);

    const existingReview = await Product.findReview(req.params.reviewId);
    if (!existingReview) return res.status(404).json({ message: 'Review not found.' });

    const requesterId = String(decoded.userId || '');
    const reviewOwnerId = String(existingReview.userId || '');
    const isAdmin = !!decoded.isAdmin;
    if (!isAdmin && requesterId !== reviewOwnerId) {
      return res.status(403).json({ message: 'You can only update your own review.' });
    }

    const { rating, text, status, image } = req.body;
    const updates = {};
    if (rating) updates.rating = parseInt(rating);
    if (text !== undefined) updates.text = text;
    if (status && isAdmin) updates.status = status;
    if (image !== undefined) updates.image = image;
    const review = await Product.updateReview(req.params.reviewId, updates, req.params.productId);
    return res.status(200).json({ message: 'Review updated.', review });
  } catch (err) {
    console.error('Update review error:', err);
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token.' });
    return res.status(500).json({ message: 'Failed to update review.' });
  }
});

// ─── REVIEWS: DELETE ────────────────────────────────────────
router.delete('/:productId/reviews/:reviewId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No auth token.' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);

    const existingReview = await Product.findReview(req.params.reviewId);
    if (!existingReview) return res.status(404).json({ message: 'Review not found.' });

    const requesterId = String(decoded.userId || '');
    const reviewOwnerId = String(existingReview.userId || '');
    const isAdmin = !!decoded.isAdmin;
    if (!isAdmin && requesterId !== reviewOwnerId) {
      return res.status(403).json({ message: 'You can only delete your own review.' });
    }

    await Product.deleteReview(req.params.reviewId, req.params.productId);
    return res.status(200).json({ message: 'Review deleted.' });
  } catch (err) {
    console.error('Delete review error:', err);
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token.' });
    return res.status(500).json({ message: 'Failed to delete review.' });
  }
});

module.exports = router;
