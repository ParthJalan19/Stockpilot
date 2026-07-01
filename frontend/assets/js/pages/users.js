/* ==========================================================================
   StockPilot Users & RBAC Client Controller
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchUsers();
});

const fetchUsers = async () => {
  try {
    const data = await apiCall('/users');
    if (data.success) {
      renderUsersTable(data.users);
    }
  } catch (err) {}
};

const renderUsersTable = (users) => {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No users registered</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const permCount = u.role === 'Super Admin' ? 'All (Root admin)' : (u.permissions ? u.permissions.length : 0);
    const avatar = u.profilePic || '/assets/uploads/default-avatar.png';

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-weight:600; color:var(--text-primary);">${u.name}</div>
          </div>
        </td>
        <td style="font-family:var(--font-numbers); font-size:0.875rem;">${u.email}</td>
        <td><span class="badge ${u.role === 'Super Admin' ? 'badge-danger' : (u.role === 'Admin' ? 'badge-success' : 'badge-warning')}">${u.role}</span></td>
        <td style="font-family:var(--font-numbers);">${permCount}</td>
        <td>
          <div style="display:flex; gap:8px;">
            ${u.role !== 'Super Admin' ? `
              <button class="btn btn-secondary" style="padding:6px 10px;" onclick="openEditUserModal('${u._id}')"><i data-lucide="edit" style="width:14px;"></i></button>
              <button class="btn btn-secondary" style="padding:6px 10px; color:var(--danger);" onclick="handleDeleteUser('${u._id}')"><i data-lucide="trash-2" style="width:14px;"></i></button>
            ` : '<span style="font-size:0.75rem; color:var(--text-tertiary);">Owner locked</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
};

// Modal toggles
const openUserModal = () => {
  document.getElementById('user-modal-title').textContent = 'Invite User';
  document.getElementById('user-id').value = '';
  document.getElementById('user-form').reset();
  document.getElementById('usr-password-group').style.display = 'block';
  document.getElementById('usr-modal-pass').required = true;
  
  // Clean checkboxes
  document.querySelectorAll('.perm-checkbox').forEach(cb => cb.checked = false);
  
  document.getElementById('user-modal').classList.add('active');
};

const openEditUserModal = async (id) => {
  try {
    const data = await apiCall('/users');
    if (data.success) {
      const u = data.users.find(usr => usr._id === id);
      if (u) {
        document.getElementById('user-modal-title').textContent = 'Edit User Permissions';
        document.getElementById('user-id').value = u._id;
        document.getElementById('usr-modal-name').value = u.name;
        document.getElementById('usr-modal-email').value = u.email;
        
        // Hide password field for edits
        document.getElementById('usr-password-group').style.display = 'none';
        document.getElementById('usr-modal-pass').required = false;

        document.getElementById('usr-modal-role').value = u.role;
        
        // Map permissions checkboxes
        document.querySelectorAll('.perm-checkbox').forEach(cb => {
          cb.checked = u.permissions && u.permissions.includes(cb.value);
        });

        document.getElementById('user-modal').classList.add('active');
      }
    }
  } catch (err) {}
};

const closeUserModal = () => {
  document.getElementById('user-modal').classList.remove('active');
};

// Auto checkboxes checker on role change
const toggleRolePermissionCheckboxes = () => {
  const role = document.getElementById('usr-modal-role').value;
  document.querySelectorAll('.perm-checkbox').forEach(cb => {
    if (role === 'Admin') cb.checked = true;
    else if (role === 'Manager') {
      cb.checked = ['can_edit_products', 'can_create_sales', 'can_approve_purchase'].includes(cb.value);
    } else {
      // Employee
      cb.checked = ['can_create_sales'].includes(cb.value);
    }
  });
};

// Form submit
const handleUserSubmit = async (e) => {
  e.preventDefault();

  const id = document.getElementById('user-id').value;
  const name = document.getElementById('usr-modal-name').value;
  const email = document.getElementById('usr-modal-email').value;
  const password = document.getElementById('usr-modal-pass').value;
  const role = document.getElementById('usr-modal-role').value;

  const permissions = [];
  document.querySelectorAll('.perm-checkbox').forEach(cb => {
    if (cb.checked) permissions.push(cb.value);
  });

  const url = id ? `/users/${id}` : '/users';
  const method = id ? 'PUT' : 'POST';
  const body = { name, email, role, permissions };
  if (!id) body.password = password;

  try {
    const data = await apiCall(url, {
      method,
      body: JSON.stringify(body)
    });

    if (data.success) {
      showToast(id ? 'User updated successfully' : 'User invited successfully', 'success');
      closeUserModal();
      fetchUsers();
    }
  } catch (err) {}
};

// Delete user
const handleDeleteUser = async (id) => {
  if (!confirm('Are you sure you want to remove this user from the organization?')) return;
  try {
    const data = await apiCall(`/users/${id}`, { method: 'DELETE' });
    if (data.success) {
      showToast(data.message, 'success');
      fetchUsers();
    }
  } catch (err) {}
};
