const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  importCSV
} = require('../controllers/productController');
const { protect, hasPermission } = require('../middleware/auth');
const upload = require('../middleware/multer');

router.get('/', protect, getProducts);
router.get('/:id', protect, getProductById);

router.post('/', protect, hasPermission('can_edit_products'), upload.single('mainImage'), createProduct);
router.put('/:id', protect, hasPermission('can_edit_products'), upload.single('mainImage'), updateProduct);
router.delete('/:id', protect, hasPermission('can_delete_products'), deleteProduct);

router.post('/import', protect, hasPermission('can_edit_products'), importCSV);

module.exports = router;
