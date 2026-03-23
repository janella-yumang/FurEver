const { Category: CategoryModel, addId, addIds } = require('../database');

const Category = {
  async find() {
    try {
      const docs = await CategoryModel.find().sort({ createdAt: -1 });
      return addIds(docs);
    } catch (error) {
      console.error('Category.find error:', error);
      return [];
    }
  },

  async findById(id) {
    try {
      const doc = await CategoryModel.findById(id);
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Category.findById error:', error);
      return null;
    }
  },

  async create(data) {
    try {
      const category = new CategoryModel({
        name: data.name,
        color: data.color || '',
        icon: data.icon || '',
      });
      const saved = await category.save();
      return addId(saved);
    } catch (error) {
      console.error('Category.create error:', error);
      throw error;
    }
  },

  async update(id, data) {
    try {
      const updates = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.color !== undefined) updates.color = data.color;
      if (data.icon !== undefined) updates.icon = data.icon;
      updates.updatedAt = new Date();
      const doc = await CategoryModel.findByIdAndUpdate(id, updates, { new: true });
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Category.update error:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const result = await CategoryModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Category.delete error:', error);
      return false;
    }
  },
};

module.exports = Category;
