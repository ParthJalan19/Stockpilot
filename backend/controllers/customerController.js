const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all customers with metrics
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  const orgId = req.orgId;
  try {
    const customers = await Customer.find({ organizationId: orgId });
    const results = [];

    for (const cust of customers) {
      const sales = await Sale.find({ organizationId: orgId, customerId: cust._id });
      const orderCount = sales.length;
      const totalPurchased = sales.reduce((sum, s) => sum + s.total, 0);

      results.push({
        ...cust.toObject(),
        orderCount,
        totalPurchased
      });
    }

    return res.status(200).json({ success: true, customers: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create Customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
  const orgId = req.orgId;
  const { name, company, email, phone, address } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Customer name is required' });
  }

  try {
    const customer = await Customer.create({
      organizationId: orgId,
      name,
      company,
      email,
      phone,
      address
    });

    await logAudit(req, {
      action: 'CUSTOMER_CREATE',
      targetCollection: 'customers',
      targetId: customer._id,
      after: customer.toObject()
    });

    return res.status(201).json({ success: true, customer });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
  const orgId = req.orgId;
  const custId = req.params.id;
  const { name, company, email, phone, address } = req.body;

  try {
    const customer = await Customer.findOne({ organizationId: orgId, _id: custId });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const before = customer.toObject();

    if (name) customer.name = name;
    if (company !== undefined) customer.company = company;
    if (email !== undefined) customer.email = email;
    if (phone !== undefined) customer.phone = phone;
    if (address !== undefined) customer.address = address;

    const updated = await customer.save();

    await logAudit(req, {
      action: 'CUSTOMER_UPDATE',
      targetCollection: 'customers',
      targetId: customer._id,
      before,
      after: updated.toObject()
    });

    return res.status(200).json({ success: true, customer: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
  const orgId = req.orgId;
  const custId = req.params.id;

  try {
    const customer = await Customer.findOne({ organizationId: orgId, _id: custId });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const before = customer.toObject();

    // Check if customer is linked to sales
    const salesCount = await Sale.countDocuments({ organizationId: orgId, customerId: custId });
    if (salesCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete customer linked to invoicing records' });
    }

    await Customer.deleteOne({ _id: custId });

    await logAudit(req, {
      action: 'CUSTOMER_DELETE',
      targetCollection: 'customers',
      targetId: custId,
      before
    });

    return res.status(200).json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
