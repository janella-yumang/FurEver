/**
 * Voucher Model - MongoDB/Mongoose Implementation
 * Handles promotional codes, discounts, and voucher tracking
 */

const { Voucher: VoucherModel, VoucherClaim } = require('../database');
const { addId, addIds } = require('../database');

const Voucher = {
  
  /**
   * Find all vouchers with optional filtering
   */
  async find(filter = {}) {
    try {
      let query = {};
      
      if (filter.isActive !== undefined) {
        query.isActive = filter.isActive;
      }
      
      if (filter.userId) {
        // Find vouchers claimed by user
        const claims = await VoucherClaim.find({ userId: filter.userId })
          .populate('voucherId');
        
        if (filter.onlyUnused) {
          return claims
            .filter(c => !c.usedAt)
            .map(c => addId(c.voucherId));
        }
        
        return claims.map(c => addId(c.voucherId));
      }
      
      if (filter.notExpired) {
        query.expiresAt = { $gt: new Date() };
      }
      
      const docs = await VoucherModel.find(query)
        .sort({ createdAt: -1 });
      
      return addIds(docs);
    } catch (error) {
      console.error('Voucher.find error:', error);
      return [];
    }
  },
  
  /**
   * Find single voucher by ID
   */
  async findById(id) {
    try {
      const doc = await VoucherModel.findById(id);
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Voucher.findById error:', error);
      return null;
    }
  },
  
  /**
   * Find voucher by promo code
   */
  async findByCode(code) {
    try {
      if (!code) return null;
      
      const doc = await VoucherModel.findOne({ 
        promoCode: code.trim().toUpperCase() 
      });
      
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Voucher.findByCode error:', error);
      return null;
    }
  },
  
  /**
   * Create new voucher
   */
  async create(data) {
    try {
      const now = new Date();
      const voucherData = {
        title: data.title,
        message: data.message || '',
        imageUrl: data.imageUrl || '',
        promoCode: (data.promoCode || '').trim().toUpperCase(),
        discountType: data.discountType || 'percent',
        discountValue: parseFloat(data.discountValue) || 0,
        maxDiscount: parseFloat(data.maxDiscount) || 0,
        minOrderAmount: parseFloat(data.minOrderAmount) || 0,
        startsAt: data.startsAt || now,
        expiresAt: data.expiresAt || null,
        isActive: data.isActive !== false,
        maxClaims: parseInt(data.maxClaims, 10) || 0,
        claimedCount: 0,
        createdByUserId: data.createdByUserId || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const voucher = new VoucherModel(voucherData);
      const saved = await voucher.save();
      return addId(saved);
    } catch (error) {
      console.error('Voucher.create error:', error);
      throw error;
    }
  },
  
  /**
   * Update voucher
   */
  async update(id, data) {
    try {
      const updateData = { ...data };
      
      if (data.promoCode) {
        updateData.promoCode = data.promoCode.trim().toUpperCase();
      }
      
      updateData.updatedAt = new Date();
      
      const doc = await VoucherModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      );
      
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Voucher.update error:', error);
      return null;
    }
  },
  
  /**
   * Delete voucher
   */
  async delete(id) {
    try {
      const result = await VoucherModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Voucher.delete error:', error);
      return false;
    }
  },
  
  /**
   * Claim voucher for user
   */
  async claim(voucherId, userId) {
    try {
      const now = new Date();
      
      // Check if already claimed
      const exists = await VoucherClaim.findOne({
        voucherId,
        userId,
      });
      
      if (exists) {
        return { alreadyClaimed: true };
      }
      
      // Create claim
      const claim = new VoucherClaim({
        voucherId,
        userId,
        claimedAt: now,
      });
      
      await claim.save();
      
      // Increment claimed count
      await VoucherModel.findByIdAndUpdate(
        voucherId,
        { 
          $inc: { claimedCount: 1 },
          updatedAt: now,
        }
      );
      
      return { 
        alreadyClaimed: false,
        claimId: claim._id,
      };
    } catch (error) {
      console.error('Voucher.claim error:', error);
      throw error;
    }
  },
  
  /**
   * Mark voucher claim as used in order
   */
  async markClaimUsed(voucherId, userId, orderId) {
    try {
      const result = await VoucherClaim.findOneAndUpdate(
        {
          voucherId,
          userId,
          usedAt: null,
        },
        {
          usedAt: new Date(),
          orderId,
        }
      );
      
      return !!result;
    } catch (error) {
      console.error('Voucher.markClaimUsed error:', error);
      return false;
    }
  },
  
  /**
   * Check if user has unused claim for voucher
   */
  async hasUnusedClaim(voucherId, userId) {
    try {
      const claim = await VoucherClaim.findOne({
        voucherId,
        userId,
        usedAt: null,
      });
      
      return !!claim;
    } catch (error) {
      console.error('Voucher.hasUnusedClaim error:', error);
      return false;
    }
  },
  
  /**
   * Get available vouchers for user
   */
  async getUserAvailableVouchers(userId) {
    try {
      const now = new Date();
      
      const claims = await VoucherClaim.find({
        userId,
        usedAt: null,
      })
        .populate({
          path: 'voucherId',
          match: {
            isActive: true,
            $or: [
              { startsAt: null },
              { startsAt: { $lte: now } },
            ],
            $or: [
              { expiresAt: null },
              { expiresAt: { $gt: now } },
            ],
          },
        });
      
      // Filter out null vouchers (didn't match the query)
      const vouchers = claims
        .filter(c => c.voucherId)
        .map(c => addId(c.voucherId))
        .sort((a, b) => {
          if (!a.expiresAt) return 1;
          if (!b.expiresAt) return -1;
          return new Date(a.expiresAt) - new Date(b.expiresAt);
        });
      
      return vouchers;
    } catch (error) {
      console.error('Voucher.getUserAvailableVouchers error:', error);
      return [];
    }
  },
};

module.exports = Voucher;
