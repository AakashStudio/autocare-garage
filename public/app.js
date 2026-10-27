/**
 * ApexAuto Frontend Application Controller
 * Ultra-responsive, modern micro-interactions & live synchronization
 */

const API_BASE = '/api';
let currentTab = 'dashboard-view';
let allInventory = [];
let allBookings = [];
let currentUser = null;

// Global Garage Profile & Country Tax Configuration
let currentSettings = {
  garage_id: 1,
  country: 'India',
  currency_symbol: '₹',
  currency_code: 'INR',
  tax_enabled: 1,
  tax_name: 'GST',
  tax_rate: 18.0,
  tax_number: '07AAPCA1234F1Z5',
  tax_label: 'GSTIN',
  garage_name: 'Apex Performance AutoCare',
  tagline: 'Premium Multi-Brand Auto Care & Detailing Studio',
  phone: '+91 98765 43210',
  email: 'contact@apexauto.com',
  address: 'Plot 42, Motor Way Hub, Sector 18, Gurugram, India',
  invoice_prefix: 'INV',
  footer_notes: 'Thank you for choosing Apex Performance AutoCare! Drive safe with confidence.'
};

const COUNTRY_TAX_PRESETS = {
  'India': {
    currency_symbol: '₹',
    currency_code: 'INR',
    tax_name: 'GST',
    tax_rate: 18.0,
    tax_label: 'GSTIN',
    tax_number: '07AAPCA1234F1Z5',
    notes: 'Standard 18% GST (CGST 9% + SGST 9% on Automotive Repair) pre-filled. You can modify any rate below.'
  },
  'United Arab Emirates': {
    currency_symbol: 'AED',
    currency_code: 'AED',
    tax_name: 'VAT',
    tax_rate: 5.0,
    tax_label: 'TRN',
    tax_number: '100234567800003',
    notes: 'Standard UAE FTA 5% Value Added Tax pre-filled.'
  },
  'Saudi Arabia': {
    currency_symbol: 'SAR',
    currency_code: 'SAR',
    tax_name: 'VAT',
    tax_rate: 15.0,
    tax_label: 'VAT No',
    tax_number: '300123456700003',
    notes: 'ZATCA Standard 15% VAT on automotive maintenance.'
  },
  'United States': {
    currency_symbol: '$',
    currency_code: 'USD',
    tax_name: 'Sales Tax',
    tax_rate: 8.25,
    tax_label: 'Tax ID / EIN',
    tax_number: '12-3456789',
    notes: 'State & Local Combined Sales Tax (standard 8.25% default).'
  },
  'United Kingdom': {
    currency_symbol: '£',
    currency_code: 'GBP',
    tax_name: 'VAT',
    tax_rate: 20.0,
    tax_label: 'VAT Reg No',
    tax_number: 'GB 123 4567 89',
    notes: 'HMRC Standard 20% VAT on garage parts & labor.'
  },
  'Canada': {
    currency_symbol: '$',
    currency_code: 'CAD',
    tax_name: 'GST/HST',
    tax_rate: 13.0,
    tax_label: 'Business No (BN)',
    tax_number: '123456789 RT0001',
    notes: 'Combined Federal GST and Provincial HST (13% default).'
  },
  'Australia': {
    currency_symbol: 'A$',
    currency_code: 'AUD',
    tax_name: 'GST',
    tax_rate: 10.0,
    tax_label: 'ABN',
    tax_number: '12 345 678 901',
    notes: 'ATO Standard 10% Goods & Services Tax (GST).'
  },
  'Germany': {
    currency_symbol: '€',
    currency_code: 'EUR',
    tax_name: 'MwSt',
    tax_rate: 19.0,
    tax_label: 'USt-IdNr',
    tax_number: 'DE 123456789',
    notes: 'Mehrwertsteuer (MwSt) 19% Standard automotive rate.'
  },
  'Singapore': {
    currency_symbol: 'S$',
    currency_code: 'SGD',
    tax_name: 'GST',
    tax_rate: 9.0,
    tax_label: 'GST Reg No',
    tax_number: 'M90369876X',
    notes: 'IRAS Standard 9% GST on workshop services.'
  },
  'Other': {
    currency_symbol: '$',
    currency_code: 'USD',
    tax_name: 'Tax',
    tax_rate: 10.0,
    tax_label: 'Tax ID',
    tax_number: 'TAX-0000',
    notes: 'Custom local municipal or garage service tax.'
  }
};

// Initialize on DOM Ready & Verify Session
document.addEventListener('DOMContentLoaded', () => {
  // 1. Check Authentication Gatekeeper
  const storedUser = localStorage.getItem('apex_user');
  if (!storedUser) {
    window.location.href = 'login.html';
    return;
  }
  try {
    currentUser = JSON.parse(storedUser);
    if (!currentUser || !currentUser.id) {
      window.location.href = 'login.html';
      return;
    }
  } catch (e) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Reflect User & Garage Workspace in Navbar
  const navGarage = document.getElementById('navGarageName');
  if (navGarage) {
    navGarage.innerText = currentUser.garage_name || 'My Garage';
  }

  const userNameEl = document.getElementById('sidebarUserName');
  if (userNameEl) userNameEl.innerText = currentUser.name || 'Admin User';
  const userRoleEl = document.getElementById('sidebarUserRole');
  if (userRoleEl) userRoleEl.innerText = currentUser.role === 'super_admin' ? 'Super Admin' : (currentUser.role || 'Manager');
  const userAvatarEl = document.getElementById('sidebarUserAvatar');
  if (userAvatarEl && currentUser.name) userAvatarEl.innerText = currentUser.name.charAt(0).toUpperCase();

  const superAdminBtn = document.getElementById('superAdminLinkBtn');
  if (superAdminBtn && currentUser.role === 'super_admin') {
    superAdminBtn.style.display = 'inline-flex';
  }

  // Restore saved sidebar collapsed state
  restoreSidebarState();

  // Set default booking date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  const custBookingDateInput = document.getElementById('custBookingDate');
  if (custBookingDateInput) {
    custBookingDateInput.value = tomorrowStr;
    custBookingDateInput.min = new Date().toISOString().split('T')[0];
    fetchSlotsForDate(tomorrowStr);
  }

  // Pre-fill default expense date to today
  const expDate = document.getElementById('expDate');
  if (expDate) {
    expDate.value = new Date().toISOString().split('T')[0];
  }

  // Load initial settings, dashboard stats & tables
  loadSettings();
  refreshCurrentTab();
});

// Logout Handler
function handleLogout() {
  localStorage.removeItem('apex_user');
  localStorage.removeItem('apex_token');
  window.location.href = 'login.html';
}

// ========================================================
// SIDEBAR COLLAPSE / EXPAND TOGGLE
// ========================================================
function toggleSidebarCollapse() {
  document.body.classList.toggle('sidebar-collapsed');
  const isCollapsed = document.body.classList.contains('sidebar-collapsed');
  localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');

  const icon = document.getElementById('sidebarToggleIcon');
  if (icon) {
    if (isCollapsed) {
      // Arrow pointing right to expand
      icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="m11 9 3 3-3 3"></path>';
    } else {
      // Arrow pointing left to collapse
      icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="m14 9-3 3 3 3"></path>';
    }
  }
}

function restoreSidebarState() {
  if (localStorage.getItem('sidebar_collapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
    const icon = document.getElementById('sidebarToggleIcon');
    if (icon) {
      icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="m11 9 3 3-3 3"></path>';
    }
  }
}

// Modal Launcher for New Booking
function openNewBookingModal() {
  document.getElementById('newBookingModal').classList.add('open');
  const dateInput = document.getElementById('custBookingDate');
  if (dateInput && dateInput.value) {
    fetchSlotsForDate(dateInput.value);
  }
  const currentAmount = parseFloat(document.getElementById('selectedServiceAmount')?.value) || 150;
  setEstimatedBudget(currentAmount);
}

// Tab Switching
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-tab-pill').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) {
    targetTab.style.display = 'block';
  }

  // Find corresponding tab button and highlight
  const allBtns = document.querySelectorAll('.nav-tab-pill');
  allBtns.forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
      btn.classList.add('active');
    }
  });

  // Trigger data fetch for current tab
  refreshCurrentTab();
}

function refreshCurrentTab() {
  loadDashboardStats();
  if (currentTab === 'dashboard-view') loadDashboardData();
  if (currentTab === 'admin-bookings') loadBookings();
  if (currentTab === 'admin-ratecard') loadRateCard();
  if (currentTab === 'admin-inventory') loadInventory();
  if (currentTab === 'admin-expenses') loadExpenses();
  if (currentTab === 'admin-staff') loadStaff();
  if (currentTab === 'admin-vendors') loadVendors();
  if (currentTab === 'admin-settings') loadSettings();
}

