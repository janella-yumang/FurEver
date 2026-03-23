const express = require('express');
const jwt = require('jsonwebtoken');
const Voucher = require('../models/Voucher');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'furever-dev-jwt-secret-change-me';

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.warn('[Voucher/Auth] Missing authorization header');
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = parseInt(decoded.userId, 10);
    const user = User.findById(userId);

    if (!user) {
      console.warn('[Voucher/Auth] User not found:', { userId });
      return res.status(401).json({ message: 'User not found.' });
    }
    
    if (!user.isAdmin) {
      console.warn('[Voucher/Auth] Non-admin user attempted access:', { userId, isAdmin: user.isAdmin });
      return res.status(403).json({ message: 'Admin access required.' });
    }
    
    if (user.isActive === false) {
      console.warn('[Voucher/Auth] Inactive user attempted access:', { userId });
      return res.status(403).json({ message: 'Account is inactive.' });
    }

    req.adminUser = user;
    req.user = user;
    console.log('[Voucher/Auth] Admin authenticated:', { userId, userName: user.name });
    next();
  } catch (err) {
    console.error('[Voucher/Auth] Token verification error:', { message: err?.message });
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function isCurrentlyAvailable(voucher) {
  if (!voucher || !voucher.isActive) return false;

  const now = new Date();
  if (voucher.startsAt && new Date(voucher.startsAt) > now) return false;
  if (voucher.expiresAt && new Date(voucher.expiresAt) <= now) return false;
  if (voucher.maxClaims > 0 && voucher.claimedCount >= voucher.maxClaims) return false;

  return true;
}

// ─── GET ACTIVE VOUCHERS (PUBLIC) ──────────────────────────
router.get('/public/active', (req, res) => {
  try {
    const vouchers = Voucher.find({ isActive: true, notExpired: true })
      .filter(isCurrentlyAvailable)
      .sort((a, b) => {
        const aExpiry = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bExpiry = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aExpiry - bExpiry;
      });

    return res.status(200).json(vouchers);
  } catch (err) {
    console.error('Get public active vouchers error:', err);
    return res.status(500).json({ message: 'Failed to fetch active vouchers.' });
  }
});

// ─── GET SINGLE ACTIVE VOUCHER (PUBLIC) ────────────────────
router.get('/public/active/:id', (req, res) => {
  try {
    const voucher = Voucher.findById(req.params.id);
    if (!voucher || !isCurrentlyAvailable(voucher)) {
      return res.status(404).json({ message: 'Voucher not found or unavailable.' });
    }

    return res.status(200).json(voucher);
  } catch (err) {
    console.error('Get public active voucher detail error:', err);
    return res.status(500).json({ message: 'Failed to fetch voucher detail.' });
  }
});

// ─── GET ALL VOUCHERS ───────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  try {
    const vouchers = Voucher.find();
    return res.status(200).json(vouchers);
  } catch (err) {
    console.error('Get vouchers error:', err);
    return res.status(500).json({ message: 'Failed to fetch vouchers.' });
  }
});

// ─── GET SINGLE VOUCHER ─────────────────────────────────────
router.get('/:id', requireAdmin, (req, res) => {
  try {
    const voucher = Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ message: 'Voucher not found.' });
    return res.status(200).json(voucher);
  } catch (err) {
    console.error('Get voucher error:', err);
    return res.status(500).json({ message: 'Failed to fetch voucher.' });
  }
});

// ─── CREATE VOUCHER ─────────────────────────────────────────
router.post('/', requireAdmin, (req, res) => {
  try {
    const { title, message, imageUrl, promoCode, discountType, discountValue,
            maxDiscount, minOrderAmount, startsAt, expiresAt, isActive, maxClaims } = req.body;
    
    console.log('[CRUD] CREATE voucher request:', {
      admin: req.adminUser?.name || req.adminUser?.id,
      title,
      promoCode,
      discountType,
      discountValue
    });

    const missing = [];
    if (!title) missing.push('title');
    if (!promoCode) missing.push('promoCode');
    if (!discountType) missing.push('discountType');
    if (discountValue == null) missing.push('discountValue');
    
    if (missing.length > 0) {
      console.warn('[CRUD] Voucher validation failed:', { missing });
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }

    const existing = Voucher.findByCode(promoCode);
    if (existing) {
      console.warn('[CRUD] Duplicate voucher code:', { promoCode });
      return res.status(409).json({ message: 'A voucher with this promo code already exists.' });
    }

    const adminId = req.adminUser?.id || req.adminUser?._id;
    if (!adminId) {
      console.error('[CRUD] Cannot determine admin ID for voucher creation');
      return res.status(500).json({ message: 'Admin ID not available.' });
    }

    const voucher = Voucher.create({
      title, message, imageUrl, promoCode, discountType, discountValue,
      maxDiscount: maxDiscount || 0,
      minOrderAmount: minOrderAmount || 0,
      startsAt: startsAt || null,
      expiresAt: expiresAt || null,
      isActive: isActive !== false,
      maxClaims: maxClaims || 0,
      createdByUserId: adminId,
    });
    
    console.log('[CRUD] Voucher created successfully:', { id: voucher.id, code: voucher.promoCode, discount: voucher.discountValue });
    return res.status(201).json(voucher);
  } catch (err) {
    console.error('[CRUD] Create voucher error:', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ message: 'Failed to create voucher: ' + err?.message });
  }
});

// ─── UPDATE VOUCHER ─────────────────────────────────────────
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const voucher = Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ message: 'Voucher not found.' });

    const fields = ['title', 'message', 'imageUrl', 'promoCode', 'discountType',
                    'discountValue', 'maxDiscount', 'minOrderAmount', 'startsAt',
                    'expiresAt', 'isActive', 'maxClaims'];
    const updates = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    // Prevent duplicate promo codes from another voucher
    if (updates.promoCode) {
      const existing = Voucher.findByCode(updates.promoCode);
      if (existing && String(existing.id) !== String(req.params.id)) {
        return res.status(409).json({ message: 'A voucher with this promo code already exists.' });
      }
    }

    const updated = Voucher.update(req.params.id, updates);
    return res.status(200).json(updated);
  } catch (err) {
    console.error('Update voucher error:', err);
    return res.status(500).json({ message: 'Failed to update voucher.' });
  }
});

// ─── TOGGLE ACTIVE STATUS ───────────────────────────────────
router.patch('/:id/toggle', requireAdmin, (req, res) => {
  try {
    const voucher = Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ message: 'Voucher not found.' });
    const updated = Voucher.update(req.params.id, { isActive: !voucher.isActive });
    return res.status(200).json(updated);
  } catch (err) {
    console.error('Toggle voucher error:', err);
    return res.status(500).json({ message: 'Failed to toggle voucher.' });
  }
});

// ─── DELETE VOUCHER ─────────────────────────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const deleted = Voucher.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Voucher not found.' });
    return res.status(200).json({ message: 'Voucher deleted.' });
  } catch (err) {
    console.error('Delete voucher error:', err);
    return res.status(500).json({ message: 'Failed to delete voucher.' });
  }
});

module.exports = router;
