/* ==========================================================================
   StockPilot Analytical Reports Client Controller
   ========================================================================== */

checkAuth();

let currentReportData = [];

document.addEventListener('DOMContentLoaded', () => {
  // Set default dates (last 30 days)
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  
  document.getElementById('report-start').value = start.toISOString().slice(0,10);
  document.getElementById('report-end').value = end.toISOString().slice(0,10);

  loadReport();
});

const loadReport = async () => {
  const type = document.getElementById('report-type').value;
  const startDate = document.getElementById('report-start').value;
  const endDate = document.getElementById('report-end').value;

  let query = `?type=${type}`;
  if (startDate) query += `&startDate=${startDate}`;
  if (endDate) query += `&endDate=${endDate}`;

  try {
    const data = await apiCall(`/reports${query}`);
    if (data.success) {
      currentReportData = data.report;
      renderReportGrid(type, data.report);
    }
  } catch (err) {}
};

// Render tables dynamically based on selection
const renderReportGrid = (type, data) => {
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');

  if (!thead || !tbody) return;

  if (type === 'ProfitMargin') {
    thead.innerHTML = `
      <tr>
        <th>SKU</th>
        <th>Product Name</th>
        <th>Category</th>
        <th>Purchase Cost</th>
        <th>Selling Price</th>
        <th>Margin Value</th>
        <th>Margin (%)</th>
      </tr>
    `;
    
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No product data available</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(item => `
      <tr>
        <td style="font-family:var(--font-numbers); font-size:0.85rem;">${item.sku}</td>
        <td><strong>${item.name}</strong></td>
        <td>${item.category}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(item.purchasePrice)}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(item.sellingPrice)}</td>
        <td style="font-family:var(--font-numbers); color:var(--success); font-weight:600;">+${formatCurrency(item.margin)}</td>
        <td style="font-family:var(--font-numbers); font-weight:700; color:var(--success);">${item.marginPercentage}%</td>
      </tr>
    `).join('');
  } 
  else if (type === 'ABCTurnover') {
    thead.innerHTML = `
      <tr>
        <th>SKU</th>
        <th>Product Name</th>
        <th>Quantity in Stock</th>
        <th>Unit Purchase Cost</th>
        <th>Total Stock Value</th>
        <th>ABC Category</th>
      </tr>
    `;

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No warehouse stock available</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(item => {
      let badge = 'badge-success'; // A
      if (item.class === 'B') badge = 'badge-warning';
      if (item.class === 'C') badge = 'badge-info';

      return `
        <tr>
          <td style="font-family:var(--font-numbers); font-size:0.85rem;">${item.sku}</td>
          <td><strong>${item.name}</strong></td>
          <td style="font-family:var(--font-numbers);">${item.quantity}</td>
          <td style="font-family:var(--font-numbers);">${formatCurrency(item.price)}</td>
          <td style="font-family:var(--font-numbers); font-weight:700;">${formatCurrency(item.totalVal)}</td>
          <td><span class="badge ${badge}">Class ${item.class}</span></td>
        </tr>
      `;
    }).join('');
  } 
  else if (type === 'TaxReport') {
    thead.innerHTML = `
      <tr>
        <th>Metric Summary</th>
        <th>Invoice / Purchase Count</th>
        <th>Calculated Value</th>
      </tr>
    `;

    tbody.innerHTML = `
      <tr>
        <td>Sales Tax Collected (Inward Tax)</td>
        <td>${data.salesCount} Invoices</td>
        <td style="font-family:var(--font-numbers); font-weight:600; color:var(--success);">${formatCurrency(data.salesTaxCollected)}</td>
      </tr>
      <tr>
        <td>Purchase Order Tax Paid (Outward Tax Credit)</td>
        <td>${data.purchaseCount} POs</td>
        <td style="font-family:var(--font-numbers); font-weight:600; color:var(--danger);">${formatCurrency(data.purchaseTaxPaid)}</td>
      </tr>
      <tr style="border-top:2px solid var(--border-color); font-weight:700;">
        <td>Net Tax Liability / Refund Claim</td>
        <td>Total Balance</td>
        <td style="font-family:var(--font-numbers); color:var(--accent-color);">${formatCurrency(data.netTaxLiability)}</td>
      </tr>
    `;
  } 
  else {
    // Sales Report
    thead.innerHTML = `
      <tr>
        <th>Invoice Number</th>
        <th>Customer</th>
        <th>Subtotal Value</th>
        <th>Tax</th>
        <th>Discounts</th>
        <th>Grand Total</th>
        <th>Billing Date</th>
      </tr>
    `;

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No sales invoices generated in this date range</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(item => {
      const date = new Date(item.date).toLocaleDateString();
      const subtotal = item.total - item.tax + item.discount;
      return `
        <tr>
          <td style="font-family:var(--font-numbers); font-weight:700;">${item.invoiceNumber}</td>
          <td><strong>${item.customer}</strong></td>
          <td style="font-family:var(--font-numbers);">${formatCurrency(subtotal)}</td>
          <td style="font-family:var(--font-numbers);">${formatCurrency(item.tax)}</td>
          <td style="font-family:var(--font-numbers); color:var(--danger);">${formatCurrency(item.discount)}</td>
          <td style="font-family:var(--font-numbers); font-weight:700;">${formatCurrency(item.total)}</td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${date}</td>
        </tr>
      `;
    }).join('');
  }
};

// Export to CSV helper
const exportReportCSV = () => {
  const type = document.getElementById('report-type').value;
  if (!currentReportData || currentReportData.length === 0) {
    showToast('No report data available to export', 'warning');
    return;
  }

  let csv = '';
  
  if (type === 'ProfitMargin') {
    csv = 'SKU,Product Name,Category,Purchase Cost,Selling Price,Margin ($),Margin (%)\n';
    currentReportData.forEach(item => {
      csv += `"${item.sku}","${item.name}",${item.category},${item.purchasePrice},${item.sellingPrice},${item.margin},${item.marginPercentage}\n`;
    });
  } 
  else if (type === 'ABCTurnover') {
    csv = 'SKU,Product Name,Stock Qty,Unit Purchase Cost,Total Value,ABC Category\n';
    currentReportData.forEach(item => {
      csv += `"${item.sku}","${item.name}",${item.quantity},${item.price},${item.totalVal},"${item.class}"\n`;
    });
  } 
  else if (type === 'TaxReport') {
    csv = 'Metric,Value\n';
    csv += `Sales Tax Collected,${currentReportData.salesTaxCollected}\n`;
    csv += `Purchase Tax Paid,${currentReportData.purchaseTaxPaid}\n`;
    csv += `Net Tax Liability,${currentReportData.netTaxLiability}\n`;
  } 
  else {
    csv = 'Invoice Number,Customer,Grand Total,Tax,Discount,Date\n';
    currentReportData.forEach(item => {
      csv += `"${item.invoiceNumber}","${item.customer}",${item.total},${item.tax},${item.discount},"${item.date}"\n`;
    });
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `stockpilot_${type}_report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Report downloaded successfully as CSV', 'success');
};
