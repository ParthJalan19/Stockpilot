const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true // e.g. "PRODUCT_DELETE", "SALE_UPDATE"
  },
  targetCollection: {
    type: String,
    required: true // e.g. "products", "sales"
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId
  },
  before: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  after: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  ip: {
    type: String,
    default: ''
  },
  device: {
    type: String,
    default: ''
  },
  browser: {
    type: String,
    default: ''
  }
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
