/* ==========================================================================
   StockPilot Products Client Page Controller
   ========================================================================== */

checkAuth();

let currentPage = 1;
const limit = 10;
let categoriesList = [];
let suppliersList = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchCategories();
  fetchSuppliers();
  fetchProducts();

  // Export Trigger from shortcuts
  window.triggerProductModal = openCreateProductModal;
});

// 1. Fetch auxiliary selectors
const fetchCategories = async () => {
  try {
    const data = await apiCall('/categories');
    if (data.success) {
      categoriesList = data.categories;
      
      const filterCat = document.getElementById('filter-category');
      const modalCat = document.getElementById('prod-modal-category');

      if (filterCat) {
        filterCat.innerHTML = '<option value="">All Categories</option>' + 
          categoriesList.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
      }
      if (modalCat) {
        modalCat.innerHTML = categoriesList.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
      }
    }
  } catch (err) {}
};

const fetchSuppliers = async () => {
  try {
    const data = await apiCall('/suppliers');
    if (data.success) {
      suppliersList = data.suppliers;
      const modalSup = document.getElementById('prod-modal-supplier');
      if (modalSup) {
        modalSup.innerHTML = '<option value="">No Supplier</option>' + 
          suppliersList.map(s => `<option value="${s._id}">${s.name} (${s.company})</option>`).join('');
      }
    }
  } catch (err) {}
};

// 2. Fetch products grid
const fetchProducts = async () => {
  const search = document.getElementById('filter-search').value;
  const category = document.getElementById('filter-category').value;
  const stockStatus = document.getElementById('filter-stock-status').value;

  let query = `?page=${currentPage}&limit=${limit}`;
  if (search) query += `&search=${encodeURIComponent(search)}`;
  if (category) query += `&category=${category}`;
  if (stockStatus) query += `&stockStatus=${stockStatus}`;

  try {
    const data = await apiCall(`/products${query}`);
    if (data.success) {
      renderProductsTable(data.products);
      
      // Update pagination details
      document.getElementById('pagination-info').textContent = 
        `Showing ${data.products.length} of ${data.total} entries (Page ${data.page} of ${data.pages})`;
      
      document.getElementById('btn-prev').disabled = data.page === 1;
      document.getElementById('btn-next').disabled = data.page >= data.pages;
    }
  } catch (err) {}
};

