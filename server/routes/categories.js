const express = require('express');
const Category = require('../models/Category');
const router = express.Router();

// GET all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    return res.status(200).json(categories);
  } catch (err) {
    console.error('Get categories error:', err);
    return res.status(500).json({ message: 'Failed to fetch categories.' });
  }
});

// GET single category
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    return res.status(200).json(category);
  } catch (err) {
    console.error('Get category error:', err);
    return res.status(500).json({ message: 'Failed to fetch category.' });
  }
});

// POST create category
router.post('/', async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required.' });
    const category = await Category.create({ name, color: color || '', icon: icon || '' });
    return res.status(201).json(category);
  } catch (err) {
    console.error('Create category error:', err);
    return res.status(500).json({ message: 'Failed to create category.' });
  }
});

// PUT update category
router.put('/:id', async (req, res) => {
  try {
    const category = await Category.update(req.params.id, {
      name: req.body.name, color: req.body.color, icon: req.body.icon,
    });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    return res.status(200).json(category);
  } catch (err) {
    console.error('Update category error:', err);
    return res.status(500).json({ message: 'Failed to update category.' });
  }
});

// DELETE category
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Category.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Category not found.' });
    return res.status(200).json({ message: 'Category deleted.' });
  } catch (err) {
    console.error('Delete category error:', err);
    return res.status(500).json({ message: 'Failed to delete category.' });
  }
});

module.exports = router;
