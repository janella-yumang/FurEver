const { db, addId, addIds, nowISO } = require('../database');

const Category = {
  find() {
    return db.prepare('SELECT * FROM categories ORDER BY createdAt DESC').all().map(r => addId(r));
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    return row ? addId(row) : null;
  },

  create(data) {
    const now = nowISO();
    const info = db.prepare(
      'INSERT INTO categories (name, color, icon, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)'
    ).run(data.name, data.color || '', data.icon || '', now, now);
    return Category.findById(info.lastInsertRowid);
  },

  update(id, data) {
    const fields = []; const params = [];
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.color !== undefined) { fields.push('color = ?'); params.push(data.color); }
    if (data.icon !== undefined) { fields.push('icon = ?'); params.push(data.icon); }
    if (!fields.length) return Category.findById(id);
    fields.push('updatedAt = ?'); params.push(nowISO()); params.push(id);
    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return Category.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM categories WHERE id = ?').run(id).changes > 0;
  },
};

module.exports = Category;
