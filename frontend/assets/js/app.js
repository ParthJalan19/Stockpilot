/* ==========================================================================
   StockPilot Unified App Layout & Command Palette JS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize standard controls
  initSidebar();
  initTheme();
  initCommandPalette();
  initShortcuts();
  fetchNavbarDetails();
});

// 1. Collapsible & Responsive Sidebar Controls
const initSidebar = () => {
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.querySelector('.sidebar-toggle-btn');
  const appContainer = document.querySelector('.app-container');

  if (toggleBtn && sidebar && appContainer) {
    toggleBtn.addEventListener('click', () => {
      appContainer.classList.toggle('collapsed');
      const isCollapsed = appContainer.classList.contains('collapsed');
      localStorage.setItem('stockpilot_sidebar_collapsed', isCollapsed);
    });
    
    // Restore state
    const wasCollapsed = localStorage.getItem('stockpilot_sidebar_collapsed') === 'true';
    if (wasCollapsed) {
      appContainer.classList.add('collapsed');
    }
  }

  // Highlight active link in sidebar
  const currentPath = window.location.pathname;
  const links = document.querySelectorAll('.sidebar-link');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.includes(href)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
};

// 2. Light / Dark & Custom Accent Color Theme Manager
const initTheme = () => {
  const currentTheme = localStorage.getItem('stockpilot_theme') || 'light';
  const currentAccent = localStorage.getItem('stockpilot_accent') || 'blue';

  document.documentElement.setAttribute('data-theme', currentTheme);
  document.documentElement.setAttribute('data-accent', currentAccent);
};

const updateTheme = (themeName) => {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('stockpilot_theme', themeName);
};

const updateAccent = (accentName) => {
  document.documentElement.setAttribute('data-accent', accentName);
  localStorage.setItem('stockpilot_accent', accentName);
};

// 3. Global Gmail-like Command Palette (Ctrl+K)
const initCommandPalette = () => {
  // Create search command palette HTML dynamically if missing
  let palette = document.getElementById('command-palette-modal');
  if (!palette) {
    palette = document.createElement('div');
    palette.id = 'command-palette-modal';
    palette.className = 'modal-overlay';
    palette.innerHTML = `
      <div class="modal-container" style="width:600px;top:10%;position:fixed;">
        <div class="modal-header" style="padding:15px 20px;">
          <input type="text" id="palette-search-input" placeholder="Search products, customers, suppliers or type commands..." style="width:100%;border:none;outline:none;background:transparent;color:var(--text-primary);font-size:1.1rem;" autocomplete="off" />
          <button style="background:none;border:none;font-size:1.5rem;color:var(--text-secondary);cursor:pointer;" onclick="toggleCommandPalette(false)">×</button>
        </div>
        <div class="modal-body" style="padding:15px;max-height:350px;">
          <div id="palette-instructions" style="font-size:0.75rem;color:var(--text-tertiary);margin-bottom:10px;">Commands: /new-product, /new-sale, /go-settings, /go-reports, /go-warehouses</div>
          <div id="palette-results-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(palette);
  }

  const searchInput = document.getElementById('palette-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', handlePaletteQuery);
  }
};

const toggleCommandPalette = (show) => {
  const palette = document.getElementById('command-palette-modal');
  const searchInput = document.getElementById('palette-search-input');
  
  if (palette) {
    if (show) {
      palette.classList.add('active');
      setTimeout(() => searchInput.focus(), 100);
    } else {
      palette.classList.remove('active');
    }
  }
};

// Handle palette query logic
const handlePaletteQuery = async (e) => {
  const query = e.target.value.trim();
  const resultsContainer = document.getElementById('palette-results-list');
  if (!resultsContainer) return;

  if (query.startsWith('/')) {
    // Action commands
    const commands = [
      { text: 'Create New Product', cmd: '/new-product', action: () => openProductModal() },
      { text: 'Create New Sale Invoice', cmd: '/new-sale', action: () => window.location.href = '/app/sales.html?action=new' },
      { text: 'Go to Settings Panel', cmd: '/go-settings', action: () => window.location.href = '/app/settings.html' },
      { text: 'Go to Analytical Reports', cmd: '/go-reports', action: () => window.location.href = '/app/reports.html' },
      { text: 'Go to Warehouses Layout', cmd: '/go-warehouses', action: () => window.location.href = '/app/warehouses.html' }
    ];

    const matched = commands.filter(c => c.cmd.includes(query.toLowerCase()));
    resultsContainer.innerHTML = matched.map(c => `
      <div class="palette-item" style="padding:10px 14px;border-radius:6px;background:var(--bg-tertiary);cursor:pointer;display:flex;justify-content:between;align-items:center;" onclick="executePaletteCommand('${c.cmd}')">
        <strong>${c.text}</strong>
        <span style="font-size:0.8rem;color:var(--text-tertiary);">${c.cmd}</span>
      </div>
    `).join('');
  } else if (query.length > 2) {
    // Live Search Database API
    try {
      resultsContainer.innerHTML = '<div style="font-size:0.9rem;color:var(--text-secondary);">Searching databases...</div>';
      // Search products
      const pData = await apiCall(`/products?search=${query}&limit=3`);
      let html = '';
      
      if (pData.products && pData.products.length > 0) {
        html += '<div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:5px;">PRODUCTS</div>';
        pData.products.forEach(p => {
          html += `
            <div style="padding:10px;border-radius:6px;background:var(--bg-secondary);border:1px solid var(--border-color);cursor:pointer;display:flex;justify-content:space-between;" onclick="window.location.href='/app/product-detail.html?id=${p._id}'">
              <span><strong>${p.name}</strong> (${p.sku})</span>
              <span style="color:var(--accent-color);font-weight:600;">$${p.sellingPrice}</span>
            </div>
          `;
        });
      }
      
      if (html === '') {
        resultsContainer.innerHTML = '<div style="font-size:0.9rem;color:var(--text-tertiary);">No results match search query</div>';
      } else {
        resultsContainer.innerHTML = html;
      }
    } catch (err) {
      resultsContainer.innerHTML = '<div style="color:var(--danger);font-size:0.9rem;">Search failed to return records</div>';
    }
  } else {
    resultsContainer.innerHTML = '';
  }
};

const executePaletteCommand = (cmd) => {
  toggleCommandPalette(false);
  if (cmd === '/new-product') {
    if (window.location.pathname.includes('/products.html')) {
      openProductModal();
    } else {
      window.location.href = '/app/products.html?action=new';
    }
  } else if (cmd === '/new-sale') {
    window.location.href = '/app/sales.html?action=new';
  } else if (cmd === '/go-settings') {
    window.location.href = '/app/settings.html';
  } else if (cmd === '/go-reports') {
    window.location.href = '/app/reports.html';
  } else if (cmd === '/go-warehouses') {
    window.location.href = '/app/warehouses.html';
  }
};

// Placeholder for page specific modal calls
const openProductModal = () => {
  if (typeof window.triggerProductModal === 'function') {
    window.triggerProductModal();
  }
};

// 4. Keyboard Shortcuts Hook
const initShortcuts = () => {
  document.addEventListener('keydown', (e) => {
    // Ctrl + K -> Command Search Palette
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette(true);
    }
    // Ctrl + N -> New Modal Trigger
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      executePaletteCommand('/new-product');
    }
    // Escape -> Close Modals
    if (e.key === 'Escape') {
      toggleCommandPalette(false);
      const activeModal = document.querySelector('.modal-overlay.active');
      if (activeModal) activeModal.classList.remove('active');
    }
  });
};

// 5. Fetch Navbar Details (User avatar and notification indicators)
const fetchNavbarDetails = async () => {
  const token = localStorage.getItem('stockpilot_access_token');
  if (!token) return;

  try {
    // Load profile
    const res = await apiCall('/auth/profile');
    if (res.success) {
      // Set User avatar & Organization Name
      const avatarEl = document.querySelector('.profile-avatar');
      const userNameEl = document.querySelector('.user-nav-name');
      const companyLabelEl = document.querySelector('.company-navbar-label');

      if (avatarEl && res.user.profilePic) avatarEl.src = res.user.profilePic;
      if (userNameEl) userNameEl.textContent = res.user.name;
      if (companyLabelEl && res.organization) companyLabelEl.textContent = res.organization.name;
      
      // Save currency default globally
      localStorage.setItem('stockpilot_currency', res.organization ? res.organization.currency : 'USD');
    }
  } catch (err) {
    console.error(`[AppFrame] Fail: ${err.message}`);
  }
};

// Helper to format prices dynamically
const formatCurrency = (amount) => {
  const currency = localStorage.getItem('stockpilot_currency') || 'USD';
  const symbols = { 'USD': '$', 'INR': '₹', 'EUR': '€', 'AED': 'د.إ' };
  const symbol = symbols[currency] || '$';
  return `${symbol}${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
