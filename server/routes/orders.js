const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const nodemailer = require('nodemailer');

const router = express.Router();

// Email transporter — uses Gmail SMTP if configured in .env
let transporter = null;
(async () => {
  try {
    if (process.env.SMTP_HOST) {
      // Use port 587 + STARTTLS (more firewall-friendly than port 465 SSL)
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,               // false = STARTTLS on 587
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 30000,    // 30 s connect timeout
        greetingTimeout: 30000,
      });
      // Verify connection
      await transporter.verify();
      console.log('✓ Gmail SMTP connected:', process.env.SMTP_USER);
    } else {
      // Create a test account so emails work in dev without real SMTP
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('✓ Email test account:', testAccount.user);
    }
  } catch (err) {
    console.log('Email transporter not configured:', err.message);
    // Fallback to Ethereal so the app keeps working without real email
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('↪ Fallback: using Ethereal test account', testAccount.user);
    } catch (_) { /* no email available */ }
  }
})();

const sendOrderConfirmation = async (order, userEmail) => {
  if (!transporter || !userEmail) return;
  try {
    const itemsHtml = (order.orderItems || [])
      .map(
        (i) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name || 'Product'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity || 1}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(i.price || 0).toFixed(2)}</td></tr>`
      )
      .join('');

    const fromEmail = process.env.SMTP_USER || 'noreply@furever.com';
    const info = await transporter.sendMail({
      from: `"FurEver Pet Shop" <${fromEmail}>`,
      to: userEmail,
      subject: `Order Confirmed – #${order._id.toString().slice(-8).toUpperCase()}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#FF8C42">🐾 Thank you for your order!</h2>
          <p>Your order <strong>#${order._id.toString().slice(-8).toUpperCase()}</strong> has been placed successfully.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Price</th></tr>
            ${itemsHtml}
          </table>
          <p><strong>Total: $${(order.totalPrice || 0).toFixed(2)}</strong></p>
          <p><strong>Payment:</strong> ${order.paymentMethod || 'N/A'}</p>
          <p><strong>Shipping to:</strong> ${order.shippingAddress1 || ''}${order.shippingAddress2 ? ', ' + order.shippingAddress2 : ''}</p>
          <p style="color:#888;font-size:12px;margin-top:24px">This is an automated email from FurEver Pet Shop.</p>
        </div>`,
    });
    console.log('Order confirmation email sent:', info.messageId);
    if (info.messageId && transporter.options?.host === 'smtp.ethereal.email') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

// Status update messages
const STATUS_MESSAGES = {
  Processing: {
    title: 'Order is Being Processed',
    message: (orderId) => `Your order #${orderId} is now being processed. We're preparing your items!`,
    emoji: '📦',
    notifType: 'order_processing',
  },
  Shipped: {
    title: 'Order Shipped!',
    message: (orderId) => `Great news! Your order #${orderId} has been shipped and is on its way to you.`,
    emoji: '🚚',
    notifType: 'order_shipped',
  },
  Delivered: {
    title: 'Order Delivered',
    message: (orderId) => `Your order #${orderId} has been delivered. Enjoy your purchase! 🐾`,
    emoji: '✅',
    notifType: 'order_delivered',
  },
  Canceled: {
    title: 'Order Canceled',
    message: (orderId) => `Your order #${orderId} has been canceled.`,
    emoji: '❌',
    notifType: 'order_canceled',
  },
};

const sendStatusEmail = async (order, userEmail, newStatus) => {
  if (!transporter || !userEmail) return;
  const info_cfg = STATUS_MESSAGES[newStatus];
  if (!info_cfg) return;
  const shortId = order._id.toString().slice(-8).toUpperCase();
  try {
    const fromEmail = process.env.SMTP_USER || 'noreply@furever.com';
    const info = await transporter.sendMail({
      from: `"FurEver Pet Shop" <${fromEmail}>`,
      to: userEmail,
      subject: `${info_cfg.emoji} ${info_cfg.title} – #${shortId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#FF8C42">${info_cfg.emoji} ${info_cfg.title}</h2>
          <p>${info_cfg.message(shortId)}</p>
          <p><strong>Status:</strong> ${newStatus}</p>
          <p style="color:#888;font-size:12px;margin-top:24px">This is an automated email from FurEver Pet Shop.</p>
        </div>`,
    });
    console.log(`Status email (${newStatus}) sent:`, info.messageId);
    if (info.messageId && transporter.options?.host === 'smtp.ethereal.email') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
  } catch (err) {
    console.error('Status email error:', err.message);
  }
};

