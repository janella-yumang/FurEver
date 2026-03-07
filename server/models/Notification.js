const { db, addId, nowISO } = require('../database');

const Notification = {
  find(filter = {}) {
    let sql = 'SELECT * FROM notifications';
    const conditions = []; const params = [];
    if (filter.userId) { conditions.push('userId = ?'); params.push(filter.userId); }
    if (filter.read !== undefined) { conditions.push('read = ?'); params.push(filter.read ? 1 : 0); }
    if (filter.type) { conditions.push('type = ?'); params.push(filter.type); }
    if (filter.productId) { conditions.push('productId = ?'); params.push(filter.productId); }
    if (filter.createdAt && filter.createdAt.$gte) {
      const d = filter.createdAt.$gte instanceof Date ? filter.createdAt.$gte.toISOString() : filter.createdAt.$gte;
      conditions.push('createdAt >= ?'); params.push(d);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY createdAt DESC';
    if (filter._limit) { sql += ' LIMIT ?'; params.push(filter._limit); }
    return db.prepare(sql).all(...params).map(Notification._parseRow);
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    return row ? Notification._parseRow(row) : null;
  },

  create(data) {
    const now = nowISO();
    const info = db.prepare(`
      INSERT INTO notifications (userId, type, title, message, orderId, productId, read, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.user || data.userId, data.type, data.title, data.message,
      data.order || data.orderId || null, data.product || data.productId || null,
      0, now, now
    );
    return Notification.findById(info.lastInsertRowid);
  },

  update(id, data) {
    const fields = []; const params = [];
    if (data.read !== undefined) { fields.push('read = ?'); params.push(data.read ? 1 : 0); }
    if (!fields.length) return Notification.findById(id);
    fields.push('updatedAt = ?'); params.push(nowISO()); params.push(id);
    db.prepare(`UPDATE notifications SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return Notification.findById(id);
  },

  markAllRead(userId) {
    db.prepare('UPDATE notifications SET read = 1, updatedAt = ? WHERE userId = ? AND read = 0').run(nowISO(), userId);
  },

  countUnread(userId) {
    return db.prepare('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND read = 0').get(userId).count;
  },

  _parseRow(row) {
    if (!row) return null;
    return {
      ...row,
      _id: String(row.id),
      user: row.userId ? String(row.userId) : null,
      order: row.orderId ? String(row.orderId) : null,
      product: row.productId ? String(row.productId) : null,
      read: !!row.read,
    };
  },
};

module.exports = Notification;
