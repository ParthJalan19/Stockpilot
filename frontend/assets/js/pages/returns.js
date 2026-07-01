/* ==========================================================================
   StockPilot Returns Client Page Controller
   ========================================================================== */

checkAuth();

let salesList = [];
let purchasesList = [];
let warehousesList = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchSalesReturns();
  fetchPurchaseReturns();
  fetchSelectorData();
});

const switchReturnTab = (tabName) => {
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  document.querySelectorAll('[id^="tab-"][id$="-btn"]').forEach(btn => {
    btn.style.color = 'var(--text-secondary)';
  });

  document.getElementById('tab-' + tabName).style.display = 'block';
  document.getElementById('tab-' + tabName + '-btn').style.color = 'var(--accent-color)';
};

// Fetch listings
const fetchSalesReturns = async () => {
  try {
    const data = await apiCall('/sales/returns');
    if (data.success) {
      renderSalesReturns(data.returns);
    }
  } catch (err) {}
};

const fetchPurchaseReturns = async () => {
  try {
    const data = await apiCall('/purchases/returns');
    if (data.success) {
      renderPurchaseReturns(data.returns);
    }
  } catch (err) {}
};

const fetchSelectorData = async () => {
  try {
    const sData = await apiCall('/sales');
    const pData = await apiCall('/purchases');
    const wData = await apiCall('/warehouses');

    if (sData.success) {
      salesList = sData.sales.filter(s => s.paymentStatus === 'Paid');
      document.getElementById('sr-modal-invoice').innerHTML = 
        '<option value="">Select Invoice...</option>' + 
        salesList.map(s => `<option value="${s._id}">${s.invoiceNumber} (${s.customerId ? s.customerId.name : 'Walk-in'})</option>`).join('');
    }

    if (pData.success) {
      purchasesList = pData.purchases.filter(p => p.status === 'Completed' || p.status === 'Received');
      document.getElementById('pr-modal-po').innerHTML = 
        '<option value="">Select PO...</option>' + 
        purchasesList.map(p => `<option value="${p._id}">${p.poNumber} (${p.supplierId ? p.supplierId.name : 'Unknown'})</option>`).join('');
    }

    if (wData.success) {
      warehousesList = wData.warehouses;
      document.getElementById('sr-modal-warehouse').innerHTML = 
        warehousesList.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('');
      document.getElementById('pr-modal-warehouse').innerHTML = 
        warehousesList.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('');
    }

  } catch (err) {}
};

