const InventoryAdjustment = require('../models/InventoryAdjustment');
const WarehouseStock = require('../models/WarehouseStock');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all stock adjustments
// @route   GET /api/adjustments
// @access  Private
const getAdjustments = async (req, res) => {
  const orgId = req.orgId;
  try {
    const adjustments = await InventoryAdjustment.find({ organizationId: orgId })
      .populate('productId', 'name sku barcode')
      .populate('warehouseId', 'name code')
      .populate('requestedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, adjustments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a stock adjustment request (starts as Pending)
// @route   POST /api/adjustments
// @access  Private
const createAdjustment = async (req, res) => {
  const orgId = req.orgId;
  const { productId, warehouseId, variantSku, adjustedQty, type, reason, notes } = req.body;

  if (!productId || !warehouseId || !adjustedQty || !type || !reason) {
    return res.status(400).json({ success: false, message: 'Please enter all required fields' });
  }

  try {
    const adjCount = await InventoryAdjustment.countDocuments({ organizationId: orgId });
    const adjustmentNumber = 'ADJ-' + (1000 + adjCount + 1);

    const adjustment = await InventoryAdjustment.create({
      organizationId: orgId,
      adjustmentNumber,
      productId,
      warehouseId,
      variantSku: variantSku || '',
      adjustedQty: parseInt(adjustedQty),
      type,
      reason,
      notes,
      requestedBy: req.user._id,
      status: 'Pending'
    });

    await logAudit(req, {
      action: 'ADJUSTMENT_CREATE',
      targetCollection: 'inventory_adjustments',
      targetId: adjustment._id,
      after: adjustment.toObject()
    });

    return res.status(201).json({ success: true, message: 'Adjustment request submitted for approval', adjustment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve a stock adjustment (updates physical stock levels & logs movement)
// @route   PUT /api/adjustments/:id/approve
// @access  Private
const approveAdjustment = async (req, res) => {
  const orgId = req.orgId;
  const adjId = req.params.id;

  try {
    const adjustment = await InventoryAdjustment.findOne({ organizationId: orgId, _id: adjId });
    if (!adjustment) {
      return res.status(404).json({ success: false, message: 'Adjustment request not found' });
    }

    if (adjustment.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Adjustment has already been ${adjustment.status.toLowerCase()}` });
    }

    const before = adjustment.toObject();

    // Check if WarehouseStock record exists, create if not
    let whStock = await WarehouseStock.findOne({
      organizationId: orgId,
      productId: adjustment.productId,
      warehouseId: adjustment.warehouseId
    });

    if (!whStock) {
      whStock = await WarehouseStock.create({
        organizationId: orgId,
        productId: adjustment.productId,
        warehouseId: adjustment.warehouseId,
        quantity: 0,
        reservedQuantity: 0
      });
    }

    const oldQty = whStock.quantity;
    let newQty = oldQty;

    if (adjustment.type === 'Addition') {
      newQty = oldQty + adjustment.adjustedQty;
    } else if (adjustment.type === 'Subtraction') {
      newQty = Math.max(0, oldQty - adjustment.adjustedQty); // Stock cannot go below zero
    }

    // Apply adjustments
    whStock.quantity = newQty;
    await whStock.save();

    // Log the Inventory Movement ledger entry
    await InventoryMovement.create({
      organizationId: orgId,
      productId: adjustment.productId,
      warehouseId: adjustment.warehouseId,
      variantSku: adjustment.variantSku,
      oldQty,
      newQty,
      type: 'Adjustment',
      reason: `Stock Adjustment: ${adjustment.reason}. Notes: ${adjustment.notes}`,
      referenceId: adjustment._id,
      updatedBy: req.user._id
    });

    // Update adjustment status
    adjustment.status = 'Approved';
    adjustment.approvedBy = req.user._id;
    await adjustment.save();

    await logAudit(req, {
      action: 'ADJUSTMENT_APPROVE',
      targetCollection: 'inventory_adjustments',
      targetId: adjustment._id,
      before,
      after: adjustment.toObject()
    });

    return res.status(200).json({ success: true, message: 'Adjustment request approved, inventory updated successfully', adjustment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject a stock adjustment request
// @route   PUT /api/adjustments/:id/reject
// @access  Private
const rejectAdjustment = async (req, res) => {
  const orgId = req.orgId;
  const adjId = req.params.id;

  try {
    const adjustment = await InventoryAdjustment.findOne({ organizationId: orgId, _id: adjId });
    if (!adjustment) {
      return res.status(404).json({ success: false, message: 'Adjustment request not found' });
    }

    if (adjustment.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Adjustment has already been ${adjustment.status.toLowerCase()}` });
    }

    const before = adjustment.toObject();

    adjustment.status = 'Rejected';
    adjustment.approvedBy = req.user._id;
    await adjustment.save();

    await logAudit(req, {
      action: 'ADJUSTMENT_REJECT',
      targetCollection: 'inventory_adjustments',
      targetId: adjustment._id,
      before,
      after: adjustment.toObject()
    });

    return res.status(200).json({ success: true, message: 'Adjustment request rejected successfully', adjustment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAdjustments,
  createAdjustment,
  approveAdjustment,
  rejectAdjustment
};