// Render rows
const renderProductsTable = (products) => {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-secondary);">No products matching filters found</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const img = p.mainImage || 'https://images.unsplash.com/photo-1540747737956-37872404a82a?auto=format&fit=crop&w=80&q=80';
    const totalStock = p.totalStock !== undefined ? p.totalStock : 0;
    
    // Low stock class highlighting
    let stockColor = 'var(--text-primary)';
    let badgeText = 'Active';
    let badgeClass = 'badge-success';

    if (p.status === 'Archived') {
      badgeText = 'Archived';
      badgeClass = 'badge-danger';
    } else if (totalStock === 0) {
      stockColor = 'var(--danger)';
      badgeText = 'Out of Stock';
      badgeClass = 'badge-danger';
    } else if (totalStock <= p.minStock) {
      stockColor = 'var(--warning)';
      badgeText = 'Low Stock';
      badgeClass = 'badge-warning';
    }

    return `
      <tr>
        <td>
          <img src="${img}" alt="${p.name}" style="width:44px; height:44px; border-radius:6px; object-fit:cover; border:1px solid var(--border-color);" />
        </td>
        <td>
          <div style="font-weight:600;"><a href="/app/product-detail.html?id=${p._id}" style="color:var(--accent-color);">${p.name}</a></div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${p.barcode || 'No barcode'}</div>
        </td>
        <td style="font-family:var(--font-numbers); font-size:0.85rem;">${p.sku}</td>
        <td>${p.category ? p.category.name : 'Unassigned'}</td>
        <td style="font-family:var(--font-numbers);">${formatCurrency(p.purchasePrice)}</td>
        <td style="font-family:var(--font-numbers); font-weight:600;">${formatCurrency(p.sellingPrice)}</td>
        <td style="font-family:var(--font-numbers); font-weight:700; color:${stockColor};">${totalStock}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" style="padding:6px 10px;" onclick="openEditProductModal('${p._id}')" title="Edit"><i data-lucide="edit-3" style="width:14px;"></i></button>
            <button class="btn btn-secondary" style="padding:6px 10px; color:var(--danger);" onclick="handleDeleteProduct('${p._id}')" title="Delete"><i data-lucide="trash-2" style="width:14px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
};

// Filter triggers
const applyFilters = () => {
  currentPage = 1;
  fetchProducts();
};

const resetFilters = () => {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-stock-status').value = '';
  applyFilters();
};

const changePage = (direction) => {
  currentPage += direction;
  fetchProducts();
};

// 3. Modal Toggles
const openCreateProductModal = () => {
  document.getElementById('product-modal-title').textContent = 'Create New Product';
  document.getElementById('product-id').value = '';
  document.getElementById('product-form').reset();
  document.getElementById('product-modal').classList.add('active');
};

const openEditProductModal = async (id) => {
  try {
    const data = await apiCall(`/products/${id}`);
    if (data.success) {
      const p = data.product;
      document.getElementById('product-modal-title').textContent = 'Edit Product';
      document.getElementById('product-id').value = p._id;
      
      document.getElementById('prod-modal-name').value = p.name;
      document.getElementById('prod-modal-sku').value = p.sku;
      document.getElementById('prod-modal-barcode').value = p.barcode;
      document.getElementById('prod-modal-purchase').value = p.purchasePrice;
      document.getElementById('prod-modal-selling').value = p.sellingPrice;
      document.getElementById('prod-modal-category').value = p.category ? p.category._id : '';
      document.getElementById('prod-modal-supplier').value = p.supplierId ? p.supplierId._id : '';
      document.getElementById('prod-modal-min').value = p.minStock;
      document.getElementById('prod-modal-max').value = p.maxStock;
      document.getElementById('prod-modal-desc').value = p.description;

      document.getElementById('product-modal').classList.add('active');
    }
  } catch (err) {}
};

const closeProductModal = () => {
  document.getElementById('product-modal').classList.remove('active');
};

// Save Product
const handleProductSubmit = async (e) => {
  e.preventDefault();

  const id = document.getElementById('product-id').value;
  const name = document.getElementById('prod-modal-name').value;
  const sku = document.getElementById('prod-modal-sku').value;
  const barcode = document.getElementById('prod-modal-barcode').value;
  const purchasePrice = document.getElementById('prod-modal-purchase').value;
  const sellingPrice = document.getElementById('prod-modal-selling').value;
  const category = document.getElementById('prod-modal-category').value;
  const supplierId = document.getElementById('prod-modal-supplier').value;
  const minStock = document.getElementById('prod-modal-min').value;
  const maxStock = document.getElementById('prod-modal-max').value;
  const description = document.getElementById('prod-modal-desc').value;
  const imageInput = document.getElementById('prod-modal-image');

  // Multi-part Form Data for upload support
  const formData = new FormData();
  formData.append('name', name);
  formData.append('sku', sku);
  formData.append('barcode', barcode);
  formData.append('purchasePrice', purchasePrice);
  formData.append('sellingPrice', sellingPrice);
  formData.append('category', category);
  formData.append('supplierId', supplierId);
  formData.append('minStock', minStock);
  formData.append('maxStock', maxStock);
  formData.append('description', description);
  
  if (imageInput.files.length > 0) {
    formData.append('mainImage', imageInput.files[0]);
  }

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/products/${id}` : '/products';

  try {
    const res = await fetch(`/api${url}`, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('stockpilot_access_token')}`
      },
      body: formData
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(data.message, 'success');
    closeProductModal();
    fetchProducts();
  } catch (error) {
    showToast(error.message, 'danger');
  }
};

// Delete Product
const handleDeleteProduct = async (id) => {
  if (!confirm('Are you sure you want to delete this product? Invoices containing this item will be preserved, but it will be archived.')) return;

  try {
    const data = await apiCall(`/products/${id}`, { method: 'DELETE' });
    if (data.success) {
      showToast(data.message, 'success');
      fetchProducts();
    }
  } catch (err) {}
};

// 4. CSV Import/Export
const exportProductsCSV = async () => {
  try {
    const data = await apiCall('/products?limit=1000'); // Load bulk items
    if (data.success && data.products.length > 0) {
      let csv = 'SKU,Name,Barcode,Category,Purchase Cost,Selling Price,Stock Quantity\n';
      data.products.forEach(p => {
        csv += `"${p.sku}","${p.name.replace(/"/g, '""')}","${p.barcode}","${p.category ? p.category.name : ''}",${p.purchasePrice},${p.sellingPrice},${p.totalStock}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `stockpilot_inventory_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Inventory exported to CSV successfully', 'success');
    }
  } catch (err) {}
};

const triggerCSVImportModal = () => {
  document.getElementById('csv-file-input').value = '';
  document.getElementById('csv-modal').classList.add('active');
};

const closeCSVModal = () => {
  document.getElementById('csv-modal').classList.remove('active');
};

const handleCSVImportSubmit = async () => {
  const fileInput = document.getElementById('csv-file-input');
  if (fileInput.files.length === 0) {
    showToast('Please select a CSV file first', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const parsedProducts = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      const item = {};
      headers.forEach((h, idx) => {
        item[h] = values[idx];
      });
      
      parsedProducts.push({
        sku: item.SKU || item.sku,
        name: item.Name || item.name,
        barcode: item.Barcode || item.barcode || '',
        purchasePrice: parseFloat(item['Purchase Cost'] || item.purchasePrice || 0),
        sellingPrice: parseFloat(item['Selling Price'] || item.sellingPrice || 0),
        minStock: parseInt(item['Min Stock'] || item.minStock || 5),
        maxStock: parseInt(item['Max Stock'] || item.maxStock || 100)
      });
    }

    try {
      const data = await apiCall('/products/import', {
        method: 'POST',
        body: JSON.stringify({ products: parsedProducts })
      });

      if (data.success) {
        showToast(data.message, 'success');
        closeCSVModal();
        fetchProducts();
      }
    } catch (err) {}
  };

  reader.readAsText(file);
};
