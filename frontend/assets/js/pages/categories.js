/* ==========================================================================
   StockPilot Categories Client Page Controller
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchCategoriesPage();
});

const fetchCategoriesPage = async () => {
  try {
    const data = await apiCall('/categories');
    if (data.success) {
      renderCategoriesGrid(data.categories);
    }
  } catch (err) {}
};

const renderCategoriesGrid = (categories) => {
  const container = document.getElementById('categories-grid');
  if (!container) return;

  if (categories.length === 0) {
    container.innerHTML = '<div class="premium-card" style="grid-column:1/-1; text-align:center; color:var(--text-secondary);">No categories created. Click Add Category to establish classification labels.</div>';
    return;
  }

  container.innerHTML = categories.map(cat => {
    return `
      <div class="premium-card" style="display:flex; flex-direction:column; justify-content:space-between; gap:20px;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-weight:700; font-size:1.15rem; color:var(--text-primary);">${cat.name}</div>
            <span class="badge ${cat.status === 'Active' ? 'badge-success' : 'badge-danger'}">${cat.status}</span>
          </div>
          <p style="font-size:0.875rem; color:var(--text-secondary); line-height:1.6; min-height:48px; margin-bottom:15px;">
            ${cat.description || 'No description summary added.'}
          </p>
          
          <div style="display:flex; align-items:center; gap:8px; font-size:0.875rem; color:var(--text-secondary);">
            <i data-lucide="tag" style="width:14px; color:var(--text-tertiary);"></i>
            <span>Active Listings: <strong style="color:var(--text-primary); font-family:var(--font-numbers);">${cat.productCount}</strong> items</span>
          </div>
        </div>

        <div style="display:flex; gap:10px; border-top:1px solid var(--border-color); padding-top:15px; margin-top:10px;">
          <button class="btn btn-secondary" style="flex:1; padding:8px;" onclick="openEditCatModal('${cat._id}')"><i data-lucide="edit-2" style="width:14px;"></i> Edit</button>
          <button class="btn btn-secondary" style="color:var(--danger); padding:8px;" onclick="handleDeleteCat('${cat._id}')" title="Delete"><i data-lucide="trash-2" style="width:14px;"></i></button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
};

// Modals
const openCatModal = () => {
  document.getElementById('cat-modal-title').textContent = 'Create Category';
  document.getElementById('cat-id').value = '';
  document.getElementById('cat-form').reset();
  document.getElementById('cat-status-group').style.display = 'none';
  document.getElementById('cat-modal').classList.add('active');
};

const openEditCatModal = async (id) => {
  try {
    const data = await apiCall('/categories');
    if (data.success) {
      const cat = data.categories.find(c => c._id === id);
      if (cat) {
        document.getElementById('cat-modal-title').textContent = 'Edit Category';
        document.getElementById('cat-id').value = cat._id;
        document.getElementById('cat-modal-name').value = cat.name;
        document.getElementById('cat-modal-desc').value = cat.description;
        
        document.getElementById('cat-status-group').style.display = 'block';
        document.getElementById('cat-modal-status').value = cat.status;
        
        document.getElementById('cat-modal').classList.add('active');
      }
    }
  } catch (err) {}
};

const closeCatModal = () => {
  document.getElementById('cat-modal').classList.remove('active');
};

const handleCatSubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('cat-id').value;
  const name = document.getElementById('cat-modal-name').value;
  const description = document.getElementById('cat-modal-desc').value;
  const status = document.getElementById('cat-modal-status').value;

  const url = id ? `/categories/${id}` : '/categories';
  const method = id ? 'PUT' : 'POST';
  const body = { name, description };
  if (id) body.status = status;

  try {
    const data = await apiCall(url, {
      method,
      body: JSON.stringify(body)
    });

    if (data.success) {
      showToast(id ? 'Category updated successfully' : 'Category created successfully', 'success');
      closeCatModal();
      fetchCategoriesPage();
    }
  } catch (err) {}
};

const handleDeleteCat = async (id) => {
  if (!confirm('Are you sure you want to delete this category? Products inside this category will be automatically reallocated to the default General category.')) return;

  try {
    const data = await apiCall(`/categories/${id}`, { method: 'DELETE' });
    if (data.success) {
      showToast(data.message, 'success');
      fetchCategoriesPage();
    }
  } catch (err) {}
};
