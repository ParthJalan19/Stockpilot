const express = require('express');
const router = express.Router();
const {
  getSales,
  createSale,
  updateSaleStatus,
  getSaleReturns,
  createSaleReturn
} = require('../controllers/saleController');
const { protect, hasPermission } = require('../middleware/auth');

router.get('/', protect, getSales);
router.post('/', protect, hasPermission('can_create_sales'), createSale);
router.put('/:id/status', protect, hasPermission('can_create_sales'), updateSaleStatus);

router.get('/returns', protect, getSaleReturns);
router.post('/returns', protect, hasPermission('can_create_sales'), createSaleReturn);

module.exports = router;
