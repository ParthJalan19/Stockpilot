const express = require('express');
const router = express.Router();
const {
  getTransfers,
  createTransfer,
  updateTransferStatus
} = require('../controllers/transferController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getTransfers);
router.post('/', protect, createTransfer);
router.put('/:id/status', protect, updateTransferStatus);

module.exports = router;