const createNotification = async (userId, order, newStatus) => {
  const info_cfg = STATUS_MESSAGES[newStatus];
  if (!info_cfg || !userId) return;
  const shortId = order._id.toString().slice(-8).toUpperCase();
  try {
    await Notification.create({
      user: userId,
      type: info_cfg.notifType,
      title: info_cfg.title,
      message: info_cfg.message(shortId),
      order: order._id,
    });
  } catch (err) {
    console.error('Create notification error:', err.message);
  }
};

// ─── Admin notification helpers ──────────────────────────────────────

const notifyAdminsNewOrder = async (order, customerName) => {
  try {
    const admins = await User.find({ isAdmin: true, isActive: true });
    const shortId = order._id.toString().slice(-8).toUpperCase();
    const total = (order.totalPrice || 0).toFixed(2);
    const itemCount = order.orderItems ? order.orderItems.length : 0;

    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        type: 'admin_new_order',
        title: 'New Order Placed',
        message: `${customerName || 'A customer'} placed order #${shortId} with ${itemCount} item(s) totaling $${total}.`,
        order: order._id,
      });
    }
  } catch (err) {
    console.error('Admin new order notification error:', err.message);
  }
};

// Notify admins when an order has been delivered
const notifyAdminsOrderDelivered = async (order, customerName) => {
  try {
    const admins = await User.find({ isAdmin: true, isActive: true });
    const shortId = order._id.toString().slice(-8).toUpperCase();
    const total = (order.totalPrice || 0).toFixed(2);
    const itemCount = order.orderItems ? order.orderItems.length : 0;

    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        type: 'admin_order_delivered',
        title: 'Order Delivered',
        message: `Order #${shortId} from ${customerName || 'a customer'} (${itemCount} item(s), $${total}) has been delivered successfully.`,
        order: order._id,
      });
    }
  } catch (err) {
    console.error('Admin delivery notification error:', err.message);
  }
};

// Decrease stock when order is delivered and notify admins about low/out-of-stock
const decreaseStockOnDelivery = async (order) => {
  try {
    const admins = await User.find({ isAdmin: true, isActive: true });

    for (const item of order.orderItems) {
      const productId = item.product;
      if (!productId) continue;

      const product = await Product.findById(productId);
      if (!product) continue;

      // Decrease stock on delivery
      const newStock = Math.max(0, product.countInStock - (item.quantity || 1));
      product.countInStock = newStock;
      await product.save();

      if (admins.length === 0) continue;

      if (newStock === 0) {
        // Out of stock notification
        for (const admin of admins) {
          const recent = await Notification.findOne({
            user: admin._id,
            type: 'admin_out_of_stock',
            product: product._id,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          });
          if (!recent) {
            await Notification.create({
              user: admin._id,
              type: 'admin_out_of_stock',
              title: 'Out of Stock Alert',
              message: `"${product.name}" is now out of stock (0 remaining). Please restock immediately.`,
              product: product._id,
            });
          }
        }
      } else if (newStock > 0 && newStock <= (product.lowStockThreshold || 10)) {
        // Low stock notification
        for (const admin of admins) {
          const recent = await Notification.findOne({
            user: admin._id,
            type: 'admin_low_stock',
            product: product._id,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          });
          if (!recent) {
            await Notification.create({
              user: admin._id,
              type: 'admin_low_stock',
              title: 'Low Stock Warning',
              message: `"${product.name}" is running low — only ${newStock} left in stock (threshold: ${product.lowStockThreshold || 10}).`,
              product: product._id,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Stock decrease/notification error:', err.message);
  }
};

// GET all orders (admin)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ dateOrdered: -1 });
    return res.status(200).json(orders);
  } catch (err) {
    console.error('Get orders error:', err);
    return res.status(500).json({ message: 'Failed to fetch orders.' });
  }
});

// GET orders for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId })
      .sort({ dateOrdered: -1 });
    return res.status(200).json(orders);
  } catch (err) {
    console.error('Get user orders error:', err);
    return res.status(500).json({ message: 'Failed to fetch user orders.' });
  }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    return res.status(200).json(order);
  } catch (err) {
    console.error('Get order error:', err);
    return res.status(500).json({ message: 'Failed to fetch order.' });
  }
});

