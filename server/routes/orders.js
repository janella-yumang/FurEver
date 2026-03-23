const express = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const Voucher = require('../models/Voucher');
const { isExpoPushToken, isLikelyFcmToken, sendPushMessages } = require('../pushService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'furever-dev-jwt-secret-change-me';

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const user = await User.findById(userId);
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'Invalid or inactive account.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// ─── Email transporter ──────────────────────────────────────
let transporter = null;
(async () => {
  try {
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 30000, greetingTimeout: 30000,
      });
      await transporter.verify();
      console.log('✓ Order routes: Gmail SMTP ready');
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('✓ Order routes: Ethereal test email ready');
    }
  } catch (err) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.warn('⚠ Order routes: SMTP fallback to Ethereal:', err.message);
    } catch (_) {}
  }
})();

const sendOrderStatusEmail = async (user, order, status) => {
  if (!transporter || !user || !user.email) return;
  const fromEmail = process.env.SMTP_USER || 'noreply@furever.com';
  const statusMessages = {
    'Pending': '📋 Your order has been received and is being processed.',
    'Processing': '🔄 Your order is now being prepared for shipping.',
    'Shipped': '📦 Great news! Your order has been shipped!',
    'Delivered': '🎉 Your order has been delivered! Enjoy your purchase!',
    'Cancelled': '❌ Your order has been cancelled.',
  };
  try {
    // Only send push notifications for order status, not emails
    // Email notifications are disabled to prevent timeouts
    // Push notifications will be sent separately below
    console.log(`Order status updated for ${user.email}: ${status}`);
  } catch (err) { console.error('Order status notification error:', err.message); }
};

function isSupportedPushToken(token = '') {
  return isLikelyFcmToken(token) || isExpoPushToken(token);
}

function resolveFcmTokenForUser(user) {
  if (!user || !user.pushToken) return null;
  return isSupportedPushToken(user.pushToken) ? user.pushToken : null;
}

// ─── GET ALL ORDERS ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not found in request.' });
    }

    let orders = [];
    if (req.user.isAdmin) {
      orders = await Order.find();
    } else {
      orders = await Order.find({ user: req.user.id || req.user._id });
    }

    // Ensure we return an array
    const result = Array.isArray(orders) ? orders : [];
    return res.status(200).json(result);
  } catch (err) {
    console.error('Get orders error:', err);
    return res.status(500).json({ message: 'Failed to fetch orders.' });
  }
});

// ─── GET ORDERS BY USER ─────────────────────────────────────
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const requestedUserId = req.params.userId;
    if (!req.user.isAdmin && String(req.user.id || req.user._id) !== String(requestedUserId)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const orders = await Order.find({ user: requestedUserId });
    return res.status(200).json(orders);
  } catch (err) {
    console.error('Get user orders error:', err);
    return res.status(500).json({ message: 'Failed to fetch user orders.' });
  }
});

// ─── GET SINGLE ORDER ───────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (!req.user.isAdmin && String(order.userId) !== String(req.user.id || req.user._id)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    return res.status(200).json(order);
  } catch (err) {
    console.error('Get order error:', err);
    return res.status(500).json({ message: 'Failed to fetch order.' });
  }
});

