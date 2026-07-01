/* ==========================================================================
   StockPilot Adjustments Client Page Controller
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchAdjustments();
  fetchSelectorData();
});

// Load adjustments list
const fetchAdjustments = async () => {
  try {
    const data = await apiCall('/adjustments');
    if (data.success) {
      renderAdjustmentsTable(data.adjustments);
    }
  } catch (err) {}
};

// Load modal dropdown selectors
const fetchSelectorData = async () => {
  try {
    const pData = await apiCall('/products?limit=1000');
    const wData = await apiCall('/warehouses');

    const modalProd = document.getElementById('adj-modal-product');
    const modalWH = document.getElementById('adj-modal-warehouse');

    if (modalProd && pData.success) {
      modalProd.innerHTML = pData.products.map(p => `<option value="${p._id}">${p.name} (${p.sku})</option>`).join('');
    }
    if (modalWH && wData.success) {
      modalWH.innerHTML = wData.warehouses.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('');
    }
  } catch (err) {}
};

// Render Adjustments
const renderAdjustmentsTable = (adjustments) => {
  const tbody = document.getElementById('adjustments-tbody');
  if (!tbody) return;

  if (adjustments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-secondary);">No adjustments logged in this tenant</td></tr>';
    return;
  }

  const role = localStorage.getItem('stockpilot_user_role');
  const canApprove = ['Super Admin', 'Admin', 'Manager'].includes(role);

  tbody.innerHTML = adjustments.map(adj => {
    const isPending = adj.status === 'Pending';
    let statusClass = 'badge-info';
    if (adj.status === 'Approved') statusClass = 'badge-success';
    if (adj.status === 'Rejected') statusClass = 'badge-danger';

    const p = adj.productId;
    const w = adj.warehouseId;
    const date = new Date(adj.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

    let actionsHtml = '<span style="font-size:0.8rem; color:var(--text-tertiary);">N/A</span>';
    if (isPending && canApprove) {
      actionsHtml = `
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" style="padding:6px 12px; color:var(--success); border-color:var(--success);" onclick="handleApproveAdj('${adj._id}')">Approve</button>
          <button class="btn btn-secondary" style="padding:6px 12px; color:var(--danger); border-color:var(--danger);" onclick="handleRejectAdj('${adj._id}')">Reject</button>
        </div>
      `;
    } else if (isPending && !canApprove) {
      actionsHtml = '<span style="font-size:0.8rem; color:var(--text-tertiary);">Awaiting Review</span>';
    } else {
      actionsHtml = `<span style="font-size:0.8rem; color:var(--text-secondary);">Resolved by ${adj.approvedBy ? adj.approvedBy.name : 'System'}</span>`;
    }

    return `
      <tr>
        <td style="font-family:var(--font-numbers); font-weight:600;">${adj.adjustmentNumber}</td>
        <td>
          <div style="font-weight:600;">${p ? p.name : 'Unknown Product'}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); font-family:var(--font-numbers);">${p ? p.sku : 'N/A'}</div>
        </td>
        <td>${w ? w.name : 'Unknown Location'}</td>
        <td><span class="badge ${adj.type === 'Addition' ? 'badge-success' : 'badge-danger'}">${adj.type}</span></td>
        <td style="font-family:var(--font-numbers); font-weight:700;">${adj.adjustedQty}</td>
        <td><span style="font-size:0.85rem; font-weight:500;">${adj.reason}</span></td>
        <td>${adj.requestedBy ? adj.requestedBy.name : 'System'}</td>
        <td><span class="badge ${statusClass}">${adj.status}</span></td>
        <td>${actionsHtml}</td>
      </tr>
    `;
  }).join('');
};

// Modal functions
const openAdjModal = () => {
  document.getElementById('adj-form').reset();
  document.getElementById('adj-modal').classList.add('active');
};

const closeAdjModal = () => {
  document.getElementById('adj-modal').classList.remove('active');
};

// Form submit
const handleAdjSubmit = async (e) => {
  e.preventDefault();
  const productId = document.getElementById('adj-modal-product').value;
  const warehouseId = document.getElementById('adj-modal-warehouse').value;
  const type = document.getElementById('adj-modal-type').value;
  const adjustedQty = document.getElementById('adj-modal-qty').value;
  const reason = document.getElementById('adj-modal-reason').value;
  const notes = document.getElementById('adj-modal-notes').value;

  try {
    const data = await apiCall('/adjustments', {
      method: 'POST',
      body: JSON.stringify({ productId, warehouseId, type, adjustedQty, reason, notes })
    });

    if (data.success) {
      showToast(data.message, 'success');
      closeAdjModal();
      fetchAdjustments();
    }
  } catch (err) {}
};

// Approval triggers
const handleApproveAdj = async (id) => {
  if (!confirm('Are you sure you want to approve this stock adjustment? Stock quantities will be updated immediately.')) return;
  try {
    const data = await apiCall(`/adjustments/${id}/approve`, { method: 'PUT' });
    if (data.success) {
      showToast(data.message, 'success');
      fetchAdjustments();
    }
  } catch (err) {}
};

const handleRejectAdj = async (id) => {
  if (!confirm('Are you sure you want to reject this stock adjustment proposal?')) return;
  try {
    const data = await apiCall(`/adjustments/${id}/reject`, { method: 'PUT' });
    if (data.success) {
      showToast(data.message, 'success');
      fetchAdjustments();
    }
  } catch (err) {}
};
