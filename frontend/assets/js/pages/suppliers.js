/* ==========================================================================
   StockPilot Suppliers Client Page Controller
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchSuppliersPage();
});

const fetchSuppliersPage = async () => {
  try {
    const data = await apiCall('/suppliers');
    if (data.success) {
      renderSuppliersTable(data.suppliers);
    }
  } catch (err) {}
};

const renderSuppliersTable = (suppliers) => {
  const tbody = document.getElementById('suppliers-tbody');
  if (!tbody) return;

  if (suppliers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">No suppliers created</td></tr>';
    return;
  }

  tbody.innerHTML = suppliers.map(s => {
    // Generate stars for rating
    const stars = '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating);
    const starColor = s.rating >= 4 ? 'var(--warning)' : 'var(--text-tertiary)';

    return `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.company || 'N/A'}</td>
        <td style="font-family:var(--font-numbers); font-size:0.875rem;">${s.email || 'N/A'}</td>
        <td style="font-family:var(--font-numbers); font-size:0.875rem;">${s.phone || 'N/A'}</td>
        <td style="font-family:var(--font-numbers);">${s.gstNumber || 'N/A'}</td>
        <td style="font-family:var(--font-numbers); font-weight:600;">${s.productCount} SKUs</td>
        <td style="color:${starColor}; font-size:1.1rem;">${stars}</td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" style="padding:6px 10px;" onclick="openEditSupModal('${s._id}')"><i data-lucide="edit" style="width:14px;"></i></button>
            <button class="btn btn-secondary" style="padding:6px 10px; color:var(--danger);" onclick="handleDeleteSup('${s._id}')"><i data-lucide="trash-2" style="width:14px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
};

// Modal toggles
const openSupModal = () => {
  document.getElementById('sup-modal-title').textContent = 'Add Supplier';
  document.getElementById('sup-id').value = '';
  document.getElementById('sup-form').reset();
  document.getElementById('sup-modal').classList.add('active');
};

const openEditSupModal = async (id) => {
  try {
    const data = await apiCall('/suppliers');
    if (data.success) {
      const s = data.suppliers.find(sup => sup._id === id);
      if (s) {
        document.getElementById('sup-modal-title').textContent = 'Edit Supplier';
        document.getElementById('sup-id').value = s._id;
        document.getElementById('sup-modal-name').value = s.name;
        document.getElementById('sup-modal-company').value = s.company;
        document.getElementById('sup-modal-email').value = s.email;
        document.getElementById('sup-modal-phone').value = s.phone;
        document.getElementById('sup-modal-gst').value = s.gstNumber;
        document.getElementById('sup-modal-rating').value = s.rating;
        document.getElementById('sup-modal-address').value = s.address;

        document.getElementById('sup-modal').classList.add('active');
      }
    }
  } catch (err) {}
};

const closeSupModal = () => {
  document.getElementById('sup-modal').classList.remove('active');
};

// Form submit
const handleSupSubmit = async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('sup-id').value;
  const name = document.getElementById('sup-modal-name').value;
  const company = document.getElementById('sup-modal-company').value;
  const email = document.getElementById('sup-modal-email').value;
  const phone = document.getElementById('sup-modal-phone').value;
  const gstNumber = document.getElementById('sup-modal-gst').value;
  const rating = document.getElementById('sup-modal-rating').value;
  const address = document.getElementById('sup-modal-address').value;

  const url = id ? `/suppliers/${id}` : '/suppliers';
  const method = id ? 'PUT' : 'POST';
  const body = { name, company, email, phone, gstNumber, rating, address };

  try {
    const data = await apiCall(url, {
      method,
      body: JSON.stringify(body)
    });

    if (data.success) {
      showToast(id ? 'Supplier updated successfully' : 'Supplier added successfully', 'success');
      closeSupModal();
      fetchSuppliersPage();
    }
  } catch (err) {}
};

// Delete Supplier
const handleDeleteSup = async (id) => {
  if (!confirm('Are you sure you want to delete this supplier? Products referencing this supplier will be set to no supplier.')) return;
  try {
    const data = await apiCall(`/suppliers/${id}`, { method: 'DELETE' });
    if (data.success) {
      showToast(data.message, 'success');
      fetchSuppliersPage();
    }
  } catch (err) {}
};
