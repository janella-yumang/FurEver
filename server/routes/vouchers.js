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
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const decoded = jwt.verify(authHeader.replace('Bearer ', '').trim(), JWT_SECRET);
    const userId = parseInt(decoded.userId, 10);
    const user = User.findById(userId);

    if (!user || !user.isAdmin || user.isActive === false) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    req.adminUser = user;
    next();
  } catch {
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

    if (!title || !promoCode || !discountType || discountValue == null) {
      return res.status(400).json({ message: 'title, promoCode, discountType and discountValue are required.' });
    }

    const existing = Voucher.findByCode(promoCode);
    if (existing) return res.status(409).json({ message: 'A voucher with this promo code already exists.' });

    const voucher = Voucher.create({
      title, message, imageUrl, promoCode, discountType, discountValue,
      maxDiscount, minOrderAmount, startsAt, expiresAt,
      isActive: isActive !== false,
      maxClaims: maxClaims || 0,
      createdByUserId: req.adminUser.userId,
    });
    return res.status(201).json(voucher);
  } catch (err) {
    console.error('Create voucher error:', err);
    return res.status(500).json({ message: 'Failed to create voucher.' });
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
