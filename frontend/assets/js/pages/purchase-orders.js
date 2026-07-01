/* ==========================================================================
   StockPilot Purchase Orders Client Controller
   ========================================================================== */

checkAuth();

let suppliersList = [];
let warehousesList = [];
let productsList = [];
let orgTaxRate = 18;

document.addEventListener('DOMContentLoaded', () => {
  fetchPurchases();
  fetchSelectorData();
});

const fetchPurchases = async () => {
  try {
    const data = await apiCall('/purchases');
    if (data.success) {
      renderPurchasesTable(data.purchases);
    }
  } catch (err) {}
};

const fetchSelectorData = async () => {
  try {
    const sData = await apiCall('/suppliers');
    const wData = await apiCall('/warehouses');
    const pData = await apiCall('/products?limit=1000');
    const setRes = await apiCall('/settings');

    if (sData.success) {
      suppliersList = sData.suppliers;
      document.getElementById('po-modal-supplier').innerHTML = 
        suppliersList.map(s => `<option value="${s._id}">${s.name} (${s.company})</option>`).join('');
    }
    if (wData.success) {
      warehousesList = wData.warehouses;
      document.getElementById('po-modal-warehouse').innerHTML = 
        warehousesList.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('');
    }
    if (pData.success) {
      productsList = pData.products;
    }
    if (setRes.success && setRes.settings) {
      orgTaxRate = setRes.settings.taxRate;
      document.getElementById('po-modal-tax-rate').textContent = `${orgTaxRate}%`;
    }
  } catch (err) {}
};

const renderPurchasesTable = (purchases) => {
  const tbody = document.getElementById('purchases-tbody');
  if (!tbody) return;

  if (purchases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">No purchase orders proposed</td></tr>';
    return;
  }

  tbody.innerHTML = purchases.map(po => {
    const supName = po.supplierId ? po.supplierId.name : 'Unknown Supplier';
    const whName = po.warehouseId ? po.warehouseId.name : 'Main Warehouse';
    
    const subtotal = po.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    let badgeClass = 'badge-info';
    if (po.status === 'Completed' || po.status === 'Received') badgeClass = 'badge-success';
    if (po.status === 'Ordered') badgeClass = 'badge-warning';
    if (po.status === 'Cancelled') badgeClass = 'badge-danger';
    if (po.status === 'Approved') badgeClass = 'badge-success';

    let actionBtn = '';
    const role = localStorage.getItem('stockpilot_user_role');
    const isAdmin = ['Super Admin', 'Admin', 'Manager'].includes(role);

    if (po.status === 'Draft') {
      actionBtn = `<button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="handleUpdatePOStatus('${po._id}', 'Pending Approval')">Submit Review</button>`;
    } else if (po.status === 'Pending Approval' && isAdmin) {
      actionBtn = `
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; color:var(--success);" onclick="handleUpdatePOStatus('${po._id}', 'Approved')">Approve</button>
          <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; color:var(--danger);" onclick="handleUpdatePOStatus('${po._id}', 'Cancelled')">Cancel</button>
        </div>
      `;
    } else if (po.status === 'Approved') {
      actionBtn = `<button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; color:var(--warning);" onclick="handleUpdatePOStatus('${po._id}', 'Ordered')">Order Items</button>`;
    } else if (po.status === 'Ordered') {
      actionBtn = `<button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="handleUpdatePOStatus('${po._id}', 'Received')">Mark Received</button>`;
    } else {
      actionBtn = '<span style="font-size:0.8rem; color:var(--text-tertiary);">Workflow Completed</span>';
    }

    return `
      <tr>
        <td style="font-family:var(--font-numbers); font-weight:700; color:var(--accent-color);">${po.poNumber}</td>
        <td><strong>${supName}</strong></td>
        <td>${whName}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(subtotal)}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(po.tax)}</td>
        <td style="font-family:var(--font-numbers); font-weight:700;">${formatCurrency(po.total)}</td>
        <td><span class="badge ${badgeClass}">${po.status}</span></td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
};

const openPOModal = () => {
  document.getElementById('po-items-container').innerHTML = '';
  document.getElementById('po-form').reset();
  addPOItemRow();
  document.getElementById('po-modal').classList.add('active');
};

const closePOModal = () => {
  document.getElementById('po-modal').classList.remove('active');
};

const addPOItemRow = () => {
  const container = document.getElementById('po-items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'po-item-row';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '2fr 1fr 1fr auto';
  row.style.gap = '12px';
  row.style.alignItems = 'center';

  row.innerHTML = `
    <select class="form-control item-product" onchange="handleProductPOSelectChange(this)" required>
      <option value="">Choose item...</option>
      ${productsList.map(p => `<option value="${p._id}" data-cost="${p.purchasePrice}">${p.name} (${p.sku})</option>`).join('')}
    </select>
    <input type="number" class="form-control item-price" placeholder="Cost" min="0" step="0.01" oninput="calculatePOTotals()" required />
    <input type="number" class="form-control item-qty" placeholder="Qty" value="1" min="1" oninput="calculatePOTotals()" required />
    <button type="button" style="background:none; border:none; color:var(--danger); cursor:pointer;" onclick="this.parentElement.remove(); calculatePOTotals();"><i data-lucide="trash" style="width:16px;"></i></button>
  `;
  container.appendChild(row);
  lucide.createIcons();
};

const handleProductPOSelectChange = (selectEl) => {
  const option = selectEl.options[selectEl.selectedIndex];
  const cost = option.getAttribute('data-cost');
  
  const row = selectEl.parentElement;
  const costInput = row.querySelector('.item-price');
  
  if (costInput && cost) {
    costInput.value = cost;
  }
  calculatePOTotals();
};

const calculatePOTotals = () => {
  const rows = document.querySelectorAll('.po-item-row');
  let subtotal = 0;
  
  rows.forEach(row => {
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const qty = parseInt(row.querySelector('.item-qty').value) || 0;
    subtotal += price * qty;
  });

  const discount = parseFloat(document.getElementById('po-modal-discount').value) || 0;
  const taxAmount = ((subtotal - discount) * orgTaxRate) / 100;
  const grandTotal = subtotal - discount + taxAmount;

  document.getElementById('po-modal-total-display').textContent = formatCurrency(grandTotal);
};

const handlePOSubmit = async (e) => {
  e.preventDefault();

  const supplierId = document.getElementById('po-modal-supplier').value;
  const warehouseId = document.getElementById('po-modal-warehouse').value;
  const discount = document.getElementById('po-modal-discount').value;

  const rows = document.querySelectorAll('.po-item-row');
  const items = [];
  rows.forEach(row => {
    const productId = row.querySelector('.item-product').value;
    const price = row.querySelector('.item-price').value;
    const quantity = row.querySelector('.item-qty').value;
    if (productId && price && quantity) {
      items.push({ productId, price: parseFloat(price), quantity: parseInt(quantity) });
    }
  });

  try {
    const data = await apiCall('/purchases', {
      method: 'POST',
      body: JSON.stringify({ supplierId, warehouseId, discount, items })
    });

    if (data.success) {
      showToast('Purchase Order created successfully', 'success');
      closePOModal();
      fetchPurchases();
    }
  } catch (err) {}
};

const handleUpdatePOStatus = async (id, status) => {
  if (!confirm(`Are you sure you want to transition this PO status to ${status}?`)) return;

  try {
    const data = await apiCall(`/purchases/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    if (data.success) {
      showToast(data.message, 'success');
      fetchPurchases();
    }
  } catch (err) {}
};