// ========================================================
// 1. DASHBOARD & STATS
// ========================================================
async function loadDashboardStats() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    const data = await res.json();
    if (data.success) {
      const s = data.data;
      if (document.getElementById('statTodayBookings')) {
        document.getElementById('statTodayBookings').innerText = s.todayBookingsCount;
        document.getElementById('statPendingBookings').innerText = s.pendingBookings;
      }
      // Executive Dashboard KPIs
      if (document.getElementById('dashTodayCount')) {
        document.getElementById('dashTodayCount').innerText = s.todayBookingsCount;
        document.getElementById('dashPendingCount').innerText = s.pendingBookings;
        document.getElementById('dashInventoryVal').innerText = `$${s.totalInventoryValue.toLocaleString('en-US')}`;
        document.getElementById('dashLowStockCount').innerText = s.lowStockCount;
        
        document.getElementById('dashActiveStaff').innerText = `${s.activeStaff} Crew Members`;
        document.getElementById('dashTotalVendors').innerText = `${s.totalVendors} Suppliers`;
        document.getElementById('dashTotalExpenses').innerText = `$${s.totalExpenses.toLocaleString('en-US')}`;
        document.getElementById('dashPendingVendorPay').innerText = `$${s.pendingVendorPay.toLocaleString('en-US')}`;
      }
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

let dashAllBookings = [];
let currentDashStatusFilter = 'All';

async function loadDashboardData() {
  const tbody = document.getElementById('dashTodayTableBody');
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    const data = await res.json();
    if (data.success) {
      dashAllBookings = data.data || [];
      renderDashboardBookingsTable();
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="color:#f87171; text-align:center; padding: 20px;">Failed to load schedule.</td></tr>`;
  }
}

function filterDashboardBookings(status, btnElement) {
  currentDashStatusFilter = status;

  // Highlight selected filter pill
  const filterGroup = document.getElementById('dashFilterPills');
  if (filterGroup) {
    filterGroup.querySelectorAll('.btn-filter-pill').forEach(btn => btn.classList.remove('active'));
  }
  if (btnElement) {
    btnElement.classList.add('active');
  }

  renderDashboardBookingsTable();
}

function renderDashboardBookingsTable() {
  const tbody = document.getElementById('dashTodayTableBody');
  if (!tbody) return;

  let filtered = dashAllBookings;
  if (currentDashStatusFilter !== 'All') {
    filtered = dashAllBookings.filter(b => (b.status || '').toLowerCase() === currentDashStatusFilter.toLowerCase());
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 28px; color: var(--text-dim); font-size: 13px;">No priority service bookings found under <strong>${escapeHtml(currentDashStatusFilter)}</strong> status.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    let badgeClass = 'pill-pending';
    if (b.status === 'Confirmed') badgeClass = 'pill-confirmed';
    if (b.status === 'In-Progress') badgeClass = 'pill-progress';
    if (b.status === 'Completed') badgeClass = 'pill-completed';
    if (b.status === 'Rescheduled') badgeClass = 'pill-rescheduled';
    if (b.status === 'Cancelled' || b.status === 'No-Show') badgeClass = 'pill-danger';

    return `
      <tr class="clickable-row" onclick="openBookingDetails(${b.id})" title="Click row to open full job card">
        <td>
          <span class="booking-ref-badge">
            ${b.booking_number}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </span>
        </td>
        <td>
          <div style="font-weight:700; color:#fff;">${escapeHtml(b.customer_name)}</div>
          <div style="font-size:11px; color:#fbbf24;">${escapeHtml(b.customer_phone || 'No phone')}</div>
        </td>
        <td>
          <div style="font-weight:600; color:#e2e8f0;">${escapeHtml(b.vehicle_name || 'Vehicle')}</div>
          <div style="font-size:11px; color:var(--text-dim); font-family:var(--font-mono); letter-spacing:0.5px;">${escapeHtml(b.reg_number || 'N/A')}</div>
        </td>
        <td><span style="font-weight:600; color:#fff;">${escapeHtml(b.service_type)}</span></td>
        <td>
          <div style="font-weight:600; font-size:12px; color:#fff;">${b.booking_date}</div>
          <div style="font-size:11px; color:#fbbf24; font-weight:600;">${b.time_slot}</div>
        </td>
        <td><span class="pill ${badgeClass}">${b.status}</span></td>
        <td onclick="event.stopPropagation()">
          <div class="row-action-wrapper">
            <select class="table-status-select" onclick="event.stopPropagation()" onchange="event.stopPropagation(); handleStatusDropdownChange(this, ${b.id})" title="Change status">
              <option value="" disabled selected>${b.status}</option>
              <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirm</option>
              <option value="In-Progress" ${b.status === 'In-Progress' ? 'selected' : ''}>In-Progress</option>
              <option value="Completed" ${b.status === 'Completed' ? 'selected' : ''}>Complete (Pay)</option>
              <option value="Rescheduled" ${b.status === 'Rescheduled' ? 'selected' : ''}>Reschedule</option>
              <option value="No-Show" ${b.status === 'No-Show' ? 'selected' : ''}>No-Show</option>
              <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Cancel</option>
            </select>
            <button type="button" class="btn-row-dots" title="More Actions" onclick="event.stopPropagation(); toggleRowActionMenu(event, 'dash-${b.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2.2"></circle>
                <circle cx="12" cy="12" r="2.2"></circle>
                <circle cx="12" cy="19" r="2.2"></circle>
              </svg>
            </button>
            <div id="rowActionMenu-dash-${b.id}" class="row-action-menu" onclick="event.stopPropagation()">
              <div class="menu-item" onclick="openBookingDetails(${b.id}); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Edit Job Card
              </div>
              <div class="menu-item" onclick="openRescheduleModal(${b.id}, '${escapeHtml(b.booking_number)}', '${escapeHtml(b.customer_name)}', '${b.booking_date}'); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Move Date / Reschedule
              </div>
              <div class="menu-item" onclick="updateBookingStatus(${b.id}, 'In-Progress'); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                Send to Bay (In-Progress)
              </div>
              <div class="menu-item" onclick="printJobCardForBooking(${b.id}); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Print Job Card
              </div>
              <div class="menu-divider"></div>
              <div class="menu-item menu-item-danger" onclick="confirmCancelBooking(${b.id}, '${escapeHtml(b.booking_number)}'); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                Cancel Booking
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ========================================================
// 2. CUSTOMER BOOKING PORTAL LOGIC
// ========================================================
function setEstimatedBudget(val) {
  val = Math.max(10, Math.min(10000, Math.round(Number(val) || 10)));
  
  const slider = document.getElementById('priceBudgetSlider');
  const numberInput = document.getElementById('budgetInputNumber');
  const hiddenAmount = document.getElementById('selectedServiceAmount');
  const summaryPrice = document.getElementById('summaryServicePrice');
  const scaleVal = document.getElementById('scaleEstimatedVal');

  if (slider) {
    slider.value = val;
    const pct = ((val - 10) / (10000 - 10)) * 100;
    slider.style.background = `linear-gradient(to right, #fbbf24 0%, #d4af37 ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%, rgba(255, 255, 255, 0.08) 100%)`;
  }

  if (numberInput) {
    numberInput.value = val;
  }

  if (hiddenAmount) {
    hiddenAmount.value = val;
  }

  if (summaryPrice) {
    summaryPrice.innerText = `$${val.toLocaleString('en-US')}`;
  }

  if (scaleVal) {
    scaleVal.innerText = `$${val.toLocaleString('en-US')}`;
  }
}

function handleBudgetSliderChange(val) {
  setEstimatedBudget(val);
}

function handleBudgetNumberInput(val) {
  setEstimatedBudget(val);
}

function setBudgetPreset(presetVal) {
  setEstimatedBudget(presetVal);
}

function selectServiceChoice(element, serviceName, defaultAmount = 150) {
  document.querySelectorAll('.service-card-choice').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  document.getElementById('selectedServiceType').value = serviceName;
  
  const summaryName = document.getElementById('summaryServiceName');
  if (summaryName) summaryName.innerText = serviceName;

  setEstimatedBudget(defaultAmount);

  // When "Other" is selected, customer complaint/issue becomes mandatory
  const issueInput = document.getElementById('custIssue');
  if (issueInput) {
    if (serviceName === 'Other') {
      issueInput.required = true;
      issueInput.placeholder = '* Please specify customer complaint / work needed (Required)...';
      issueInput.style.borderColor = 'rgba(212, 175, 55, 0.85)';
      issueInput.style.boxShadow = '0 0 12px rgba(212, 175, 55, 0.35)';
      issueInput.focus();
    } else {
      issueInput.required = false;
      issueInput.placeholder = 'Symptoms / customer complaints...';
      issueInput.style.borderColor = '';
      issueInput.style.boxShadow = '';
    }
  }
}

async function fetchSlotsForDate(date) {
  const container = document.getElementById('slotsPillContainer');
  if (!container) return;
  container.innerHTML = '<span style="font-size: 11px; color: var(--text-dim);">Checking bays...</span>';

  try {
    const res = await fetch(`${API_BASE}/slots/availability?date=${date}`);
    const data = await res.json();
    if (data.success) {
      container.innerHTML = '';
      data.slots.forEach(slotInfo => {
        const chip = document.createElement('div');
        chip.className = `slot-chip ${slotInfo.available ? '' : 'disabled'}`;
        const remCount = slotInfo.available ? (slotInfo.capacity - slotInfo.booked) : 0;
        const timeStr = slotInfo.slot.split(' - ')[0];

        chip.innerHTML = `
          <div class="slot-chip-left">
            <span class="slot-chip-count">${remCount}</span>
            <span class="slot-chip-label">${slotInfo.available ? 'Left' : 'Full'}</span>
          </div>
          <div class="slot-chip-divider"></div>
          <div class="slot-chip-right">
            <span class="slot-chip-time-big">${timeStr}</span>
          </div>
        `;

        if (slotInfo.available) {
          chip.onclick = () => {
            document.querySelectorAll('.slot-chip').forEach(p => p.classList.remove('selected'));
            chip.classList.add('selected');
            document.getElementById('selectedTimeSlot').value = slotInfo.slot;
            document.getElementById('summaryServiceSlot').innerText = `${date.split('-')[2]}/${date.split('-')[1]} (${slotInfo.slot.split(' - ')[0]})`;
          };
        }
        container.appendChild(chip);
      });
    }
  } catch (err) {
    container.innerHTML = '<span style="color:#f87171; font-size:11px;">Error loading slots.</span>';
  }
}

async function handleCustomerBooking(e) {
  e.preventDefault();
  const timeSlot = document.getElementById('selectedTimeSlot').value;
  if (!timeSlot) {
    alert('Please choose an available bay slot for your service.');
    return;
  }

  const serviceType = document.getElementById('selectedServiceType').value;
  const custIssueInput = document.getElementById('custIssue');
  const issueDescription = custIssueInput ? custIssueInput.value.trim() : '';

  if (serviceType === 'Other' && !issueDescription) {
    alert('Customer complaint / work needed is mandatory when "Other" is selected.');
    if (custIssueInput) {
      custIssueInput.focus();
      custIssueInput.style.borderColor = '#ef4444';
      custIssueInput.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.4)';
    }
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHtml = submitBtn.innerHTML;

  // Micro UX Loading State
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="pulse-spinner"></span> Locking Bay Slot & Dispatching...`;

  const payload = {
    customer_name: document.getElementById('custName').value,
    customer_phone: document.getElementById('custPhone').value,
    customer_email: '',
    reg_number: document.getElementById('custRegNumber').value,
    vehicle_name: document.getElementById('custVehicleName').value,
    service_type: document.getElementById('selectedServiceType').value,
    booking_date: document.getElementById('custBookingDate').value,
    time_slot: timeSlot,
    issue_description: document.getElementById('custIssue').value,
    total_amount: parseFloat(document.getElementById('selectedServiceAmount').value),
    garage_id: currentUser ? currentUser.garage_id : 1,
    answers_json: {
      pickup: document.getElementById('q_pickup')?.checked || false,
      oilChange: document.getElementById('q_oil')?.checked || false,
      wheelBalancing: document.getElementById('q_wheel')?.checked || false,
      acCheck: document.getElementById('q_ac')?.checked || false,
      washing: document.getElementById('q_washing')?.checked || false,
      generalRepair: document.getElementById('q_repair')?.checked || false,
      brakes: document.getElementById('q_brakes')?.checked || false,
      battery: document.getElementById('q_battery')?.checked || false
    }
  };

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    
    // Restore button
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;

    if (result.success) {
      // Close the booking input modal first
      closeModal('newBookingModal');

      // 1. Populate details into the Celebration Success Popup Modal
      document.getElementById('modalBookingRef').innerText = result.booking_number;
      document.getElementById('modalClientName').innerText = `${payload.customer_name} (${payload.customer_phone})`;
      document.getElementById('modalVehicleInfo').innerText = `${payload.vehicle_name} • ${payload.reg_number}`;
      document.getElementById('modalServiceTier').innerText = payload.service_type;
      document.getElementById('modalScheduleTime').innerText = `${payload.booking_date} @ ${payload.time_slot}`;
      document.getElementById('modalTotalBill').innerText = `$${payload.total_amount.toLocaleString('en-US')}`;

      // 2. Open the celebratory modal
      document.getElementById('bookingConfirmedModal').classList.add('open');

      // 3. Reset form
      document.getElementById('publicBookingForm').reset();
      const slotSummary = document.getElementById('summaryServiceSlot');
      if (slotSummary) slotSummary.innerText = 'Select slot';

      // Refresh data
      refreshCurrentTab();

      // 4. Also show subtle top banner
      const banner = document.getElementById('bookingAlertBanner');
      const msg = document.getElementById('bookingAlertMessage');
      msg.innerHTML = `
        <strong>Booking Confirmed #${result.booking_number}!</strong> 
        Bay locked for ${payload.booking_date} (${payload.time_slot}). Dispatch alert triggered to garage floor.
      `;
      banner.classList.add('show');
      setTimeout(() => { banner.classList.remove('show'); }, 6000);

    } else {
      alert('Booking error: ' + result.error);
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
    alert('Failed to connect to server: ' + err.message);
  }
}

// ========================================================
// 3. BOOKING OPERATIONS (ADMIN PANEL)
// ========================================================
async function loadBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  const search = document.getElementById('bookingSearchInput').value;
  const status = document.getElementById('bookingStatusFilter').value;

  try {
    let url = `${API_BASE}/bookings?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
    if (currentUser && currentUser.garage_id && currentUser.role !== 'super_admin') {
      url += `&garage_id=${currentUser.garage_id}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      allBookings = data.data;
      renderBookingsTable(allBookings);

      let inProg = 0, resched = 0;
      allBookings.forEach(b => {
        if (b.status === 'In-Progress') inProg++;
        if (b.status === 'Rescheduled') resched++;
      });
      document.getElementById('statInProgressBookings').innerText = inProg;
      document.getElementById('statRescheduledBookings').innerText = resched;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:#f87171; text-align:center;">Failed to load bookings.</td></tr>`;
  }
}

function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookingsTableBody');
  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-dim);">No bookings found.</td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    let badgeClass = 'pill-pending';
    if (b.status === 'Confirmed') badgeClass = 'pill-confirmed';
    if (b.status === 'In-Progress') badgeClass = 'pill-progress';
    if (b.status === 'Completed') badgeClass = 'pill-completed';
    if (b.status === 'Rescheduled') badgeClass = 'pill-rescheduled';
    if (b.status === 'Cancelled' || b.status === 'No-Show') badgeClass = 'pill-danger';

    return `
      <tr class="clickable-row" onclick="openBookingDetails(${b.id})" title="Click row to view full job card">
        <td>
          <span class="booking-ref-badge">
            ${b.booking_number}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </span>
        </td>
        <td>
          <div style="font-weight:600; color:#fff;">${escapeHtml(b.customer_name)}</div>
          <div style="font-size:11.5px; color:var(--text-dim);">${escapeHtml(b.customer_phone)}</div>
        </td>
        <td>
          <span style="font-family:var(--font-mono); font-weight:700; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; font-size:11.5px;">
            ${escapeHtml(b.reg_number)}
          </span>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${escapeHtml(b.vehicle_name || '')}</div>
        </td>
        <td>
          <div style="font-weight:500;">${escapeHtml(b.service_type)}</div>
          ${b.issue_description ? `<div style="font-size:10.5px; color:#f87171;">Issue: ${escapeHtml(b.issue_description)}</div>` : ''}
        </td>
        <td>
          <div style="font-weight:600; font-size:12px;">${b.booking_date}</div>
          <div style="font-size:11px; color:var(--text-dim);">${b.time_slot}</div>
        </td>
        <td><span class="pill ${badgeClass}">${b.status}</span></td>
        <td style="font-weight:700; color:#34d399; font-family:var(--font-mono);">$${b.total_amount ? b.total_amount.toLocaleString('en-US') : 0}</td>
        <td onclick="event.stopPropagation()">
          <div class="row-action-wrapper">
            <select class="table-status-select" onclick="event.stopPropagation()" onchange="event.stopPropagation(); handleStatusDropdownChange(this, ${b.id})" title="Update status">
              <option value="" disabled selected>${b.status}</option>
              <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirm</option>
              <option value="In-Progress" ${b.status === 'In-Progress' ? 'selected' : ''}>In-Progress</option>
              <option value="Completed" ${b.status === 'Completed' ? 'selected' : ''}>Complete (Pay)</option>
              <option value="Rescheduled" ${b.status === 'Rescheduled' ? 'selected' : ''}>Reschedule</option>
              <option value="No-Show" ${b.status === 'No-Show' ? 'selected' : ''}>No-Show</option>
              <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Cancel</option>
            </select>
            <button type="button" class="btn-row-dots" id="dotBtn-${b.id}" title="More Actions" onclick="event.stopPropagation(); toggleRowActionMenu(event, ${b.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2.2"></circle>
                <circle cx="12" cy="12" r="2.2"></circle>
                <circle cx="12" cy="19" r="2.2"></circle>
              </svg>
            </button>
            <div id="rowActionMenu-${b.id}" class="row-action-menu" onclick="event.stopPropagation()">
              <div class="menu-item" onclick="openRescheduleModal(${b.id}, '${escapeHtml(b.booking_number)}', '${escapeHtml(b.customer_name)}', '${b.booking_date}'); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Move Date / Reschedule
              </div>
              <div class="menu-item" onclick="updateBookingStatus(${b.id}, 'In-Progress'); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                Send to Bay (In-Progress)
              </div>
              <div class="menu-item" onclick="updateBookingStatus(${b.id}, 'Pending'); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Move to Queue (Pending)
              </div>
              <div class="menu-item" onclick="openBookingDetails(${b.id}); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Edit Job Card Details
              </div>
              <div class="menu-item" onclick="printJobCardForBooking(${b.id}); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Print Job Card
              </div>
              <div class="menu-divider"></div>
              <div class="menu-item menu-item-danger" onclick="confirmCancelBooking(${b.id}, '${escapeHtml(b.booking_number)}'); closeAllRowMenus();">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                Cancel Booking
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Intercept Status Change — Require Payment Verification before 'Completed'
let activePaymentSelectEl = null;
let currentBaseAmount = 0;
let currentExtraItems = [];

function handleStatusDropdownChange(selectEl, bookingId) {
  const newStatus = selectEl.value;
  if (!newStatus) return;

  if (newStatus === 'Completed') {
    activePaymentSelectEl = selectEl;
    
    const booking = allBookings.find(b => b.id == bookingId);
    if (!booking) {
      updateBookingStatus(bookingId, newStatus);
      return;
    }

    // Set baseline and clear any previous extra items
    currentBaseAmount = parseFloat(booking.total_amount) || 0;
    currentExtraItems = [];
    currentPaidBooking = booking;

    const currSym = (currentSettings && currentSettings.currency_symbol) ? currentSettings.currency_symbol : '₹';

    // Populate Payment Modal
    document.getElementById('payBookingId').value = bookingId;
    document.getElementById('payModalBookingRef').innerText = booking.booking_number;
    document.getElementById('payModalClientVehicle').innerText = `${booking.customer_name} • ${booking.reg_number}`;
    document.getElementById('payModalBaseAmount').innerText = `${currSym}${currentBaseAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    renderExtraItems();
    selectPaymentMethod('Cash');
    applyTenderedAmount('exact');

    // Show Payment Verification Modal
    document.getElementById('paymentVerifyModal').classList.add('open');
  } else {
    updateBookingStatus(bookingId, newStatus);
  }
}

// Bill calculation helper with Country Tax Engine
function calculateCurrentBill() {
  const extraTotal = currentExtraItems.reduce((s, i) => s + i.price, 0);
  const subtotal = currentBaseAmount + extraTotal;
  const isTaxEnabled = currentSettings && (currentSettings.tax_enabled == 1 || currentSettings.tax_enabled === true);
  const taxRate = isTaxEnabled ? (parseFloat(currentSettings.tax_rate) || 0) : 0;
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;
  const currSym = (currentSettings && currentSettings.currency_symbol) ? currentSettings.currency_symbol : '₹';
  return { subtotal, extraTotal, taxAmount, grandTotal, taxRate, isTaxEnabled, currSym };
}

// Select Payment Method Tab (Cash, Card, UPI, Fleet)
function selectPaymentMethod(method) {
  const methodInput = document.getElementById('selectedPaymentMethod');
  if (methodInput) methodInput.value = method;
  
  // Highlight tab
  document.querySelectorAll('.pay-method-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`payCard-${method}`);
  if (card) card.classList.add('active');

  // Show panel
  document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('show'));
  const panel = document.getElementById(`payPanel-${method}`);
  if (panel) panel.classList.add('show');

  if (method === 'Cash') {
    calculateCashChange();
  }
}

// 1-Tap Quick Spares Adder
function quickAddSpare(name, price) {
  currentExtraItems.push({ name, price: parseFloat(price) });
  renderExtraItems();
  calculateCashChange();
}

function applyTenderedAmount(amt) {
  const bill = calculateCurrentBill();
  const input = document.getElementById('payCashTendered');
  if (!input) return;
  if (amt === 'exact') {
    input.value = bill.grandTotal.toFixed(2);
  } else {
    input.value = (bill.grandTotal + parseFloat(amt)).toFixed(2);
  }
  calculateCashChange();
}

function calculateCashChange() {
  const bill = calculateCurrentBill();
  const input = document.getElementById('payCashTendered');
  const changeEl = document.getElementById('payChangeReturnDisplay');
  if (!input || !changeEl) return;

  const tendered = parseFloat(input.value) || 0;
  if (tendered === 0) {
    changeEl.innerText = `${bill.currSym}0.00`;
    changeEl.style.color = '#34d399';
    return;
  }

  const change = tendered - bill.grandTotal;
  if (change >= -0.01) {
    changeEl.innerText = `${bill.currSym}${Math.max(0, change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    changeEl.style.color = '#34d399';
  } else {
    changeEl.innerText = `-${bill.currSym}${Math.abs(change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Due)`;
    changeEl.style.color = '#fbbf24';
  }
}

// Add Extra Parts / Work to the bill
function addExtraBillItem() {
  const nameInput = document.getElementById('extraItemName');
  const priceInput = document.getElementById('extraItemPrice');

  const itemName = nameInput.value.trim();
  const itemPrice = parseFloat(priceInput.value);

  if (!itemName || isNaN(itemPrice) || itemPrice <= 0) {
    alert('Please enter a valid item/part name and price');
    return;
  }

  currentExtraItems.push({ name: itemName, price: itemPrice });
  nameInput.value = '';
  priceInput.value = '';

  renderExtraItems();
  calculateCashChange();
}

function removeExtraBillItem(index) {
  currentExtraItems.splice(index, 1);
  renderExtraItems();
  calculateCashChange();
}

function renderExtraItems() {
  const bill = calculateCurrentBill();
  const container = document.getElementById('additionalItemsContainer');

  if (currentExtraItems.length === 0) {
    container.innerHTML = '';
  } else {
    container.innerHTML = currentExtraItems.map((item, idx) => {
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(212,175,55,0.12); padding:3px 8px; border-radius:4px; font-size:11px;">
          <span style="color:#e2e8f0;">+ ${escapeHtml(item.name)}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:700; color:#fbbf24; font-family:var(--font-mono);">+${bill.currSym}${item.price.toLocaleString('en-US')}</span>
            <button type="button" onclick="removeExtraBillItem(${idx})" style="border:none; background:none; color:#f87171; cursor:pointer; font-weight:800; font-size:12px;" title="Remove item">&times;</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Update Base Amount
  const payModalBaseAmount = document.getElementById('payModalBaseAmount');
  if (payModalBaseAmount) {
    payModalBaseAmount.innerText = `${bill.currSym}${currentBaseAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Update Subtotal
  const payModalSubtotal = document.getElementById('payModalSubtotal');
  if (payModalSubtotal) {
    payModalSubtotal.innerText = `${bill.currSym}${bill.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Update Tax Line
  const payModalTaxRow = document.getElementById('payModalTaxRow');
  const payModalTaxLabel = document.getElementById('payModalTaxLabel');
  const payModalTaxAmount = document.getElementById('payModalTaxAmount');
  if (payModalTaxRow && payModalTaxLabel && payModalTaxAmount) {
    if (bill.isTaxEnabled && bill.taxRate > 0) {
      payModalTaxRow.style.display = 'flex';
      payModalTaxLabel.innerText = `Tax (${currentSettings.tax_name || 'Tax'} ${bill.taxRate}%):`;
      payModalTaxAmount.innerText = `${bill.currSym}${bill.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      payModalTaxRow.style.display = 'none';
    }
  }

  // Update Net Payable
  const payModalAmount = document.getElementById('payModalAmount');
  if (payModalAmount) {
    payModalAmount.innerText = `${bill.currSym}${bill.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const submitBtn = document.getElementById('paySubmitBtn');
  if (submitBtn) {
    submitBtn.innerHTML = `✓ Settle & Complete Job (${bill.currSym}${bill.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
}

function cancelPaymentModal() {
  closeModal('paymentVerifyModal');
  if (activePaymentSelectEl) {
    activePaymentSelectEl.value = '';
  }
  loadBookings();
}

async function confirmPaymentAndComplete() {
  const bookingId = document.getElementById('payBookingId').value;
  const method = document.getElementById('selectedPaymentMethod')?.value || 'Cash';
  const bill = calculateCurrentBill();

  let extraNotes = '';
  if (currentExtraItems.length > 0) {
    extraNotes = ` | Added: ${currentExtraItems.map(i => `${i.name} (${bill.currSym}${i.price})`).join(', ')}`;
  }

  let payDetails = '';
  let changeGiven = 0;
  if (method === 'Cash') {
    const tendered = parseFloat(document.getElementById('payCashTendered')?.value) || bill.grandTotal;
    changeGiven = Math.max(0, tendered - bill.grandTotal);
    payDetails = `Cash Tendered: ${bill.currSym}${tendered.toFixed(2)} (Change: ${bill.currSym}${changeGiven.toFixed(2)})`;
  } else if (method === 'Card') {
    const brand = document.getElementById('payCardBrand')?.value || 'Card';
    const last4 = document.getElementById('payCardLast4')?.value || '****';
    const auth = document.getElementById('payCardAuth')?.value || 'POS-OK';
    payDetails = `${brand} POS [Auth: ${auth}, •••• ${last4}]`;
  } else if (method === 'UPI') {
    const upiRef = document.getElementById('payUpiRef')?.value || 'Verified Instant Scan';
    payDetails = `UPI QR [Ref: ${upiRef}]`;
  } else if (method === 'Fleet') {
    const company = document.getElementById('payFleetCompany')?.value || 'Fleet Client';
    const po = document.getElementById('payFleetPo')?.value || 'NET-30';
    payDetails = `Fleet [${company}, PO: ${po}]`;
  }

  const taxDetailText = bill.isTaxEnabled ? ` | Subtotal: ${bill.currSym}${bill.subtotal.toFixed(2)}, ${currentSettings.tax_name || 'Tax'}: ${bill.currSym}${bill.taxAmount.toFixed(2)}` : '';
  const notesAppend = `Payment Verified via ${method} (${payDetails})${extraNotes}${taxDetailText}`;

  const submitBtn = document.getElementById('paySubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="pulse-spinner"></span> Finalizing Settlement...`;

  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'Completed',
        notes: notesAppend,
        total_amount: bill.grandTotal,
        extra_items: currentExtraItems
      })
    });
    const result = await res.json();
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = `✓ Settle & Complete Job (${bill.currSym}${bill.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    
    if (result.success) {
      closeModal('paymentVerifyModal');

      const booking = currentPaidBooking || allBookings.find(b => b.id == bookingId) || {};
      
      // Populate Celebratory Digital Tax Invoice Receipt
      const prefix = currentSettings.invoice_prefix || 'INV';
      const invoiceNumber = `${prefix}-${(booking.booking_number || 'BK').replace('BK-', '')}-${Math.floor(100 + Math.random() * 900)}`;
      
      if (document.getElementById('receiptGarageName')) document.getElementById('receiptGarageName').innerText = (currentSettings.garage_name || 'Apex Performance AutoCare').toUpperCase();
      if (document.getElementById('receiptTagline')) document.getElementById('receiptTagline').innerText = currentSettings.tagline || 'Premium Workshop Studio';
      if (document.getElementById('receiptAddress')) document.getElementById('receiptAddress').innerText = currentSettings.address || '';
      if (document.getElementById('receiptPhone')) document.getElementById('receiptPhone').innerText = `Ph: ${currentSettings.phone || ''}`;
      if (document.getElementById('receiptTaxId')) document.getElementById('receiptTaxId').innerText = `${currentSettings.tax_label || 'GSTIN'}: ${currentSettings.tax_number || 'N/A'}`;
      if (document.getElementById('receiptFooterNotes')) document.getElementById('receiptFooterNotes').innerText = currentSettings.footer_notes || 'Thank you for choosing us!';

      document.getElementById('receiptInvoiceNum').innerText = `TAX INVOICE: ${invoiceNumber}`;
      document.getElementById('receiptDate').innerText = `Settled: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      document.getElementById('receiptCustomerName').innerText = booking.customer_name || 'Client';
      document.getElementById('receiptVehicleReg').innerText = `${booking.vehicle_name || 'Vehicle'} • ${booking.reg_number || ''}`;
      document.getElementById('receiptPaymentMode').innerText = `${method} (${payDetails})`;
      
      // Itemized breakdown in thermal slip
      const breakdownEl = document.getElementById('receiptItemsBreakdown');
      let itemsHtml = `
        <div style="display:flex; justify-content:space-between; color:#e2e8f0;">
          <span>1x ${escapeHtml(booking.service_type || 'Standard Service')}</span>
          <span style="font-family:var(--font-mono); font-weight:700;">${bill.currSym}${currentBaseAmount.toFixed(2)}</span>
        </div>
      `;
      currentExtraItems.forEach(item => {
        itemsHtml += `
          <div style="display:flex; justify-content:space-between; color:#fbbf24;">
            <span>+ ${escapeHtml(item.name)}</span>
            <span style="font-family:var(--font-mono); font-weight:700;">${bill.currSym}${item.price.toFixed(2)}</span>
          </div>
        `;
      });
      breakdownEl.innerHTML = itemsHtml;

      // Subtotal & Tax Breakdown
      if (document.getElementById('receiptSubtotalAmount')) {
        document.getElementById('receiptSubtotalAmount').innerText = `${bill.currSym}${bill.subtotal.toFixed(2)}`;
      }

      const taxContainer = document.getElementById('receiptTaxRowsContainer');
      if (taxContainer) {
        if (bill.isTaxEnabled && bill.taxRate > 0) {
          if (currentSettings.country === 'India') {
            const halfRate = (bill.taxRate / 2).toFixed(1);
            const halfTax = (bill.taxAmount / 2).toFixed(2);
            taxContainer.innerHTML = `
              <div style="display:flex; justify-content:space-between; color:#34d399;">
                <span>CGST (${halfRate}%):</span>
                <span style="font-family:var(--font-mono); font-weight:700;">${bill.currSym}${halfTax}</span>
              </div>
              <div style="display:flex; justify-content:space-between; color:#34d399;">
                <span>SGST (${halfRate}%):</span>
                <span style="font-family:var(--font-mono); font-weight:700;">${bill.currSym}${halfTax}</span>
              </div>
            `;
          } else {
            taxContainer.innerHTML = `
              <div style="display:flex; justify-content:space-between; color:#34d399;">
                <span>${currentSettings.tax_name || 'Tax'} (${bill.taxRate}%):</span>
                <span style="font-family:var(--font-mono); font-weight:700;">${bill.currSym}${bill.taxAmount.toFixed(2)}</span>
              </div>
            `;
          }
        } else {
          taxContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; color:var(--text-dim);">
              <span>Tax Status:</span>
              <span style="font-family:var(--font-mono); font-weight:700;">Zero Tax / Exempt</span>
            </div>
          `;
        }
      }

      document.getElementById('receiptTotalAmount').innerText = `${bill.currSym}${bill.grandTotal.toFixed(2)}`;

      const changeRow = document.getElementById('receiptChangeRow');
      if (method === 'Cash' && changeGiven > 0) {
        changeRow.style.display = 'flex';
        document.getElementById('receiptChangeAmount').innerText = `${bill.currSym}${changeGiven.toFixed(2)}`;
      } else {
        changeRow.style.display = 'none';
      }

      // Open Celebratory Receipt Modal
      document.getElementById('paymentReceiptModal').classList.add('open');
      
      const banner = document.getElementById('bookingAlertBanner');
      const msg = document.getElementById('bookingAlertMessage');
      if (banner && msg) {
        msg.innerHTML = `
          <strong>Payment Settled & Job Completed!</strong> 
          Tax Invoice ${invoiceNumber} created for ${bill.currSym}${bill.grandTotal.toFixed(2)} via ${method}.
        `;
        banner.classList.add('show');
        setTimeout(() => { banner.classList.remove('show'); }, 6000);
      }

      loadBookings();
      loadDashboardStats();
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `✓ Settle & Complete Job (${bill.currSym}${bill.grandTotal.toFixed(2)})`;
    alert('Failed to settle payment: ' + err.message);
  }
}

function printReceiptSlip() {
  window.print();
}

function shareReceiptWhatsApp() {
  if (!currentPaidBooking) return;
  const inv = document.getElementById('receiptInvoiceNum')?.innerText || 'Invoice';
  const tot = document.getElementById('receiptTotalAmount')?.innerText || '$0';
  const text = `Hello ${currentPaidBooking.customer_name},\nYour service invoice ${inv} of ${tot} for vehicle ${currentPaidBooking.reg_number} has been settled successfully at Apex AutoCare. Thank you for choosing us!`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function closeReceiptModal() {
  closeModal('paymentReceiptModal');
}

async function updateBookingStatus(id, newStatus, additionalNotes) {
  if (!newStatus) return;
  try {
    const res = await fetch(`${API_BASE}/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: newStatus,
        notes: additionalNotes || undefined
      })
    });
    const result = await res.json();
    if (result.success) {
      loadBookings();
      loadDashboardStats();
    }
  } catch (err) {
    alert('Failed to update status');
  }
}

// Reschedule Modal Handlers
function openRescheduleModal(id, bookingNumber, customerName, currentDate) {
  document.getElementById('rescheduleBookingId').value = id;
  document.getElementById('rescheduleBookingInfo').innerText = `${bookingNumber} - ${customerName} (Current: ${currentDate})`;
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('rescheduleDate').value = tomorrow.toISOString().split('T')[0];

  document.getElementById('rescheduleModal').classList.add('open');
}

async function submitReschedule() {
  const id = document.getElementById('rescheduleBookingId').value;
  const newDate = document.getElementById('rescheduleDate').value;
  const reason = document.getElementById('rescheduleReason').value;

  if (!newDate) {
    alert('Please pick a new date');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/bookings/${id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_date: newDate, reason })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('rescheduleModal');
      loadBookings();
    }
  } catch (err) {
    alert('Reschedule error');
  }
}

