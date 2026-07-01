const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseReturn = require('../models/PurchaseReturn');
const WarehouseStock = require('../models/WarehouseStock');
const InventoryMovement = require('../models/InventoryMovement');
const Organization = require('../models/Organization');
const Product = require('../models/Product');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all purchase orders
// @route   GET /api/purchases
// @access  Private
const getPurchases = async (req, res) => {
  const orgId = req.orgId;
  try {
    const purchases = await PurchaseOrder.find({ organizationId: orgId })
      .populate('supplierId', 'name company email phone')
      .populate('warehouseId', 'name code')
      .populate('items.productId', 'name sku purchasePrice')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, purchases });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a Purchase Order
// @route   POST /api/purchases
// @access  Private
const createPurchase = async (req, res) => {
  const orgId = req.orgId;
  const { supplierId, warehouseId, items, taxGroup, discount, notes } = req.body;

  if (!supplierId || !warehouseId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please enter supplier, warehouse, and at least one item' });
  }

  try {
    const org = await Organization.findById(orgId);
    const purchaseCount = await PurchaseOrder.countDocuments({ organizationId: orgId });
    const poNumber = 'PO-' + (1000 + purchaseCount + 1);

    // Calculate totals
    let itemsSubtotal = 0;
    for (const item of items) {
      const prod = await Product.findOne({ organizationId: orgId, _id: item.productId });
      if (!prod) {
        return res.status(404).json({ success: false, message: `Product not found` });
      }
      itemsSubtotal += item.quantity * item.price;
    }

    const discountAmount = parseFloat(discount) || 0;
    const taxRate = org ? org.taxRate : 18;
    const taxAmount = ((itemsSubtotal - discountAmount) * taxRate) / 100;
    const total = itemsSubtotal - discountAmount + taxAmount;

    const po = await PurchaseOrder.create({
      organizationId: orgId,
      poNumber,
      supplierId,
      warehouseId,
      items,
      taxGroup: taxGroup || 'GST',
      tax: taxAmount,
      discount: discountAmount,
      total,
      status: 'Draft',
      notes,
      updatedBy: req.user._id
    });

    await logAudit(req, {
      action: 'PO_CREATE',
      targetCollection: 'purchase_orders',
      targetId: po._id,
      after: po.toObject()
    });

    return res.status(201).json({ success: true, purchaseOrder: po });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update PO Status (Draft -> Pending Approval -> Approved -> Ordered -> Received -> Completed)
// @route   PUT /api/purchases/:id/status
// @access  Private
const updatePurchaseStatus = async (req, res) => {
  const orgId = req.orgId;
  const poId = req.params.id;
  const { status } = req.body;

  const validStatuses = ['Draft', 'Pending Approval', 'Approved', 'Ordered', 'Received', 'Completed'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status update request' });
  }

  try {
    const po = await PurchaseOrder.findOne({ organizationId: orgId, _id: poId });
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (po.status === 'Completed' || po.status === 'Received') {
      return res.status(400).json({ success: false, message: 'Cannot edit status of a completed purchase order' });
    }

    const before = po.toObject();
    const oldStatus = po.status;
    po.status = status;
    po.updatedBy = req.user._id;

    // Add items to stock when transitioning to Received/Completed
    if ((status === 'Received' || status === 'Completed') && oldStatus !== 'Received' && oldStatus !== 'Completed') {
      for (const item of po.items) {
        let stock = await WarehouseStock.findOne({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: po.warehouseId
        });

        if (!stock) {
          stock = await WarehouseStock.create({
            organizationId: orgId,
            productId: item.productId,
            warehouseId: po.warehouseId,
            quantity: 0
          });
        }

        const oldQty = stock.quantity;
        stock.quantity += item.quantity;
        await stock.save();

        // Log movement ledger
        await InventoryMovement.create({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: po.warehouseId,
          variantSku: item.variantSku || '',
          oldQty,
          newQty: stock.quantity,
          type: 'Purchase',
          reason: `PO Received: Intake from Supplier ID: ${po.supplierId}. Ref: ${po.poNumber}`,
          referenceId: po._id,
          updatedBy: req.user._id
        });
      }
    }

    await po.save();

    await logAudit(req, {
      action: `PO_STATUS_${status.toUpperCase().replace(' ', '_')}`,
      targetCollection: 'purchase_orders',
      targetId: po._id,
      before,
      after: po.toObject()
    });

    return res.status(200).json({ success: true, message: `Purchase Order status updated to ${status}`, purchaseOrder: po });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get purchase returns
// @route   GET /api/purchases/returns
// @access  Private
const getPurchaseReturns = async (req, res) => {
  const orgId = req.orgId;
  try {
    const returns = await PurchaseReturn.find({ organizationId: orgId })
      .populate('purchaseOrderId', 'poNumber')
      .populate('warehouseId', 'name code')
      .populate('items.productId', 'name sku')
      .populate('updatedBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, returns });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Log a purchase return (returns items back to supplier, deducts stock)
// @route   POST /api/purchases/returns
// @access  Private
const createPurchaseReturn = async (req, res) => {
  const orgId = req.orgId;
  const { purchaseOrderId, warehouseId, items, reason } = req.body;

  if (!purchaseOrderId || !warehouseId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please enter PO, warehouse, and items returned' });
  }

  try {
    const returnCount = await PurchaseReturn.countDocuments({ organizationId: orgId });
    const returnNumber = 'RET-PR-' + (1000 + returnCount + 1);

    let totalRefund = 0;
    const itemsList = [];

    // Validate quantities exist at warehouse before returning
    for (const item of items) {
      const prod = await Product.findOne({ organizationId: orgId, _id: item.productId });
      if (!prod) {
        return res.status(404).json({ success: false, message: `Product not found` });
      }

      const stock = await WarehouseStock.findOne({
        organizationId: orgId,
        productId: item.productId,
        warehouseId
      });

      const availableQty = stock ? stock.quantity - stock.reservedQuantity : 0;
      if (availableQty < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${prod.name} at warehouse to return. Available: ${availableQty}, Requested: ${item.quantity}`
        });
      }

      const refundAmt = item.quantity * prod.purchasePrice;
      totalRefund += refundAmt;

      itemsList.push({
        productId: item.productId,
        variantSku: item.variantSku || '',
        quantity: parseInt(item.quantity),
        refundAmount: refundAmt
      });
    }

    const purchaseReturn = await PurchaseReturn.create({
      organizationId: orgId,
      returnNumber,
      purchaseOrderId,
      warehouseId,
      items: itemsList,
      totalRefund,
      reason,
      status: 'Completed',
      updatedBy: req.user._id
    });

    // Update stock levels & record movements
    for (const item of itemsList) {
      const stock = await WarehouseStock.findOne({
        organizationId: orgId,
        productId: item.productId,
        warehouseId
      });

      const oldQty = stock.quantity;
      stock.quantity = Math.max(0, stock.quantity - item.quantity);
      await stock.save();

      await InventoryMovement.create({
        organizationId: orgId,
        productId: item.productId,
        warehouseId,
        variantSku: item.variantSku,
        oldQty,
        newQty: stock.quantity,
        type: 'Return',
        reason: `Purchase Return Logged: Return to supplier. Ref: ${returnNumber}`,
        referenceId: purchaseReturn._id,
        updatedBy: req.user._id
      });
    }

    await logAudit(req, {
      action: 'PO_RETURN_CREATE',
      targetCollection: 'purchase_returns',
      targetId: purchaseReturn._id,
      after: purchaseReturn.toObject()
    });

    return res.status(201).json({ success: true, message: 'Purchase return logged and stock deducted successfully', purchaseReturn });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPurchases,
  createPurchase,
  updatePurchaseStatus,
  getPurchaseReturns,
  createPurchaseReturn
};
