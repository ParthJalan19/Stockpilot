const mongoose = require('mongoose');

const inventoryAdjustmentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  adjustmentNumber: {
    type: String,
    required: true,
    trim: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  variantSku: {
    type: String,
    default: ''
  },
  adjustedQty: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['Addition', 'Subtraction'],
    required: true
  },
  reason: {
    type: String,
    enum: ['Damaged', 'Theft', 'Re-count', 'Expiry', 'Other'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

inventoryAdjustmentSchema.index({ organizationId: 1, adjustmentNumber: 1 }, { unique: true });

module.exports = mongoose.model('InventoryAdjustment', inventoryAdjustmentSchema);
