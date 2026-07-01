/* ==========================================================================
   StockPilot Product Details Page Controller
   ========================================================================== */

checkAuth();

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

if (!productId) {
  window.location.href = '/app/products.html';
}

document.addEventListener('DOMContentLoaded', () => {
  fetchProductDetails();
});

// Switch between tabs
const switchTab = (tabName) => {
  // Hide all panes
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  
  // Clear active tab button styling
  document.querySelectorAll('[id^="tab-"][id$="-btn"]').forEach(btn => {
    btn.style.color = 'var(--text-secondary)';
  });

  // Display selected pane
  document.getElementById('tab-' + tabName).style.display = 'block';
  
  // Highlight active tab button
  document.getElementById('tab-' + tabName + '-btn').style.color = 'var(--accent-color)';
};

// Fetch product details API
const fetchProductDetails = async () => {
  try {
    const data = await apiCall(`/products/${productId}`);
    if (data.success) {
      const p = data.product;
      
      // Update header details
      document.getElementById('detail-name').textContent = p.name;
      document.getElementById('detail-sku').textContent = p.sku;
      document.getElementById('detail-barcode').textContent = p.barcode || 'None';
      
      const img = p.mainImage || 'https://images.unsplash.com/photo-1540747737956-37872404a82a?auto=format&fit=crop&w=150&q=80';
      document.getElementById('detail-image').src = img;

      const statusEl = document.getElementById('detail-status');
      statusEl.textContent = p.status;
      statusEl.className = `badge ${p.status === 'Active' ? 'badge-success' : 'badge-danger'}`;

      // Update overview tab
      document.getElementById('detail-desc').textContent = p.description || 'No description provided for this product.';
      
      // Render variants list
      renderVariants(p.variants);

      // Render barcode label
      document.getElementById('barcode-label').textContent = p.barcode || p.sku;
      generateBarcodeLines(p.barcode || p.sku);
      generateQRCode(p._id);

      // Render warehouse stock distribution
      renderStockDistribution(data.warehouseStocks);

      // Render history ledgers
      renderMovements(data.movements);
      renderSales(data.sales);
      renderPurchases(data.purchases);
      
      // Populate printable tags
      document.getElementById('print-product-name').textContent = p.name;
      document.getElementById('print-barcode-block').textContent = p.barcode || p.sku;
      document.getElementById('print-sku').textContent = `SKU: ${p.sku}`;
      document.getElementById('print-price').textContent = formatCurrency(p.sellingPrice);
    }
  } catch (err) {}
};

// Render Product Variants specs
const renderVariants = (variants) => {
  const container = document.getElementById('detail-variants-list');
  if (!container) return;

  if (!variants || variants.length === 0) {
    container.innerHTML = '<div style="font-size:0.9rem; color:var(--text-tertiary);">No product variants specified</div>';
    return;
  }

  container.innerHTML = variants.map(v => {
    let spec = [];
    if (v.color) spec.push(`Color: ${v.color}`);
    if (v.size) spec.push(`Size: ${v.size}`);
    if (v.storage) spec.push(`Storage: ${v.storage}`);
    if (v.ram) spec.push(`RAM: ${v.ram}`);
    if (v.weight) spec.push(`Weight: ${v.weight}`);

    return `
      <div style="padding:10px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-color); background:var(--bg-tertiary); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="font-size:0.9rem; color:var(--text-primary); font-family:var(--font-numbers);">${v.skuSuffix}</strong>
          <span style="font-size:0.8rem; color:var(--text-secondary); margin-left:12px;">(${spec.join(', ')})</span>
        </div>
        <span style="font-size:0.85rem; font-weight:600; color:var(--success);">+${formatCurrency(v.additionalPrice)}</span>
      </div>
    `;
  }).join('');
};

// Render warehouse table rows
const renderStockDistribution = (stocks) => {
  const tbody = document.getElementById('detail-stock-tbody');
  if (!tbody) return;

  if (!stocks || stocks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary);">Product has not been allocated to any warehouse warehouses yet. Initiate PO to stock items.</td></tr>';
    return;
  }

  tbody.innerHTML = stocks.map(s => {
    const wh = s.warehouseId;
    const qty = s.quantity;
    const reserved = s.reservedQuantity || 0;
    const available = qty - reserved;

    return `
      <tr>
        <td style="font-weight:600; color:var(--text-primary);">${wh ? wh.name : 'Unknown'}</td>
        <td style="font-family:var(--font-numbers);">${wh ? wh.code : 'N/A'}</td>
        <td style="font-family:var(--font-numbers); font-weight:600; color:var(--success);">${available}</td>
        <td style="font-family:var(--font-numbers); color:var(--warning);">${reserved}</td>
        <td style="font-family:var(--font-numbers); font-weight:700;">${qty}</td>
      </tr>
    `;
  }).join('');
};

