const express = require('express');
const nodemailer = require('nodemailer');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { db } = require('../database');

const router = express.Router();

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
    await transporter.sendMail({
      from: `"FurEver Pet Shop" <${fromEmail}>`,
      to: user.email,
      subject: `🐾 Order Update - ${status}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto">
        <h2 style="color:#FF8C42">🐾 Order Status Update</h2>
        <p>Hi <strong>${user.name || 'Customer'}</strong>,</p>
        <p>${statusMessages[status] || 'Your order status has been updated.'}</p>
        <div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0">
          <p><strong>Order ID:</strong> #${order._id || order.id}</p>
          <p><strong>Status:</strong> ${status}</p>
          <p><strong>Total:</strong> ₱${(order.totalPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
        </div>
        <p style="color:#666;font-size:14px">Thank you for shopping at FurEver! 🐾</p>
      </div>`,
    });
    console.log(`Order status email sent to ${user.email}: ${status}`);
  } catch (err) { console.error('Order status email error:', err.message); }
};

// ─── GET ALL ORDERS ─────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const orders = Order.find();
    return res.status(200).json(orders);
  } catch (err) {
    console.error('Get orders error:', err);
    return res.status(500).json({ message: 'Failed to fetch orders.' });
  }
});

// ─── GET ORDERS BY USER ─────────────────────────────────────
router.get('/user/:userId', (req, res) => {
  try {
    const orders = Order.find({ user: parseInt(req.params.userId) });
    return res.status(200).json(orders);
  } catch (err) {
    console.error('Get user orders error:', err);
    return res.status(500).json({ message: 'Failed to fetch user orders.' });
  }
});

// ─── GET SINGLE ORDER ───────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const order = Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    return res.status(200).json(order);
  } catch (err) {
    console.error('Get order error:', err);
    return res.status(500).json({ message: 'Failed to fetch order.' });
  }
});

// ─── CREATE ORDER ───────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { orderItems, shippingAddress1, shippingAddress2, phone, status, totalPrice, paymentMethod, user } = req.body;
    if (!orderItems || !orderItems.length) {
      return res.status(400).json({ message: 'No order items.' });
    }

    const order = Order.create({
      shippingAddress1: shippingAddress1 || '',
      shippingAddress2: shippingAddress2 || '',
      phone: phone || '',
      status: status || 'Pending',
      totalPrice: parseFloat(totalPrice) || 0,
      paymentMethod: paymentMethod || '',
      user: parseInt(user),
    }, orderItems.map(item => ({
      product: parseInt(item.product),
      name: item.name || '',
      price: parseFloat(item.price) || 0,
      image: item.image || '',
      quantity: parseInt(item.quantity) || 1,
    })));

    // Decrease stock for each item
    for (const item of orderItems) {
      const prod = Product.findById(parseInt(item.product));
      if (prod) {
        const newStock = Math.max(0, prod.countInStock - (parseInt(item.quantity) || 1));
        Product.update(parseInt(item.product), { countInStock: newStock });
      }
    }

    // Send notification + email to user
    const userObj = User.findById(parseInt(user));
    if (userObj) {
      sendOrderStatusEmail(userObj, order, 'Pending');
      Notification.create({
        user: userObj.id, type: 'order',
        title: 'Order Placed',
        message: `Your order #${order._id} has been placed successfully!`,
        orderId: order.id,
      });
    }

    // Notify admins
    const admins = User.find().filter(u => u.isAdmin);
    for (const admin of admins) {
      Notification.create({
        user: admin.id, type: 'order',
        title: 'New Order',
        message: `New order #${order._id} placed${userObj ? ' by ' + userObj.name : ''}.`,
        orderId: order.id,
      });
    }

    return res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ message: 'Failed to create order.' });
  }
});

// ─── UPDATE ORDER STATUS ────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    let order = Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const { status, shippingAddress1, shippingAddress2, phone, paymentMethod } = req.body;

    const updates = {};
    if (status) updates.status = status;
    if (shippingAddress1 !== undefined) updates.shippingAddress1 = shippingAddress1;
    if (shippingAddress2 !== undefined) updates.shippingAddress2 = shippingAddress2;
    if (phone !== undefined) updates.phone = phone;
    if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;

    order = Order.update(req.params.id, updates);

    if (status && order.userId) {
      const userObj = User.findById(order.userId);
      if (userObj) {
        sendOrderStatusEmail(userObj, order, status);
        Notification.create({
          user: userObj.id, type: 'order',
          title: `Order ${status}`,
          message: `Your order #${order._id} status has been updated to ${status}.`,
          orderId: order.id,
        });
      }
    }
    return res.status(200).json(order);
  } catch (err) {
    console.error('Update order error:', err);
    return res.status(500).json({ message: 'Failed to update order.' });
  }
});

// ─── CANCEL ORDER ───────────────────────────────────────────
router.put('/:id/cancel', async (req, res) => {
  try {
    let order = Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Cannot cancel a delivered order.' });
    }

    // Restore stock
    if (order.orderItems) {
      for (const item of order.orderItems) {
        const prodId = typeof item.product === 'object' ? item.product : (item.productId || item.product);
        if (prodId) {
          const prod = Product.findById(parseInt(prodId));
          if (prod) {
            Product.update(parseInt(prodId), { countInStock: prod.countInStock + (item.quantity || 1) });
          }
        }
      }
    }

    order = Order.update(req.params.id, { status: 'Cancelled' });

    if (order.userId) {
      const userObj = User.findById(order.userId);
      if (userObj) {
        sendOrderStatusEmail(userObj, order, 'Cancelled');
        Notification.create({
          user: userObj.id, type: 'order',
          title: 'Order Cancelled',
          message: `Your order #${order._id} has been cancelled.`,
          orderId: order.id,
        });
      }
    }
    return res.status(200).json(order);
  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(500).json({ message: 'Failed to cancel order.' });
  }
});

// ─── DELETE ORDER ───────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const deleted = Order.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Order not found.' });
    return res.status(200).json({ message: 'Order deleted.' });
  } catch (err) {
    console.error('Delete order error:', err);
    return res.status(500).json({ message: 'Failed to delete order.' });
  }
});

module.exports = router;
