/* ==========================================================================
   StockPilot Warehouses Client Page Controller
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchWarehouses();
});

// Fetch warehouses
const fetchWarehouses = async () => {
  try {
    const data = await apiCall('/warehouses');
    if (data.success) {
      renderWarehousesGrid(data.warehouses);
    }
  } catch (err) {}
};

// Render warehouse cards
const renderWarehousesGrid = (warehouses) => {
  const container = document.getElementById('warehouses-grid');
  if (!container) return;

  if (warehouses.length === 0) {
    container.innerHTML = '<div class="premium-card" style="grid-column:1/-1; text-align:center; color:var(--text-secondary);">No warehouse depots created. Please click Add Warehouse to establish one.</div>';
    return;
  }

  container.innerHTML = warehouses.map(wh => {
    const isInactive = wh.status === 'Inactive';
    const statusClass = isInactive ? 'badge-danger' : 'badge-success';
    
    return `
      <div class="premium-card" style="display:flex; flex-direction:column; justify-content:space-between; gap:20px;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-weight:700; font-size:1.15rem; color:var(--text-primary);">${wh.name}</div>
            <span class="badge ${statusClass}">${wh.status}</span>
          </div>
          <div style="font-family:var(--font-numbers); font-size:0.85rem; color:var(--accent-color); margin-bottom:15px;">Code: ${wh.code}</div>
          
          <div style="display:flex; flex-direction:column; gap:8px; font-size:0.875rem; color:var(--text-secondary);">
            <div style="display:flex; align-items:center; gap:8px;"><i data-lucide="map-pin" style="width:14px; color:var(--text-tertiary);"></i> <span>${wh.address || 'No physical address listed'}</span></div>
            <div style="display:flex; align-items:center; gap:8px;"><i data-lucide="package-open" style="width:14px; color:var(--text-tertiary);"></i> <span>Total Qty: <strong style="color:var(--text-primary); font-family:var(--font-numbers);">${wh.totalStock}</strong> items</span></div>
            <div style="display:flex; align-items:center; gap:8px;"><i data-lucide="bookmark" style="width:14px; color:var(--text-tertiary);"></i> <span>Reserved: <strong style="color:var(--text-primary); font-family:var(--font-numbers);">${wh.totalReserved}</strong> items</span></div>
          </div>
        </div>

        <div style="display:flex; gap:10px; border-top:1px solid var(--border-color); padding-top:15px; margin-top:10px;">
          <button class="btn btn-secondary" style="flex:1; padding:8px;" onclick="openEditWHModal('${wh._id}')"><i data-lucide="edit-2" style="width:14px;"></i> Edit</button>
          <button class="btn btn-secondary" style="color:var(--danger); padding:8px;" onclick="handleDeleteWH('${wh._id}')" title="Delete"><i data-lucide="trash-2" style="width:14px;"></i></button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
};

// Modal functions
const openWHModal = () => {
  document.getElementById('wh-modal-title').textContent = 'Create Warehouse';
  document.getElementById('wh-id').value = '';
  document.getElementById('wh-form').reset();
  document.getElementById('wh-status-group').style.display = 'none';
  document.getElementById('wh-modal').classList.add('active');
};

const openEditWHModal = async (id) => {
  try {
    const data = await apiCall('/warehouses');
    if (data.success) {
      const wh = data.warehouses.find(w => w._id === id);
      if (wh) {
        document.getElementById('wh-modal-title').textContent = 'Edit Warehouse';
        document.getElementById('wh-id').value = wh._id;
        document.getElementById('wh-modal-name').value = wh.name;
        document.getElementById('wh-modal-code').value = wh.code;
        document.getElementById('wh-modal-address').value = wh.address;
        
        document.getElementById('wh-status-group').style.display = 'block';
        document.getElementById('wh-modal-status').value = wh.status;
        
        document.getElementById('wh-modal').classList.add('active');
      }
    }
  } catch (err) {}
};

const closeWHModal = () => {
  document.getElementById('wh-modal').classList.remove('active');
};

// Form submit
const handleWHSubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('wh-id').value;
  const name = document.getElementById('wh-modal-name').value;
  const code = document.getElementById('wh-modal-code').value;
  const address = document.getElementById('wh-modal-address').value;
  const status = document.getElementById('wh-modal-status').value;

  const url = id ? `/warehouses/${id}` : '/warehouses';
  const method = id ? 'PUT' : 'POST';
  const body = { name, code, address };
  if (id) body.status = status;

  try {
    const data = await apiCall(url, {
      method,
      body: JSON.stringify(body)
    });

    if (data.success) {
      showToast(id ? 'Warehouse updated successfully' : 'Warehouse created successfully', 'success');
      closeWHModal();
      fetchWarehouses();
    }
  } catch (err) {}
};

// Delete Warehouse
const handleDeleteWH = async (id) => {
  if (!confirm('Are you sure you want to remove this warehouse location? Stocks allocated to this location must be zero.')) return;

  try {
    const data = await apiCall(`/warehouses/${id}`, { method: 'DELETE' });
    if (data.success) {
      showToast(data.message, 'success');
      fetchWarehouses();
    }
  } catch (err) {}
};
