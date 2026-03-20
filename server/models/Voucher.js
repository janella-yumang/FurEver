const { db, addId, nowISO } = require('../database');

const Voucher = {
  find(filter = {}) {
    let sql = 'SELECT * FROM vouchers';
    const conditions = [];
    const params = [];

    if (filter.isActive !== undefined) {
      conditions.push('isActive = ?');
      params.push(filter.isActive ? 1 : 0);
    }

    if (filter.userId) {
      sql = `
        SELECT v.*, vc.id as claimId, vc.claimedAt, vc.usedAt, vc.orderId
        FROM vouchers v
        JOIN voucher_claims vc ON vc.voucherId = v.id
      `;
      conditions.push('vc.userId = ?');
      params.push(filter.userId);

      if (filter.onlyUnused) {
        conditions.push('vc.usedAt IS NULL');
      }
    }

    if (filter.notExpired) {
      const expiryColumn = filter.userId ? 'v.expiresAt' : 'expiresAt';
      conditions.push(`(${expiryColumn} IS NULL OR ${expiryColumn} > ?)`);
      params.push(nowISO());
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const createdAtColumn = filter.userId ? 'v.createdAt' : 'createdAt';
    sql += ` ORDER BY ${createdAtColumn} DESC`;

    return db.prepare(sql).all(...params).map((row) => Voucher._parseRow(addId(row)));
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(id);
    return row ? Voucher._parseRow(addId(row)) : null;
  },

  findByCode(code) {
    if (!code) return null;
    const row = db.prepare('SELECT * FROM vouchers WHERE promoCode = ? COLLATE NOCASE').get(String(code).trim());
    return row ? Voucher._parseRow(addId(row)) : null;
  },

  create(data) {
    const now = nowISO();
    const info = db.prepare(`
      INSERT INTO vouchers
      (title, message, imageUrl, promoCode, discountType, discountValue, maxDiscount, minOrderAmount, startsAt, expiresAt, isActive, maxClaims, claimedCount, createdByUserId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.title,
      data.message || '',
      data.imageUrl || '',
      String(data.promoCode || '').trim().toUpperCase(),
      data.discountType || 'percent',
      parseFloat(data.discountValue) || 0,
      parseFloat(data.maxDiscount) || 0,
      parseFloat(data.minOrderAmount) || 0,
      data.startsAt || now,
      data.expiresAt || null,
      data.isActive === false ? 0 : 1,
      parseInt(data.maxClaims, 10) || 0,
      0,
      data.createdByUserId || null,
      now,
      now
    );

    return Voucher.findById(info.lastInsertRowid);
  },

  update(id, data) {
    const fields = [];
    const params = [];

    if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
    if (data.message !== undefined) { fields.push('message = ?'); params.push(data.message); }
    if (data.imageUrl !== undefined) { fields.push('imageUrl = ?'); params.push(data.imageUrl); }
    if (data.promoCode !== undefined) { fields.push('promoCode = ?'); params.push(String(data.promoCode).trim().toUpperCase()); }
    if (data.discountType !== undefined) { fields.push('discountType = ?'); params.push(data.discountType); }
    if (data.discountValue !== undefined) { fields.push('discountValue = ?'); params.push(parseFloat(data.discountValue) || 0); }
    if (data.maxDiscount !== undefined) { fields.push('maxDiscount = ?'); params.push(parseFloat(data.maxDiscount) || 0); }
    if (data.minOrderAmount !== undefined) { fields.push('minOrderAmount = ?'); params.push(parseFloat(data.minOrderAmount) || 0); }
    if (data.startsAt !== undefined) { fields.push('startsAt = ?'); params.push(data.startsAt || null); }
    if (data.expiresAt !== undefined) { fields.push('expiresAt = ?'); params.push(data.expiresAt || null); }
    if (data.maxClaims !== undefined) { fields.push('maxClaims = ?'); params.push(parseInt(data.maxClaims, 10) || 0); }
    if (data.isActive !== undefined) { fields.push('isActive = ?'); params.push(data.isActive ? 1 : 0); }
    if (data.claimedCount !== undefined) { fields.push('claimedCount = ?'); params.push(parseInt(data.claimedCount, 10) || 0); }

    if (!fields.length) return Voucher.findById(id);

    fields.push('updatedAt = ?');
    params.push(nowISO());
    params.push(id);

    db.prepare(`UPDATE vouchers SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return Voucher.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM vouchers WHERE id = ?').run(id).changes > 0;
  },

  claim(voucherId, userId) {
    const now = nowISO();
    const exists = db.prepare('SELECT id FROM voucher_claims WHERE voucherId = ? AND userId = ?').get(voucherId, userId);
    if (exists) return { alreadyClaimed: true };

    const info = db.prepare('INSERT INTO voucher_claims (voucherId, userId, claimedAt) VALUES (?, ?, ?)').run(voucherId, userId, now);
    db.prepare('UPDATE vouchers SET claimedCount = claimedCount + 1, updatedAt = ? WHERE id = ?').run(now, voucherId);

    return { claimId: info.lastInsertRowid, alreadyClaimed: false };
  },

  markClaimUsed(voucherId, userId, orderId) {
    const now = nowISO();
    const result = db.prepare(
      'UPDATE voucher_claims SET usedAt = ?, orderId = ? WHERE voucherId = ? AND userId = ? AND usedAt IS NULL'
    ).run(now, orderId, voucherId, userId);

    return result.changes > 0;
  },

  hasUnusedClaim(voucherId, userId) {
    const row = db.prepare(
      'SELECT id FROM voucher_claims WHERE voucherId = ? AND userId = ? AND usedAt IS NULL'
    ).get(voucherId, userId);
    return !!row;
  },

  getUserAvailableVouchers(userId) {
    const rows = db.prepare(`
      SELECT v.*, vc.claimedAt, vc.usedAt
      FROM voucher_claims vc
      JOIN vouchers v ON v.id = vc.voucherId
      WHERE vc.userId = ?
        AND vc.usedAt IS NULL
        AND v.isActive = 1
        AND (v.startsAt IS NULL OR v.startsAt <= ?)
        AND (v.expiresAt IS NULL OR v.expiresAt > ?)
      ORDER BY v.expiresAt ASC, v.createdAt DESC
    `).all(userId, nowISO(), nowISO());

    return rows.map((row) => Voucher._parseRow(addId(row)));
  },

  _parseRow(row) {
    if (!row) return null;

    return {
      ...row,
      isActive: !!row.isActive,
      discountValue: parseFloat(row.discountValue) || 0,
      maxDiscount: parseFloat(row.maxDiscount) || 0,
      minOrderAmount: parseFloat(row.minOrderAmount) || 0,
      maxClaims: parseInt(row.maxClaims, 10) || 0,
      claimedCount: parseInt(row.claimedCount, 10) || 0,
      isExpired: !!(row.expiresAt && new Date(row.expiresAt) <= new Date()),
    };
  },
};

module.exports = Voucher;