// Render movements history
const renderMovements = (movements) => {
  const tbody = document.getElementById('detail-movements-tbody');
  if (!tbody) return;

  if (!movements || movements.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-tertiary);">No stock movement ledger records found</td></tr>';
    return;
  }

  tbody.innerHTML = movements.map(m => {
    const date = new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const change = m.newQty - m.oldQty;
    const changeColor = change > 0 ? 'var(--success)' : 'var(--danger)';
    const changeText = change > 0 ? `+${change}` : change;

    return `
      <tr>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${date}</td>
        <td>Warehouse</td>
        <td style="font-family:var(--font-numbers);">${m.oldQty}</td>
        <td style="font-family:var(--font-numbers);">${m.newQty}</td>
        <td style="font-family:var(--font-numbers); font-weight:700; color:${changeColor};">${changeText}</td>
        <td style="font-size:0.85rem;">${m.reason || m.type}</td>
        <td>${m.updatedBy ? m.updatedBy.name : 'System'}</td>
      </tr>
    `;
  }).join('');
};

// Render Sales histories
const renderSales = (sales) => {
  const tbody = document.getElementById('detail-sales-tbody');
  if (!tbody) return;

  if (!sales || sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No sales transactions logged containing this item</td></tr>';
    return;
  }

  tbody.innerHTML = sales.map(s => {
    const date = new Date(s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    // Find item matching product ID in the sale invoice
    const item = s.items.find(i => i.productId === productId || (i.productId && i.productId._id === productId));
    const qty = item ? item.quantity : 0;
    const price = item ? item.price : 0;

    return `
      <tr>
        <td style="font-weight:600;"><a href="/app/sales.html?invoice=${s.invoiceNumber}" style="color:var(--accent-color);">${s.invoiceNumber}</a></td>
        <td>${s.customerId ? s.customerId.name : 'Walk-in Customer'}</td>
        <td style="font-family:var(--font-numbers);">${qty}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(price)}</td>
        <td><span class="badge ${s.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}">${s.paymentStatus}</span></td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${date}</td>
      </tr>
    `;
  }).join('');
};

// Render Purchases POs
const renderPurchases = (purchases) => {
  const tbody = document.getElementById('detail-purchases-tbody');
  if (!tbody) return;

  if (!purchases || purchases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No purchase order receipts logged containing this item</td></tr>';
    return;
  }

  tbody.innerHTML = purchases.map(p => {
    const date = new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    const item = p.items.find(i => i.productId === productId || (i.productId && i.productId._id === productId));
    const qty = item ? item.quantity : 0;
    const cost = item ? item.price : 0;

    return `
      <tr>
        <td style="font-weight:600;"><a href="/app/purchase-orders.html?po=${p.poNumber}" style="color:var(--accent-color);">${p.poNumber}</a></td>
        <td>${p.supplierId ? p.supplierId.name : 'Unknown'}</td>
        <td style="font-family:var(--font-numbers);">${qty}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(cost)}</td>
        <td><span class="badge ${p.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${date}</td>
      </tr>
    `;
  }).join('');
};

// Generate standard Code-128 barcode simulation lines on screen
const generateBarcodeLines = (text) => {
  const display = document.getElementById('barcode-display');
  if (!display) return;
  
  // Set simple random barcode lines look in HTML instead of heavy libraries
  let lines = '';
  for (let i = 0; i < text.length * 2; i++) {
    const width = Math.random() > 0.4 ? '2px' : '4px';
    const margin = Math.random() > 0.5 ? '1px' : '2px';
    lines += `<div style="width:${width}; height:40px; background:black; display:inline-block; margin-right:${margin};"></div>`;
  }
  display.innerHTML = `<div style="display:flex; justify-content:center; align-items:center;">${lines}</div>`;
};

// Generate QR Code simulation canvas
const generateQRCode = (prodId) => {
  const qrcodeBox = document.getElementById('qrcode-display');
  if (!qrcodeBox) return;

  // We can draw a clean, simulated QR code canvas block inside the element
  qrcodeBox.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 120, 120);

  ctx.fillStyle = '#111827';
  
  // Draw corners (QR Anchors)
  const drawAnchor = (x, y) => {
    ctx.fillRect(x, y, 25, 25);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, y + 4, 17, 17);
    ctx.fillStyle = '#111827';
    ctx.fillRect(x + 8, y + 8, 9, 9);
  };
  
  drawAnchor(5, 5); // Top-left
  drawAnchor(90, 5); // Top-right
  drawAnchor(5, 90); // Bottom-left

  // Random pixel grid matching a real QR
  for (let r = 30; r < 90; r += 5) {
    for (let c = 5; c < 115; c += 5) {
      if (Math.random() > 0.4) {
        ctx.fillRect(c, r, 4, 4);
      }
    }
  }

  // Bottom right random pixels
  for (let r = 90; r < 115; r += 5) {
    for (let c = 30; c < 115; c += 5) {
      if (Math.random() > 0.4) {
        ctx.fillRect(c, r, 4, 4);
      }
    }
  }

  qrcodeBox.appendChild(canvas);
};

// Print Barcode Label
const printLabel = () => {
  const template = document.getElementById('print-label-template');
  if (!template) return;

  const originalContent = document.body.innerHTML;
  
  document.body.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:white;">
      ${template.outerHTML}
    </div>
  `;
  document.getElementById('print-label-template').style.display = 'flex';
  
  window.print();
  
  // Reload page to restore
  window.location.reload();
};