// ========================================================
// 3.1 BOOKING DETAILS / FULL-PAGE JOB CARD FORM VIEW
// ========================================================
let activeViewBooking = null;
let previousTabBeforeDetail = 'admin-bookings';

async function openBookingDetails(bookingId) {
  try {
    // Save current active tab so back button returns user here
    if (currentTab && currentTab !== 'booking-detail-view') {
      previousTabBeforeDetail = currentTab;
    }

    // 1. First try to find in existing in-memory allBookings
    let booking = allBookings.find(b => b.id == bookingId);

    // 2. If not found (e.g. from dashboard where allBookings might not have it loaded), fetch from API
    if (!booking) {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}`);
      const data = await res.json();
      if (data.success) {
        booking = data.data;
      }
    }

    if (!booking) {
      alert('Booking record not found.');
      return;
    }

    activeViewBooking = booking;

    // Header Details
    const refEl = document.getElementById('detailBookingRef');
    if (refEl) refEl.innerText = booking.booking_number;
    const crEl = document.getElementById('detailCreatedAt');
    if (crEl) crEl.innerText = `Created: ${booking.created_at || 'Recently'}`;

    // Status Pill
    let badgeClass = 'pill-pending';
    if (booking.status === 'Confirmed') badgeClass = 'pill-confirmed';
    if (booking.status === 'In-Progress') badgeClass = 'pill-progress';
    if (booking.status === 'Completed') badgeClass = 'pill-completed';
    if (booking.status === 'Rescheduled') badgeClass = 'pill-rescheduled';
    if (booking.status === 'Cancelled' || booking.status === 'No-Show') badgeClass = 'pill-danger';

    const statusBadge = document.getElementById('detailStatusBadge');
    if (statusBadge) {
      statusBadge.className = `pill ${badgeClass}`;
      statusBadge.innerText = (booking.status || 'PENDING').toUpperCase();
    }

    // Editable Customer Profile
    const custName = document.getElementById('editDetailCustomerName');
    if (custName) custName.value = booking.customer_name || '';
    const custPhone = document.getElementById('editDetailCustomerPhone');
    if (custPhone) custPhone.value = booking.customer_phone || '';
    const custEmail = document.getElementById('editDetailCustomerEmail');
    if (custEmail) custEmail.value = booking.customer_email || '';

    // Editable Vehicle Details
    const vName = document.getElementById('editDetailVehicleName');
    if (vName) vName.value = booking.vehicle_name || '';
    const regPlate = document.getElementById('editDetailRegPlate');
    if (regPlate) regPlate.value = booking.reg_number || '';

    // Editable Service & Schedule
    const srvPkg = document.getElementById('editDetailServicePackage');
    if (srvPkg && booking.service_type) {
      srvPkg.value = booking.service_type;
      if (!srvPkg.value) srvPkg.value = 'Other';
    }
    const bDate = document.getElementById('editDetailBookingDate');
    if (bDate) bDate.value = booking.booking_date || '';
    const bSlot = document.getElementById('editDetailTimeSlot');
    if (bSlot) bSlot.value = booking.time_slot || '09:00 AM - 11:00 AM';
    const bAmount = document.getElementById('editDetailTotalAmount');
    if (bAmount) bAmount.value = parseFloat(booking.total_amount) || 0;

    // Interactive Diagnostic Checklist
    let answers = {};
    try {
      answers = typeof booking.answers_json === 'string' ? JSON.parse(booking.answers_json || '{}') : (booking.answers_json || {});
    } catch (e) { answers = {}; }

    const checklistItems = [
      { id: 'detailCheck_pickup', key: 'pickup', label: 'Doorstep Pickup & Drop', checked: !!answers.pickup, icon: '🚗' },
      { id: 'detailCheck_oil', key: 'oilChange', label: 'Synthetic Oil & Filter Flush', checked: !!answers.oilChange, icon: '🛢️' },
      { id: 'detailCheck_wheel', key: 'wheelBalancing', label: 'Wheel Balancing & Alignment', checked: !!answers.wheelBalancing, icon: '⚙️' },
      { id: 'detailCheck_ac', key: 'acCheck', label: 'AC Diagnostic & Refrigerant', checked: !!answers.acCheck, icon: '❄️' },
      { id: 'detailCheck_washing', key: 'washing', label: 'Foam Washing & Vacuum', checked: !!answers.washing, icon: '🧼' },
      { id: 'detailCheck_repair', key: 'generalRepair', label: 'General Mechanical Repair', checked: !!answers.generalRepair, icon: '🔧' },
      { id: 'detailCheck_brakes', key: 'brakes', label: 'Brake Pad & Rotor Check', checked: !!answers.brakes, icon: '🛑' },
      { id: 'detailCheck_battery', key: 'battery', label: 'Battery Health & Electrical', checked: !!answers.battery, icon: '🔋' }
    ];

    const grid = document.getElementById('detailChecklistGrid');
    if (grid) {
      grid.innerHTML = checklistItems.map(item => `
        <label class="job-card-check-item ${item.checked ? 'active' : ''}" for="${item.id}" onclick="event.stopPropagation()">
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="${item.id}" ${item.checked ? 'checked' : ''} onchange="this.closest('.job-card-check-item').classList.toggle('active', this.checked)">
            <span style="color: #fff; font-weight: 500;">${item.icon} ${item.label}</span>
          </div>
          <span style="font-size: 11px; color: ${item.checked ? '#34d399' : 'var(--text-dim)'}; font-weight: 700;">
            ${item.checked ? 'Included' : 'Optional'}
          </span>
        </label>
      `).join('');
    }

    // Editable Customer Stated Issue & Notes
    const notesEl = document.getElementById('editDetailIssueNotes');
    if (notesEl) notesEl.value = booking.issue_description || '';

    const internalNotesEl = document.getElementById('editDetailInternalNotes');
    if (internalNotesEl) internalNotesEl.value = booking.notes || '';

    // Status Selector & Interactive Stepper
    const statusSelect = document.getElementById('detailStatusSelect');
    if (statusSelect) statusSelect.value = booking.status;
    updateStepperUI(booking.status);

    // Populate Assigned Mechanic / Staff dropdown
    const staffSelect = document.getElementById('editDetailAssignedStaff');
    if (staffSelect) {
      try {
        const sres = await fetch(`${API_BASE}/staff`);
        const sdata = await sres.json();
        if (sdata.success) {
          staffSelect.innerHTML = `<option value="">-- Unassigned (Floor Pool) --</option>` + sdata.data.map(s => `
            <option value="${s.id}" ${booking.assigned_staff_id == s.id ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.role)})</option>
          `).join('');
        }
      } catch (e) {}
    }

    // Populate Workshop Bay
    const baySelect = document.getElementById('editDetailAssignedBay');
    if (baySelect) {
      if (booking.notes && booking.notes.includes('[Bay:')) {
        const match = booking.notes.match(/\[Bay:\s*([^\]]+)\]/);
        if (match) baySelect.value = match[1];
      }
    }

    // Show dedicated full-page job card view
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-tab-pill').forEach(btn => btn.classList.remove('active'));

    const detailTab = document.getElementById('tab-booking-detail-view');
    if (detailTab) {
      detailTab.style.display = 'block';
    }
    currentTab = 'booking-detail-view';
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Error opening booking details:', err);
    alert('Unable to load booking details');
  }
}

// Update Interactive Stepper UI
function updateStepperUI(status) {
  const steps = ['Pending', 'Confirmed', 'In-Progress', 'Completed'];
  const curIdx = steps.indexOf(status);

  steps.forEach((st, idx) => {
    const stepEl = document.getElementById(`step-${st}`);
    const circleEl = document.getElementById(`circle-${st}`);
    if (!stepEl || !circleEl) return;

    stepEl.classList.remove('active', 'completed');

    if (curIdx !== -1 && idx < curIdx) {
      stepEl.classList.add('completed');
      circleEl.innerHTML = '✓';
    } else if (idx === curIdx) {
      stepEl.classList.add('active');
      circleEl.innerHTML = `${idx + 1}`;
    } else {
      circleEl.innerHTML = `${idx + 1}`;
    }
  });

  // Connecting lines between steps
  for (let i = 1; i <= 3; i++) {
    const lineEl = document.getElementById(`line-${i}`);
    if (lineEl) {
      if (curIdx !== -1 && curIdx >= i) {
        lineEl.classList.add('filled');
      } else {
        lineEl.classList.remove('filled');
      }
    }
  }
}

// Change Status Directly via Stepper Tap
function changeStatusFromStepper(targetStatus) {
  if (!activeViewBooking) return;
  if (targetStatus === 'Completed') {
    handleStatusDropdownChange({ value: 'Completed' }, activeViewBooking.id);
  } else {
    updateBookingStatus(activeViewBooking.id, targetStatus);
    activeViewBooking.status = targetStatus;
    updateStepperUI(targetStatus);
    
    let badgeClass = 'pill-pending';
    if (targetStatus === 'Confirmed') badgeClass = 'pill-confirmed';
    if (targetStatus === 'In-Progress') badgeClass = 'pill-progress';
    if (targetStatus === 'Completed') badgeClass = 'pill-completed';
    if (targetStatus === 'Rescheduled') badgeClass = 'pill-rescheduled';
    if (targetStatus === 'Cancelled') badgeClass = 'pill-danger';

    const statusBadge = document.getElementById('detailStatusBadge');
    if (statusBadge) {
      statusBadge.className = `pill ${badgeClass}`;
      statusBadge.innerText = targetStatus.toUpperCase();
    }

    const statusSelect = document.getElementById('detailStatusSelect');
    if (statusSelect) statusSelect.value = targetStatus;

    const banner = document.getElementById('bookingAlertBanner');
    const msg = document.getElementById('bookingAlertMessage');
    if (banner && msg) {
      msg.innerHTML = `<strong>Workflow Stage Updated!</strong> Moved to <strong>${targetStatus}</strong>.`;
      banner.classList.add('show');
      setTimeout(() => { banner.classList.remove('show'); }, 4000);
    }
  }
}

// Save Full Job Card Edits
async function saveBookingEdits() {
  if (!activeViewBooking) return;

  const bookingId = activeViewBooking.id;
  const customer_name = document.getElementById('editDetailCustomerName')?.value.trim();
  const customer_phone = document.getElementById('editDetailCustomerPhone')?.value.trim();
  const customer_email = document.getElementById('editDetailCustomerEmail')?.value.trim();
  const vehicle_name = document.getElementById('editDetailVehicleName')?.value.trim();
  const reg_number = document.getElementById('editDetailRegPlate')?.value.trim().toUpperCase();
  const service_type = document.getElementById('editDetailServicePackage')?.value;
  const booking_date = document.getElementById('editDetailBookingDate')?.value;
  const time_slot = document.getElementById('editDetailTimeSlot')?.value;
  const total_amount = parseFloat(document.getElementById('editDetailTotalAmount')?.value) || 0;
  const issue_description = document.getElementById('editDetailIssueNotes')?.value.trim();
  let notes = document.getElementById('editDetailInternalNotes')?.value.trim() || '';
  const assigned_staff_id = document.getElementById('editDetailAssignedStaff')?.value;
  const assigned_bay = document.getElementById('editDetailAssignedBay')?.value;

  if (assigned_bay) {
    notes = notes.replace(/\[Bay:\s*[^\]]+\]/g, '').trim();
    notes = `${notes} [Bay: ${assigned_bay}]`.trim();
  }

  if (!customer_name) {
    alert('Please enter a customer name.');
    return;
  }
  if (!customer_phone) {
    alert('Please enter a customer phone number.');
    return;
  }
  if (!reg_number) {
    alert('Please enter a vehicle registration plate.');
    return;
  }
  if (!booking_date) {
    alert('Please select a bay appointment date.');
    return;
  }

  const answers_json = {
    pickup: document.getElementById('detailCheck_pickup')?.checked || false,
    oilChange: document.getElementById('detailCheck_oil')?.checked || false,
    wheelBalancing: document.getElementById('detailCheck_wheel')?.checked || false,
    acCheck: document.getElementById('detailCheck_ac')?.checked || false,
    washing: document.getElementById('detailCheck_washing')?.checked || false,
    generalRepair: document.getElementById('detailCheck_repair')?.checked || false,
    brakes: document.getElementById('detailCheck_brakes')?.checked || false,
    battery: document.getElementById('detailCheck_battery')?.checked || false
  };

  const payload = {
    customer_name,
    customer_phone,
    customer_email,
    vehicle_name,
    reg_number,
    service_type,
    booking_date,
    time_slot,
    total_amount,
    issue_description,
    notes,
    assigned_staff_id: assigned_staff_id ? parseInt(assigned_staff_id) : null,
    answers_json
  };

  const topBtn = document.getElementById('btnTopSaveJobCard');
  const bottomBtn = document.getElementById('btnBottomSaveJobCard');
  const originalTopText = topBtn ? topBtn.innerHTML : '';
  const originalBottomText = bottomBtn ? bottomBtn.innerHTML : '';

  if (topBtn) {
    topBtn.disabled = true;
    topBtn.innerHTML = `<span class="pulse-spinner"></span> Saving Changes...`;
  }
  if (bottomBtn) {
    bottomBtn.disabled = true;
    bottomBtn.innerHTML = `<span class="pulse-spinner"></span> Saving Changes...`;
  }

  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (topBtn) { topBtn.disabled = false; topBtn.innerHTML = originalTopText; }
    if (bottomBtn) { bottomBtn.disabled = false; bottomBtn.innerHTML = originalBottomText; }

    if (result.success && result.data) {
      activeViewBooking = result.data;
      
      const idx = allBookings.findIndex(b => b.id == bookingId);
      if (idx !== -1) {
        allBookings[idx] = result.data;
      }

      // Show top alert banner
      const banner = document.getElementById('bookingAlertBanner');
      const msg = document.getElementById('bookingAlertMessage');
      if (banner && msg) {
        msg.innerHTML = `
          <strong>Job Card #${result.data.booking_number} Updated!</strong>
          Details for ${escapeHtml(customer_name)} (${escapeHtml(reg_number)}) successfully updated.
        `;
        banner.classList.add('show');
        setTimeout(() => { banner.classList.remove('show'); }, 6000);
      }

      loadBookings();
      loadDashboardStats();
    } else {
      alert('Error updating job card: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    if (topBtn) { topBtn.disabled = false; topBtn.innerHTML = originalTopText; }
    if (bottomBtn) { bottomBtn.disabled = false; bottomBtn.innerHTML = originalBottomText; }
    alert('Failed to connect to server: ' + err.message);
  }
}

// 3-Dot Action Menu Handlers
function toggleRowActionMenu(e, id) {
  if (e) e.stopPropagation();
  const menu = document.getElementById(`rowActionMenu-${id}`);
  if (!menu) return;
  const isAlreadyOpen = menu.classList.contains('show');
  closeAllRowMenus();
  if (!isAlreadyOpen) {
    menu.classList.add('show');
  }
}

function closeAllRowMenus() {
  document.querySelectorAll('.row-action-menu.show').forEach(m => m.classList.remove('show'));
}

window.addEventListener('click', () => {
  closeAllRowMenus();
});

async function confirmCancelBooking(id, bookingNumber) {
  if (confirm(`Are you sure you want to cancel booking ${bookingNumber}?`)) {
    await updateBookingStatus(id, 'Cancelled');
  }
}

async function printJobCardForBooking(id) {
  await openBookingDetails(id);
  setTimeout(() => {
    printJobCard();
  }, 350);
}

function closeBookingDetailView() {
  const detailTab = document.getElementById('tab-booking-detail-view');
  if (detailTab) detailTab.style.display = 'none';
  switchTab(previousTabBeforeDetail || 'admin-bookings');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveStatusFromModal() {
  if (!activeViewBooking) return;
  const statusSelect = document.getElementById('detailStatusSelect');
  const newStatus = statusSelect ? statusSelect.value : null;
  if (!newStatus) return;

  if (newStatus === 'Completed') {
    // Open payment flow
    handleStatusDropdownChange({ value: 'Completed' }, activeViewBooking.id);
  } else {
    updateBookingStatus(activeViewBooking.id, newStatus);
    activeViewBooking.status = newStatus;
    updateStepperUI(newStatus);

    // Update status badge immediately in view
    let badgeClass = 'pill-pending';
    if (newStatus === 'Confirmed') badgeClass = 'pill-confirmed';
    if (newStatus === 'In-Progress') badgeClass = 'pill-progress';
    if (newStatus === 'Completed') badgeClass = 'pill-completed';
    if (newStatus === 'Rescheduled') badgeClass = 'pill-rescheduled';
    if (newStatus === 'Cancelled' || newStatus === 'No-Show') badgeClass = 'pill-danger';

    const statusBadge = document.getElementById('detailStatusBadge');
    if (statusBadge) {
      statusBadge.className = `pill ${badgeClass}`;
      statusBadge.innerText = newStatus.toUpperCase();
    }

    const banner = document.getElementById('bookingAlertBanner');
    const msg = document.getElementById('bookingAlertMessage');
    if (banner && msg) {
      msg.innerHTML = `<strong>Status Updated!</strong> Booking #${activeViewBooking.booking_number} updated to ${newStatus}.`;
      banner.classList.add('show');
      setTimeout(() => { banner.classList.remove('show'); }, 5000);
    }
  }
}

