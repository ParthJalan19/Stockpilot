const express = require('express');
const router = express.Router();
const {
  getPurchases,
  createPurchase,
  updatePurchaseStatus,
  getPurchaseReturns,
  createPurchaseReturn
} = require('../controllers/purchaseOrderController');
const { protect, hasPermission } = require('../middleware/auth');

router.get('/', protect, getPurchases);
router.post('/', protect, createPurchase);
router.put('/:id/status', protect, hasPermission('can_approve_purchase'), updatePurchaseStatus);

router.get('/returns', protect, getPurchaseReturns);
router.post('/returns', protect, createPurchaseReturn);

module.exports = router;
