const express = require('express');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Voucher = require('../models/Voucher');
const { isExpoPushToken, isLikelyFcmToken, sendPushMessages } = require('../pushService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'furever-dev-jwt-secret-change-me';

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = parseInt(decoded.userId, 10);
    const user = User.findById(userId);

    if (!user || !user.isAdmin || user.isActive === false) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = parseInt(decoded.userId, 10);
    const user = User.findById(userId);
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'Invalid or inactive account.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function isSupportedPushToken(token = '') {
  return isExpoPushToken(token) || isLikelyFcmToken(token);
}

// GET notifications for a user
router.get('/user/:userId', (req, res) => {
  try {
    const notifications = Notification.find({ user: parseInt(req.params.userId) });
    return res.status(200).json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

// GET unread count
router.get('/user/:userId/unread-count', (req, res) => {
  try {
    const count = Notification.countUnread(parseInt(req.params.userId));
    return res.status(200).json({ count });
  } catch (err) {
    console.error('Unread count error:', err);
    return res.status(500).json({ message: 'Failed to get unread count.' });
  }
});

// GET notification detail for a user
router.get('/user/:userId/:id', (req, res) => {
  try {
    const notification = Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    if (parseInt(notification.user, 10) !== parseInt(req.params.userId, 10)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    return res.status(200).json(notification);
  } catch (err) {
    console.error('Get notification detail error:', err);
    return res.status(500).json({ message: 'Failed to fetch notification detail.' });
  }
});

// PUT register/update a user's push token (FCM or Expo)
router.put('/user/:userId/push-token', requireAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const { pushToken } = req.body || {};

    if (!pushToken || !isSupportedPushToken(pushToken)) {
      return res.status(400).json({ message: 'A valid push token is required.' });
    }

    const user = User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    User.update(userId, { pushToken });
    return res.status(200).json({ message: 'Push token saved.' });
  } catch (err) {
    console.error('Save push token error:', err);
    return res.status(500).json({ message: 'Failed to save push token.' });
  }
});

// DELETE remove a user's push token on logout
router.delete('/user/:userId/push-token', requireAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const user = User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    User.update(userId, { pushToken: null });
    return res.status(200).json({ message: 'Push token removed.' });
  } catch (err) {
    console.error('Remove push token error:', err);
    return res.status(500).json({ message: 'Failed to remove push token.' });
  }
});

// POST broadcast promotion notification to all active users (including admins)
router.post('/promotions/broadcast', requireAdmin, async (req, res) => {
  try {
    const {
      title,
      message,
      discountPercent,
      promoCode,
      imageUrl,
      expiresAt,
      startsAt,
      maxClaims,
      minOrderAmount,
      maxDiscount,
      productId,
      deepLink,
    } = req.body || {};

    const parsedDiscount = Number(discountPercent);
    if (!title || !message || Number.isNaN(parsedDiscount) || parsedDiscount <= 0 || parsedDiscount > 100) {
      return res.status(400).json({ message: 'Title, message, and a valid discount percent (1-100) are required.' });
    }

    const normalizedCode = String(promoCode || '').trim().toUpperCase();
    if (!normalizedCode) {
      return res.status(400).json({ message: 'Promo code is required.' });
    }

    const expiryDate = expiresAt ? new Date(expiresAt) : null;
    if (expiryDate && Number.isNaN(expiryDate.getTime())) {
      return res.status(400).json({ message: 'Invalid expiration date/time.' });
    }
    if (expiryDate && expiryDate <= new Date()) {
      return res.status(400).json({ message: 'Expiration must be in the future.' });
    }

    if (Voucher.findByCode(normalizedCode)) {
      return res.status(409).json({ message: 'Promo code already exists. Please use another code.' });
    }

    const voucher = Voucher.create({
      title,
      message,
      imageUrl: imageUrl || '',
      promoCode: normalizedCode,
      discountType: 'percent',
      discountValue: parsedDiscount,
      maxDiscount: Number(maxDiscount) || 0,
      minOrderAmount: Number(minOrderAmount) || 0,
      startsAt: startsAt || null,
      expiresAt: expiryDate ? expiryDate.toISOString() : null,
      maxClaims: Number(maxClaims) || 0,
      createdByUserId: req.user.id,
    });

    const targets = User.find({ isActive: true });
    if (!targets.length) {
      return res.status(200).json({ message: 'No eligible users found.', voucher, created: 0, push: { sent: 0, failed: 0 } });
    }

    let created = 0;
    const pushMessages = [];

    for (const user of targets) {
      Notification.create({
        user: user.id,
        type: 'promo_discount',
        title,
        message,
        productId: productId || null,
        imageUrl: imageUrl || '',
        voucherId: voucher.id,
        expiresAt: voucher.expiresAt || null,
      });
      created += 1;

      if (user.pushToken && isSupportedPushToken(user.pushToken)) {
        pushMessages.push({
          token: user.pushToken,
          title,
          body: message,
          data: {
            type: 'promo_discount',
            discountPercent: parsedDiscount,
            promoCode: normalizedCode,
            productId: productId || null,
            voucherId: voucher.id,
            imageUrl: imageUrl || null,
            expiresAt: voucher.expiresAt || null,
            deepLink: deepLink || null,
          },
        });
      }
    }

    const pushResult = await sendPushMessages(pushMessages);

    // Remove stale push tokens so they won't be retried in future broadcasts
    if (pushResult.staleTokens.size > 0) {
      for (const user of targets) {
        if (user.pushToken && pushResult.staleTokens.has(user.pushToken)) {
          User.update(user.id, { pushToken: null });
        }
      }
    }

    return res.status(200).json({
      message: 'Promotion sent successfully.',
      voucher,
      created,
      push: { sent: pushResult.sent, failed: pushResult.failed },
    });
  } catch (err) {
    console.error('Broadcast promotion error:', err);
    return res.status(500).json({ message: 'Failed to broadcast promotion.' });
  }
});