function openRescheduleFromDetails() {
  if (!activeViewBooking) return;
  const b = activeViewBooking;
  openRescheduleModal(b.id, b.booking_number, b.customer_name, b.booking_date);
}

function printJobCard() {
  window.print();
}

// ========================================================
// 4. STORE INVENTORY
// ========================================================
async function loadInventory(lowStockOnly = false) {
  const tbody = document.getElementById('inventoryTableBody');
  const search = document.getElementById('invSearchInput').value;

  try {
    const url = `${API_BASE}/inventory?search=${encodeURIComponent(search)}${lowStockOnly ? '&low_stock=true' : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      allInventory = data.data;
      renderInventoryTable(allInventory);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:#f87171; text-align:center;">Failed to load inventory.</td></tr>`;
  }
}

function filterLowStock() {
  loadInventory(true);
}

function renderInventoryTable(parts) {
  const tbody = document.getElementById('inventoryTableBody');
  if (parts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--text-dim);">No parts in catalog.</td></tr>`;
    return;
  }

  tbody.innerHTML = parts.map(p => {
    const isLow = p.stock_qty <= p.min_threshold;
    return `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">${escapeHtml(p.sku)}</td>
        <td style="font-weight:600; color:#fff;">${escapeHtml(p.part_name)}</td>
        <td><span class="pill" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">${escapeHtml(p.category)}</span></td>
        <td>
          <span style="font-weight:700; ${isLow ? 'color:#f87171;' : 'color:#fff;'}">${p.stock_qty} units</span>
          ${isLow ? '<span class="pill pill-danger" style="margin-left:4px; font-size:9.5px;">Low!</span>' : ''}
        </td>
        <td style="color:var(--text-dim);">${p.min_threshold}</td>
        <td style="font-family:var(--font-mono);">$${p.unit_cost.toLocaleString('en-US')}</td>
        <td style="font-weight:700; color:#34d399; font-family:var(--font-mono);">$${p.selling_price.toLocaleString('en-US')}</td>
        <td><span style="background:rgba(255,255,255,0.04); padding:2px 6px; border-radius:4px; font-size:11px;">${escapeHtml(p.location || 'Rack 1')}</span></td>
        <td style="font-size:11.5px; color:var(--text-dim);">${escapeHtml(p.vendor_name || 'Direct')}</td>
        <td>
          <div style="display:flex; gap:4px;">
            <button class="btn-neo btn-neo-secondary btn-neo-sm" onclick="adjustStock(${p.id}, 1)">+1</button>
            <button class="btn-neo btn-neo-secondary btn-neo-sm" onclick="adjustStock(${p.id}, -1)">-1</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function adjustStock(id, changeQty) {
  try {
    const res = await fetch(`${API_BASE}/inventory/${id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ change_qty: changeQty })
    });
    const data = await res.json();
    if (data.success) {
      loadInventory();
    }
  } catch (err) {
    alert('Failed to update stock');
  }
}

