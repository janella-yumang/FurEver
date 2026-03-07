const { db, addId, addIds, nowISO } = require('../database');

const User = {
  find(filter = {}) {
    let sql = 'SELECT * FROM users';
    const conditions = [];
    const params = [];
    if (filter.isAdmin !== undefined) { conditions.push('isAdmin = ?'); params.push(filter.isAdmin ? 1 : 0); }
    if (filter.isActive !== undefined) { conditions.push('isActive = ?'); params.push(filter.isActive ? 1 : 0); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY createdAt DESC';
    return db.prepare(sql).all(...params).map(r => User._parseRow(addId(r)));
  },

  findOne(filter) {
    if (filter.email) {
      const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(filter.email.toLowerCase());
      return row ? User._parseRow(addId(row)) : null;
    }
    if (filter.id || filter._id) return User.findById(filter.id || filter._id);
    return null;
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? User._parseRow(addId(row)) : null;
  },

  create(data) {
    const now = nowISO();
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password, phone, isAdmin, role, shippingAddress, preferredPets, image, isActive, emailVerified, verificationCode, verificationExpires, googleId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      data.name, (data.email || '').toLowerCase(), data.password, data.phone || '',
      data.isAdmin ? 1 : 0, data.role || 'customer', data.shippingAddress || '',
      JSON.stringify(data.preferredPets || []), data.image || '',
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      data.emailVerified ? 1 : 0, data.verificationCode || null,
      data.verificationExpires || null, data.googleId || null, now, now
    );
    return User.findById(info.lastInsertRowid);
  },

  update(id, data) {
    const fields = []; const params = [];
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.email !== undefined) { fields.push('email = ?'); params.push(data.email.toLowerCase()); }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
    if (data.shippingAddress !== undefined) { fields.push('shippingAddress = ?'); params.push(data.shippingAddress); }
    if (data.preferredPets !== undefined) { fields.push('preferredPets = ?'); params.push(JSON.stringify(data.preferredPets)); }
    if (data.image !== undefined) { fields.push('image = ?'); params.push(data.image); }
    if (data.isAdmin !== undefined) { fields.push('isAdmin = ?'); params.push(data.isAdmin ? 1 : 0); }
    if (data.role !== undefined) { fields.push('role = ?'); params.push(data.role); }
    if (data.isActive !== undefined) { fields.push('isActive = ?'); params.push(data.isActive ? 1 : 0); }
    if (data.emailVerified !== undefined) { fields.push('emailVerified = ?'); params.push(data.emailVerified ? 1 : 0); }
    if (data.verificationCode !== undefined) { fields.push('verificationCode = ?'); params.push(data.verificationCode); }
    if (data.verificationExpires !== undefined) { fields.push('verificationExpires = ?'); params.push(data.verificationExpires); }
    if (data.googleId !== undefined) { fields.push('googleId = ?'); params.push(data.googleId); }
    if (data.password !== undefined) { fields.push('password = ?'); params.push(data.password); }
    if (!fields.length) return User.findById(id);
    fields.push('updatedAt = ?'); params.push(nowISO()); params.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return User.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  },

  _parseRow(row) {
    if (!row) return null;
    return {
      ...row,
      isAdmin: !!row.isAdmin,
      isActive: row.isActive !== 0,
      emailVerified: !!row.emailVerified,
      preferredPets: typeof row.preferredPets === 'string' ? JSON.parse(row.preferredPets || '[]') : (row.preferredPets || []),
    };
  },

  toJSON(user) {
    if (!user) return null;
    const { password, verificationCode, verificationExpires, ...safe } = user;
    return safe;
  },
};

module.exports = User;
