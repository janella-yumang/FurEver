const express = require('express');
const Notification = require('../models/Notification');

const router = express.Router();

// GET notifications for a user
router.get('/user/:userId', (req, res) => {
  try {
    const notifications = Notification.find({ user: parseInt(req.params.userId) });
    return res.status(200).json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

// GET unread count
router.get('/user/:userId/unread-count', (req, res) => {
  try {
    const count = Notification.countUnread(parseInt(req.params.userId));
    return res.status(200).json({ count });
  } catch (err) {
    console.error('Unread count error:', err);
    return res.status(500).json({ message: 'Failed to get unread count.' });
  }
});

// PUT mark single notification as read
router.put('/:id/read', (req, res) => {
  try {
    const notification = Notification.update(req.params.id, { read: true });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    return res.status(200).json(notification);
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ message: 'Failed to mark as read.' });
  }
});

// PUT mark all as read
router.put('/user/:userId/mark-all-read', (req, res) => {
  try {
    const count = Notification.markAllRead(parseInt(req.params.userId));
    return res.status(200).json({ message: `${count} notifications marked as read.` });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ message: 'Failed to mark all as read.' });
  }
});

// DELETE notification
router.delete('/:id', (req, res) => {
  try {
    const deleted = Notification.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Notification not found.' });
    return res.status(200).json({ message: 'Notification deleted.' });
  } catch (err) {
    console.error('Delete notification error:', err);
    return res.status(500).json({ message: 'Failed to delete notification.' });
  }
});

module.exports = router;
