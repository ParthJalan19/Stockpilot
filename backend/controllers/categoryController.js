const Category = require('../models/Category');
const Product = require('../models/Product');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all categories with product counts
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res) => {
  const orgId = req.orgId;
  try {
    const categories = await Category.find({ organizationId: orgId });
    const results = [];

    for (const cat of categories) {
      const productCount = await Product.countDocuments({
        organizationId: orgId,
        category: cat._id,
        status: { $ne: 'Archived' }
      });
      results.push({
        ...cat.toObject(),
        productCount
      });
    }

    return res.status(200).json({ success: true, categories: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private
const createCategory = async (req, res) => {
  const orgId = req.orgId;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  try {
    const exists = await Category.findOne({ organizationId: orgId, name });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const category = await Category.create({
      organizationId: orgId,
      name,
      description
    });

    await logAudit(req, {
      action: 'CATEGORY_CREATE',
      targetCollection: 'categories',
      targetId: category._id,
      after: category.toObject()
    });

    return res.status(201).json({ success: true, category });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
const updateCategory = async (req, res) => {
  const orgId = req.orgId;
  const catId = req.params.id;
  const { name, description, status } = req.body;

  try {
    const category = await Category.findOne({ organizationId: orgId, _id: catId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const before = category.toObject();

    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (status) category.status = status;

    const updated = await category.save();

    await logAudit(req, {
      action: 'CATEGORY_UPDATE',
      targetCollection: 'categories',
      targetId: category._id,
      before,
      after: updated.toObject()
    });

    return res.status(200).json({ success: true, category: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete category (archiving products inside default General)
// @route   DELETE /api/categories/:id
// @access  Private
const deleteCategory = async (req, res) => {
  const orgId = req.orgId;
  const catId = req.params.id;

  try {
    const category = await Category.findOne({ organizationId: orgId, _id: catId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Don't allow deleting "General" default
    if (category.name === 'General') {
      return res.status(400).json({ success: false, message: 'Default General category cannot be deleted' });
    }

    const before = category.toObject();

    // Check if there are active products inside this category
    const productsCount = await Product.countDocuments({ organizationId: orgId, category: catId });
    if (productsCount > 0) {
      // Find or create General
      let generalCat = await Category.findOne({ organizationId: orgId, name: 'General' });
      if (!generalCat) {
        generalCat = await Category.create({ organizationId: orgId, name: 'General', description: 'General imports' });
      }

      // Move products to General
      await Product.updateMany({ organizationId: orgId, category: catId }, { category: generalCat._id });
    }

    await Category.deleteOne({ _id: catId });

    await logAudit(req, {
      action: 'CATEGORY_DELETE',
      targetCollection: 'categories',
      targetId: catId,
      before
    });

    return res.status(200).json({ success: true, message: 'Category deleted and related products moved to General category' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
