/* ==========================================================================
   StockPilot Settings Client Page Controller
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchSettings();
});

const fetchSettings = async () => {
  try {
    const data = await apiCall('/settings');
    if (data.success && data.settings) {
      const s = data.settings;
      document.getElementById('set-modal-name').value = s.name;
      document.getElementById('set-modal-currency').value = s.currency;
      document.getElementById('set-modal-tax').value = s.taxRate;
      document.getElementById('set-modal-gstin').value = s.gstin || '';
      document.getElementById('set-modal-pan').value = s.pan || '';
      document.getElementById('set-modal-phone').value = s.phone || '';
      document.getElementById('set-modal-email').value = s.email || '';
      document.getElementById('set-modal-address').value = s.address || '';
    }
  } catch (err) {}
};

// Form submit
const handleSettingsSubmit = async (e) => {
  e.preventDefault();

  const name = document.getElementById('set-modal-name').value;
  const currency = document.getElementById('set-modal-currency').value;
  const taxRate = document.getElementById('set-modal-tax').value;
  const gstin = document.getElementById('set-modal-gstin').value;
  const pan = document.getElementById('set-modal-pan').value;
  const phone = document.getElementById('set-modal-phone').value;
  const email = document.getElementById('set-modal-email').value;
  const address = document.getElementById('set-modal-address').value;
  const logoInput = document.getElementById('set-modal-logo');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('currency', currency);
  formData.append('taxRate', taxRate);
  formData.append('gstin', gstin);
  formData.append('pan', pan);
  formData.append('phone', phone);
  formData.append('email', email);
  formData.append('address', address);

  if (logoInput.files.length > 0) {
    formData.append('logo', logoInput.files[0]);
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('stockpilot_access_token')}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Company settings saved successfully', 'success');
    
    // Save currency to localStorage for updates
    localStorage.setItem('stockpilot_currency', currency);
    fetchSettings();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// Backup download
const downloadTenantBackup = () => {
  const token = localStorage.getItem('stockpilot_access_token');
  if (!token) return;

  // Since it's a GET file download, redirecting the browser with token is handled via a download element or direct location
  const link = document.createElement('a');
  link.href = `/api/settings/backup?Authorization=Bearer ${token}`; // Route protect checks queries too or simply downloads
  // Alternatively, fetch with headers and download blob
  fetchBackupBlob();
};

const fetchBackupBlob = async () => {
  try {
    toggleSpinner(true);
    const res = await fetch('/api/settings/backup', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('stockpilot_access_token')}` }
    });
    
    if (res.ok) {
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `stockpilot_tenant_backup_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Database JSON backup downloaded successfully', 'success');
    }
    toggleSpinner(false);
  } catch (err) {
    toggleSpinner(false);
    showToast('Backup download failed', 'danger');
  }
};

// Backup restore from JSON upload
const restoreTenantBackup = async () => {
  const fileInput = document.getElementById('restore-file-input');
  if (fileInput.files.length === 0) {
    showToast('Please select a JSON backup file first', 'warning');
    return;
  }

  if (!confirm('WARNING: Restoring database will wipe all current tenant listings, customers, suppliers, warehouses, sales and purchase histories. Are you sure you want to proceed?')) return;

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const backupData = JSON.parse(e.target.result);
      
      const data = await apiCall('/settings/restore', {
        method: 'POST',
        body: JSON.stringify({ backupData })
      });

      if (data.success) {
        showToast(data.message, 'success');
        fileInput.value = '';
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      showToast('Invalid JSON backup file structural layout', 'danger');
    }
  };

  reader.readAsText(file);
};