// Render tables
const renderSalesReturns = (returns) => {
  const tbody = document.getElementById('sales-returns-tbody');
  if (!tbody) return;

  if (returns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No customer returns logged</td></tr>';
    return;
  }

  tbody.innerHTML = returns.map(ret => {
    const date = new Date(ret.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const invNum = ret.saleId ? ret.saleId.invoiceNumber : 'N/A';
    const whName = ret.warehouseId ? ret.warehouseId.name : 'N/A';

    return `
      <tr>
        <td style="font-family:var(--font-numbers); font-weight:700;">${ret.returnNumber}</td>
        <td style="font-family:var(--font-numbers); font-weight:600; color:var(--accent-color);">${invNum}</td>
        <td>${whName}</td>
        <td style="font-family:var(--font-numbers); font-weight:700; color:var(--danger);">${formatCurrency(ret.totalRefund)}</td>
        <td style="font-size:0.85rem;">${ret.reason}</td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${date}</td>
      </tr>
    `;
  }).join('');
};

const renderPurchaseReturns = (returns) => {
  const tbody = document.getElementById('purchase-returns-tbody');
  if (!tbody) return;

  if (returns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No supplier returns logged</td></tr>';
    return;
  }

  tbody.innerHTML = returns.map(ret => {
    const date = new Date(ret.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const poNum = ret.purchaseOrderId ? ret.purchaseOrderId.poNumber : 'N/A';
    const whName = ret.warehouseId ? ret.warehouseId.name : 'N/A';

    return `
      <tr>
        <td style="font-family:var(--font-numbers); font-weight:700;">${ret.returnNumber}</td>
        <td style="font-family:var(--font-numbers); font-weight:600; color:var(--accent-color);">${poNum}</td>
        <td>${whName}</td>
        <td style="font-family:var(--font-numbers); font-weight:700; color:var(--danger);">${formatCurrency(ret.totalRefund)}</td>
        <td style="font-size:0.85rem;">${ret.reason}</td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${date}</td>
      </tr>
    `;
  }).join('');
};

// Modal handlers
const openSaleReturnModal = () => {
  document.getElementById('sale-return-form').reset();
  document.getElementById('sr-items-container').innerHTML = '';
  document.getElementById('sale-return-modal').classList.add('active');
};

const closeSaleReturnModal = () => {
  document.getElementById('sale-return-modal').classList.remove('active');
};

const openPurchaseReturnModal = () => {
  document.getElementById('purchase-return-form').reset();
  document.getElementById('pr-items-container').innerHTML = '';
  document.getElementById('purchase-return-modal').classList.add('active');
};

const closePurchaseReturnModal = () => {
  document.getElementById('purchase-return-modal').classList.remove('active');
};

// Invoice dropdown change: loads line items to return
const handleSaleInvoiceChange = () => {
  const saleId = document.getElementById('sr-modal-invoice').value;
  const container = document.getElementById('sr-items-container');
  if (!saleId || !container) return;

  const sale = salesList.find(s => s._id === saleId);
  if (!sale) return;

  // Set restocking warehouse default to invoice warehouse source
  document.getElementById('sr-modal-warehouse').value = sale.warehouseId ? sale.warehouseId._id : '';

  container.innerHTML = sale.items.map(item => {
    const p = item.productId;
    return `
      <div class="sr-item-row" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-tertiary); padding:10px 14px; border-radius:6px;">
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
          <input type="checkbox" class="item-select" value="${p._id}" />
          <span><strong>${p ? p.name : 'Product'}</strong> (Bought: ${item.quantity})</span>
        </label>
        <div>
          Return Qty: <input type="number" class="form-control item-qty" value="1" min="1" max="${item.quantity}" style="width:70px; display:inline-block; padding:4px 8px; margin-left:8px;" />
        </div>
      </div>
    `;
  }).join('');
};

// PO dropdown change: loads line items to return to supplier
const handlePurchaseOrderChange = () => {
  const poId = document.getElementById('pr-modal-po').value;
  const container = document.getElementById('pr-items-container');
  if (!poId || !container) return;

  const po = purchasesList.find(p => p._id === poId);
  if (!po) return;

  document.getElementById('pr-modal-warehouse').value = po.warehouseId ? po.warehouseId._id : '';

  container.innerHTML = po.items.map(item => {
    const p = item.productId;
    return `
      <div class="pr-item-row" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-tertiary); padding:10px 14px; border-radius:6px;">
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
          <input type="checkbox" class="item-select" value="${p._id}" />
          <span><strong>${p ? p.name : 'Product'}</strong> (Received: ${item.quantity})</span>
        </label>
        <div>
          Return Qty: <input type="number" class="form-control item-qty" value="1" min="1" max="${item.quantity}" style="width:70px; display:inline-block; padding:4px 8px; margin-left:8px;" />
        </div>
      </div>
    `;
  }).join('');
};

// Submit handlers
const handleSaleReturnSubmit = async (e) => {
  e.preventDefault();

  const saleId = document.getElementById('sr-modal-invoice').value;
  const warehouseId = document.getElementById('sr-modal-warehouse').value;
  const reason = document.getElementById('sr-modal-reason').value;

  const rows = document.querySelectorAll('.sr-item-row');
  const items = [];
  rows.forEach(row => {
    const checkbox = row.querySelector('.item-select');
    if (checkbox && checkbox.checked) {
      const productId = checkbox.value;
      const quantity = row.querySelector('.item-qty').value;
      items.push({ productId, quantity: parseInt(quantity) });
    }
  });

  if (items.length === 0) {
    showToast('Please select at least one item to return', 'warning');
    return;
  }

  try {
    const data = await apiCall('/sales/returns', {
      method: 'POST',
      body: JSON.stringify({ saleId, warehouseId, items, reason })
    });

    if (data.success) {
      showToast(data.message, 'success');
      closeSaleReturnModal();
      fetchSalesReturns();
    }
  } catch (err) {}
};

const handlePurchaseReturnSubmit = async (e) => {
  e.preventDefault();

  const purchaseOrderId = document.getElementById('pr-modal-po').value;
  const warehouseId = document.getElementById('pr-modal-warehouse').value;
  const reason = document.getElementById('pr-modal-reason').value;

  const rows = document.querySelectorAll('.pr-item-row');
  const items = [];
  rows.forEach(row => {
    const checkbox = row.querySelector('.item-select');
    if (checkbox && checkbox.checked) {
      const productId = checkbox.value;
      const quantity = row.querySelector('.item-qty').value;
      items.push({ productId, quantity: parseInt(quantity) });
    }
  });

  if (items.length === 0) {
    showToast('Please select at least one item to return', 'warning');
    return;
  }

  try {
    const data = await apiCall('/purchases/returns', {
      method: 'POST',
      body: JSON.stringify({ purchaseOrderId, warehouseId, items, reason })
    });

    if (data.success) {
      showToast(data.message, 'success');
      closePurchaseReturnModal();
      fetchPurchaseReturns();
    }
  } catch (err) {}
};
