/**
 * Order Model - MongoDB/Mongoose Implementation
 * Handles order management, order items, and analytics
 */

const { Order: OrderModel } = require('../database');
const { addId, addIds } = require('../database');

const Order = {
  
  /**
   * Find orders with filtering
   */
  async find(filter = {}) {
    try {
      let query = {};
      
      if (filter.userId || filter.user) {
        query.userId = filter.userId || filter.user;
      }
      
      if (filter.status) {
        if (typeof filter.status === 'object' && filter.status.$ne) {
          query.status = { $ne: filter.status.$ne };
        } else {
          query.status = filter.status;
        }
      }
      
      if (filter.dateOrdered?.$gte) {
        const date = filter.dateOrdered.$gte instanceof Date 
          ? filter.dateOrdered.$gte 
          : new Date(filter.dateOrdered.$gte);
        query.dateOrdered = { $gte: date };
      }
      
      const docs = await OrderModel.find(query)
        .populate('userId', 'name email')
        .sort({ dateOrdered: -1 });

      return addIds(docs).map((order) => {
        if (order.userId && typeof order.userId === 'object') {
          order.user = {
            _id: String(order.userId._id || order.userId.id || ''),
            name: order.userId.name || '',
            email: order.userId.email || '',
          };
        }
        order.orderItems = order.items || [];
        return order;
      });
    } catch (error) {
      console.error('Order.find error:', error);
      return [];
    }
  },
  
  /**
   * Find order by ID
   */
  async findById(id) {
    try {
      const doc = await OrderModel.findById(id)
        .populate('userId', 'name email');
      
      if (!doc) return null;
      
      // Format user info to match legacy structure
      const order = addId(doc.toObject());
      if (doc.userId) {
        order.user = {
          _id: String(doc.userId._id),
          name: doc.userId.name,
          email: doc.userId.email,
        };
      }
      order.orderItems = order.items || [];
      
      return order;
    } catch (error) {
      console.error('Order.findById error:', error);
      return null;
    }
  },
  
  /**
   * Create order with items
   */
  async create(data, orderItems) {
    try {
      const now = new Date();
      const items = orderItems || data.orderItems || [];
      
      const orderData = {
        shippingAddress1: data.shippingAddress1 || '',
        shippingAddress2: data.shippingAddress2 || '',
        phone: data.phone || '',
        status: data.status || 'Pending',
        totalPrice: data.totalPrice || 0,
        voucherDiscount: data.voucherDiscount || 0,
        voucherId: data.voucherId || null,
        voucherCode: data.voucherCode || '',
        paymentMethod: data.paymentMethod || '',
        userId: data.userId || data.user || null,
        items: items.map(item => ({
          productId: item.product || item.productId || null,
          name: item.name || '',
          price: item.price || 0,
          image: item.image || '',
          quantity: item.quantity || 1,
        })),
        dateOrdered: data.dateOrdered || now,
        createdAt: now,
        updatedAt: now,
      };
      
      const orderDoc = new OrderModel(orderData);
      const saved = await orderDoc.save();
      
      const populated = await OrderModel.findById(saved._id)
        .populate('userId', 'name email');

      const order = addId(populated.toObject());
      order.orderItems = order.items || [];
      return order;
    } catch (error) {
      console.error('Order.create error:', error);
      throw error;
    }
  },
  
  /**
   * Update order
   */
  async update(id, data) {
    try {
      const updateData = { 
        ...data,
        updatedAt: new Date(),
      };
      
      const doc = await OrderModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      )
        .populate('userId', 'name email');
      
      if (!doc) return null;
      
      const order = addId(doc.toObject());
      if (doc.userId) {
        order.user = {
          _id: String(doc.userId._id),
          name: doc.userId.name,
          email: doc.userId.email,
        };
      }
      order.orderItems = order.items || [];
      
      return order;
    } catch (error) {
      console.error('Order.update error:', error);
      return null;
    }
  },
  
  /**
   * Delete order
   */
  async delete(id) {
    try {
      const result = await OrderModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Order.delete error:', error);
      return false;
    }
  },
  
  /**
   * Get order items for an order
   */
  async getOrderItems(orderId) {
    try {
      const order = await OrderModel.findById(orderId);
      if (!order) return [];
      
      return (order.items || []).map(item => ({
        ...item,
        _id: item._id.toString(),
        product: item.productId ? String(item.productId) : null,
      }));
    } catch (error) {
      console.error('Order.getOrderItems error:', error);
      return [];
    }
  },
  
  // ─── Analytics Methods ─────────────────────────────────
  
  /**
   * Get sales by date/month
   */
  async salesByDate(startDate, endDate, period = 'day') {
    try {
      const sd = startDate ? new Date(startDate) : new Date('2000-01-01');
      const ed = endDate ? new Date(endDate) : new Date('2099-12-31');
      
      const groupStage = period === 'month' 
        ? { $dateToString: { format: '%Y-%m', date: '$dateOrdered' } }
        : { $dateToString: { format: '%Y-%m-%d', date: '$dateOrdered' } };
      
      const results = await OrderModel.aggregate([
        {
          $match: {
            dateOrdered: { $gte: sd, $lte: ed },
            status: { $ne: 'Cancelled' },
          },
        },
        {
          $group: {
            _id: groupStage,
            totalRevenue: { $sum: '$totalPrice' },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      
      return results;
    } catch (error) {
      console.error('Order.salesByDate error:', error);
      return [];
    }
  },
  
  /**
   * Get total sales statistics
   */
  async salesTotals() {
    try {
      const results = await OrderModel.aggregate([
        {
          $match: { status: { $ne: 'Cancelled' } },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPrice' },
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: '$totalPrice' },
          },
        },
      ]);
      
      return results.length > 0 ? results[0] : { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
    } catch (error) {
      console.error('Order.salesTotals error:', error);
      return { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
    }
  },
  
  /**
   * Get monthly revenue for current year
   */
  async monthlyRevenue() {
    try {
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      
      const results = await OrderModel.aggregate([
        {
          $match: {
            dateOrdered: { $gte: yearStart },
            status: { $ne: 'Cancelled' },
          },
        },
        {
          $group: {
            _id: { $month: '$dateOrdered' },
            revenue: { $sum: '$totalPrice' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      
      return results;
    } catch (error) {
      console.error('Order.monthlyRevenue error:', error);
      return [];
    }
  },
  
  /**
   * Get best selling products
   */
  async bestSellers(limit = 10) {
    try {
      const results = await OrderModel.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.name' },
            image: { $first: '$items.image' },
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: limit },
      ]);
      
      return results;
    } catch (error) {
      console.error('Order.bestSellers error:', error);
      return [];
    }
  },
  
  /**
   * Get top customers
   */
  async topCustomers(limit = 10) {
    try {
      const results = await OrderModel.aggregate([
        { $match: { status: { $ne: 'Cancelled' }, userId: { $ne: null } } },
        {
          $group: {
            _id: '$userId',
            totalSpent: { $sum: '$totalPrice' },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$totalPrice' },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        { $unwind: '$userInfo' },
        {
          $project: {
            _id: 1,
            name: '$userInfo.name',
            email: '$userInfo.email',
            totalSpent: 1,
            orderCount: 1,
            avgOrderValue: 1,
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: limit },
      ]);
      
      return results;
    } catch (error) {
      console.error('Order.topCustomers error:', error);
      return [];
    }
  },
  
  /**
   * Get order status distribution
   */
  async statusDistribution() {
    try {
      const results = await OrderModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);
      
      return results;
    } catch (error) {
      console.error('Order.statusDistribution error:', error);
      return [];
    }
  },
  
  /**
   * Get payment method statistics
   */
  async paymentMethodStats() {
    try {
      const results = await OrderModel.aggregate([
        {
          $group: {
            _id: { $ifNull: ['$paymentMethod', 'Unknown'] },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalPrice' },
          },
        },
        { $sort: { count: -1 } },
      ]);
      
      return results;
    } catch (error) {
      console.error('Order.paymentMethodStats error:', error);
      return [];
    }
  },
  
  /**
   * Get category sales
   */
  async categorySales() {
    try {
      const results = await OrderModel.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            totalQuantity: { $sum: '$items.quantity' },
          },
        },
      ]);
      
      return results.map(r => ({
        _id: r._id,
        name: 'Total Category Sales',
        totalRevenue: r.totalRevenue,
        totalQuantity: r.totalQuantity,
      }));
    } catch (error) {
      console.error('Order.categorySales error:', error);
      return [];
    }
  },
};

module.exports = Order;
