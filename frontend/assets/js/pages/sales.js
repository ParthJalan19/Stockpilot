/* ==========================================================================
   StockPilot Sales & Invoicing Client Controller
   ========================================================================== */

checkAuth();

let customersList = [];
let warehousesList = [];
let productsList = [];
let orgTaxRate = 18;

document.addEventListener('DOMContentLoaded', () => {
  fetchSales();
  fetchSelectorData();
});

// Load invoices
const fetchSales = async () => {
  try {
    const data = await apiCall('/sales');
    if (data.success) {
      renderSalesTable(data.sales);
    }
  } catch (err) {}
};

// Load selectors
const fetchSelectorData = async () => {
  try {
    const cData = await apiCall('/customers');
    const wData = await apiCall('/warehouses');
    const pData = await apiCall('/products?limit=1000');
    const sData = await apiCall('/settings');

    if (cData.success) {
      customersList = cData.customers;
      document.getElementById('inv-modal-customer').innerHTML = 
        customersList.map(c => `<option value="${c._id}">${c.name} (${c.company})</option>`).join('');
    }
    if (wData.success) {
      warehousesList = wData.warehouses;
      document.getElementById('inv-modal-warehouse').innerHTML = 
        warehousesList.map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('');
    }
    if (pData.success) {
      productsList = pData.products;
    }
    if (sData.success && sData.settings) {
      orgTaxRate = sData.settings.taxRate;
      document.getElementById('inv-modal-tax-rate').textContent = `${orgTaxRate}%`;
    }
  } catch (err) {}
};

// Render rows
const renderSalesTable = (sales) => {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;

  if (sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-secondary);">No sales invoices generated in this organization</td></tr>';
    return;
  }

  tbody.innerHTML = sales.map(s => {
    const custName = s.customerId ? s.customerId.name : 'Walk-in Customer';
    const whName = s.warehouseId ? s.warehouseId.name : 'Main Warehouse';
    
    // Subtotal calculation from items
    const subtotal = s.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    const isPaid = s.paymentStatus === 'Paid';
    const isCompleted = s.deliveryStatus === 'Completed' || s.deliveryStatus === 'Delivered';

    return `
      <tr>
        <td style="font-family:var(--font-numbers); font-weight:700; color:var(--accent-color);">${s.invoiceNumber}</td>
        <td><strong>${custName}</strong></td>
        <td>${whName}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(subtotal)}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(s.tax)}</td>
        <td style="font-family:var(--font-numbers); font-weight:700;">${formatCurrency(s.total)}</td>
        <td>
          <select class="form-control" style="padding:4px 8px; width:110px; font-size:0.8rem; border-color:${isPaid ? 'var(--success)' : 'var(--warning)'};" onchange="handleUpdateStatus('${s._id}', this.value, null)">
            <option value="Draft" ${s.paymentStatus === 'Draft' ? 'selected' : ''}>Draft</option>
            <option value="Pending" ${s.paymentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Paid" ${s.paymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
          </select>
        </td>
        <td>
          <select class="form-control" style="padding:4px 8px; width:110px; font-size:0.8rem; border-color:${isCompleted ? 'var(--success)' : 'var(--warning)'};" onchange="handleUpdateStatus('${s._id}', null, this.value)">
            <option value="Pending" ${s.deliveryStatus === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Delivered" ${s.deliveryStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Completed" ${s.deliveryStatus === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </td>
        <td>
          <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="handlePrintInvoice('${s._id}')"><i data-lucide="printer" style="width:14px;"></i> Print</button>
        </td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
};

// Open creation modals
const openInvoiceModal = () => {
  document.getElementById('inv-items-container').innerHTML = '';
  document.getElementById('invoice-form').reset();
  addInvoiceItemRow(); // Default first line item
  document.getElementById('invoice-modal').classList.add('active');
};

const closeInvoiceModal = () => {
  document.getElementById('invoice-modal').classList.remove('active');
};

// Add lines row to modals
const addInvoiceItemRow = () => {
  const container = document.getElementById('inv-items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'inv-item-row';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '2fr 1fr 1fr auto';
  row.style.gap = '12px';
  row.style.alignItems = 'center';

  row.innerHTML = `
    <select class="form-control item-product" onchange="handleProductSelectChange(this)" required>
      <option value="">Choose item...</option>
      ${productsList.map(p => `<option value="${p._id}" data-price="${p.sellingPrice}">${p.name} (${p.sku})</option>`).join('')}
    </select>
    <input type="number" class="form-control item-price" placeholder="Cost" min="0" step="0.01" oninput="calculateInvoiceTotals()" required />
    <input type="number" class="form-control item-qty" placeholder="Qty" value="1" min="1" oninput="calculateInvoiceTotals()" required />
    <button type="button" style="background:none; border:none; color:var(--danger); cursor:pointer;" onclick="this.parentElement.remove(); calculateInvoiceTotals();"><i data-lucide="trash" style="width:16px;"></i></button>
  `;
  container.appendChild(row);
  lucide.createIcons();
};

// Sync price input field when selection switches
const handleProductSelectChange = (selectEl) => {
  const option = selectEl.options[selectEl.selectedIndex];
  const price = option.getAttribute('data-price');
  
  const row = selectEl.parentElement;
  const priceInput = row.querySelector('.item-price');
  
  if (priceInput && price) {
    priceInput.value = price;
  }
  calculateInvoiceTotals();
};

// Compute dynamic totals on modal inputs
const calculateInvoiceTotals = () => {
  const rows = document.querySelectorAll('.inv-item-row');
  let subtotal = 0;
  
  rows.forEach(row => {
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const qty = parseInt(row.querySelector('.item-qty').value) || 0;
    subtotal += price * qty;
  });

  const discount = parseFloat(document.getElementById('inv-modal-discount').value) || 0;
  const taxAmount = ((subtotal - discount) * orgTaxRate) / 100;
  const grandTotal = subtotal - discount + taxAmount;

  document.getElementById('inv-modal-total-display').textContent = formatCurrency(grandTotal);
};

// Form submit
const handleInvoiceSubmit = async (e) => {
  e.preventDefault();

  const customerId = document.getElementById('inv-modal-customer').value;
  const warehouseId = document.getElementById('inv-modal-warehouse').value;
  const paymentStatus = document.getElementById('inv-modal-payment').value;
  const deliveryStatus = document.getElementById('inv-modal-delivery').value;
  const discount = document.getElementById('inv-modal-discount').value;

  const rows = document.querySelectorAll('.inv-item-row');
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
    const data = await apiCall('/sales', {
      method: 'POST',
      body: JSON.stringify({ customerId, warehouseId, paymentStatus, deliveryStatus, discount, items })
    });

    if (data.success) {
      showToast('Sale invoice created successfully', 'success');
      closeInvoiceModal();
      fetchSales();
    }
  } catch (err) {}
};

// Change payment status inline
const handleUpdateStatus = async (id, paymentStatus, deliveryStatus) => {
  const body = {};
  if (paymentStatus) body.paymentStatus = paymentStatus;
  if (deliveryStatus) body.deliveryStatus = deliveryStatus;

  try {
    const data = await apiCall(`/sales/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    if (data.success) {
      showToast('Status updated successfully', 'success');
      fetchSales();
    }
  } catch (err) {}
};