// GET available claimed vouchers for a user
router.get('/promotions/vouchers/available/:userId', requireAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const vouchers = Voucher.getUserAvailableVouchers(userId);
    return res.status(200).json(vouchers);
  } catch (err) {
    console.error('Get available vouchers error:', err);
    return res.status(500).json({ message: 'Failed to fetch available vouchers.' });
  }
});

// POST claim a promo voucher from notification
router.post('/promotions/vouchers/:voucherId/claim', requireAuth, (req, res) => {
  try {
    const voucherId = parseInt(req.params.voucherId, 10);
    const requestedUserId = parseInt(req.body?.userId, 10);
    const userId = Number.isNaN(requestedUserId) ? req.user.id : requestedUserId;

    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const voucher = Voucher.findById(voucherId);
    if (!voucher || !voucher.isActive) {
      return res.status(404).json({ message: 'Voucher not found or inactive.' });
    }

    const now = new Date();
    if (voucher.startsAt && new Date(voucher.startsAt) > now) {
      return res.status(400).json({ message: 'Voucher is not active yet.' });
    }
    if (voucher.expiresAt && new Date(voucher.expiresAt) <= now) {
      return res.status(400).json({ message: 'Voucher has already expired.' });
    }
    if (voucher.maxClaims > 0 && voucher.claimedCount >= voucher.maxClaims) {
      return res.status(400).json({ message: 'Voucher claim limit reached.' });
    }

    const claimResult = Voucher.claim(voucherId, userId);
    if (claimResult.alreadyClaimed) {
      return res.status(200).json({ message: 'Voucher already claimed.', voucher });
    }

    return res.status(201).json({ message: 'Voucher claimed successfully.', voucher: Voucher.findById(voucherId) });
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(200).json({ message: 'Voucher already claimed.' });
    }
    console.error('Claim voucher error:', err);
    return res.status(500).json({ message: 'Failed to claim voucher.' });
  }
});

// PUT mark single notification as read
router.put('/:id/read', (req, res) => {
  try {
    const notification = Notification.update(req.params.id, { read: true });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    return res.status(200).json(notification);
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ message: 'Failed to mark as read.' });
  }
});

// PUT mark all as read
router.put('/user/:userId/mark-all-read', (req, res) => {
  try {
    const count = Notification.markAllRead(parseInt(req.params.userId));
    return res.status(200).json({ message: `${count} notifications marked as read.` });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ message: 'Failed to mark all as read.' });
  }
});

// DELETE notification
router.delete('/:id', (req, res) => {
  try {
    const deleted = Notification.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Notification not found.' });
    return res.status(200).json({ message: 'Notification deleted.' });
  } catch (err) {
    console.error('Delete notification error:', err);
    return res.status(500).json({ message: 'Failed to delete notification.' });
  }
});

module.exports = router;
