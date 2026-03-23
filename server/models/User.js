const { User: UserModel, addId, addIds } = require('../database');

const User = {
  async find(filter = {}) {
    try {
      let query = {};
      if (filter.isAdmin !== undefined) query.isAdmin = filter.isAdmin;
      if (filter.isActive !== undefined) query.isActive = filter.isActive;
      const docs = await UserModel.find(query).sort({ createdAt: -1 });
      return addIds(docs);
    } catch (error) {
      console.error('User.find error:', error);
      return [];
    }
  },

  async findOne(filter) {
    try {
      if (filter.email) {
        const doc = await UserModel.findOne({ email: filter.email.toLowerCase() });
        return doc ? addId(doc) : null;
      }
      if (filter.id || filter._id) {
        return await User.findById(filter.id || filter._id);
      }
      return null;
    } catch (error) {
      console.error('User.findOne error:', error);
      return null;
    }
  },

  async findById(id) {
    try {
      const doc = await UserModel.findById(id);
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('User.findById error:', error);
      return null;
    }
  },

  async create(data) {
    try {
      const user = new UserModel({
        name: data.name,
        email: (data.email || '').toLowerCase(),
        password: data.password,
        phone: data.phone || '',
        isAdmin: data.isAdmin ? true : false,
        role: data.role || 'customer',
        shippingAddress: data.shippingAddress || '',
        preferredPets: Array.isArray(data.preferredPets) ? data.preferredPets : (data.preferredPets || []),
        image: data.image || '',
        isActive: data.isActive !== undefined ? !!data.isActive : true,
        emailVerified: !!data.emailVerified,
        verificationCode: data.verificationCode || null,
        verificationExpires: data.verificationExpires || null,
        googleId: data.googleId || null,
        pushToken: data.pushToken || null,
        loyaltyPoints: parseInt(data.loyaltyPoints) || 0,
      });
      const saved = await user.save();
      return addId(saved);
    } catch (error) {
      console.error('User.create error:', error);
      throw error;
    }
  },

  async update(id, data) {
    try {
      const updates = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.email !== undefined) updates.email = data.email.toLowerCase();
      if (data.phone !== undefined) updates.phone = data.phone;
      if (data.shippingAddress !== undefined) updates.shippingAddress = data.shippingAddress;
      if (data.preferredPets !== undefined) updates.preferredPets = Array.isArray(data.preferredPets) ? data.preferredPets : [];
      if (data.image !== undefined) updates.image = data.image;
      if (data.isAdmin !== undefined) updates.isAdmin = !!data.isAdmin;
      if (data.role !== undefined) updates.role = data.role;
      if (data.isActive !== undefined) updates.isActive = !!data.isActive;
      if (data.emailVerified !== undefined) updates.emailVerified = !!data.emailVerified;
      if (data.verificationCode !== undefined) updates.verificationCode = data.verificationCode;
      if (data.verificationExpires !== undefined) updates.verificationExpires = data.verificationExpires;
      if (data.googleId !== undefined) updates.googleId = data.googleId;
      if (data.pushToken !== undefined) updates.pushToken = data.pushToken;
      if (data.password !== undefined) updates.password = data.password;
      if (data.loyaltyPoints !== undefined) updates.loyaltyPoints = parseInt(data.loyaltyPoints) || 0;
      
      updates.updatedAt = new Date();
      const doc = await UserModel.findByIdAndUpdate(id, updates, { new: true });
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('User.update error:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const result = await UserModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('User.delete error:', error);
      return false;
    }
  },

  toJSON(user) {
    if (!user) return null;
    const obj = user.toObject ? user.toObject() : user;
    const { password, verificationCode, ...safe } = obj;
    return safe;
  },
};

module.exports = User;