// ─── CREATE ORDER ───────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      orderItems,
      shippingAddress1,
      shippingAddress2,
      phone,
      status,
      paymentMethod,
      user,
      voucherId,
      voucherCode,
    } = req.body;
    console.log('\n📦 CREATE ORDER REQUEST');
    console.log('  Items:', orderItems?.length || 0);
    console.log('  Payment Method:', paymentMethod);
    
    if (!orderItems || !orderItems.length) {
      return res.status(400).json({ message: 'No order items.' });
    }

    const normalizedItems = orderItems.map(item => {
      const resolvedProductId = item.product || item.productId || item._id || item.id || null;
      return {
        product: resolvedProductId,
        name: item.name || '',
        price: parseFloat(item.price) || 0,
        image: item.image || '',
        quantity: parseInt(item.quantity) || 1,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1)), 0);
    let appliedVoucher = null;
    let voucherDiscount = 0;
    const userId = user;

    if (!req.user.isAdmin && String(userId) !== String(req.user.id || req.user._id)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    if (voucherId || voucherCode) {
      appliedVoucher = voucherId
        ? await Voucher.findById(voucherId)
        : await Voucher.findByCode(voucherCode);

      if (!appliedVoucher || !appliedVoucher.isActive) {
        return res.status(400).json({ message: 'Selected voucher is invalid or inactive.' });
      }

      const now = new Date();
      if (appliedVoucher.startsAt && new Date(appliedVoucher.startsAt) > now) {
        return res.status(400).json({ message: 'Selected voucher is not active yet.' });
      }
      if (appliedVoucher.expiresAt && new Date(appliedVoucher.expiresAt) <= now) {
        return res.status(400).json({ message: 'Selected voucher has already expired.' });
      }
      if (appliedVoucher.minOrderAmount > 0 && subtotal < appliedVoucher.minOrderAmount) {
        return res.status(400).json({ message: `Voucher requires a minimum order of ₱${appliedVoucher.minOrderAmount.toFixed(2)}.` });
      }
      if (!await Voucher.hasUnusedClaim(appliedVoucher.id || appliedVoucher._id, userId)) {
        return res.status(400).json({ message: 'You must claim this voucher before using it.' });
      }

      if (appliedVoucher.discountType === 'percent') {
        voucherDiscount = (subtotal * appliedVoucher.discountValue) / 100;
      } else {
        voucherDiscount = appliedVoucher.discountValue;
      }

      if (appliedVoucher.maxDiscount > 0) {
        voucherDiscount = Math.min(voucherDiscount, appliedVoucher.maxDiscount);
      }

      voucherDiscount = Math.min(voucherDiscount, subtotal);
    }

    const finalTotal = Math.max(0, subtotal - voucherDiscount);
    console.log('  Subtotal:', subtotal);
    console.log('  Voucher discount:', voucherDiscount);
    console.log('  Final total for DB:', finalTotal);

    const order = await Order.create({
      shippingAddress1: shippingAddress1 || '',
      shippingAddress2: shippingAddress2 || '',
      phone: phone || '',
      status: status || 'Pending',
      totalPrice: finalTotal,
      voucherDiscount,
      voucherId: appliedVoucher?.id || null,
      voucherCode: appliedVoucher?.promoCode || '',
      paymentMethod: paymentMethod || '',
      user: userId,
    }, normalizedItems);

    console.log('✅ Order created with ID:', order.id, 'Total:', order.totalPrice);

    if (appliedVoucher?.id || appliedVoucher?._id) {
      await Voucher.markClaimUsed(appliedVoucher.id || appliedVoucher._id, userId, order.id || order._id);
    }

    // Decrease stock for each item
    for (const item of normalizedItems) {
      if (!item.product) continue;
      const prod = await Product.findById(item.product);
      if (prod) {
        const newStock = Math.max(0, prod.countInStock - (parseInt(item.quantity) || 1));
        await Product.update(item.product, { countInStock: newStock });
      }
    }

    // Send notification + email to user
    const userObj = await User.findById(user);
    if (userObj) {
      sendOrderStatusEmail(userObj, order, 'Pending');
      await Notification.create({
        user: userObj.id, type: 'order_confirmed',
        title: 'Order Placed',
        message: `Your order #${order._id} has been placed successfully!`,
        orderId: order.id,
      });

      const userFcmToken = resolveFcmTokenForUser(userObj);
      if (userFcmToken && isSupportedPushToken(userFcmToken)) {
        console.log('[OrderCreation/Push] Sending order confirmation:', { orderId: order.id, userId: userObj.id, token: userFcmToken.substring(0, 20) + '...' });
        const pushResult = await sendPushMessages([
          {
            token: userFcmToken,
            title: 'Order Placed',
            body: `Your order #${order._id} has been placed successfully!`,
            data: {
              type: 'order_confirmed',
              orderId: order.id,
              status: 'Pending',
            },
          },
        ]);

        console.log('[OrderCreation/Push] Push result:', { sent: pushResult.sent, failed: pushResult.failed });

        if (pushResult.staleTokens.has(userFcmToken)) {
          console.warn('[OrderCreation/Push] Stale token detected, clearing:', { userId: userObj.id });
          await User.update(userObj.id, { pushToken: null });
        }
      } else {
        console.warn('[OrderCreation/Push] No valid push token for user:', { userId: userObj.id, hasToken: !!userObj.pushToken });
      }
    }

    // Notify admins
    const admins = (await User.find()).filter(u => u.isAdmin);
    const adminPushMessages = [];
    for (const admin of admins) {
      await Notification.create({
        user: admin.id, type: 'admin_new_order',
        title: 'New Order',
        message: `New order #${order._id} placed${userObj ? ' by ' + userObj.name : ''}.`,
        orderId: order.id,
      });

      const adminFcmToken = resolveFcmTokenForUser(admin);
      if (adminFcmToken && isSupportedPushToken(adminFcmToken)) {
        adminPushMessages.push({
          token: adminFcmToken,
          title: 'New Order',
          body: `New order #${order._id} placed${userObj ? ' by ' + userObj.name : ''}.`,
          data: {
            type: 'admin_new_order',
            orderId: order.id,
          },
        });
      }
    }

    const adminPushResult = await sendPushMessages(adminPushMessages);
    if (adminPushResult.staleTokens.size > 0) {
      for (const admin of admins) {
        if (admin.pushToken && adminPushResult.staleTokens.has(admin.pushToken)) {
          await User.update(admin.id, { pushToken: null });
        }
      }
    }

    return res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ message: 'Failed to create order.' });
  }
});

