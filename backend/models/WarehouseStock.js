const mongoose = require('mongoose');

const warehouseStockSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0 // Reserved stock for pending sales orders before delivery
  }
}, {
  timestamps: true
});

// Compound index to quickly fetch stock per product and warehouse inside an organization
warehouseStockSchema.index({ organizationId: 1, productId: 1, warehouseId: 1 }, { unique: true });

module.exports = mongoose.model('WarehouseStock', warehouseStockSchema);
