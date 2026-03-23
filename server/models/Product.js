const { Product: ProductModel, Review: ReviewModel, addId, addIds } = require('../database');

const Product = {
  async find(filter = {}) {
    try {
      let query = {};
      if (filter.categoryIds && filter.categoryIds.length) {
        query.category = { $in: filter.categoryIds };
      }
      if (filter.countInStock !== undefined) {
        if (typeof filter.countInStock === 'object') {
          if (filter.countInStock.$lte !== undefined) query.countInStock = { $lte: filter.countInStock.$lte };
          if (filter.countInStock.$gt !== undefined) query.countInStock = { ...query.countInStock, $gt: filter.countInStock.$gt };
        } else {
          query.countInStock = filter.countInStock;
        }
      }
      if (filter.barcode) query.barcode = filter.barcode;
      const docs = await ProductModel.find(query)
        .populate('category')
        .sort({ createdAt: -1 });
      return addIds(docs);
    } catch (error) {
      console.error('Product.find error:', error);
      return [];
    }
  },

  async findById(id) {
    try {
      const doc = await ProductModel.findById(id).populate('category');
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Product.findById error:', error);
      return null;
    }
  },

  async findByBarcode(code) {
    try {
      const doc = await ProductModel.findOne({ barcode: code }).populate('category');
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Product.findByBarcode error:', error);
      return null;
    }
  },

  async create(data) {
    try {
      const product = new ProductModel({
        name: data.name,
        category: data.category || null,
        petType: data.petType || '',
        price: parseFloat(data.price) || 0,
        countInStock: parseInt(data.countInStock) || 0,
        lowStockThreshold: parseInt(data.lowStockThreshold) || 10,
        image: data.image || '',
        description: data.description || '',
        barcode: data.barcode || '',
        variants: Array.isArray(data.variants) ? data.variants : [],
        expirationDate: data.expirationDate || '',
        rating: parseFloat(data.rating) || 0,
        numReviews: parseInt(data.numReviews) || 0,
      });
      const saved = await product.save();
      return addId(saved);
    } catch (error) {
      console.error('Product.create error:', error);
      throw error;
    }
  },

  async update(id, data) {
    try {
      const updates = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.price !== undefined) updates.price = parseFloat(data.price) || 0;
      if (data.category !== undefined) updates.category = data.category;
      if (data.countInStock !== undefined) updates.countInStock = parseInt(data.countInStock) || 0;
      if (data.lowStockThreshold !== undefined) updates.lowStockThreshold = parseInt(data.lowStockThreshold) || 10;
      if (data.petType !== undefined) updates.petType = data.petType;
      if (data.barcode !== undefined) updates.barcode = data.barcode;
      if (data.expirationDate !== undefined) updates.expirationDate = data.expirationDate;
      if (data.variants !== undefined) updates.variants = Array.isArray(data.variants) ? data.variants : [];
      if (data.image !== undefined) updates.image = data.image;
      if (data.rating !== undefined) updates.rating = parseFloat(data.rating) || 0;
      if (data.numReviews !== undefined) updates.numReviews = parseInt(data.numReviews) || 0;
      updates.updatedAt = new Date();
      const doc = await ProductModel.findByIdAndUpdate(id, updates, { new: true }).populate('category');
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Product.update error:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const result = await ProductModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Product.delete error:', error);
      return false;
    }
  },

  async countDocuments(filter = {}) {
    try {
      let query = {};
      if (filter.countInStock !== undefined) {
        if (typeof filter.countInStock === 'object') {
          if (filter.countInStock.$lte !== undefined) query.countInStock = { $lte: filter.countInStock.$lte };
          if (filter.countInStock.$gt !== undefined) query.countInStock = { ...query.countInStock, $gt: filter.countInStock.$gt };
        } else {
          query.countInStock = filter.countInStock;
        }
      }
      return await ProductModel.countDocuments(query);
    } catch (error) {
      console.error('Product.countDocuments error:', error);
      return 0;
    }
  },

  // ─── Reviews ─────────────────────────────────────────
  async getReviews(productId) {
    try {
      const reviews = await ReviewModel.find({ productId }).populate('userId', 'name email image').sort({ createdAt: -1 });
      return reviews.map(r => ({
        _id: r._id.toString(),
        id: r._id,
        user: r.userId ? {
          _id: r.userId._id.toString(),
          name: r.userId.name,
          email: r.userId.email,
          image: r.userId.image,
        } : null,
        name: r.name,
        rating: r.rating,
        text: r.text,
        image: r.image || '',
        status: r.status,
        date: r.createdAt ? r.createdAt.toISOString().split('T')[0] : '',
        createdAt: r.createdAt,
      }));
    } catch (error) {
      console.error('Product.getReviews error:', error);
      return [];
    }
  },

  async addReview(productId, data) {
    try {
      const review = new ReviewModel({
        productId,
        userId: data.userId || null,
        name: data.name || '',
        rating: data.rating,
        text: data.text || '',
        image: data.image || '',
        status: data.status || 'approved',
      });
      await review.save();
      await Product._recalcRating(productId);
      return addId(review);
    } catch (error) {
      console.error('Product.addReview error:', error);
      throw error;
    }
  },

  async findReview(reviewId) {
    try {
      const doc = await ReviewModel.findById(reviewId);
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Product.findReview error:', error);
      return null;
    }
  },

  async updateReview(reviewId, data, productId) {
    try {
      const updates = {};
      if (data.rating !== undefined) updates.rating = parseInt(data.rating);
      if (data.text !== undefined) updates.text = data.text;
      if (data.image !== undefined) updates.image = data.image;
      if (data.status !== undefined) updates.status = data.status;
      updates.updatedAt = new Date();
      const doc = await ReviewModel.findByIdAndUpdate(reviewId, updates, { new: true });
      if (doc) {
        const pid = productId || doc.productId;
        await Product._recalcRating(pid);
      }
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Product.updateReview error:', error);
      throw error;
    }
  },

  async deleteReview(reviewId, productId) {
    try {
      const review = await ReviewModel.findByIdAndDelete(reviewId);
      if (review) {
        await Product._recalcRating(productId || review.productId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Product.deleteReview error:', error);
      return false;
    }
  },

  async _recalcRating(productId) {
    try {
      const reviews = await ReviewModel.find({ productId });
      const count = reviews.length;
      const avg = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
      await ProductModel.findByIdAndUpdate(productId, {
        numReviews: count,
        rating: avg,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Product._recalcRating error:', error);
    }
  },

  async getAllReviews() {
    try {
      const reviews = await ReviewModel.find()
        .populate('productId', 'name image')
        .populate('userId', 'name email image')
        .sort({ createdAt: -1 });
      return reviews.map(r => ({
        _id: r._id.toString(),
        productId: r.productId._id.toString(),
        productName: r.productId.name,
        productImage: r.productId.image,
        user: r.userId ? {
          _id: r.userId._id.toString(),
          name: r.userId.name,
          email: r.userId.email,
          image: r.userId.image,
        } : null,
        name: r.name,
        rating: r.rating,
        text: r.text,
        image: r.image || '',
        status: r.status || 'pending',
        date: r.createdAt ? r.createdAt.toISOString().split('T')[0] : '',
      }));
    } catch (error) {
      console.error('Product.getAllReviews error:', error);
      return [];
    }
  },
};

module.exports = Product;