// POST create order
router.post('/', async (req, res) => {
  try {
    const {
      orderItems, shippingAddress1, shippingAddress2,
      phone, user,
      paymentMethod
    } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items.' });
    }

    // Map cart items to order items — cart sends full product objects
    const mappedItems = orderItems.map((item) => ({
      product: item._id || item.id || item.product,
      name: item.name || '',
      price: item.price || 0,
      image: item.image || '',
      quantity: item.quantity || 1,
    }));

    // Calculate total from items
    const totalPrice = mappedItems.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0
    );

    const order = new Order({
      orderItems: mappedItems,
      shippingAddress1: shippingAddress1 || '',
      shippingAddress2: shippingAddress2 || '',
      phone: phone || '',
      totalPrice,
      paymentMethod: paymentMethod || '',
      user: user || null,
      status: 'Pending',
      dateOrdered: Date.now(),
    });

    const saved = await order.save();

    // Send confirmation email + notification
    if (user) {
      const userDoc = await User.findById(user);
      if (userDoc && userDoc.email) {
        sendOrderConfirmation(saved, userDoc.email);
      }
      // Create order confirmed notification for the customer
      const shortId = saved._id.toString().slice(-8).toUpperCase();
      Notification.create({
        user,
        type: 'order_confirmed',
        title: 'Order Confirmed!',
        message: `Your order #${shortId} has been placed successfully. Total: $${(saved.totalPrice || 0).toFixed(2)}`,
        order: saved._id,
      }).catch((err) => console.error('Notification error:', err.message));

      // Notify all admins about the new order
      const customerName = userDoc ? userDoc.name : 'A customer';
      notifyAdminsNewOrder(saved, customerName).catch((err) =>
        console.error('Admin order notification error:', err.message)
      );
    }

    return res.status(201).json(saved);
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ message: 'Failed to create order.' });
  }
});

// PUT update order status (admin)
router.put('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    // Send email + in-app notification for status change
    const newStatus = req.body.status;
    const userId = order.user?._id || order.user;
    const userEmail = order.user?.email;
    if (userId) createNotification(userId, order, newStatus);
    if (userEmail) sendStatusEmail(order, userEmail, newStatus);

    // Decrease stock when order is delivered + notify admins
    if (newStatus === 'Delivered') {
      const customerName = order.user?.name || 'A customer';
      notifyAdminsOrderDelivered(order, customerName).catch((err) =>
        console.error('Admin delivery notification error:', err.message)
      );
      decreaseStockOnDelivery(order).catch((err) =>
        console.error('Stock decrease on delivery error:', err.message)
      );
    }

    return res.status(200).json(order);
  } catch (err) {
    console.error('Update order error:', err);
    return res.status(500).json({ message: 'Failed to update order.' });
  }
});

// PUT cancel order (customer – only if not yet Shipped)
router.put('/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (['Shipped', 'Delivered'].includes(order.status)) {
      return res.status(400).json({
        message: 'Cannot cancel an order that has already been shipped or delivered.',
      });
    }

    order.status = 'Canceled';
    const saved = await order.save();

    // Notification for cancellation
    if (order.user) {
      createNotification(order.user, saved, 'Canceled');
    }

    return res.status(200).json(saved);
  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(500).json({ message: 'Failed to cancel order.' });
  }
});

// DELETE order
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    return res.status(200).json({ message: 'Order deleted.' });
  } catch (err) {
    console.error('Delete order error:', err);
    return res.status(500).json({ message: 'Failed to delete order.' });
  }
});

module.exports = router;
