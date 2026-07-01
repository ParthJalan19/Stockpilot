const express = require('express');
const router = express.Router();
const {
  getAdjustments,
  createAdjustment,
  approveAdjustment,
  rejectAdjustment
} = require('../controllers/adjustmentController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', protect, getAdjustments);
router.post('/', protect, createAdjustment);
router.put('/:id/approve', protect, restrictTo('Super Admin', 'Admin', 'Manager'), approveAdjustment);
router.put('/:id/reject', protect, restrictTo('Super Admin', 'Admin', 'Manager'), rejectAdjustment);

module.exports = router;
