const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all suppliers with metrics
// @route   GET /api/suppliers
// @access  Private
const getSuppliers = async (req, res) => {
  const orgId = req.orgId;
  try {
    const suppliers = await Supplier.find({ organizationId: orgId });
    const results = [];

    for (const sup of suppliers) {
      const productCount = await Product.countDocuments({
        organizationId: orgId,
        supplierId: sup._id,
        status: { $ne: 'Archived' }
      });
      results.push({
        ...sup.toObject(),
        productCount
      });
    }

    return res.status(200).json({ success: true, suppliers: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create Supplier
// @route   POST /api/suppliers
// @access  Private
const createSupplier = async (req, res) => {
  const orgId = req.orgId;
  const { name, company, email, phone, gstNumber, address, rating } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Supplier name is required' });
  }

  try {
    const supplier = await Supplier.create({
      organizationId: orgId,
      name,
      company,
      email,
      phone,
      gstNumber,
      address,
      rating: parseInt(rating) || 5
    });

    await logAudit(req, {
      action: 'SUPPLIER_CREATE',
      targetCollection: 'suppliers',
      targetId: supplier._id,
      after: supplier.toObject()
    });

    return res.status(201).json({ success: true, supplier });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Supplier
// @route   PUT /api/suppliers/:id
// @access  Private
const updateSupplier = async (req, res) => {
  const orgId = req.orgId;
  const supId = req.params.id;
  const { name, company, email, phone, gstNumber, address, rating } = req.body;

  try {
    const supplier = await Supplier.findOne({ organizationId: orgId, _id: supId });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const before = supplier.toObject();

    if (name) supplier.name = name;
    if (company !== undefined) supplier.company = company;
    if (email !== undefined) supplier.email = email;
    if (phone !== undefined) supplier.phone = phone;
    if (gstNumber !== undefined) supplier.gstNumber = gstNumber;
    if (address !== undefined) supplier.address = address;
    if (rating !== undefined) supplier.rating = parseInt(rating) || 5;

    const updated = await supplier.save();

    await logAudit(req, {
      action: 'SUPPLIER_UPDATE',
      targetCollection: 'suppliers',
      targetId: supplier._id,
      before,
      after: updated.toObject()
    });

    return res.status(200).json({ success: true, supplier: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Supplier
// @route   DELETE /api/suppliers/:id
// @access  Private
const deleteSupplier = async (req, res) => {
  const orgId = req.orgId;
  const supId = req.params.id;

  try {
    const supplier = await Supplier.findOne({ organizationId: orgId, _id: supId });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const before = supplier.toObject();

    // Check if supplier is linked to products
    const productsCount = await Product.countDocuments({ organizationId: orgId, supplierId: supId });
    if (productsCount > 0) {
      // Unlink supplier from products
      await Product.updateMany({ organizationId: orgId, supplierId: supId }, { supplierId: null });
    }

    await Supplier.deleteOne({ _id: supId });

    await logAudit(req, {
      action: 'SUPPLIER_DELETE',
      targetCollection: 'suppliers',
      targetId: supId,
      before
    });

    return res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
