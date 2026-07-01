const express = require('express');
const router = express.Router();
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { protect, hasPermission } = require('../middleware/auth');

router.get('/', protect, getCategories);
router.post('/', protect, hasPermission('can_edit_products'), createCategory);
router.put('/:id', protect, hasPermission('can_edit_products'), updateCategory);
router.delete('/:id', protect, hasPermission('can_delete_products'), deleteCategory);

module.exports = router;
