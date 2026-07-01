const express = require('express');
const router = express.Router();
const {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
} = require('../controllers/warehouseController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', protect, getWarehouses);
router.post('/', protect, restrictTo('Super Admin', 'Admin'), createWarehouse);
router.put('/:id', protect, restrictTo('Super Admin', 'Admin'), updateWarehouse);
router.delete('/:id', protect, restrictTo('Super Admin', 'Admin'), deleteWarehouse);

module.exports = router;
