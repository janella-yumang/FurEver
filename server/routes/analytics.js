const express = require('express');
const Order = require('../models/Order');
const { User, Product } = require('../database');

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

async function buildSalesSummary(startDate, endDate) {
  const buckets = await Order.salesByDate(startDate, endDate, 'day');
  const revenue = buckets.reduce((sum, item) => sum + Number(item.totalRevenue || 0), 0);
  const count = buckets.reduce((sum, item) => sum + Number(item.orderCount || 0), 0);
  return { revenue, count };
}

// ─── SALES BY DATE RANGE ────────────────────────────────────
router.get('/sales', async (req, res) => {
  try {
    const { startDate, endDate, period, range } = req.query;
    const bounds = (startDate && endDate)
      ? { startDate, endDate }
      : getIsoBounds(range || 'monthly');

    const grouping = period || ((String(range).toLowerCase() === 'yearly' || String(range).toLowerCase() === 'year') ? 'month' : 'day');
    const salesByDate = await Order.salesByDate(bounds.startDate, bounds.endDate, grouping);
    const totals = await buildSalesSummary(bounds.startDate, bounds.endDate);

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
router.get('/sales-totals', async (req, res) => {
  try {
    const totals = await Order.salesTotals();
    return res.status(200).json(totals);
  } catch (err) {
    console.error('Sales totals error:', err);
    return res.status(500).json({ message: 'Failed to fetch sales totals.' });
  }
});

// ─── MONTHLY REVENUE (last 12 months) ──────────────────────
router.get('/revenue', async (req, res) => {
  try {
    const data = await Order.monthlyRevenue();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Revenue analytics error:', err);
    return res.status(500).json({ message: 'Failed to fetch revenue analytics.' });
  }
});

// ─── BEST SELLERS ───────────────────────────────────────────
router.get('/best-sellers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = await Order.bestSellers(limit);
    return res.status(200).json(data);
  } catch (err) {
    console.error('Best sellers error:', err);
    return res.status(500).json({ message: 'Failed to fetch best sellers.' });
  }
});

// ─── TOP CUSTOMERS ──────────────────────────────────────────
router.get('/customer-trends', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topCustomers = await Order.topCustomers(limit);
    const statusDistribution = await Order.statusDistribution();
    const paymentMethods = await Order.paymentMethodStats();
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
router.get('/category-sales', async (req, res) => {
  try {
    const data = await Order.categorySales();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Category sales error:', err);
    return res.status(500).json({ message: 'Failed to fetch category sales.' });
  }
});

// ─── PRODUCT DISTRIBUTION ───────────────────────────────────
router.get('/product-distribution', async (req, res) => {
  try {
    const data = await Product.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      {
        $group: {
          _id: '$category',
          categoryName: { $first: { $arrayElemAt: ['$categoryInfo.name', 0] } },
          productCount: { $sum: 1 },
          totalStock: { $sum: '$countInStock' },
        },
      },
      {
        $project: {
          _id: { $ifNull: [{ $toString: '$_id' }, 'uncategorized'] },
          name: { $ifNull: ['$categoryName', 'Uncategorized'] },
          productCount: 1,
          totalStock: 1,
        },
      },
      { $sort: { productCount: -1 } },
    ]);
    return res.status(200).json(data);
  } catch (err) {
    console.error('Product distribution error:', err);
    return res.status(500).json({ message: 'Failed to fetch product distribution.' });
  }
});

// ─── DASHBOARD SUMMARY ─────────────────────────────────────
router.get('/dashboard-summary', async (req, res) => {
  try {
    const totalOrders = await Order.find();
    const totals = await Order.salesTotals();
    const totalUsers = await User.countDocuments({});
    const totalProducts = await Product.countDocuments({});
    const pendingOrders = await Order.find({ status: 'Pending' });
    const lowStock = await Product.countDocuments({ $expr: { $lte: ['$countInStock', '$lowStockThreshold'] } });

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

    const today = await buildSalesSummary(todayStart.toISOString(), now.toISOString());
    const thisWeek = await buildSalesSummary(weekStart.toISOString(), now.toISOString());
    const thisMonth = await buildSalesSummary(monthStart.toISOString(), now.toISOString());
    const thisYear = await buildSalesSummary(yearStart.toISOString(), now.toISOString());
    const allTime = totals;

    const statusDist = await Order.statusDistribution();
    const paymentDist = await Order.paymentMethodStats();

    return res.status(200).json({
      totalOrders: totalOrders.length,
      totalRevenue: Number(totals?.totalRevenue || 0),
      totalUsers,
      totalProducts,
      pendingOrders: pendingOrders.length,
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
