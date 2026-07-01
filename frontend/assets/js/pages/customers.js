/* ==========================================================================
   StockPilot Customers Client Page Controller
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchCustomersPage();
});

const fetchCustomersPage = async () => {
  try {
    const data = await apiCall('/customers');
    if (data.success) {
      renderCustomersTable(data.customers);
    }
  } catch (err) {}
};

const renderCustomersTable = (customers) => {
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;

  if (customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">No customer profiles created</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map(c => {
    return `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.company || 'N/A'}</td>
        <td style="font-family:var(--font-numbers); font-size:0.875rem;">${c.email || 'N/A'}</td>
        <td style="font-family:var(--font-numbers); font-size:0.875rem;">${c.phone || 'N/A'}</td>
        <td style="font-size:0.85rem; color:var(--text-secondary); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.address || 'N/A'}</td>
        <td style="font-family:var(--font-numbers); font-weight:600;">${c.orderCount} Orders</td>
        <td style="font-family:var(--font-numbers); font-weight:700; color:var(--success);">${formatCurrency(c.totalPurchased)}</td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" style="padding:6px 10px;" onclick="openEditCustModal('${c._id}')"><i data-lucide="edit" style="width:14px;"></i></button>
            <button class="btn btn-secondary" style="padding:6px 10px; color:var(--danger);" onclick="handleDeleteCust('${c._id}')"><i data-lucide="trash-2" style="width:14px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
};

// Modals
const openCustModal = () => {
  document.getElementById('cust-modal-title').textContent = 'Add Customer';
  document.getElementById('cust-id').value = '';
  document.getElementById('cust-form').reset();
  document.getElementById('cust-modal').classList.add('active');
};

const openEditCustModal = async (id) => {
  try {
    const data = await apiCall('/customers');
    if (data.success) {
      const c = data.customers.find(cust => cust._id === id);
      if (c) {
        document.getElementById('cust-modal-title').textContent = 'Edit Customer';
        document.getElementById('cust-id').value = c._id;
        document.getElementById('cust-modal-name').value = c.name;
        document.getElementById('cust-modal-company').value = c.company;
        document.getElementById('cust-modal-email').value = c.email;
        document.getElementById('cust-modal-phone').value = c.phone;
        document.getElementById('cust-modal-address').value = c.address;

        document.getElementById('cust-modal').classList.add('active');
      }
    }
  } catch (err) {}
};

const closeCustModal = () => {
  document.getElementById('cust-modal').classList.remove('active');
};

// Save customer
const handleCustSubmit = async (e) => {
  e.preventDefault();

  const id = document.getElementById('cust-id').value;
  const name = document.getElementById('cust-modal-name').value;
  const company = document.getElementById('cust-modal-company').value;
  const email = document.getElementById('cust-modal-email').value;
  const phone = document.getElementById('cust-modal-phone').value;
  const address = document.getElementById('cust-modal-address').value;

  const url = id ? `/customers/${id}` : '/customers';
  const method = id ? 'PUT' : 'POST';
  const body = { name, company, email, phone, address };

  try {
    const data = await apiCall(url, {
      method,
      body: JSON.stringify(body)
    });

    if (data.success) {
      showToast(id ? 'Customer updated successfully' : 'Customer added successfully', 'success');
      closeCustModal();
      fetchCustomersPage();
    }
  } catch (err) {}
};

// Delete Customer
const handleDeleteCust = async (id) => {
  if (!confirm('Are you sure you want to delete this customer? Invoices linking this customer will prevent deletion.')) return;
  try {
    const data = await apiCall(`/customers/${id}`, { method: 'DELETE' });
    if (data.success) {
      showToast(data.message, 'success');
      fetchCustomersPage();
    }
  } catch (err) {}
};
