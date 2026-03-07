const { db, addId, addIds, nowISO } = require('../database');

const Product = {
  find(filter = {}) {
    let sql = `SELECT p.*, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon
               FROM products p LEFT JOIN categories c ON p.category = c.id`;
    const conditions = []; const params = [];
    if (filter.categoryIds && filter.categoryIds.length) {
      const placeholders = filter.categoryIds.map(() => '?').join(',');
      conditions.push(`p.category IN (${placeholders})`);
      params.push(...filter.categoryIds);
    }
    if (filter.countInStock !== undefined) {
      if (typeof filter.countInStock === 'object') {
        if (filter.countInStock.$lte !== undefined) { conditions.push('p.countInStock <= ?'); params.push(filter.countInStock.$lte); }
        if (filter.countInStock.$gt !== undefined) { conditions.push('p.countInStock > ?'); params.push(filter.countInStock.$gt); }
      } else {
        conditions.push('p.countInStock = ?'); params.push(filter.countInStock);
      }
    }
    if (filter.barcode) { conditions.push('p.barcode = ?'); params.push(filter.barcode); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY p.createdAt DESC';
    return db.prepare(sql).all(...params).map(Product._parseRow);
  },

  findById(id) {
    const row = db.prepare(`
      SELECT p.*, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon
      FROM products p LEFT JOIN categories c ON p.category = c.id
      WHERE p.id = ?
    `).get(id);
    return row ? Product._parseRow(row) : null;
  },

  findByBarcode(code) {
    const row = db.prepare(`
      SELECT p.*, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon
      FROM products p LEFT JOIN categories c ON p.category = c.id
      WHERE p.barcode = ?
    `).get(code);
    return row ? Product._parseRow(row) : null;
  },

  create(data) {
    const now = nowISO();
    const info = db.prepare(`
      INSERT INTO products (name, category, petType, price, countInStock, lowStockThreshold, image, description, barcode, variants, expirationDate, rating, numReviews, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name, data.category || null, data.petType || '', Number(data.price) || 0,
      Number(data.countInStock) || 0, Number(data.lowStockThreshold) || 10,
      data.image || '', data.description || '', data.barcode || '',
      JSON.stringify(data.variants || []), data.expirationDate || '',
      0, 0, now, now
    );
    return Product.findById(info.lastInsertRowid);
  },

  update(id, data) {
    const fields = []; const params = [];
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.price !== undefined) { fields.push('price = ?'); params.push(Number(data.price)); }
    if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category); }
    if (data.countInStock !== undefined) { fields.push('countInStock = ?'); params.push(Number(data.countInStock)); }
    if (data.lowStockThreshold !== undefined) { fields.push('lowStockThreshold = ?'); params.push(Number(data.lowStockThreshold)); }
    if (data.petType !== undefined) { fields.push('petType = ?'); params.push(data.petType); }
    if (data.barcode !== undefined) { fields.push('barcode = ?'); params.push(data.barcode); }
    if (data.expirationDate !== undefined) { fields.push('expirationDate = ?'); params.push(data.expirationDate); }
    if (data.variants !== undefined) { fields.push('variants = ?'); params.push(JSON.stringify(data.variants)); }
    if (data.image !== undefined) { fields.push('image = ?'); params.push(data.image); }
    if (data.rating !== undefined) { fields.push('rating = ?'); params.push(data.rating); }
    if (data.numReviews !== undefined) { fields.push('numReviews = ?'); params.push(data.numReviews); }
    if (!fields.length) return Product.findById(id);
    fields.push('updatedAt = ?'); params.push(nowISO()); params.push(id);
    db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return Product.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
  },

  countDocuments(filter = {}) {
    let sql = 'SELECT COUNT(*) as count FROM products';
    const conditions = []; const params = [];
    if (filter.countInStock !== undefined) {
      if (typeof filter.countInStock === 'object') {
        if (filter.countInStock.$lte !== undefined) { conditions.push('countInStock <= ?'); params.push(filter.countInStock.$lte); }
        if (filter.countInStock.$gt !== undefined) { conditions.push('countInStock > ?'); params.push(filter.countInStock.$gt); }
      } else {
        conditions.push('countInStock = ?'); params.push(filter.countInStock);
      }
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    return db.prepare(sql).get(...params).count;
  },

  // ─── Reviews ─────────────────────────────────────────
  getReviews(productId) {
    return db.prepare(`
      SELECT r.*, u.name as userName, u.email as userEmail, u.image as userImage
      FROM reviews r LEFT JOIN users u ON r.userId = u.id
      WHERE r.productId = ? ORDER BY r.createdAt DESC
    `).all(productId).map(r => ({
      _id: String(r.id),
      id: r.id,
      user: r.userId ? { _id: String(r.userId), name: r.userName, email: r.userEmail, image: r.userImage } : null,
      name: r.name,
      rating: r.rating,
      text: r.text,
      status: r.status,
      date: r.createdAt ? r.createdAt.split('T')[0] : '',
      createdAt: r.createdAt,
    }));
  },

  addReview(productId, data) {
    const now = nowISO();
    db.prepare(`
      INSERT INTO reviews (productId, userId, name, rating, text, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(productId, data.userId || null, data.name || '', data.rating, data.text || '', data.status || 'approved', now, now);
    Product._recalcRating(productId);
  },

  findReview(reviewId) {
    const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
    return row ? { ...row, _id: String(row.id) } : null;
  },

  updateReview(reviewId, data, productId) {
    const fields = []; const params = [];
    if (data.rating !== undefined) { fields.push('rating = ?'); params.push(Number(data.rating)); }
    if (data.text !== undefined) { fields.push('text = ?'); params.push(data.text); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (!fields.length) return Product.findReview(reviewId);
    fields.push('updatedAt = ?'); params.push(nowISO()); params.push(reviewId);
    db.prepare(`UPDATE reviews SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    const review = Product.findReview(reviewId);
    if (review && productId) Product._recalcRating(productId);
    else if (review) Product._recalcRating(review.productId);
    return review;
  },

  deleteReview(reviewId, productId) {
    const review = Product.findReview(reviewId);
    if (!review) return false;
    db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);
    Product._recalcRating(productId || review.productId);
    return true;
  },

  _recalcRating(productId) {
    const stats = db.prepare('SELECT COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg FROM reviews WHERE productId = ?').get(productId);
    db.prepare('UPDATE products SET numReviews = ?, rating = ?, updatedAt = ? WHERE id = ?')
      .run(stats.cnt, stats.avg, nowISO(), productId);
  },

  // Get all reviews across all products (for admin)
  getAllReviews() {
    return db.prepare(`
      SELECT r.*, p.name as productName, p.image as productImage, p.id as pId,
             u.name as userName, u.email as userEmail, u.image as userImage
      FROM reviews r
      JOIN products p ON r.productId = p.id
      LEFT JOIN users u ON r.userId = u.id
      ORDER BY r.createdAt DESC
    `).all().map(r => ({
      _id: String(r.id),
      productId: String(r.pId),
      productName: r.productName,
      productImage: r.productImage,
      user: r.userId ? { _id: String(r.userId), name: r.userName, email: r.userEmail, image: r.userImage } : null,
      name: r.name,
      rating: r.rating,
      text: r.text,
      status: r.status || 'pending',
      date: r.createdAt ? r.createdAt.split('T')[0] : '',
    }));
  },

  _parseRow(row) {
    if (!row) return null;
    const category = row.category ? {
      _id: String(row.category),
      id: row.category,
      name: row.categoryName || '',
      color: row.categoryColor || '',
      icon: row.categoryIcon || '',
    } : null;
    return {
      ...row,
      _id: String(row.id),
      category,
      variants: typeof row.variants === 'string' ? JSON.parse(row.variants || '[]') : (row.variants || []),
      isOutOfStock: row.countInStock === 0,
      isLowStock: row.countInStock > 0 && row.countInStock <= row.lowStockThreshold,
      // Remove joined category columns
      categoryName: undefined, categoryColor: undefined, categoryIcon: undefined,
    };
  },
};

module.exports = Product;
