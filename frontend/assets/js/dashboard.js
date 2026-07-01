/* ==========================================================================
   StockPilot Dashboard Controllers
   ========================================================================== */

checkAuth();

document.addEventListener('DOMContentLoaded', () => {
  fetchDashboardData();
});

// Fetch KPI statistics and aggregation details
const fetchDashboardData = async () => {
  try {
    const data = await apiCall('/dashboard');
    if (data.success) {
      // 1. Update KPI widgets
      document.getElementById('kpi-today-sales').textContent = formatCurrency(data.stats.todaySales);
      document.getElementById('kpi-today-purchases').textContent = formatCurrency(data.stats.todayPurchases);
      document.getElementById('kpi-inv-value').textContent = formatCurrency(data.stats.inventoryValue);
      
      const lowStockEl = document.getElementById('kpi-low-stock');
      lowStockEl.textContent = `${data.stats.lowStockCount} Items`;
      if (data.stats.lowStockCount > 0) {
        lowStockEl.style.color = 'var(--danger)';
      }

      // 2. Render Timeline logs
      renderTimeline(data.activities);

      // 3. Render Calendar schedules
      renderCalendar(data.calendarEvents);

      // 4. Render Chart.js analytical charts
      renderCharts(data.charts);
    }
  } catch (err) {
    console.error(`[Dashboard] Fetch metrics failed: ${err.message}`);
  }
};

// Render recent activity nodes
const renderTimeline = (activities) => {
  const container = document.getElementById('dashboard-timeline');
  if (!container) return;

  if (!activities || activities.length === 0) {
    container.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.9rem;">No operational actions logged yet</div>';
    return;
  }

  container.innerHTML = activities.map(act => {
    const date = new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let actionText = act.action.replace('_', ' ');
    let color = 'var(--accent-color)';
    
    if (act.action.includes('DELETE') || act.action.includes('REJECT')) color = 'var(--danger)';
    if (act.action.includes('CREATE') || act.action.includes('APPROVE')) color = 'var(--success)';
    
    return `
      <div style="position:relative; margin-bottom:12px;">
        <div style="position:absolute; left:-15px; top:6px; width:8px; height:8px; border-radius:50%; background:${color}; border:2px solid var(--bg-secondary);"></div>
        <div style="display:flex; justify-content:space-between; font-size:0.875rem;">
          <span style="font-weight:600; color:var(--text-primary);">${actionText}</span>
          <span style="font-size:0.75rem; color:var(--text-tertiary);">${date}</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">Logged by ${act.userName}</div>
      </div>
    `;
  }).join('');
};

// Render due payments / PO expect calendar lists
const renderCalendar = (events) => {
  const container = document.getElementById('dashboard-calendar-list');
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = '<div style="color:var(--text-tertiary); text-align:center; padding:20px;">No upcoming due schedules logged</div>';
    return;
  }

  container.innerHTML = events.map(evt => {
    const dateStr = new Date(evt.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const isInvoice = evt.type === 'invoice';
    const color = isInvoice ? 'var(--warning)' : 'var(--info)';
    const icon = isInvoice ? 'file-text' : 'truck';

    return `
      <div style="padding:12px 16px; border-radius:var(--radius-sm); background:var(--bg-tertiary); border-left:4px solid ${color}; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="color:${color};"><i data-lucide="${icon}" style="width:18px;"></i></div>
          <div>
            <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${evt.title}</div>
            <div style="font-size:0.75rem; color:var(--text-tertiary);">Due date: ${dateStr}</div>
          </div>
        </div>
        <div style="font-size:0.9rem; font-weight:700; font-family:var(--font-numbers); color:var(--text-primary);">${formatCurrency(evt.amount)}</div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
};

// Chart.js configurations
const renderCharts = (chartData) => {
  const ctxRevenue = document.getElementById('chart-revenue');
  const ctxCategories = document.getElementById('chart-categories');
  const ctxWarehouses = document.getElementById('chart-warehouses');
  const ctxMovements = document.getElementById('chart-movements');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // 1. Spline revenue Growth Chart
  if (ctxRevenue && chartData.monthlySales) {
    const labels = chartData.monthlySales.map(item => `${months[item._id.month - 1]} ${item._id.year}`);
    const revenues = chartData.monthlySales.map(item => item.revenue);
    const counts = chartData.monthlySales.map(item => item.salesCount);

    new Chart(ctxRevenue, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Revenue ($)',
            data: revenues,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            yAxisID: 'y'
          },
          {
            label: 'Sales Count',
            data: counts,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            yAxisID: 'yCount',
            type: 'line'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter' } } }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          yCount: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  // 2. Pie chart: Categories distribution
  if (ctxCategories && chartData.categoryDistribution) {
    const labels = chartData.categoryDistribution.map(item => item.name);
    const counts = chartData.categoryDistribution.map(item => item.count);

    new Chart(ctxCategories, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
        }
      }
    });
  }

  // 3. Donut chart: Warehouse stock quantities
  if (ctxWarehouses && chartData.warehouseDistribution) {
    const labels = chartData.warehouseDistribution.map(item => item.name);
    const qtys = chartData.warehouseDistribution.map(item => item.qty);

    new Chart(ctxWarehouses, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: qtys,
          backgroundColor: ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
        }
      }
    });
  }

  // 4. Area chart: Movement count history
  if (ctxMovements && chartData.movementTrends) {
    const labels = chartData.movementTrends.map(item => `${months[item._id.month - 1]} ${item._id.year}`);
    const counts = chartData.movementTrends.map(item => item.count);

    new Chart(ctxMovements, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Movements Count',
          data: counts,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: 'rgba(0,0,0,0.05)' } }
        }
      }
    });
  }
};
