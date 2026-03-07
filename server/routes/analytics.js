const express = require('express');
const Order = require('../models/Order');
const { db } = require('../database');

const router = express.Router();

// ─── SALES BY DATE RANGE ────────────────────────────────────
router.get('/sales', (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;
    const data = Order.salesByDate(startDate, endDate, period || 'day');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Sales analytics error:', err);
    return res.status(500).json({ message: 'Failed to fetch sales analytics.' });
  }
});

// ─── SALES TOTALS ───────────────────────────────────────────
router.get('/sales-totals', (req, res) => {
  try {
    const totals = Order.salesTotals();
    return res.status(200).json(totals);
  } catch (err) {
    console.error('Sales totals error:', err);
    return res.status(500).json({ message: 'Failed to fetch sales totals.' });
  }
});

// ─── MONTHLY REVENUE (last 12 months) ──────────────────────
router.get('/revenue', (req, res) => {
  try {
    const data = Order.monthlyRevenue();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Revenue analytics error:', err);
    return res.status(500).json({ message: 'Failed to fetch revenue analytics.' });
  }
});

// ─── BEST SELLERS ───────────────────────────────────────────
router.get('/best-sellers', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = Order.bestSellers(limit);
    return res.status(200).json(data);
  } catch (err) {
    console.error('Best sellers error:', err);
    return res.status(500).json({ message: 'Failed to fetch best sellers.' });
  }
});

// ─── TOP CUSTOMERS ──────────────────────────────────────────
router.get('/customer-trends', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = Order.topCustomers(limit);
    return res.status(200).json(data);
  } catch (err) {
    console.error('Customer trends error:', err);
    return res.status(500).json({ message: 'Failed to fetch customer trends.' });
  }
});

// ─── CATEGORY SALES ─────────────────────────────────────────
router.get('/category-sales', (req, res) => {
  try {
    const data = Order.categorySales();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Category sales error:', err);
    return res.status(500).json({ message: 'Failed to fetch category sales.' });
  }
});

// ─── PRODUCT DISTRIBUTION ───────────────────────────────────
router.get('/product-distribution', (req, res) => {
  try {
    const data = db.prepare(
      `SELECT c.name AS category, COUNT(p.id) AS count
       FROM products p LEFT JOIN categories c ON p.category = c.id
       GROUP BY p.category
       ORDER BY count DESC`
    ).all().map(r => ({ _id: r.category || 'Uncategorized', count: r.count }));
    return res.status(200).json(data);
  } catch (err) {
    console.error('Product distribution error:', err);
    return res.status(500).json({ message: 'Failed to fetch product distribution.' });
  }
});

// ─── DASHBOARD SUMMARY ─────────────────────────────────────
router.get('/dashboard-summary', (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) AS cnt FROM orders').get().cnt;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(totalPrice), 0) AS total FROM orders WHERE status != 'Cancelled'").get().total;
    const totalUsers = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
    const totalProducts = db.prepare('SELECT COUNT(*) AS cnt FROM products').get().cnt;
    const pendingOrders = db.prepare("SELECT COUNT(*) AS cnt FROM orders WHERE status = 'Pending'").get().cnt;

    const statusDist = Order.statusDistribution();
    const paymentDist = Order.paymentMethodStats();

    return res.status(200).json({
      totalOrders, totalRevenue, totalUsers, totalProducts, pendingOrders,
      statusDistribution: statusDist,
      paymentMethodDistribution: paymentDist,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ message: 'Failed to fetch dashboard summary.' });
  }
});

module.exports = router;
