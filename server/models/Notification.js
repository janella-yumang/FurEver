/**
 * Notification Model - MongoDB/Mongoose Implementation
 * Handles user notifications for orders, products, promotions
 */

const { Notification: NotificationModel } = require('../database');
const { addId, addIds } = require('../database');

const Notification = {
  
  /**
   * Find notifications with filtering
   */
  async find(filter = {}) {
    try {
      let query = {};
      
      if (filter.user || filter.userId) {
        query.userId = filter.user || filter.userId;
      }
      
      if (filter.read !== undefined) {
        query.read = filter.read;
      }
      
      if (filter.type) {
        query.type = filter.type;
      }
      
      if (filter.productId) {
        query.productId = filter.productId;
      }
      
      if (filter.createdAt?.$gte) {
        const date = filter.createdAt.$gte instanceof Date 
          ? filter.createdAt.$gte 
          : new Date(filter.createdAt.$gte);
        query.createdAt = { $gte: date };
      }
      
      let query_obj = NotificationModel.find(query)
        .sort({ createdAt: -1 });
      
      if (filter._limit) {
        query_obj = query_obj.limit(filter._limit);
      }
      
      const docs = await query_obj.exec();
      return addIds(docs);
    } catch (error) {
      console.error('Notification.find error:', error);
      return [];
    }
  },
  
  /**
   * Find notification by ID
   */
  async findById(id) {
    try {
      const doc = await NotificationModel.findById(id);
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Notification.findById error:', error);
      return null;
    }
  },
  
  /**
   * Create notification
   */
  async create(data) {
    try {
      const now = new Date();
      const notificationData = {
        userId: data.user || data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        orderId: data.order || data.orderId || null,
        productId: data.product || data.productId || null,
        imageUrl: data.imageUrl || '',
        voucherId: data.voucherId || null,
        expiresAt: data.expiresAt || null,
        read: false,
        createdAt: now,
        updatedAt: now,
      };
      
      const notification = new NotificationModel(notificationData);
      const saved = await notification.save();
      return addId(saved);
    } catch (error) {
      console.error('Notification.create error:', error);
      throw error;
    }
  },
  
  /**
   * Update notification (typically to mark as read)
   */
  async update(id, data) {
    try {
      const updateData = { 
        ...data,
        updatedAt: new Date(),
      };
      
      const doc = await NotificationModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      );
      
      return doc ? addId(doc) : null;
    } catch (error) {
      console.error('Notification.update error:', error);
      return null;
    }
  },
  
  /**
   * Delete notification
   */
  async delete(id) {
    try {
      const result = await NotificationModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Notification.delete error:', error);
      return false;
    }
  },
  
  /**
   * Mark all notifications as read for user
   */
  async markAllRead(userId) {
    try {
      const now = new Date();
      await NotificationModel.updateMany(
        { userId, read: false },
        { 
          $set: { 
            read: true,
            updatedAt: now,
          } 
        }
      );
    } catch (error) {
      console.error('Notification.markAllRead error:', error);
    }
  },
  
  /**
   * Count unread notifications for user
   */
  async countUnread(userId) {
    try {
      const count = await NotificationModel.countDocuments({
        userId,
        read: false,
      });
      return count;
    } catch (error) {
      console.error('Notification.countUnread error:', error);
      return 0;
    }
  },
  
  /**
   * Get statistics for user notifications
   */
  async getStats(userId) {
    try {
      const total = await NotificationModel.countDocuments({ userId });
      const unread = await NotificationModel.countDocuments({ userId, read: false });
      
      return { total, unread };
    } catch (error) {
      console.error('Notification.getStats error:', error);
      return { total: 0, unread: 0 };
    }
  },
};

module.exports = Notification;
