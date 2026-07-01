/* ==========================================================================
   StockPilot API Wrapper & Notifications Client
   ========================================================================== */

const API_BASE = '/api';

// Toast Notifications Manager
const showToast = (message, type = 'info') => {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Set color backgrounds based on warning types
  let bg = '#2563eb'; // blue/info
  if (type === 'success') bg = '#10b981';
  else if (type === 'danger') bg = '#ef4444';
  else if (type === 'warning') bg = '#f59e0b';
  
  toast.style.backgroundColor = bg;
  toast.innerHTML = `
    <span style="flex:1;">${message}</span>
    <button style="background:none;border:none;color:white;cursor:pointer;font-weight:700;" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slide-up-toast 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Global Loading Spinner Toggle
const toggleSpinner = (show) => {
  let spinner = document.getElementById('global-spinner');
  if (!spinner && show) {
    spinner = document.createElement('div');
    spinner.id = 'global-spinner';
    spinner.style.position = 'fixed';
    spinner.style.top = '0';
    spinner.style.left = '0';
    spinner.style.width = '100vw';
    spinner.style.height = '100vh';
    spinner.style.backgroundColor = 'rgba(0,0,0,0.2)';
    spinner.style.backdropFilter = 'blur(2px)';
    spinner.style.zIndex = '9999';
    spinner.style.display = 'flex';
    spinner.style.alignItems = 'center';
    spinner.style.justifyContent = 'center';
    spinner.innerHTML = `
      <div style="width: 50px; height: 50px; border: 5px solid #e2e8f0; border-top: 5px solid var(--accent-color, #2563eb); border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(spinner);
  } else if (spinner && !show) {
    spinner.remove();
  }
};

// Fetch API core wrapper
const apiCall = async (endpoint, options = {}) => {
  toggleSpinner(true);
  
  // Set headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const token = localStorage.getItem('stockpilot_access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers
  };

  try {
    let response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
    
    // Auto logout & Refresh token handler on 401
    if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
      console.warn('[API] Access token expired, attempting refresh...');
      const refreshSuccess = await attemptTokenRefresh();
      
      if (refreshSuccess) {
        // Retry the original query with the new token
        headers['Authorization'] = `Bearer ${localStorage.getItem('stockpilot_access_token')}`;
        response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
      } else {
        // Redirect to login on session expiry
        console.error('[API] Refresh failed, logging out...');
        localStorage.clear();
        showToast('Your session has expired. Please login again.', 'danger');
        setTimeout(() => {
          window.location.href = '/app/login.html';
        }, 1500);
        toggleSpinner(false);
        throw new Error('Session expired');
      }
    }

    const data = await response.json();
    toggleSpinner(false);
    
    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    toggleSpinner(false);
    showToast(error.message, 'danger');
    throw error;
  }
};

// Handle access token refresh
const attemptTokenRefresh = async () => {
  const rToken = localStorage.getItem('stockpilot_refresh_token');
  if (!rToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rToken })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('stockpilot_access_token', data.accessToken);
      localStorage.setItem('stockpilot_refresh_token', data.refreshToken);
      return true;
    }
  } catch (err) {
    console.error(`[API] Token refresh handshake failed: ${err.message}`);
  }
  return false;
};

// Check if user is authenticated
const checkAuth = () => {
  const token = localStorage.getItem('stockpilot_access_token');
  if (!token && !window.location.pathname.includes('/login.html')) {
    window.location.href = '/app/login.html';
  }
};

// Verify user onboarding state
const checkOnboarding = (orgProfile) => {
  // If org profile matches default parameters, redirect to wizard
  if (orgProfile && (!orgProfile.phone || orgProfile.phone === '')) {
    if (!window.location.pathname.includes('/onboarding.html')) {
      window.location.href = '/app/onboarding.html';
    }
  }
};
