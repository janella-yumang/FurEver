const express = require('express');
const jwt = require('jsonwebtoken');
const Voucher = require('../models/Voucher');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'furever-dev-jwt-secret-change-me';

function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: 'No auth token.' });
    const decoded = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ message: 'Admin access required.' });
    req.adminUser = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token.' });
  }
}

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