function openAddPartModal() {
  document.getElementById('addPartModal').classList.add('open');
}

async function submitNewPart(e) {
  e.preventDefault();
  const payload = {
    sku: document.getElementById('partSku').value,
    part_name: document.getElementById('partName').value,
    category: document.getElementById('partCategory').value,
    stock_qty: parseInt(document.getElementById('partStock').value),
    min_threshold: parseInt(document.getElementById('partMin').value),
    unit_cost: parseFloat(document.getElementById('partCost').value),
    selling_price: parseFloat(document.getElementById('partPrice').value),
    location: document.getElementById('partLocation').value
  };

  try {
    const res = await fetch(`${API_BASE}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal('addPartModal');
      document.getElementById('addPartForm').reset();
      loadInventory();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Server error');
  }
}

// ========================================================
// 5. EXPENSE MANAGEMENT
// ========================================================
async function loadExpenses() {
  const tbody = document.getElementById('expensesTableBody');
  const cat = document.getElementById('expenseCategoryFilter').value;

  try {
    const res = await fetch(`${API_BASE}/expenses?category=${encodeURIComponent(cat)}`);
    const data = await res.json();
    if (data.success) {
      renderExpensesTable(data.data);
      renderExpenseCategorySummary(data.categoryTotals);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#f87171; text-align:center;">Failed to load expenses.</td></tr>`;
  }
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expensesTableBody');
  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-dim);">No expense records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td style="font-weight:600; font-size:11.5px;">${e.expense_date}</td>
      <td style="font-weight:600; color:#fff;">${escapeHtml(e.title)}</td>
      <td><span class="pill" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">${escapeHtml(e.category)}</span></td>
      <td>
        ${e.vendor_name ? `<span class="pill" style="background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.3); color:#fbbf24; font-size:11px;">🏢 ${escapeHtml(e.vendor_name)}</span>` : '<span style="color:var(--text-dim); font-size:11px;">—</span>'}
      </td>
      <td style="font-weight:700; color:#f87171; font-family:var(--font-mono);">$${Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td><span style="font-size:11px; color:var(--text-dim);">${escapeHtml(e.payment_mode)}</span></td>
      <td style="font-size:11px; color:var(--text-dim);">${escapeHtml(e.notes || '-')}</td>
    </tr>
  `).join('');
}

function renderExpenseCategorySummary(totals) {
  const summaryDiv = document.getElementById('expenseCategorySummary');
  if (!totals || totals.length === 0) {
    summaryDiv.innerHTML = '<span style="font-size:11px; color:var(--text-dim);">No expense summary.</span>';
    return;
  }

  let grandTotal = totals.reduce((sum, item) => sum + item.total, 0);

  summaryDiv.innerHTML = `
    <div style="font-size:14px; font-weight:800; color:#fff; margin-bottom:8px; font-family:var(--font-mono);">
      Total Outflow: $${grandTotal.toLocaleString('en-US')}
    </div>
  ` + totals.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-weight:600; font-size:12px; color:var(--text-muted);">${escapeHtml(item.category)}</span>
      <span style="font-weight:700; color:#f87171; font-family:var(--font-mono); font-size:12px;">$${item.total.toLocaleString('en-US')}</span>
    </div>
  `).join('');
}

