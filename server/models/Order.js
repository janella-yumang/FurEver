const { db, addId, addIds, nowISO } = require('../database');

const Order = {
  find(filter = {}) {
    let sql = 'SELECT o.*, u.name as userName, u.email as userEmail FROM orders o LEFT JOIN users u ON o.userId = u.id';
    const conditions = []; const params = [];
    if (filter.userId || filter.user) { conditions.push('o.userId = ?'); params.push(filter.userId || filter.user); }
    if (filter.status) {
      if (typeof filter.status === 'object' && filter.status.$ne) {
        conditions.push('o.status != ?'); params.push(filter.status.$ne);
      } else {
        conditions.push('o.status = ?'); params.push(filter.status);
      }
    }
    if (filter.dateOrdered && filter.dateOrdered.$gte) {
      conditions.push('o.dateOrdered >= ?'); params.push(filter.dateOrdered.$gte instanceof Date ? filter.dateOrdered.$gte.toISOString() : filter.dateOrdered.$gte);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY o.dateOrdered DESC';
    return db.prepare(sql).all(...params).map(Order._parseRow);
  },

  findById(id) {
    const row = db.prepare('SELECT o.*, u.name as userName, u.email as userEmail FROM orders o LEFT JOIN users u ON o.userId = u.id WHERE o.id = ?').get(id);
    return row ? Order._parseRow(row) : null;
  },

  create(data, orderItems) {
    const now = nowISO();
    const info = db.prepare(`
      INSERT INTO orders (shippingAddress1, shippingAddress2, phone, status, totalPrice, voucherDiscount, voucherId, voucherCode, paymentMethod, userId, dateOrdered, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.shippingAddress1 || '', data.shippingAddress2 || '', data.phone || '',
      data.status || 'Pending', data.totalPrice || 0,
      data.voucherDiscount || 0,
      data.voucherId || null,
      data.voucherCode || '',
      data.paymentMethod || '',
      data.userId || data.user || null, data.dateOrdered || now, now, now
    );
    const orderId = info.lastInsertRowid;

    // Insert order items (accept second arg or data.orderItems)
    const items = orderItems || data.orderItems || [];
    const itemStmt = db.prepare('INSERT INTO order_items (orderId, productId, name, price, image, quantity) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of items) {
      itemStmt.run(orderId, item.product || item.productId || null, item.name || '', item.price || 0, item.image || '', item.quantity || 1);
    }
    return Order.findById(orderId);
  },

  update(id, data) {
    const fields = []; const params = [];
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.totalPrice !== undefined) { fields.push('totalPrice = ?'); params.push(data.totalPrice); }
    if (data.voucherDiscount !== undefined) { fields.push('voucherDiscount = ?'); params.push(data.voucherDiscount); }
    if (data.voucherId !== undefined) { fields.push('voucherId = ?'); params.push(data.voucherId); }
    if (data.voucherCode !== undefined) { fields.push('voucherCode = ?'); params.push(data.voucherCode); }
    if (data.shippingAddress1 !== undefined) { fields.push('shippingAddress1 = ?'); params.push(data.shippingAddress1); }
    if (data.shippingAddress2 !== undefined) { fields.push('shippingAddress2 = ?'); params.push(data.shippingAddress2); }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
    if (data.paymentMethod !== undefined) { fields.push('paymentMethod = ?'); params.push(data.paymentMethod); }
    if (!fields.length) return Order.findById(id);
    fields.push('updatedAt = ?'); params.push(nowISO()); params.push(id);
    db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return Order.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM orders WHERE id = ?').run(id).changes > 0;
  },

  getOrderItems(orderId) {
    return db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId).map(r => ({
      ...r, _id: String(r.id), product: r.productId ? String(r.productId) : null,
    }));
  },

  // ─── Analytics helpers ─────────────────────────────────
  salesByDate(startDate, endDate, period = 'day') {
    const sd = startDate || '2000-01-01';
    const ed = endDate || '2099-12-31';
    const groupExpr = period === 'month' ? "strftime('%Y-%m', dateOrdered)" : "date(dateOrdered)";
    const rows = db.prepare(`
      SELECT ${groupExpr} as period, SUM(totalPrice) as totalRevenue, COUNT(*) as orderCount
      FROM orders WHERE dateOrdered >= ? AND dateOrdered <= ? AND status != 'Cancelled'
      GROUP BY ${groupExpr} ORDER BY period ASC
    `).all(sd, ed);
    return rows.map(r => ({ _id: r.period, totalRevenue: r.totalRevenue, orderCount: r.orderCount }));
  },

  salesTotals() {
    return db.prepare(`
      SELECT COALESCE(SUM(totalPrice), 0) as totalRevenue, COUNT(*) as totalOrders, COALESCE(AVG(totalPrice), 0) as avgOrderValue
      FROM orders WHERE status != 'Cancelled'
    `).get();
  },

  monthlyRevenue() {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    return db.prepare(`
      SELECT CAST(strftime('%m', dateOrdered) AS INTEGER) as month, SUM(totalPrice) as revenue, COUNT(*) as orders
      FROM orders WHERE dateOrdered >= ? AND status != 'Cancelled'
      GROUP BY strftime('%m', dateOrdered) ORDER BY month ASC
    `).all(yearStart);
  },

  bestSellers(limit = 10) {
    return db.prepare(`
      SELECT oi.productId, p.name, p.image,
        SUM(oi.quantity) as totalQuantity,
        SUM(oi.price * oi.quantity) as totalRevenue,
        COUNT(DISTINCT oi.orderId) as orderCount
      FROM order_items oi
      JOIN orders o ON oi.orderId = o.id
      JOIN products p ON oi.productId = p.id
      WHERE o.status != 'Cancelled'
      GROUP BY oi.productId
      ORDER BY totalQuantity DESC LIMIT ?
    `).all(limit).map(r => ({
      _id: String(r.productId), name: r.name, image: r.image,
      totalQuantity: r.totalQuantity, totalRevenue: r.totalRevenue, orderCount: r.orderCount,
    }));
  },

  topCustomers(limit = 10) {
    return db.prepare(`
      SELECT o.userId, u.name, u.email,
        SUM(o.totalPrice) as totalSpent, COUNT(*) as orderCount, AVG(o.totalPrice) as avgOrderValue
      FROM orders o JOIN users u ON o.userId = u.id
      WHERE o.status != 'Cancelled' AND o.userId IS NOT NULL
      GROUP BY o.userId ORDER BY totalSpent DESC LIMIT ?
    `).all(limit).map(r => ({
      _id: String(r.userId), name: r.name, email: r.email,
      totalSpent: r.totalSpent, orderCount: r.orderCount, avgOrderValue: r.avgOrderValue,
    }));
  },

  statusDistribution() {
    return db.prepare('SELECT status as _id, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC').all();
  },

  paymentMethodStats() {
    return db.prepare(`
      SELECT COALESCE(paymentMethod, 'Unknown') as _id, COUNT(*) as count, SUM(totalPrice) as totalRevenue
      FROM orders GROUP BY paymentMethod ORDER BY count DESC
    `).all();
  },

  categorySales() {
    return db.prepare(`
      SELECT c.id as catId, COALESCE(c.name, 'Uncategorized') as name,
        SUM(oi.price * oi.quantity) as totalRevenue, SUM(oi.quantity) as totalQuantity
      FROM order_items oi
      JOIN orders o ON oi.orderId = o.id
      LEFT JOIN products p ON oi.productId = p.id
      LEFT JOIN categories c ON p.category = c.id
      WHERE o.status != 'Cancelled'
      GROUP BY c.id ORDER BY totalRevenue DESC
    `).all().map(r => ({ _id: r.catId ? String(r.catId) : null, name: r.name, totalRevenue: r.totalRevenue, totalQuantity: r.totalQuantity }));
  },

  _parseRow(row) {
    if (!row) return null;
    const order = {
      ...row,
      _id: String(row.id),
      user: row.userId ? { _id: String(row.userId), name: row.userName, email: row.userEmail } : null,
      orderItems: Order.getOrderItems(row.id),
      voucherId: row.voucherId ? String(row.voucherId) : null,
      voucherDiscount: parseFloat(row.voucherDiscount) || 0,
      voucherCode: row.voucherCode || '',
      userName: undefined, userEmail: undefined,
    };
    return order;
  },
};

module.exports = Order;
