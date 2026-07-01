const Sale = require('../models/Sale');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const WarehouseStock = require('../models/WarehouseStock');
const Category = require('../models/Category');

// @desc    Generate report data based on type and dates
// @route   GET /api/reports
// @access  Private
const getReportData = async (req, res) => {
  const orgId = req.orgId;
  const { type, startDate, endDate } = req.query;

  try {
    let reportData = [];
    const filter = { organizationId: orgId };

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (type === 'ProfitMargin') {
      const products = await Product.find({ organizationId: orgId }).populate('category', 'name');
      products.forEach(p => {
        const margin = p.sellingPrice - p.purchasePrice;
        const marginPercentage = p.sellingPrice > 0 ? ((margin / p.sellingPrice) * 100).toFixed(2) : 0;
        reportData.push({
          productId: p._id,
          name: p.name,
          sku: p.sku,
          category: p.category ? p.category.name : 'N/A',
          purchasePrice: p.purchasePrice,
          sellingPrice: p.sellingPrice,
          margin,
          marginPercentage: parseFloat(marginPercentage)
        });
      });
    } 
    else if (type === 'ABCTurnover') {
      // ABC analysis classifies items based on stock holding value
      // A: High Value (> 50% value cumulative), B: Medium (30%), C: Low (20%)
      const stocks = await WarehouseStock.find({ organizationId: orgId }).populate('productId');
      let itemsList = [];
      let totalTenantInventoryVal = 0;

      stocks.forEach(s => {
        if (s.productId) {
          const val = s.quantity * s.productId.purchasePrice;
          totalTenantInventoryVal += val;
          itemsList.push({
            productId: s.productId._id,
            name: s.productId.name,
            sku: s.productId.sku,
            quantity: s.quantity,
            price: s.productId.purchasePrice,
            totalVal: val
          });
        }
      });

      // Sort items by total stock value desc
      itemsList.sort((a, b) => b.totalVal - a.totalVal);

      // Classify ABC
      let currentValSum = 0;
      reportData = itemsList.map(item => {
        currentValSum += item.totalVal;
        const percentage = totalTenantInventoryVal > 0 ? (currentValSum / totalTenantInventoryVal) * 100 : 0;
        let classification = 'C';
        if (percentage <= 60) classification = 'A';
        else if (percentage <= 90) classification = 'B';

        return {
          ...item,
          cumulativePercentage: parseFloat(percentage.toFixed(2)),
          class: classification
        };
      });
    } 
    else if (type === 'TaxReport') {
      const sales = await Sale.find(filter);
      const purchases = await PurchaseOrder.find(filter);

      const salesTax = sales.reduce((sum, s) => sum + s.tax, 0);
      const purchasesTax = purchases.reduce((sum, p) => sum + p.tax, 0);

      reportData = {
        salesTaxCollected: salesTax,
        purchaseTaxPaid: purchasesTax,
        netTaxLiability: salesTax - purchasesTax,
        salesCount: sales.length,
        purchaseCount: purchases.length
      };
    } 
    else if (type === 'DailySales') {
      // Aggregate sales by date
      const salesAgg = await Sale.aggregate([
        { $match: { organizationId: orgId, paymentStatus: 'Paid' } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      reportData = salesAgg.map(s => ({ date: s._id, revenue: s.revenue, count: s.count }));
    } 
    else if (type === 'MonthlySales') {
      const salesAgg = await Sale.aggregate([
        { $match: { organizationId: orgId, paymentStatus: 'Paid' } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            revenue: { $sum: "$total" },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      reportData = salesAgg.map(s => ({ month: s._id, revenue: s.revenue, count: s.count }));
    } 
    else {
      // Default to general Sales Report
      const sales = await Sale.find(filter).populate('customerId', 'name');
      reportData = sales.map(s => ({
        invoiceNumber: s.invoiceNumber,
        customer: s.customerId ? s.customerId.name : 'Unknown',
        total: s.total,
        tax: s.tax,
        discount: s.discount,
        paymentStatus: s.paymentStatus,
        deliveryStatus: s.deliveryStatus,
        date: s.createdAt
      }));
    }

    return res.status(200).json({ success: true, type, report: reportData });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getReportData
};
