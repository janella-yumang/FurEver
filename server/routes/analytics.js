const express = require('express');
const Order = require('../models/Order');
const { db } = require('../database');

const router = express.Router();

function getIsoBounds(range = 'monthly') {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  switch (String(range).toLowerCase()) {
    case 'daily':
    case 'day': {
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'weekly':
    case 'week': {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'yearly':
    case 'year': {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'monthly':
    case 'month':
    default: {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    }
  }

  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function buildSalesSummary(startDate, endDate) {
  const totals = db.prepare(`
    SELECT COALESCE(SUM(totalPrice), 0) AS revenue, COUNT(*) AS count
    FROM orders
    WHERE status != 'Cancelled' AND dateOrdered >= ? AND dateOrdered <= ?
  `).get(startDate, endDate);

  return {
    revenue: Number(totals?.revenue || 0),
    count: Number(totals?.count || 0),
  };
}

// ─── SALES BY DATE RANGE ────────────────────────────────────
router.get('/sales', (req, res) => {
  try {
    const { startDate, endDate, period, range } = req.query;
    const bounds = (startDate && endDate)
      ? { startDate, endDate }
      : getIsoBounds(range || 'monthly');

    const grouping = period || ((String(range).toLowerCase() === 'yearly' || String(range).toLowerCase() === 'year') ? 'month' : 'day');
    const salesByDate = Order.salesByDate(bounds.startDate, bounds.endDate, grouping);
    const totals = buildSalesSummary(bounds.startDate, bounds.endDate);

    return res.status(200).json({
      range: range || null,
      period: grouping,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      totals,
      salesByDate,
    });
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
    const topCustomers = Order.topCustomers(limit);
    const statusDistribution = Order.statusDistribution();
    const paymentMethods = Order.paymentMethodStats();
    return res.status(200).json({
      topCustomers,
      statusDistribution,
      paymentMethods,
    });
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
      `SELECT c.id AS categoryId, c.name AS category, COUNT(p.id) AS productCount, COALESCE(SUM(p.countInStock), 0) AS totalStock
       FROM products p LEFT JOIN categories c ON p.category = c.id
       GROUP BY p.category
       ORDER BY productCount DESC`
    ).all().map(r => ({
      _id: r.categoryId ? String(r.categoryId) : 'uncategorized',
      name: r.category || 'Uncategorized',
      productCount: Number(r.productCount || 0),
      totalStock: Number(r.totalStock || 0),
    }));
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
    const lowStock = db.prepare('SELECT COUNT(*) AS cnt FROM products WHERE countInStock <= lowStockThreshold').get().cnt;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const today = buildSalesSummary(todayStart.toISOString(), now.toISOString());
    const thisWeek = buildSalesSummary(weekStart.toISOString(), now.toISOString());
    const thisMonth = buildSalesSummary(monthStart.toISOString(), now.toISOString());
    const thisYear = buildSalesSummary(yearStart.toISOString(), now.toISOString());
    const allTime = Order.salesTotals();

    const statusDist = Order.statusDistribution();
    const paymentDist = Order.paymentMethodStats();

    return res.status(200).json({
      totalOrders, totalRevenue, totalUsers, totalProducts, pendingOrders,
      lowStock,
      today,
      thisWeek,
      thisMonth,
      thisYear,
      allTime: {
        revenue: Number(allTime?.totalRevenue || 0),
        count: Number(allTime?.totalOrders || 0),
        avgOrderValue: Number(allTime?.avgOrderValue || 0),
      },
      statusDistribution: statusDist,
      paymentMethodDistribution: paymentDist,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ message: 'Failed to fetch dashboard summary.' });
  }
});

module.exports = router;
