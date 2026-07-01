const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
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
  oldQty: {
    type: Number,
    required: true
  },
  newQty: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['Adjustment', 'Sale', 'Purchase', 'Transfer', 'Return'],
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
