/* ==========================================================================
   StockPilot Transfers Client Page Controller
   ========================================================================== */

checkAuth();

let warehousesList = [];
let productsList = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchTransfers();
  fetchSelectorData();
});

const fetchTransfers = async () => {
  try {
    const data = await apiCall('/transfers');
    if (data.success) {
      renderTransfersTable(data.transfers);
    }
  } catch (err) {}
};

const fetchSelectorData = async () => {
  try {
    const wData = await apiCall('/warehouses');
    const pData = await apiCall('/products?limit=1000');
    
    if (wData.success) {
      warehousesList = wData.warehouses;
      document.getElementById('trf-modal-src').innerHTML = warehousesList.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('');
      document.getElementById('trf-modal-dest').innerHTML = warehousesList.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('');
    }
    if (pData.success) {
      productsList = pData.products;
    }
  } catch (err) {}
};

const renderTransfersTable = (transfers) => {
  const tbody = document.getElementById('transfers-tbody');
  if (!tbody) return;

  if (transfers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">No warehouse transfers proposed yet</td></tr>';
    return;
  }

  tbody.innerHTML = transfers.map(trf => {
    const date = new Date(trf.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const itemsCount = trf.items.reduce((sum, item) => sum + item.quantity, 0);
    
    let badgeClass = 'badge-info';
    if (trf.status === 'Received') badgeClass = 'badge-success';
    if (trf.status === 'Shipped') badgeClass = 'badge-warning';
    if (trf.status === 'Cancelled') badgeClass = 'badge-danger';
    if (trf.status === 'Approved') badgeClass = 'badge-success';

    let actionBtn = '';
    const role = localStorage.getItem('stockpilot_user_role');
    const isAdmin = ['Super Admin', 'Admin', 'Manager'].includes(role);

    if (trf.status === 'Draft') {
      actionBtn = `<button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="handleUpdateTrfStatus('${trf._id}', 'Pending Approval')">Submit Request</button>`;
    } else if (trf.status === 'Pending Approval' && isAdmin) {
      actionBtn = `
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; color:var(--success);" onclick="handleUpdateTrfStatus('${trf._id}', 'Approved')">Approve</button>
          <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; color:var(--danger);" onclick="handleUpdateTrfStatus('${trf._id}', 'Cancelled')">Cancel</button>
        </div>
      `;
    } else if (trf.status === 'Approved') {
      actionBtn = `<button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; color:var(--warning);" onclick="handleUpdateTrfStatus('${trf._id}', 'Shipped')">Ship Stock</button>`;
    } else if (trf.status === 'Shipped') {
      actionBtn = `<button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="handleUpdateTrfStatus('${trf._id}', 'Received')">Mark Received</button>`;
    } else {
      actionBtn = '<span style="font-size:0.8rem; color:var(--text-tertiary);">Workflow Completed</span>';
    }

    return `
      <tr>
        <td style="font-family:var(--font-numbers); font-weight:700;">${trf.transferNumber}</td>
        <td>${trf.sourceWarehouseId ? trf.sourceWarehouseId.name : 'N/A'}</td>
        <td>${trf.destinationWarehouseId ? trf.destinationWarehouseId.name : 'N/A'}</td>
        <td style="font-family:var(--font-numbers); font-weight:600;">${itemsCount}</td>
        <td>${trf.requestedBy ? trf.requestedBy.name : 'System'}</td>
        <td><span class="badge ${badgeClass}">${trf.status}</span></td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${date}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
};

// Modal functions
const openTrfModal = () => {
  document.getElementById('trf-items-container').innerHTML = '';
  document.getElementById('trf-form').reset();
  addTransferItemRow(); // Add one default empty row
  document.getElementById('trf-modal').classList.add('active');
};

const closeTrfModal = () => {
  document.getElementById('trf-modal').classList.remove('active');
};

// Add item line row
const addTransferItemRow = () => {
  const container = document.getElementById('trf-items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'trf-item-row';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '2fr 1fr auto';
  row.style.gap = '12px';
  row.style.alignItems = 'center';

  row.innerHTML = `
    <select class="form-control item-product" required>
      ${productsList.map(p => `<option value="${p._id}">${p.name} (${p.sku})</option>`).join('')}
    </select>
    <input type="number" class="form-control item-qty" value="1" min="1" required />
    <button type="button" style="background:none; border:none; color:var(--danger); cursor:pointer;" onclick="this.parentElement.remove()"><i data-lucide="trash" style="width:16px;"></i></button>
  `;
  container.appendChild(row);
  lucide.createIcons();
};

// Form submit
const handleTrfSubmit = async (e) => {
  e.preventDefault();

  const sourceWarehouseId = document.getElementById('trf-modal-src').value;
  const destinationWarehouseId = document.getElementById('trf-modal-dest').value;
  const notes = document.getElementById('trf-modal-notes').value;

  const rows = document.querySelectorAll('.trf-item-row');
  const items = [];
  rows.forEach(row => {
    const productId = row.querySelector('.item-product').value;
    const quantity = row.querySelector('.item-qty').value;
    if (productId && quantity) {
      items.push({ productId, quantity: parseInt(quantity) });
    }
  });

  try {
    const data = await apiCall('/transfers', {
      method: 'POST',
      body: JSON.stringify({ sourceWarehouseId, destinationWarehouseId, items, notes })
    });

    if (data.success) {
      showToast('Transfer proposed successfully', 'success');
      closeTrfModal();
      fetchTransfers();
    }
  } catch (err) {}
};

// Transition status
const handleUpdateTrfStatus = async (id, status) => {
  if (!confirm(`Are you sure you want to transition this transfer status to ${status}?`)) return;

  try {
    const data = await apiCall(`/transfers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });

    if (data.success) {
      showToast(data.message, 'success');
      fetchTransfers();
    }
  } catch (err) {}
};