// ─── UPDATE ORDER STATUS ────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    let order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const isAdmin = !!req.user.isAdmin;
    const isOwner = String(order.userId) === String(req.user.id || req.user._id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const { status, shippingAddress1, shippingAddress2, phone, paymentMethod } = req.body;

    if (!isAdmin && status && !['Delivered', 'Canceled', 'Cancelled'].includes(status)) {
      return res.status(403).json({ message: 'Customers can only confirm delivery or cancel their own orders.' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (shippingAddress1 !== undefined) updates.shippingAddress1 = shippingAddress1;
    if (shippingAddress2 !== undefined) updates.shippingAddress2 = shippingAddress2;
    if (phone !== undefined) updates.phone = phone;
    if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;

    order = await Order.update(req.params.id, updates);

    if (status && order.userId) {
      const userObj = await User.findById(order.userId);
      if (userObj) {
        sendOrderStatusEmail(userObj, order, status);
        // Map status to notification type
        const statusTypeMap = {
          'Pending': 'order_confirmed',
          'Processing': 'order_processing',
          'Shipped': 'order_shipped',
          'Delivered': 'order_delivered',
          'Cancelled': 'order_canceled',
        };
        await Notification.create({
          user: userObj.id, type: statusTypeMap[status] || 'order_confirmed',
          title: `Order ${status}`,
          message: `Your order #${order._id} status has been updated to ${status}.`,
          orderId: order.id,
        });

        const userFcmToken = resolveFcmTokenForUser(userObj);
        if (userFcmToken && isSupportedPushToken(userFcmToken)) {
          console.log('[OrderStatus/Push] Sending status update:', { orderId: order.id, status, userId: userObj.id, token: userFcmToken.substring(0, 20) + '...' });
          const pushResult = await sendPushMessages([
            {
              token: userFcmToken,
              title: `Order ${status}`,
              body: `Your order #${order._id} status has been updated to ${status}.`,
              data: {
                type: statusTypeMap[status] || 'order_confirmed',
                orderId: order.id,
                status,
              },
            },
          ]);

          console.log('[OrderStatus/Push] Push result:', { sent: pushResult.sent, failed: pushResult.failed, staleTokens: pushResult.staleTokens.size });

          if (pushResult.staleTokens.has(userFcmToken)) {
            console.warn('[OrderStatus/Push] Stale token detected, clearing:', { userId: userObj.id });
            await User.update(userObj.id, { pushToken: null });
          }
        } else {
          console.warn('[OrderStatus/Push] No valid push token for user:', { userId: userObj.id, hasToken: !!userObj.pushToken, isSupported: isSupportedPushToken(userObj.pushToken) });
        }
      }

      // Notify admins for delivered orders
      if (status === 'Delivered') {
        const admins = (await User.find()).filter(u => u.isAdmin);
        const adminPushMessages = [];
        for (const admin of admins) {
          await Notification.create({
            user: admin.id, type: 'admin_order_delivered',
            title: 'Order Delivered',
            message: `Order #${order._id} has been delivered to ${userObj?.name || 'customer'}.`,
            orderId: order.id,
          });

          const adminFcmToken = resolveFcmTokenForUser(admin);
          if (adminFcmToken && isSupportedPushToken(adminFcmToken)) {
            adminPushMessages.push({
              token: adminFcmToken,
              title: 'Order Delivered',
              body: `Order #${order._id} has been delivered to ${userObj?.name || 'customer'}.`,
              data: {
                type: 'admin_order_delivered',
                orderId: order.id,
              },
            });
          }
        }

        const adminPushResult = await sendPushMessages(adminPushMessages);
        if (adminPushResult.staleTokens.size > 0) {
          for (const admin of admins) {
            if (admin.pushToken && adminPushResult.staleTokens.has(admin.pushToken)) {
              await User.update(admin.id, { pushToken: null });
            }
          }
        }

        // Award loyalty points: 1 point per ₱1 spent (rounded down)
        if (userObj) {
          const pointsEarned = Math.floor(order.totalPrice || 0);
          if (pointsEarned > 0) {
            const currentPoints = userObj.loyaltyPoints || 0;
            await User.update(userObj.id, { loyaltyPoints: currentPoints + pointsEarned });
            await Notification.create({
              user: userObj.id, type: 'loyalty_points',
              title: '🎉 Loyalty Points Earned!',
              message: `You earned ${pointsEarned} loyalty points for order #${order._id}! Total: ${currentPoints + pointsEarned} pts.`,
              orderId: order.id,
            });
          }
        }
      }
    }
    return res.status(200).json(order);
  } catch (err) {
    console.error('Update order error:', err);
    return res.status(500).json({ message: 'Failed to update order.' });
  }
});

// ─── CANCEL ORDER ───────────────────────────────────────────
router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    let order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const isAdmin = !!req.user.isAdmin;
    const isOwner = String(order.userId) === String(req.user.id || req.user._id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Cannot cancel a delivered order.' });
    }

    // Restore stock
    if (order.orderItems) {
      for (const item of order.orderItems) {
        const prodId = typeof item.product === 'object' ? item.product : (item.productId || item.product);
        if (prodId) {
          const prod = await Product.findById(prodId);
          if (prod) {
            await Product.update(prodId, { countInStock: prod.countInStock + (item.quantity || 1) });
          }
        }
      }
    }

    order = await Order.update(req.params.id, { status: 'Cancelled' });

    if (order.userId) {
      const userObj = await User.findById(order.userId);
      if (userObj) {
        sendOrderStatusEmail(userObj, order, 'Cancelled');
        await Notification.create({
          user: userObj.id, type: 'order_canceled',
          title: 'Order Cancelled',
          message: `Your order #${order._id} has been cancelled.`,
          orderId: order.id,
        });

        const userFcmToken = resolveFcmTokenForUser(userObj);
        if (userFcmToken && isSupportedPushToken(userFcmToken)) {
          const pushResult = await sendPushMessages([
            {
              token: userFcmToken,
              title: 'Order Cancelled',
              body: `Your order #${order._id} has been cancelled.`,
              data: {
                type: 'order_canceled',
                orderId: order.id,
                status: 'Cancelled',
              },
            },
          ]);

          if (pushResult.staleTokens.has(userFcmToken)) {
            await User.update(userObj.id, { pushToken: null });
          }
        }
      }
    }
    return res.status(200).json(order);
  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(500).json({ message: 'Failed to cancel order.' });
  }
});

// ─── DELETE ORDER ───────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const deleted = await Order.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Order not found.' });
    return res.status(200).json({ message: 'Order deleted.' });
  } catch (err) {
    console.error('Delete order error:', err);
    return res.status(500).json({ message: 'Failed to delete order.' });
  }
});

module.exports = router;
