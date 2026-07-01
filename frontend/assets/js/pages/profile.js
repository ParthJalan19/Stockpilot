/* ==========================================================================
   StockPilot Profile Client Page Controller
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchUserProfile();
});

const fetchUserProfile = async () => {
  try {
    const data = await apiCall('/auth/profile');
    if (data.success && data.user) {
      const u = data.user;
      document.getElementById('prof-modal-name').value = u.name;
      document.getElementById('prof-modal-email').value = u.email;

      renderLoginHistory(u.loginHistory);
    }
  } catch (err) {}
};

// Render login log entries
const renderLoginHistory = (history) => {
  const container = document.getElementById('profile-sessions-list');
  if (!container) return;

  if (!history || history.length === 0) {
    container.innerHTML = '<div style="font-size:0.85rem; color:var(--text-tertiary); text-align:center;">No sessions logged</div>';
    return;
  }

  container.innerHTML = history.map((session, idx) => {
    const date = new Date(session.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    // Parse device from agent string
    let dev = 'Desktop Computer';
    if (session.device.includes('Mobi') || session.device.includes('iPhone') || session.device.includes('Android')) {
      dev = 'Mobile SmartPhone';
    }

    return `
      <div style="padding:12px; border-radius:var(--radius-sm); background:var(--bg-tertiary); display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:600; font-size:0.85rem; color:var(--text-primary);">${dev}</span>
          ${idx === 0 ? '<span class="badge badge-success" style="font-size:0.65rem;">Active</span>' : ''}
        </div>
        <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; justify-content:space-between;">
          <span>IP: ${session.ip || 'Localhost'}</span>
          <span>${date}</span>
        </div>
      </div>
    `;
  }).join('');
};

// Form submits
const handleProfileSubmit = async (e) => {
  e.preventDefault();

  const name = document.getElementById('prof-modal-name').value;
  const imageInput = document.getElementById('prof-modal-image');

  const formData = new FormData();
  formData.append('name', name);
  if (imageInput.files.length > 0) {
    formData.append('profilePic', imageInput.files[0]);
  }

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('stockpilot_access_token')}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Profile details updated successfully', 'success');
    
    // Refresh avatar on navbar
    const avatarEl = document.querySelector('.profile-avatar');
    if (avatarEl && data.user.profilePic) avatarEl.src = data.user.profilePic;

    fetchUserProfile();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

const handlePasswordSubmit = async (e) => {
  e.preventDefault();
  const oldPassword = document.getElementById('prof-modal-old-pass').value;
  const newPassword = document.getElementById('prof-modal-new-pass').value;

  try {
    const data = await apiCall('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword })
    });

    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('password-form').reset();
    }
  } catch (err) {}
};
