const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all warehouses with stock metrics
// @route   GET /api/warehouses
// @access  Private
const getWarehouses = async (req, res) => {
  const orgId = req.orgId;
  try {
    const warehouses = await Warehouse.find({ organizationId: orgId });
    const results = [];

    for (const wh of warehouses) {
      const stocks = await WarehouseStock.find({ organizationId: orgId, warehouseId: wh._id });
      
      const totalStock = stocks.reduce((sum, s) => sum + s.quantity, 0);
      const totalReserved = stocks.reduce((sum, s) => sum + s.reservedQuantity, 0);
      const distinctProducts = stocks.filter(s => s.quantity > 0).length;

      results.push({
        ...wh.toObject(),
        totalStock,
        totalReserved,
        distinctProducts
      });
    }

    return res.status(200).json({ success: true, warehouses: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create Warehouse
// @route   POST /api/warehouses
// @access  Private
const createWarehouse = async (req, res) => {
  const orgId = req.orgId;
  const { name, code, address } = req.body;

  if (!name || !code) {
    return res.status(400).json({ success: false, message: 'Warehouse name and code are required' });
  }

  try {
    const exists = await Warehouse.findOne({ organizationId: orgId, code: code.toUpperCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Warehouse with this code already exists' });
    }

    const warehouse = await Warehouse.create({
      organizationId: orgId,
      name,
      code: code.toUpperCase(),
      address
    });

    await logAudit(req, {
      action: 'WAREHOUSE_CREATE',
      targetCollection: 'warehouses',
      targetId: warehouse._id,
      after: warehouse.toObject()
    });

    return res.status(201).json({ success: true, warehouse });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Warehouse
// @route   PUT /api/warehouses/:id
// @access  Private
const updateWarehouse = async (req, res) => {
  const orgId = req.orgId;
  const whId = req.params.id;
  const { name, code, address, status } = req.body;

  try {
    const warehouse = await Warehouse.findOne({ organizationId: orgId, _id: whId });
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    const before = warehouse.toObject();

    if (name) warehouse.name = name;
    if (code) warehouse.code = code.toUpperCase();
    if (address !== undefined) warehouse.address = address;
    if (status) warehouse.status = status;

    const updated = await warehouse.save();

    await logAudit(req, {
      action: 'WAREHOUSE_UPDATE',
      targetCollection: 'warehouses',
      targetId: warehouse._id,
      before,
      after: updated.toObject()
    });

    return res.status(200).json({ success: true, warehouse: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Warehouse
// @route   DELETE /api/warehouses/:id
// @access  Private
const deleteWarehouse = async (req, res) => {
  const orgId = req.orgId;
  const whId = req.params.id;

  try {
    const warehouse = await Warehouse.findOne({ organizationId: orgId, _id: whId });
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    // Check if there is active stock in this warehouse
    const stocks = await WarehouseStock.find({ organizationId: orgId, warehouseId: whId });
    const totalQty = stocks.reduce((sum, s) => sum + s.quantity, 0);

    if (totalQty > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete warehouse containing stock. Please transfer or adjust stock first.'
      });
    }

    const before = warehouse.toObject();

    await Warehouse.deleteOne({ _id: whId });
    await WarehouseStock.deleteMany({ organizationId: orgId, warehouseId: whId });

    await logAudit(req, {
      action: 'WAREHOUSE_DELETE',
      targetCollection: 'warehouses',
      targetId: whId,
      before
    });

    return res.status(200).json({ success: true, message: 'Warehouse deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
};