// Print Invoice Receipt PDF
const handlePrintInvoice = async (id) => {
  try {
    const data = await apiCall('/sales');
    if (data.success) {
      const sale = data.sales.find(s => s._id === id);
      const settingsData = await apiCall('/settings');
      
      if (!sale) return;

      const org = settingsData.settings;
      
      // Update printable template
      document.getElementById('print-inv-company').textContent = org ? org.name : 'StockPilot SaaS';
      document.getElementById('print-inv-company-addr').textContent = org ? org.address : 'HQ Distribution Office';
      document.getElementById('print-inv-number').textContent = sale.invoiceNumber;
      
      const c = sale.customerId;
      document.getElementById('print-inv-cust-name').textContent = c ? c.name : 'Walk-in Customer';
      document.getElementById('print-inv-cust-addr').textContent = c ? (c.address || c.company) : 'N/A';
      
      document.getElementById('print-inv-date').textContent = new Date(sale.createdAt).toLocaleDateString();
      document.getElementById('print-inv-warehouse').textContent = sale.warehouseId ? sale.warehouseId.name : 'Default WH-A';

      // Load products rows
      const tbody = document.getElementById('print-inv-tbody');
      let subtotal = 0;
      
      tbody.innerHTML = sale.items.map(item => {
        const p = item.productId;
        const lineTotal = item.quantity * item.price;
        subtotal += lineTotal;
        return `
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:10px;">${p ? p.name : 'Unknown Product'}</td>
            <td style="padding:10px; font-family:monospace;">${p ? p.sku : 'N/A'}</td>
            <td style="padding:10px; text-align:right;">${formatCurrency(item.price)}</td>
            <td style="padding:10px; text-align:right;">${item.quantity}</td>
            <td style="padding:10px; text-align:right;">${formatCurrency(lineTotal)}</td>
          </tr>
        `;
      }).join('');

      document.getElementById('print-inv-tax').textContent = formatCurrency(sale.tax);
      document.getElementById('print-inv-discount').textContent = formatCurrency(sale.discount);
      document.getElementById('print-inv-grandtotal').textContent = formatCurrency(sale.total);

      // Perform Printing
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = `
        <div style="padding:40px; background:white; min-height:100vh;">
          ${document.getElementById('print-invoice-template').outerHTML}
        </div>
      `;
      document.getElementById('print-invoice-template').style.display = 'block';
      
      window.print();
      window.location.reload();
    }
  } catch (err) {}
};
