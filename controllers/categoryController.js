const fs = require('fs');
const Category = require('../models/Category');
const cloudinary = require('cloudinary').v2;

// Public: list categories (optionally filter by type and active)
exports.listPublic = async (req, res) => {
  try {
    const { type } = req.query; // 'vendor' | 'agent'
    const filter = { isActive: true };
    if (type === 'vendor') {
      filter.$or = [{ type: 'vendor' }, { type: 'both' }];
    } else if (type === 'agent') {
      filter.$or = [{ type: 'agent' }, { type: 'both' }];
    }
    const categories = await Category.find(filter).sort({ displayOrder: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ success: false, message: 'Error fetching categories' });
  }
};

// Admin: create
exports.create = async (req, res) => {
  try {
    const { name, groupName = 'Uncategorized', type = 'both', isActive = 'true', displayOrder = 0 } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    let imageUrl = '';
    if (req.file) {
      const upload = await cloudinary.uploader.upload(req.file.path, {
        folder: 'vendplug/categories',
      });
      imageUrl = upload.secure_url;
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }

    const created = await Category.create({
      name: name.trim(),
      imageUrl,
      groupName: groupName.trim(),
      type,
      isActive: String(isActive) === 'true',
      displayOrder: Number(displayOrder) || 0,
    });
    res.status(201).json({ success: true, category: created });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ success: false, message: 'Error creating category' });
  }
};

// Admin: update
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const { name, groupName, type, isActive, displayOrder } = req.body;
    if (typeof name !== 'undefined') category.name = name.trim();
    if (typeof groupName !== 'undefined') category.groupName = groupName.trim();
    if (typeof type !== 'undefined') category.type = type;
    if (typeof isActive !== 'undefined') category.isActive = String(isActive) === 'true';
    if (typeof displayOrder !== 'undefined') category.displayOrder = Number(displayOrder) || 0;

    if (req.file) {
      const upload = await cloudinary.uploader.upload(req.file.path, {
        folder: 'vendplug/categories',
      });
      category.imageUrl = upload.secure_url;
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }

    await category.save();
    res.json({ success: true, category });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ success: false, message: 'Error updating category' });
  }
};

// Admin: delete
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ success: false, message: 'Error deleting category' });
  }
};


