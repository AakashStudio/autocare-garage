/**
 * Main Express Server
 * Clean REST API for:
 * 1. Bookings (Create, Update Status, Reschedule to tomorrow, Cancel, Assign Staff)
 * 2. Store Inventory (Add, Edit, Update Stock, Low Stock Alert)
 * 3. Expenses (Record, Filter, Category Totals)
 * 4. Staff Mode (Manage Mechanics/Staff, Roles, Status)
 * 5. Vendors Mode (Manage Spares Vendors, Payments)
 * 6. Dashboard Analytics (Counts, Revenue, Low Stock, Today's Bookings)
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDB, queryAll, queryOne, execute } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Root path redirect/serve Login & Sign Up page first
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 0. AUTHENTICATION & SAAS TENANT API
// ==========================================

// User Login (Super Admin & Garage Owners)
app.post('/api/auth/login', async (req, res) => {
  try {
    const db = await getDB();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = queryOne(db, "SELECT * FROM users WHERE LOWER(email) = ?", [cleanEmail]);

    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (user.status === 'Suspended') {
      return res.status(403).json({ success: false, error: 'Your user account has been suspended by the platform administrator.' });
    }

    let tenant = null;
    if (user.garage_id) {
      tenant = queryOne(db, "SELECT * FROM tenants WHERE id = ?", [user.garage_id]);
      if (tenant && tenant.status === 'Suspended') {
        return res.status(403).json({ success: false, error: 'This garage workspace is suspended. Please contact platform support.' });
      }
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role, // 'super_admin', 'garage_admin', 'staff'
      status: user.status,
      garage_id: user.garage_id,
      garage_name: tenant ? tenant.name : (user.role === 'super_admin' ? 'ApexAuto Platform Master' : 'Main Garage'),
      plan_tier: tenant ? tenant.plan_tier : 'Enterprise'
    };

    const token = 'apex_token_' + Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');

    res.json({
      success: true,
      message: 'Login successful',
      user: userPayload,
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Self-Serve Garage Registration (Sign Up)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const db = await getDB();
    const { garage_name, owner_name, email, phone, password } = req.body;

    if (!garage_name || !owner_name || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user or tenant already exists with this email
    const existingUser = queryOne(db, "SELECT * FROM users WHERE LOWER(email) = ?", [cleanEmail]);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists. Please Sign In.' });
    }

    const slug = garage_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(100 + Math.random() * 900);

    // 1. Create Tenant
    const tenantSql = `
      INSERT INTO tenants (name, slug, owner_name, email, phone, plan_tier, status)
      VALUES (?, ?, ?, ?, ?, 'Trial', 'Active')
    `;
    const tenantId = execute(db, tenantSql, [
      garage_name.trim(),
      slug,
      owner_name.trim(),
      cleanEmail,
      phone || ''
    ]);

    // 2. Create Garage Admin User
    const userSql = `
      INSERT INTO users (garage_id, name, email, password, phone, role, status)
      VALUES (?, ?, ?, ?, ?, 'garage_admin', 'Active')
    `;
    const userId = execute(db, userSql, [
      tenantId,
      owner_name.trim(),
      cleanEmail,
      password,
      phone || ''
    ]);

    const userPayload = {
      id: userId,
      name: owner_name.trim(),
      email: cleanEmail,
      phone: phone || '',
      role: 'garage_admin',
      garage_id: tenantId,
      garage_name: garage_name.trim(),
      plan_tier: 'Trial',
      status: 'Active'
    };

    const token = 'apex_token_' + Buffer.from(`${userId}:${cleanEmail}:${Date.now()}`).toString('base64');

    res.json({
      success: true,
      message: 'Garage workspace created successfully!',
      user: userPayload,
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Current User Session
app.get('/api/auth/me', async (req, res) => {
  try {
    const db = await getDB();
    const userId = req.headers['x-user-id'] || req.query.user_id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized. No user ID provided.' });
    }

    const user = queryOne(db, "SELECT id, garage_id, name, email, phone, role, status FROM users WHERE id = ?", [userId]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let tenant = null;
    if (user.garage_id) {
      tenant = queryOne(db, "SELECT * FROM tenants WHERE id = ?", [user.garage_id]);
    }

    res.json({
      success: true,
      user: {
        ...user,
        garage_name: tenant ? tenant.name : (user.role === 'super_admin' ? 'ApexAuto Platform Master' : 'Main Garage'),
        plan_tier: tenant ? tenant.plan_tier : 'Enterprise'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 0.1 SUPER ADMIN SAAS MANAGEMENT API
// ==========================================

// Global Platform Statistics for Super Admin
app.get('/api/saas/stats', async (req, res) => {
  try {
    const db = await getDB();
    const totalTenants = queryOne(db, "SELECT COUNT(*) as count FROM tenants").count;
    const activeTenants = queryOne(db, "SELECT COUNT(*) as count FROM tenants WHERE status = 'Active'").count;
    const totalUsers = queryOne(db, "SELECT COUNT(*) as count FROM users").count;
    const totalBookings = queryOne(db, "SELECT COUNT(*) as count FROM bookings").count;
    const totalRevenueEst = queryOne(db, "SELECT SUM(total_amount) as total FROM bookings WHERE status = 'Completed'").total || 0;

    res.json({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        totalUsers,
        totalBookings,
        totalRevenueEst
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get All Garages / Tenants (with linked admin credentials & metrics)
app.get('/api/saas/garages', async (req, res) => {
  try {
    const db = await getDB();
    const tenants = queryAll(db, "SELECT * FROM tenants ORDER BY id DESC");

    const enriched = tenants.map(t => {
      const adminUser = queryOne(db, "SELECT id, name, email, password, phone, status FROM users WHERE garage_id = ? AND role = 'garage_admin' ORDER BY id ASC LIMIT 1", [t.id]);
      const bookingsCount = queryOne(db, "SELECT COUNT(*) as count FROM bookings WHERE garage_id = ?", [t.id]).count;
      const staffCount = queryOne(db, "SELECT COUNT(*) as count FROM staff WHERE garage_id = ?", [t.id]).count;

      return {
        ...t,
        admin_id: adminUser ? adminUser.id : null,
        admin_email: adminUser ? adminUser.email : t.email,
        admin_password: adminUser ? adminUser.password : '******',
        user_status: adminUser ? adminUser.status : t.status,
        bookings_count: bookingsCount,
        staff_count: staffCount
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Super Admin Creates a New Garage + Generates User Credentials
app.post('/api/saas/garages', async (req, res) => {
  try {
    const db = await getDB();
    const { name, owner_name, email, phone, password, plan_tier } = req.body;

    if (!name || !owner_name || !email) {
      return res.status(400).json({ success: false, error: 'Garage Name, Owner Name, and Email are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = queryOne(db, "SELECT * FROM users WHERE LOWER(email) = ?", [cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'A user with this email already exists' });
    }

    const generatedPassword = password ? password.trim() : 'Apex@' + Math.floor(1000 + Math.random() * 9000);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(100 + Math.random() * 900);

    // 1. Create Tenant
    const tenantSql = `
      INSERT INTO tenants (name, slug, owner_name, email, phone, plan_tier, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `;
    const tenantId = execute(db, tenantSql, [
      name.trim(),
      slug,
      owner_name.trim(),
      cleanEmail,
      phone || '',
      plan_tier || 'Trial'
    ]);

    // 2. Create User
    const userSql = `
      INSERT INTO users (garage_id, name, email, password, phone, role, status)
      VALUES (?, ?, ?, ?, ?, 'garage_admin', 'Active')
    `;
    const userId = execute(db, userSql, [
      tenantId,
      owner_name.trim(),
      cleanEmail,
      generatedPassword,
      phone || ''
    ]);

    res.json({
      success: true,
      message: 'New garage workspace and credentials generated successfully!',
      data: {
        garage_id: tenantId,
        garage_name: name.trim(),
        owner_name: owner_name.trim(),
        email: cleanEmail,
        password: generatedPassword,
        plan_tier: plan_tier || 'Trial',
        login_url: `http://localhost:${PORT}/login.html`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle Garage Status (Active <-> Suspended)
app.patch('/api/saas/garages/:id/status', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { status } = req.body;

    if (!status || (status !== 'Active' && status !== 'Suspended')) {
      return res.status(400).json({ success: false, error: 'Valid status (Active or Suspended) is required' });
    }

    execute(db, "UPDATE tenants SET status = ? WHERE id = ?", [status, id]);
    execute(db, "UPDATE users SET status = ? WHERE garage_id = ?", [status, id]);

    res.json({ success: true, message: `Garage #${id} and associated users set to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset Password for any Garage Account
app.patch('/api/saas/garages/:id/reset-password', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { new_password } = req.body;

    const finalPass = new_password && new_password.trim() ? new_password.trim() : 'Apex@' + Math.floor(1000 + Math.random() * 9000);

    execute(db, "UPDATE users SET password = ? WHERE garage_id = ? AND role = 'garage_admin'", [finalPass, id]);

    res.json({
      success: true,
      message: `Password successfully updated for Garage #${id}`,
      new_password: finalPass
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 1. DASHBOARD ANALYTICS API
// ==========================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const db = await getDB();
    const today = new Date().toISOString().split('T')[0];

    const todayBookings = queryAll(db, "SELECT * FROM bookings WHERE booking_date = ?", [today]);
    const totalBookings = queryOne(db, "SELECT COUNT(*) as count FROM bookings").count;
    const pendingBookings = queryOne(db, "SELECT COUNT(*) as count FROM bookings WHERE status = 'Pending'").count;
    
    const lowStockParts = queryAll(db, "SELECT * FROM inventory WHERE stock_qty <= min_threshold");
    const totalInventoryValue = queryOne(db, "SELECT SUM(stock_qty * selling_price) as val FROM inventory").val || 0;
    
    const totalExpenses = queryOne(db, "SELECT SUM(amount) as total FROM expenses").total || 0;
    const activeStaff = queryOne(db, "SELECT COUNT(*) as count FROM staff WHERE status = 'Active'").count;
    const totalVendors = queryOne(db, "SELECT COUNT(*) as count FROM vendors").count;
    const pendingVendorPay = queryOne(db, "SELECT SUM(pending_payment) as total FROM vendors").total || 0;

    res.json({
      success: true,
      data: {
        todayDate: today,
        todayBookingsCount: todayBookings.length,
        totalBookings,
        pendingBookings,
        lowStockCount: lowStockParts.length,
        lowStockParts,
        totalInventoryValue,
        totalExpenses,
        activeStaff,
        totalVendors,
        pendingVendorPay
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. BOOKINGS API
// ==========================================
// Get all bookings with filter (date, status, search)
app.get('/api/bookings', async (req, res) => {
  try {
    const db = await getDB();
    const { date, status, search, garage_id } = req.query;
    let sql = "SELECT * FROM bookings WHERE 1=1";
    const params = [];

    if (garage_id && garage_id !== 'all') {
      sql += " AND garage_id = ?";
      params.push(garage_id);
    }
    if (date) {
      sql += " AND booking_date = ?";
      params.push(date);
    }
    if (status && status !== 'All') {
      sql += " AND status = ?";
      params.push(status);
    }
    if (search) {
      sql += " AND (customer_name LIKE ? OR customer_phone LIKE ? OR reg_number LIKE ? OR booking_number LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += " ORDER BY id DESC";
    const bookings = queryAll(db, sql, params);
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single booking by ID
app.get('/api/bookings/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const bookings = queryAll(db, "SELECT * FROM bookings WHERE id = ?", [id]);
    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, data: bookings[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new booking (Public Customer Booking Form)
app.post('/api/bookings', async (req, res) => {
  try {
    const db = await getDB();
    const {
      customer_name,
      customer_phone,
      customer_email,
      reg_number,
      vehicle_name,
      service_type,
      booking_date,
      time_slot,
      issue_description,
      answers_json,
      total_amount,
      garage_id
    } = req.body;

    if (!customer_name || !customer_phone || !reg_number || !booking_date || !time_slot) {
      return res.status(400).json({ success: false, error: 'Please provide all mandatory booking details' });
    }

    const booking_number = 'BK-' + Math.floor(1000 + Math.random() * 9000);
    const sql = `
      INSERT INTO bookings (
        garage_id, booking_number, customer_id, customer_name, customer_phone, customer_email,
        reg_number, vehicle_name, service_type, booking_date, time_slot,
        issue_description, answers_json, status, total_amount, notes
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, 'Booked via customer portal')
    `;

    const id = execute(db, sql, [
      garage_id || 1,
      booking_number,
      customer_name,
      customer_phone,
      customer_email || '',
      reg_number.toUpperCase().trim(),
      vehicle_name || 'Generic Vehicle',
      service_type,
      booking_date,
      time_slot,
      issue_description || '',
      JSON.stringify(answers_json || {}),
      total_amount || 1999
    ]);

    // Send response with simulated SMS / WhatsApp notification to garage owner
    res.json({
      success: true,
      message: 'Booking successfully confirmed!',
      booking_number,
      id,
      shopNotification: {
        sent: true,
        channel: 'SMS & WhatsApp (Simulated)',
        recipient: 'Garage Manager & Customer',
        preview: `New Booking ${booking_number} received for ${customer_name} (${reg_number}) on ${booking_date} at ${time_slot}.`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Booking Status (Confirmed, In-Progress, Completed, Cancelled, No-Show)
app.patch('/api/bookings/:id/status', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { status, notes, assigned_staff_id, total_amount, extra_items } = req.body;

    let sql = "UPDATE bookings SET status = ?";
    const params = [status];

    if (notes !== undefined) {
      sql += ", notes = ?";
      params.push(notes);
    }
    if (assigned_staff_id !== undefined) {
      sql += ", assigned_staff_id = ?";
      params.push(assigned_staff_id);
    }
    if (total_amount !== undefined) {
      sql += ", total_amount = ?";
      params.push(parseFloat(total_amount));
    }
    sql += " WHERE id = ?";
    params.push(id);

    execute(db, sql, params);

    // Auto-decrement inventory stock if extra parts/spares were billed on Completion
    if (status === 'Completed' && extra_items && Array.isArray(extra_items)) {
      for (const item of extra_items) {
        if (!item.name) continue;
        const firstWord = item.name.trim().split(' ')[0];
        const match = queryAll(db, "SELECT id, stock_qty FROM inventory WHERE LOWER(part_name) LIKE LOWER(?) LIMIT 1", [`%${firstWord}%`]);
        if (match && match.length > 0) {
          execute(db, "UPDATE inventory SET stock_qty = MAX(0, stock_qty - 1) WHERE id = ?", [match[0].id]);
        }
      }
    }

    res.json({ success: true, message: `Booking #${id} updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Full Update of Booking Details (Digital Job Card Edit / Save)
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const {
      customer_name,
      customer_phone,
      customer_email,
      reg_number,
      vehicle_name,
      service_type,
      booking_date,
      time_slot,
      issue_description,
      answers_json,
      status,
      assigned_staff_id,
      total_amount,
      notes
    } = req.body;

    const existing = queryAll(db, "SELECT * FROM bookings WHERE id = ?", [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const cur = existing[0];
    const updatedCustomerName = customer_name !== undefined ? customer_name : cur.customer_name;
    const updatedCustomerPhone = customer_phone !== undefined ? customer_phone : cur.customer_phone;
    const updatedCustomerEmail = customer_email !== undefined ? customer_email : cur.customer_email;
    const updatedRegNumber = reg_number !== undefined ? reg_number.toUpperCase().trim() : cur.reg_number;
    const updatedVehicleName = vehicle_name !== undefined ? vehicle_name : cur.vehicle_name;
    const updatedServiceType = service_type !== undefined ? service_type : cur.service_type;
    const updatedBookingDate = booking_date !== undefined ? booking_date : cur.booking_date;
    const updatedTimeSlot = time_slot !== undefined ? time_slot : cur.time_slot;
    const updatedIssueDesc = issue_description !== undefined ? issue_description : cur.issue_description;
    const updatedAnswersJson = answers_json !== undefined ? (typeof answers_json === 'string' ? answers_json : JSON.stringify(answers_json)) : cur.answers_json;
    const updatedStatus = status !== undefined ? status : cur.status;
    const updatedAssignedStaff = assigned_staff_id !== undefined ? (assigned_staff_id ? parseInt(assigned_staff_id) : null) : cur.assigned_staff_id;
    const updatedTotalAmount = total_amount !== undefined ? parseFloat(total_amount) : cur.total_amount;
    const updatedNotes = notes !== undefined ? notes : cur.notes;

    const sql = `
      UPDATE bookings 
      SET customer_name = ?,
          customer_phone = ?,
          customer_email = ?,
          reg_number = ?,
          vehicle_name = ?,
          service_type = ?,
          booking_date = ?,
          time_slot = ?,
          issue_description = ?,
          answers_json = ?,
          status = ?,
          assigned_staff_id = ?,
          total_amount = ?,
          notes = ?
      WHERE id = ?
    `;

    execute(db, sql, [
      updatedCustomerName,
      updatedCustomerPhone,
      updatedCustomerEmail,
      updatedRegNumber,
      updatedVehicleName,
      updatedServiceType,
      updatedBookingDate,
      updatedTimeSlot,
      updatedIssueDesc,
      updatedAnswersJson,
      updatedStatus,
      updatedAssignedStaff,
      updatedTotalAmount,
      updatedNotes,
      id
    ]);

    const updatedBooking = queryAll(db, "SELECT * FROM bookings WHERE id = ?", [id])[0];
    res.json({ success: true, message: 'Job Card details updated successfully!', data: updatedBooking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Move Booking to Tomorrow / Reschedule Date
app.patch('/api/bookings/:id/reschedule', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { new_date, new_slot, reason } = req.body;

    if (!new_date) {
      return res.status(400).json({ success: false, error: 'New date is required' });
    }

    const noteAppend = ` | Rescheduled to ${new_date}: ${reason || 'Customer requested'}`;
    const sql = `
      UPDATE bookings 
      SET booking_date = ?, 
          time_slot = COALESCE(?, time_slot),
          status = 'Rescheduled',
          notes = COALESCE(notes, '') || ?
      WHERE id = ?
    `;

    execute(db, sql, [new_date, new_slot || null, noteAppend, id]);
    res.json({ success: true, message: `Booking moved to ${new_date} successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check Slot Availability
app.get('/api/slots/availability', async (req, res) => {
  try {
    const db = await getDB();
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, error: 'Date is required' });

    const standardSlots = [
      '09:00 AM - 11:00 AM',
      '11:00 AM - 01:00 PM',
      '02:00 PM - 04:00 PM',
      '04:00 PM - 06:00 PM'
    ];

    const booked = queryAll(db, "SELECT time_slot, COUNT(*) as count FROM bookings WHERE booking_date = ? AND status != 'Cancelled' GROUP BY time_slot", [date]);
    const bookedMap = {};
    booked.forEach(b => { bookedMap[b.time_slot] = b.count; });

    // Max 3 cars per slot in garage
    const availability = standardSlots.map(slot => {
      const currentBookings = bookedMap[slot] || 0;
      const capacity = 3;
      return {
        slot,
        booked: currentBookings,
        capacity,
        available: currentBookings < capacity
      };
    });

    res.json({ success: true, date, slots: availability });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. STORE INVENTORY API
// ==========================================
app.get('/api/inventory', async (req, res) => {
  try {
    const db = await getDB();
    const { search, category, low_stock } = req.query;
    let sql = `
      SELECT i.*, v.company_name as vendor_name 
      FROM inventory i 
      LEFT JOIN vendors v ON i.vendor_id = v.id 
      WHERE 1=1
    `;
    const params = [];

    if (low_stock === 'true') {
      sql += " AND i.stock_qty <= i.min_threshold";
    }
    if (category && category !== 'All') {
      sql += " AND i.category = ?";
      params.push(category);
    }
    if (search) {
      sql += " AND (i.part_name LIKE ? OR i.sku LIKE ? OR i.location LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += " ORDER BY i.id DESC";
    const parts = queryAll(db, sql, params);
    res.json({ success: true, data: parts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const db = await getDB();
    const { sku, part_name, category, stock_qty, min_threshold, unit_cost, selling_price, location, vendor_id } = req.body;

    if (!sku || !part_name || !selling_price) {
      return res.status(400).json({ success: false, error: 'SKU, Part Name & Selling Price are required' });
    }

    const sql = `
      INSERT INTO inventory (sku, part_name, category, stock_qty, min_threshold, unit_cost, selling_price, location, vendor_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const id = execute(db, sql, [
      sku.toUpperCase().trim(),
      part_name,
      category || 'General',
      parseInt(stock_qty) || 0,
      parseInt(min_threshold) || 5,
      parseFloat(unit_cost) || 0,
      parseFloat(selling_price) || 0,
      location || 'General Rack',
      vendor_id || null
    ]);

    res.json({ success: true, message: 'Item added to inventory successfully', id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/inventory/:id/stock', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { change_qty } = req.body; // e.g. +5 or -2

    execute(db, "UPDATE inventory SET stock_qty = stock_qty + ? WHERE id = ?", [change_qty, id]);
    res.json({ success: true, message: 'Stock updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. EXPENSE MANAGEMENT API
// ==========================================
app.get('/api/expenses', async (req, res) => {
  try {
    const db = await getDB();
    const { category, month } = req.query;
    let sql = "SELECT * FROM expenses WHERE 1=1";
    const params = [];

    if (category && category !== 'All') {
      sql += " AND category = ?";
      params.push(category);
    }
    if (month) {
      sql += " AND expense_date LIKE ?";
      params.push(`${month}%`);
    }

    sql += " ORDER BY expense_date DESC";
    const expenses = queryAll(db, sql, params);
    
    // Category totals
    const catTotals = queryAll(db, "SELECT category, SUM(amount) as total FROM expenses GROUP BY category");

    res.json({ success: true, data: expenses, categoryTotals: catTotals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const db = await getDB();
    const { title, category, amount, expense_date, payment_mode, notes, vendor_id, vendor_name } = req.body;

    if (!title || !amount || !expense_date) {
      return res.status(400).json({ success: false, error: 'Title, amount and date are required' });
    }

    const sql = `
      INSERT INTO expenses (title, category, amount, expense_date, payment_mode, notes, vendor_id, vendor_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const id = execute(db, sql, [
      title,
      category || 'Miscellaneous',
      parseFloat(amount),
      expense_date,
      payment_mode || 'Cash',
      notes || '',
      vendor_id ? parseInt(vendor_id) : null,
      vendor_name || null
    ]);

    res.json({ success: true, message: 'Expense recorded successfully', id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. STAFF MODE API
// ==========================================
app.get('/api/staff', async (req, res) => {
  try {
    const db = await getDB();
    const staff = queryAll(db, "SELECT * FROM staff ORDER BY id ASC");
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const db = await getDB();
    const { name, role, phone, email, salary, status, skills, joined_date } = req.body;

    if (!name || !role || !phone) {
      return res.status(400).json({ success: false, error: 'Name, Role and Phone are required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const sql = `
      INSERT INTO staff (name, role, phone, email, salary, status, joined_date, skills)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const id = execute(db, sql, [
      name,
      role,
      phone,
      email || '',
      parseFloat(salary) || 0,
      status || 'Active',
      joined_date || today,
      skills || ''
    ]);

    res.json({ success: true, message: 'Staff member added successfully', id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/staff/:id/status', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { status } = req.body;

    execute(db, "UPDATE staff SET status = ? WHERE id = ?", [status, id]);
    res.json({ success: true, message: 'Staff status updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. VENDORS MODE API
// ==========================================
app.get('/api/vendors', async (req, res) => {
  try {
    const db = await getDB();
    const vendors = queryAll(db, "SELECT * FROM vendors ORDER BY id ASC");
    res.json({ success: true, data: vendors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const db = await getDB();
    const { company_name, contact_person, phone, email, address, category, gst_number, pending_payment } = req.body;

    if (!company_name || !contact_person || !phone) {
      return res.status(400).json({ success: false, error: 'Company Name, Contact Person and Phone are required' });
    }

    const sql = `
      INSERT INTO vendors (company_name, contact_person, phone, email, address, category, gst_number, pending_payment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const id = execute(db, sql, [
      company_name,
      contact_person,
      phone,
      email || '',
      address || '',
      category || 'General Parts',
      gst_number || '',
      parseFloat(pending_payment) || 0
    ]);

    res.json({ success: true, message: 'Vendor registered successfully', id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Vendor Details
app.put('/api/vendors/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { company_name, contact_person, phone, email, address, category, gst_number, pending_payment } = req.body;

    if (!company_name || !contact_person || !phone) {
      return res.status(400).json({ success: false, error: 'Company Name, Contact Person and Phone are required' });
    }

    const sql = `
      UPDATE vendors 
      SET company_name = ?, contact_person = ?, phone = ?, email = ?, address = ?, category = ?, gst_number = ?, pending_payment = ?
      WHERE id = ?
    `;

    execute(db, sql, [
      company_name,
      contact_person,
      phone,
      email || '',
      address || '',
      category || 'General Parts',
      gst_number || '',
      parseFloat(pending_payment) || 0,
      id
    ]);

    res.json({ success: true, message: 'Vendor updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. SERVICE RATE CARD & MASTER PRICING API
// ==========================================
app.get('/api/rate-card', async (req, res) => {
  try {
    const db = await getDB();
    const { garage_id, category, search } = req.query;
    let sql = "SELECT * FROM services_rate_card WHERE is_active = 1";
    const params = [];

    if (garage_id && garage_id !== 'all') {
      sql += " AND (garage_id = ? OR garage_id IS NULL)";
      params.push(garage_id);
    }
    if (category && category !== 'All') {
      sql += " AND category = ?";
      params.push(category);
    }
    if (search) {
      sql += " AND (service_name LIKE ? OR service_code LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY category ASC, base_price ASC";
    const data = queryAll(db, sql, params);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/rate-card', async (req, res) => {
  try {
    const db = await getDB();
    const { garage_id, service_name, category, base_price, estimated_time_mins, description } = req.body;

    if (!service_name || base_price === undefined) {
      return res.status(400).json({ success: false, error: 'Service name and base price are required' });
    }

    const code = 'SRV-' + Math.floor(1000 + Math.random() * 9000);
    const sql = `
      INSERT INTO services_rate_card (garage_id, service_code, service_name, category, base_price, estimated_time_mins, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const id = execute(db, sql, [
      garage_id || 1,
      code,
      service_name.trim(),
      category || 'Periodic Service',
      parseFloat(base_price),
      parseInt(estimated_time_mins) || 60,
      description || ''
    ]);

    res.json({ success: true, message: 'Service added to Master Rate Card', id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/rate-card/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { service_name, category, base_price, estimated_time_mins, description, is_active } = req.body;

    const existing = queryOne(db, "SELECT * FROM services_rate_card WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Service rate card item not found' });
    }

    const updatedName = service_name !== undefined ? service_name.trim() : existing.service_name;
    const updatedCategory = category !== undefined ? category : existing.category;
    const updatedPrice = base_price !== undefined ? parseFloat(base_price) : existing.base_price;
    const updatedTime = estimated_time_mins !== undefined ? parseInt(estimated_time_mins) : existing.estimated_time_mins;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedActive = is_active !== undefined ? is_active : existing.is_active;

    const sql = `
      UPDATE services_rate_card 
      SET service_name = ?, category = ?, base_price = ?, estimated_time_mins = ?, description = ?, is_active = ?
      WHERE id = ?
    `;

    execute(db, sql, [updatedName, updatedCategory, updatedPrice, updatedTime, updatedDesc, updatedActive, id]);
    res.json({ success: true, message: 'Rate card updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/rate-card/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    execute(db, "UPDATE services_rate_card SET is_active = 0 WHERE id = ?", [id]);
    res.json({ success: true, message: 'Service removed from active rate card' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. GARAGE SETTINGS & COUNTRY TAX CONFIGURATION API
// ==========================================

app.get('/api/settings', async (req, res) => {
  try {
    const db = await getDB();
    const garage_id = parseInt(req.query.garage_id) || 1;
    let settings = queryOne(db, "SELECT * FROM garage_settings WHERE garage_id = ?", [garage_id]);
    
    if (!settings) {
      settings = {
        garage_id: garage_id,
        garage_name: 'Apex Performance AutoCare',
        tagline: 'Premium Multi-Brand Auto Care & Performance Studio',
        phone: '+91 98765 43210',
        email: 'contact@apexauto.com',
        address: 'Plot 42, Motor Way Hub, Sector 18, Gurugram, India',
        country: 'India',
        currency_symbol: '₹',
        currency_code: 'INR',
        tax_enabled: 1,
        tax_name: 'GST',
        tax_rate: 18.0,
        tax_number: '07AAPCA1234F1Z5',
        tax_label: 'GSTIN',
        invoice_prefix: 'INV',
        footer_notes: 'Thank you for choosing Apex Performance AutoCare! Drive safe with confidence.'
      };
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const db = await getDB();
    const {
      garage_id = 1,
      garage_name,
      tagline,
      phone,
      email,
      address,
      country,
      currency_symbol,
      currency_code,
      tax_enabled,
      tax_name,
      tax_rate,
      tax_number,
      tax_label,
      invoice_prefix,
      footer_notes
    } = req.body;

    const existing = queryOne(db, "SELECT * FROM garage_settings WHERE garage_id = ?", [garage_id]);

    if (existing) {
      const sql = `
        UPDATE garage_settings
        SET garage_name = ?, tagline = ?, phone = ?, email = ?, address = ?, country = ?,
            currency_symbol = ?, currency_code = ?, tax_enabled = ?, tax_name = ?,
            tax_rate = ?, tax_number = ?, tax_label = ?, invoice_prefix = ?, footer_notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE garage_id = ?
      `;
      execute(db, sql, [
        garage_name !== undefined ? garage_name : existing.garage_name,
        tagline !== undefined ? tagline : existing.tagline,
        phone !== undefined ? phone : existing.phone,
        email !== undefined ? email : existing.email,
        address !== undefined ? address : existing.address,
        country !== undefined ? country : existing.country,
        currency_symbol !== undefined ? currency_symbol : existing.currency_symbol,
        currency_code !== undefined ? currency_code : existing.currency_code,
        tax_enabled !== undefined ? (tax_enabled ? 1 : 0) : existing.tax_enabled,
        tax_name !== undefined ? tax_name : existing.tax_name,
        tax_rate !== undefined ? parseFloat(tax_rate) : existing.tax_rate,
        tax_number !== undefined ? tax_number : existing.tax_number,
        tax_label !== undefined ? tax_label : existing.tax_label,
        invoice_prefix !== undefined ? invoice_prefix : existing.invoice_prefix,
        footer_notes !== undefined ? footer_notes : existing.footer_notes,
        garage_id
      ]);
    } else {
      const insertSql = `
        INSERT INTO garage_settings (
          garage_id, garage_name, tagline, phone, email, address, country,
          currency_symbol, currency_code, tax_enabled, tax_name, tax_rate,
          tax_number, tax_label, invoice_prefix, footer_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      execute(db, insertSql, [
        garage_id,
        garage_name || 'Apex Performance AutoCare',
        tagline || 'Premium Multi-Brand Auto Care',
        phone || '+91 98765 43210',
        email || 'contact@apexauto.com',
        address || 'Gurugram, India',
        country || 'India',
        currency_symbol || '₹',
        currency_code || 'INR',
        tax_enabled !== undefined ? (tax_enabled ? 1 : 0) : 1,
        tax_name || 'GST',
        tax_rate !== undefined ? parseFloat(tax_rate) : 18.0,
        tax_number || '07AAPCA1234F1Z5',
        tax_label || 'GSTIN',
        invoice_prefix || 'INV',
        footer_notes || 'Thank you for choosing Apex Performance AutoCare!'
      ]);
    }

    if (garage_name) {
      try {
        execute(db, "UPDATE tenants SET name = ? WHERE id = ?", [garage_name, garage_id]);
      } catch (e) {}
    }

    const updated = queryOne(db, "SELECT * FROM garage_settings WHERE garage_id = ?", [garage_id]);
    res.json({ success: true, message: 'Garage settings updated successfully', settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`AutoCare Garage ERP & Booking System running on http://localhost:${PORT}`);
});