function toggleExpenseVendorDropdown(isChecked) {
  const wrapper = document.getElementById('expenseVendorFieldWrapper');
  const select = document.getElementById('expVendorSelect');
  if (!wrapper || !select) return;

  if (isChecked) {
    wrapper.style.opacity = '1';
    wrapper.style.pointerEvents = 'auto';
    select.disabled = false;
  } else {
    wrapper.style.opacity = '0.4';
    wrapper.style.pointerEvents = 'none';
    select.disabled = true;
    select.value = '';
  }
}

async function openAddExpenseModal() {
  // Pre-fill today's date if empty
  const dateInput = document.getElementById('expDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Reset vendor checkbox and disable dropdown
  const chk = document.getElementById('expenseHasVendor');
  if (chk) chk.checked = false;
  toggleExpenseVendorDropdown(false);

  // Load registered vendors list into dropdown
  const select = document.getElementById('expVendorSelect');
  if (select) {
    select.innerHTML = '<option value="">-- Choose Vendor / Supplier --</option>';
    try {
      const res = await fetch(`${API_BASE}/vendors`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        data.data.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = `${v.company_name} (${v.category || 'Supplier'})`;
          opt.dataset.name = v.company_name;
          select.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Could not load vendors for expense modal:', err);
    }
  }

  document.getElementById('addExpenseModal').classList.add('open');
}

async function submitNewExpense(e) {
  e.preventDefault();
  const hasVendor = document.getElementById('expenseHasVendor')?.checked;
  const vendorSelect = document.getElementById('expVendorSelect');
  
  let vendor_id = null;
  let vendor_name = null;
  if (hasVendor && vendorSelect && vendorSelect.value) {
    vendor_id = parseInt(vendorSelect.value);
    const selectedOpt = vendorSelect.options[vendorSelect.selectedIndex];
    vendor_name = selectedOpt ? (selectedOpt.dataset.name || selectedOpt.textContent.split(' (')[0]) : null;
  }

  const payload = {
    title: document.getElementById('expTitle').value,
    category: document.getElementById('expCategory').value,
    amount: parseFloat(document.getElementById('expAmount').value),
    expense_date: document.getElementById('expDate').value,
    payment_mode: document.getElementById('expMode').value,
    notes: document.getElementById('expNotes').value,
    vendor_id: vendor_id,
    vendor_name: vendor_name
  };

  try {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal('addExpenseModal');
      document.getElementById('addExpenseForm').reset();
      toggleExpenseVendorDropdown(false);
      loadExpenses();
    } else {
      alert(data.error || 'Failed to record expense');
    }
  } catch (err) {
    alert('Expense recording error');
  }
}

// ========================================================
// 6. STAFF MODE
// ========================================================
async function loadStaff() {
  const tbody = document.getElementById('staffTableBody');
  try {
    const res = await fetch(`${API_BASE}/staff`);
    const data = await res.json();
    if (data.success) {
      renderStaffTable(data.data);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:#f87171; text-align:center;">Failed to load crew.</td></tr>`;
  }
}

function renderStaffTable(staffList) {
  const tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = staffList.map(s => `
    <tr>
      <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">#STF-${s.id}</td>
      <td style="font-weight:700; color:#fff;">${escapeHtml(s.name)}</td>
      <td><span class="pill pill-confirmed">${escapeHtml(s.role)}</span></td>
      <td>${escapeHtml(s.phone)}</td>
      <td style="font-size:11px; color:var(--text-dim);">${escapeHtml(s.skills || '-')}</td>
      <td style="font-weight:600; font-family:var(--font-mono);">$${s.salary ? s.salary.toLocaleString('en-US') : 0}/mo</td>
      <td><span class="pill ${s.status === 'Active' ? 'pill-completed' : 'pill-danger'}">${s.status}</span></td>
      <td>
        <button class="btn-neo btn-neo-secondary btn-neo-sm" onclick="toggleStaffStatus(${s.id}, '${s.status}')">
          ${s.status === 'Active' ? 'Set Off-Duty' : 'Set Active'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function toggleStaffStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'On-Leave' : 'Active';
  await fetch(`${API_BASE}/staff/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  loadStaff();
}

function openAddStaffModal() {
  document.getElementById('addStaffModal').classList.add('open');
}

async function submitNewStaff(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('staffName').value,
    role: document.getElementById('staffRole').value,
    phone: document.getElementById('staffPhone').value,
    salary: parseFloat(document.getElementById('staffSalary').value) || 0,
    skills: document.getElementById('staffSkills').value
  };

  try {
    const res = await fetch(`${API_BASE}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal('addStaffModal');
      document.getElementById('addStaffForm').reset();
      loadStaff();
    }
  } catch (err) {
    alert('Staff creation error');
  }
}

// ========================================================
// 7. VENDORS MODE
// ========================================================
let allVendors = [];

async function loadVendors() {
  const tbody = document.getElementById('vendorsTableBody');
  try {
    const res = await fetch(`${API_BASE}/vendors`);
    const data = await res.json();
    if (data.success) {
      allVendors = data.data;
      renderVendorsTable(allVendors);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:#f87171; text-align:center;">Failed to load vendors.</td></tr>`;
  }
}

function renderVendorsTable(vendors) {
  const tbody = document.getElementById('vendorsTableBody');
  tbody.innerHTML = vendors.map(v => `
    <tr>
      <td style="font-family:var(--font-mono); font-weight:700; color:#fbbf24;">#VND-${v.id}</td>
      <td style="font-weight:700; color:#fff;">${escapeHtml(v.company_name)}</td>
      <td>${escapeHtml(v.contact_person)}</td>
      <td>
        <div style="font-weight:600;">${escapeHtml(v.phone)}</div>
        <div style="font-size:11px; color:#fbbf24; font-family:var(--font-mono);">${escapeHtml(v.email || 'No email')}</div>
      </td>
      <td><span class="pill" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">${escapeHtml(v.category || 'General')}</span></td>
      <td style="font-family:var(--font-mono); font-size:11px;">${escapeHtml(v.gst_number || '-')}</td>
      <td style="font-weight:700; font-family:var(--font-mono); ${v.pending_payment > 0 ? 'color:#f87171;' : 'color:#34d399;'}">
        $${v.pending_payment.toLocaleString('en-US')}
      </td>
      <td>
        <button class="btn-neo btn-neo-secondary btn-neo-sm" onclick="openEditVendorModal(${v.id})" title="Edit Supplier Information">
          Edit
        </button>
      </td>
    </tr>
  `).join('');
}

function openAddVendorModal() {
  document.getElementById('addVendorModal').classList.add('open');
}

async function submitNewVendor(e) {
  e.preventDefault();
  const payload = {
    company_name: document.getElementById('vendorCompany').value,
    contact_person: document.getElementById('vendorContact').value,
    phone: document.getElementById('vendorPhone').value,
    email: document.getElementById('vendorEmail').value,
    category: document.getElementById('vendorCategory').value,
    gst_number: document.getElementById('vendorGst').value,
    pending_payment: parseFloat(document.getElementById('vendorBalance').value) || 0
  };

  try {
    const res = await fetch(`${API_BASE}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal('addVendorModal');
      document.getElementById('addVendorForm').reset();
      loadVendors();
      loadDashboardStats();
    }
  } catch (err) {
    alert('Vendor creation error');
  }
}

// Open Edit Vendor Modal and Pre-populate Fields
function openEditVendorModal(vendorId) {
  const vendor = allVendors.find(v => v.id == vendorId);
  if (!vendor) return;

  document.getElementById('editVendorId').value = vendor.id;
  document.getElementById('editVendorCompany').value = vendor.company_name;
  document.getElementById('editVendorContact').value = vendor.contact_person;
  document.getElementById('editVendorPhone').value = vendor.phone;
  document.getElementById('editVendorEmail').value = vendor.email || '';
  document.getElementById('editVendorCategory').value = vendor.category || '';
  document.getElementById('editVendorGst').value = vendor.gst_number || '';
  document.getElementById('editVendorBalance').value = vendor.pending_payment || 0;

  document.getElementById('editVendorModal').classList.add('open');
}

// Submit Updated Vendor Info
async function submitEditVendor(e) {
  e.preventDefault();
  const vendorId = document.getElementById('editVendorId').value;
  const payload = {
    company_name: document.getElementById('editVendorCompany').value,
    contact_person: document.getElementById('editVendorContact').value,
    phone: document.getElementById('editVendorPhone').value,
    email: document.getElementById('editVendorEmail').value,
    category: document.getElementById('editVendorCategory').value,
    gst_number: document.getElementById('editVendorGst').value,
    pending_payment: parseFloat(document.getElementById('editVendorBalance').value) || 0
  };

  try {
    const res = await fetch(`${API_BASE}/vendors/${vendorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal('editVendorModal');
      loadVendors();
      loadDashboardStats();
    } else {
      alert('Update error: ' + data.error);
    }
  } catch (err) {
    alert('Server error updating vendor');
  }
}

// ========================================================
// 8. SERVICE RATE CARD & MASTER PRICING (ADMIN)
// ========================================================
let allRateCardItems = [];
let currentRateCardCategory = 'All';

async function loadRateCard() {
  const tbody = document.getElementById('rateCardTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/rate-card`);
    const result = await res.json();
    if (result.success) {
      allRateCardItems = result.data || [];
      renderRateCardTable(allRateCardItems);
      updateRateCardKPIs(allRateCardItems);
    } else {
      tbody.innerHTML = `<tr><td colspan="7" style="color:#f87171; text-align:center;">Failed to load rate card.</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#f87171; text-align:center;">Failed to connect to rate card API.</td></tr>`;
  }
}

function updateRateCardKPIs(items) {
  const countEl = document.getElementById('rcTotalServices');
  if (countEl) countEl.innerText = `${items.length} Tiers`;

  const wash = items.find(i => i.service_name.toLowerCase().includes('wash') || i.service_code === 'SRV-WASH');
  const normal = items.find(i => i.service_name.toLowerCase().includes('normal') || i.service_code === 'SRV-NORMAL');
  const deep = items.find(i => i.service_name.toLowerCase().includes('deep') || i.service_code === 'SRV-DEEP');

  if (document.getElementById('rcWashPrice') && wash) {
    document.getElementById('rcWashPrice').innerText = `$${wash.base_price.toFixed(2)}`;
  }
  if (document.getElementById('rcNormalPrice') && normal) {
    document.getElementById('rcNormalPrice').innerText = `$${normal.base_price.toFixed(2)}`;
  }
  if (document.getElementById('rcDeepPrice') && deep) {
    document.getElementById('rcDeepPrice').innerText = `$${deep.base_price.toFixed(2)}`;
  }
}

function renderRateCardTable(items) {
  const tbody = document.getElementById('rateCardTableBody');
  if (!tbody) return;

  let filtered = items;
  if (currentRateCardCategory !== 'All') {
    filtered = filtered.filter(i => i.category === currentRateCardCategory);
  }

  const searchInput = document.getElementById('rcSearchInput')?.value.trim().toLowerCase();
  if (searchInput) {
    filtered = filtered.filter(i => 
      i.service_name.toLowerCase().includes(searchInput) ||
      i.service_code.toLowerCase().includes(searchInput) ||
      (i.description && i.description.toLowerCase().includes(searchInput))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-dim);">No service rates found matching filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    let icon = '🔧';
    if (item.category.includes('Wash')) icon = '🧼';
    if (item.category.includes('Fluid') || item.category.includes('Oil')) icon = '🛢️';
    if (item.category.includes('Detail')) icon = '✨';
    if (item.category.includes('Brake')) icon = '🛑';
    if (item.category.includes('AC') || item.category.includes('Electrical')) icon = '❄️';

    return `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">
          ${escapeHtml(item.service_code)}
        </td>
        <td>
          <div style="font-weight:700; color:#fff; font-size:13px; display:flex; align-items:center; gap:6px;">
            <span>${icon}</span>
            <span>${escapeHtml(item.service_name)}</span>
          </div>
          <div style="font-size:11px; color:var(--text-dim); margin-top:3px; max-width:320px;">
            ${escapeHtml(item.description || 'Standard garage labor and inspection')}
          </div>
        </td>
        <td>
          <span class="pill pill-confirmed" style="font-size:10.5px;">${escapeHtml(item.category)}</span>
        </td>
        <td>
          <span style="font-family:var(--font-mono); font-size:11.5px; color:#e2e8f0;">${item.estimated_time_mins} mins</span>
        </td>
        <td>
          <span style="font-family:var(--font-mono); font-size:15px; font-weight:900; color:#fbbf24;">
            $${parseFloat(item.base_price).toFixed(2)}
          </span>
        </td>
        <td>
          <span class="pill pill-progress" style="font-size:10px;">Active</span>
        </td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn-neo btn-neo-primary btn-neo-sm" title="Edit Price & Scope" onclick="openEditRateCardModal(${item.id})">
              ✏️ Edit Price
            </button>
            <button class="btn-neo btn-neo-secondary btn-neo-sm" style="color:#f87171;" title="Deactivate" onclick="deleteRateCardItem(${item.id}, '${escapeHtml(item.service_name)}')">
              ✕
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterRateCardCategory(cat, btn) {
  currentRateCardCategory = cat;
  document.querySelectorAll('#rateCardCategoryFilter .filter-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderRateCardTable(allRateCardItems);
}

let rcSearchTimer = null;
function debounceRateCardSearch() {
  clearTimeout(rcSearchTimer);
  rcSearchTimer = setTimeout(() => {
    renderRateCardTable(allRateCardItems);
  }, 200);
}

function openAddRateCardModal() {
  document.getElementById('rcItemId').value = '';
  document.getElementById('rcServiceName').value = '';
  document.getElementById('rcCategory').value = 'Cleaning & Wash';
  document.getElementById('rcBasePrice').value = '';
  document.getElementById('rcTimeMins').value = '45';
  document.getElementById('rcDescription').value = '';
  document.getElementById('rateCardModalTitle').innerText = 'Add New Service Rate';
  document.getElementById('rateCardModal').classList.add('open');
}

function openEditRateCardModal(id) {
  const item = allRateCardItems.find(i => i.id == id);
  if (!item) return;

  document.getElementById('rcItemId').value = item.id;
  document.getElementById('rcServiceName').value = item.service_name;
  document.getElementById('rcCategory').value = item.category;
  document.getElementById('rcBasePrice').value = item.base_price;
  document.getElementById('rcTimeMins').value = item.estimated_time_mins || 60;
  document.getElementById('rcDescription').value = item.description || '';
  document.getElementById('rateCardModalTitle').innerText = `Edit Rate: ${item.service_name}`;
  document.getElementById('rateCardModal').classList.add('open');
}

async function submitRateCardForm(e) {
  e.preventDefault();
  const id = document.getElementById('rcItemId').value;
  const payload = {
    service_name: document.getElementById('rcServiceName').value.trim(),
    category: document.getElementById('rcCategory').value,
    base_price: parseFloat(document.getElementById('rcBasePrice').value),
    estimated_time_mins: parseInt(document.getElementById('rcTimeMins').value) || 60,
    description: document.getElementById('rcDescription').value.trim(),
    garage_id: currentUser ? currentUser.garage_id : 1
  };

  try {
    let url = `${API_BASE}/rate-card`;
    let method = 'POST';
    if (id) {
      url += `/${id}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      closeModal('rateCardModal');
      loadRateCard();

      const banner = document.getElementById('bookingAlertBanner');
      const msg = document.getElementById('bookingAlertMessage');
      if (banner && msg) {
        msg.innerHTML = `<strong>Rate Card Updated!</strong> Price for "${escapeHtml(payload.service_name)}" set to $${payload.base_price.toFixed(2)}.`;
        banner.classList.add('show');
        setTimeout(() => { banner.classList.remove('show'); }, 4000);
      }
    } else {
      alert('Error saving rate card: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Failed to connect to server: ' + err.message);
  }
}

async function deleteRateCardItem(id, name) {
  if (confirm(`Are you sure you want to remove "${name}" from the active rate card?`)) {
    try {
      const res = await fetch(`${API_BASE}/rate-card/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        loadRateCard();
      }
    } catch (err) {
      alert('Failed to delete item');
    }
  }
}

// ========================================================
// GARAGE PROFILE & COUNTRY TAX SETTINGS MODULE
// ========================================================

async function loadSettings() {
  try {
    const garageId = currentUser ? currentUser.garage_id : 1;
    const res = await fetch(`${API_BASE}/settings?garage_id=${garageId}`);
    const data = await res.json();
    if (data.success && data.settings) {
      currentSettings = { ...currentSettings, ...data.settings };
      populateSettingsForm(currentSettings);
      updateSettingsKpis(currentSettings);
      updateSettingsLivePreview();
    }
  } catch (err) {
    console.error('Failed to load garage settings:', err);
  }
}

function populateSettingsForm(s) {
  if (document.getElementById('cfgCountry')) document.getElementById('cfgCountry').value = s.country || 'India';
  if (document.getElementById('cfgTaxName')) document.getElementById('cfgTaxName').value = s.tax_name || 'GST';
  if (document.getElementById('cfgTaxRate')) document.getElementById('cfgTaxRate').value = s.tax_rate !== undefined ? s.tax_rate : 18.0;
  if (document.getElementById('cfgTaxLabel')) document.getElementById('cfgTaxLabel').value = s.tax_label || 'GSTIN';
  if (document.getElementById('cfgTaxNumber')) document.getElementById('cfgTaxNumber').value = s.tax_number || '07AAPCA1234F1Z5';
  if (document.getElementById('cfgCurrencySymbol')) document.getElementById('cfgCurrencySymbol').value = s.currency_symbol || '₹';
  if (document.getElementById('cfgCurrencyCode')) document.getElementById('cfgCurrencyCode').value = s.currency_code || 'INR';
  if (document.getElementById('cfgTaxEnabled')) document.getElementById('cfgTaxEnabled').value = (s.tax_enabled == 1 || s.tax_enabled === true) ? '1' : '0';

  if (document.getElementById('cfgGarageName')) document.getElementById('cfgGarageName').value = s.garage_name || 'Apex Performance AutoCare';
  if (document.getElementById('cfgTagline')) document.getElementById('cfgTagline').value = s.tagline || 'Premium Multi-Brand Auto Care & Detailing Studio';
  if (document.getElementById('cfgPhone')) document.getElementById('cfgPhone').value = s.phone || '+91 98765 43210';
  if (document.getElementById('cfgEmail')) document.getElementById('cfgEmail').value = s.email || 'contact@apexauto.com';
  if (document.getElementById('cfgAddress')) document.getElementById('cfgAddress').value = s.address || 'Plot 42, Motor Way Hub, Sector 18, Gurugram, India';
  if (document.getElementById('cfgInvoicePrefix')) document.getElementById('cfgInvoicePrefix').value = s.invoice_prefix || 'INV';
  if (document.getElementById('cfgFooterNotes')) document.getElementById('cfgFooterNotes').value = s.footer_notes || 'Thank you for choosing Apex Performance AutoCare! Drive safe with confidence.';

  const preset = COUNTRY_TAX_PRESETS[s.country];
  if (preset && document.getElementById('cfgCountryNote')) {
    document.getElementById('cfgCountryNote').innerText = preset.notes;
  }
}

function updateSettingsKpis(s) {
  if (document.getElementById('statSettingsCountry')) {
    const flags = { 'India': '🇮🇳', 'United Arab Emirates': '🇦🇪', 'Saudi Arabia': '🇸🇦', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Germany': '🇩🇪', 'Singapore': '🇸🇬' };
    document.getElementById('statSettingsCountry').innerText = `${s.country || 'India'} ${flags[s.country] || '🌐'}`;
  }
  if (document.getElementById('statSettingsCurrency')) {
    document.getElementById('statSettingsCurrency').innerText = `Currency: ${s.currency_code || 'INR'} (${s.currency_symbol || '₹'})`;
  }
  if (document.getElementById('statSettingsTaxType')) {
    const isTaxOn = (s.tax_enabled == 1 || s.tax_enabled === true);
    document.getElementById('statSettingsTaxType').innerText = isTaxOn ? `${s.tax_name || 'GST'} ${s.tax_rate}%` : 'Tax Disabled';
  }
  if (document.getElementById('statSettingsTaxStatus')) {
    const isTaxOn = (s.tax_enabled == 1 || s.tax_enabled === true);
    document.getElementById('statSettingsTaxStatus').innerText = isTaxOn ? 'Automated Invoice Calculation' : 'Zero Tax Invoicing';
  }
  if (document.getElementById('statSettingsTaxNumber')) {
    document.getElementById('statSettingsTaxNumber').innerText = s.tax_number || 'N/A';
  }
  if (document.getElementById('statSettingsTaxLabel')) {
    document.getElementById('statSettingsTaxLabel').innerText = `${s.tax_label || 'GSTIN'} Configured`;
  }
  if (document.getElementById('statSettingsPrefix')) {
    document.getElementById('statSettingsPrefix').innerText = `${s.invoice_prefix || 'INV'}-`;
  }
}

function handleCountryChange(countryVal) {
  const preset = COUNTRY_TAX_PRESETS[countryVal] || COUNTRY_TAX_PRESETS['Other'];
  
  if (document.getElementById('cfgCurrencySymbol')) document.getElementById('cfgCurrencySymbol').value = preset.currency_symbol;
  if (document.getElementById('cfgCurrencyCode')) document.getElementById('cfgCurrencyCode').value = preset.currency_code;
  if (document.getElementById('cfgTaxName')) document.getElementById('cfgTaxName').value = preset.tax_name;
  if (document.getElementById('cfgTaxRate')) document.getElementById('cfgTaxRate').value = preset.tax_rate;
  if (document.getElementById('cfgTaxLabel')) document.getElementById('cfgTaxLabel').value = preset.tax_label;
  if (document.getElementById('cfgTaxNumber')) document.getElementById('cfgTaxNumber').value = preset.tax_number;
  
  const noteEl = document.getElementById('cfgCountryNote');
  if (noteEl) noteEl.innerText = preset.notes;

  updateSettingsLivePreview();
}

function updateSettingsLivePreview() {
  const country = document.getElementById('cfgCountry')?.value || currentSettings.country || 'India';
  const garageName = document.getElementById('cfgGarageName')?.value || currentSettings.garage_name || 'Apex Performance AutoCare';
  const tagline = document.getElementById('cfgTagline')?.value || currentSettings.tagline || '';
  const address = document.getElementById('cfgAddress')?.value || currentSettings.address || '';
  const phone = document.getElementById('cfgPhone')?.value || currentSettings.phone || '';
  const taxLabel = document.getElementById('cfgTaxLabel')?.value || currentSettings.tax_label || 'GSTIN';
  const taxNumber = document.getElementById('cfgTaxNumber')?.value || currentSettings.tax_number || '';
  const taxName = document.getElementById('cfgTaxName')?.value || currentSettings.tax_name || 'GST';
  const taxRate = parseFloat(document.getElementById('cfgTaxRate')?.value) || 0;
  const currSym = document.getElementById('cfgCurrencySymbol')?.value || currentSettings.currency_symbol || '₹';
  const isTaxEnabled = (document.getElementById('cfgTaxEnabled')?.value === '1');
  const invPrefix = document.getElementById('cfgInvoicePrefix')?.value || 'INV';
  const footerNotes = document.getElementById('cfgFooterNotes')?.value || currentSettings.footer_notes || '';

  // Update Preview Elements
  if (document.getElementById('prevGarageName')) document.getElementById('prevGarageName').innerText = garageName.toUpperCase();
  if (document.getElementById('prevTagline')) document.getElementById('prevTagline').innerText = tagline;
  if (document.getElementById('prevAddress')) document.getElementById('prevAddress').innerText = address;
  if (document.getElementById('prevPhone')) document.getElementById('prevPhone').innerText = `Ph: ${phone}`;
  if (document.getElementById('prevTaxId')) document.getElementById('prevTaxId').innerText = `${taxLabel}: ${taxNumber}`;
  if (document.getElementById('prevInvoiceNum')) document.getElementById('prevInvoiceNum').innerText = `TAX INVOICE: ${invPrefix}-1092`;
  if (document.getElementById('prevFooterNotes')) document.getElementById('prevFooterNotes').innerText = footerNotes;

  // Pricing math for preview
  const sampleBase = 150.0;
  const sampleExtra = 45.0;
  const sampleSubtotal = sampleBase + sampleExtra;
  const taxAmount = isTaxEnabled ? (sampleSubtotal * (taxRate / 100)) : 0;
  const grandTotal = sampleSubtotal + taxAmount;

  if (document.getElementById('prevItemBasePrice')) document.getElementById('prevItemBasePrice').innerText = `${currSym}${sampleBase.toFixed(2)}`;
  if (document.getElementById('prevItemExtraPrice')) document.getElementById('prevItemExtraPrice').innerText = `${currSym}${sampleExtra.toFixed(2)}`;
  if (document.getElementById('prevSubtotal')) document.getElementById('prevSubtotal').innerText = `${currSym}${sampleSubtotal.toFixed(2)}`;
  if (document.getElementById('prevGrandTotal')) document.getElementById('prevGrandTotal').innerText = `${currSym}${grandTotal.toFixed(2)}`;

  const taxLinesContainer = document.getElementById('prevTaxLines');
  if (taxLinesContainer) {
    if (!isTaxEnabled || taxRate === 0) {
      taxLinesContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; color:var(--text-dim);">
          <span>Tax Status:</span>
          <span style="font-family:var(--font-mono); font-weight:700;">Zero Tax / Exempt</span>
        </div>
      `;
    } else if (country === 'India') {
      const halfRate = (taxRate / 2).toFixed(1);
      const halfTax = (taxAmount / 2).toFixed(2);
      taxLinesContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; color:#34d399;">
          <span>CGST (${halfRate}%):</span>
          <span style="font-family:var(--font-mono); font-weight:700;">${currSym}${halfTax}</span>
        </div>
        <div style="display:flex; justify-content:space-between; color:#34d399;">
          <span>SGST (${halfRate}%):</span>
          <span style="font-family:var(--font-mono); font-weight:700;">${currSym}${halfTax}</span>
        </div>
      `;
    } else {
      taxLinesContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; color:#34d399;">
          <span>${taxName} (${taxRate.toFixed(1)}%):</span>
          <span style="font-family:var(--font-mono); font-weight:700;">${currSym}${taxAmount.toFixed(2)}</span>
        </div>
      `;
    }
  }
}

async function saveGarageSettings() {
  const payload = {
    garage_id: currentUser ? currentUser.garage_id : 1,
    country: document.getElementById('cfgCountry')?.value || 'India',
    garage_name: document.getElementById('cfgGarageName')?.value.trim() || 'Apex Performance AutoCare',
    tagline: document.getElementById('cfgTagline')?.value.trim() || '',
    phone: document.getElementById('cfgPhone')?.value.trim() || '',
    email: document.getElementById('cfgEmail')?.value.trim() || '',
    address: document.getElementById('cfgAddress')?.value.trim() || '',
    currency_symbol: document.getElementById('cfgCurrencySymbol')?.value.trim() || '₹',
    currency_code: document.getElementById('cfgCurrencyCode')?.value.trim() || 'INR',
    tax_enabled: document.getElementById('cfgTaxEnabled')?.value === '1' ? 1 : 0,
    tax_name: document.getElementById('cfgTaxName')?.value.trim() || 'GST',
    tax_rate: parseFloat(document.getElementById('cfgTaxRate')?.value) || 0,
    tax_label: document.getElementById('cfgTaxLabel')?.value.trim() || 'GSTIN',
    tax_number: document.getElementById('cfgTaxNumber')?.value.trim() || '',
    invoice_prefix: document.getElementById('cfgInvoicePrefix')?.value.trim() || 'INV',
    footer_notes: document.getElementById('cfgFooterNotes')?.value.trim() || ''
  };

  const btnTop = document.getElementById('btnSaveGarageSettingsTop');
  const btnBottom = document.getElementById('btnSaveGarageSettingsBottom');
  if (btnTop) btnTop.disabled = true;
  if (btnBottom) btnBottom.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (btnTop) btnTop.disabled = false;
    if (btnBottom) btnBottom.disabled = false;

    if (result.success) {
      currentSettings = { ...currentSettings, ...result.settings };
      updateSettingsKpis(currentSettings);
      updateSettingsLivePreview();

      // Update Garage Name in Navbar and Current User Cache
      const navGarage = document.getElementById('navGarageName');
      if (navGarage) navGarage.innerText = payload.garage_name;

      if (currentUser) {
        currentUser.garage_name = payload.garage_name;
        localStorage.setItem('apex_user', JSON.stringify(currentUser));
      }

      // Show celebratory notification toast
      const banner = document.getElementById('bookingAlertBanner');
      const msg = document.getElementById('bookingAlertMessage');
      if (banner && msg) {
        msg.innerHTML = `
          <strong>Garage Settings & Tax Engine Saved!</strong> 
          Country set to ${payload.country} with ${payload.tax_enabled ? (payload.tax_name + ' ' + payload.tax_rate + '%') : 'Zero Tax'} & currency ${payload.currency_symbol}.
        `;
        banner.classList.add('show');
        setTimeout(() => { banner.classList.remove('show'); }, 5000);
      }
    } else {
      alert('Error saving settings: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    if (btnTop) btnTop.disabled = false;
    if (btnBottom) btnBottom.disabled = false;
    alert('Failed to save settings: ' + err.message);
  }
}

// Helpers
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('open');
}

function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
