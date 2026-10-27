/**
 * Database Module using sql.js (WebAssembly SQLite)
 * Persistent SQLite file stored on disk with clean helper methods.
 * Easy for any 2-3 yr developer to understand and extend.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILE = path.join(__dirname, 'garage_database.sqlite');
let dbInstance = null;

async function getDB() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
    upgradeSaaSSchema(dbInstance);
    saveDB(dbInstance);
  } else {
    dbInstance = new SQL.Database();
    initTables(dbInstance);
    upgradeSaaSSchema(dbInstance);
    saveDB(dbInstance);
  }
  return dbInstance;
}

function upgradeSaaSSchema(db) {
  // 1. Tenants / Garages Table
  db.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      owner_name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      plan_tier TEXT DEFAULT 'Trial',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Add garage_id and status columns to existing tables if missing
  const alterStatements = [
    "ALTER TABLE users ADD COLUMN garage_id INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'",
    "ALTER TABLE bookings ADD COLUMN garage_id INTEGER DEFAULT 1",
    "ALTER TABLE bookings ADD COLUMN extra_items TEXT DEFAULT '[]'",
    "ALTER TABLE inventory ADD COLUMN garage_id INTEGER DEFAULT 1",
    "ALTER TABLE expenses ADD COLUMN garage_id INTEGER DEFAULT 1",
    "ALTER TABLE staff ADD COLUMN garage_id INTEGER DEFAULT 1",
    "ALTER TABLE vendors ADD COLUMN garage_id INTEGER DEFAULT 1",
    "ALTER TABLE expenses ADD COLUMN vendor_id INTEGER",
    "ALTER TABLE expenses ADD COLUMN vendor_name TEXT"
  ];

  for (const stmt of alterStatements) {
    try {
      db.run(stmt);
    } catch (e) {
      // Column already exists, safe to ignore
    }
  }

  // 3. Ensure Default Demo Tenant (Garage)
  const defaultTenant = queryOne(db, "SELECT * FROM tenants WHERE id = 1");
  if (!defaultTenant) {
    db.run(`
      INSERT INTO tenants (id, name, slug, owner_name, email, phone, plan_tier, status)
      VALUES (1, 'Apex Performance AutoCare', 'apex-autocare', 'Rajesh Sharma', 'garage@autocare.com', '+1 (555) 987-6543', 'Pro', 'Active')
    `);
  }

  // 4. Ensure Super Admin Account exists
  const superAdmin = queryOne(db, "SELECT * FROM users WHERE email = 'admin@apexauto.com'");
  if (!superAdmin) {
    db.run(`
      INSERT INTO users (garage_id, name, email, password, phone, role, status)
      VALUES (NULL, 'Apex Master Admin', 'admin@apexauto.com', 'admin123', '+1 (555) 000-0001', 'super_admin', 'Active')
    `);
  } else {
    db.run("UPDATE users SET role = 'super_admin', status = 'Active' WHERE email = 'admin@apexauto.com'");
  }

  // 5. Ensure Demo Garage Owner Account exists
  const garageAdmin = queryOne(db, "SELECT * FROM users WHERE email = 'garage@autocare.com'");
  if (!garageAdmin) {
    db.run(`
      INSERT INTO users (garage_id, name, email, password, phone, role, status)
      VALUES (1, 'Rajesh Sharma', 'garage@autocare.com', 'garage123', '+1 (555) 987-6543', 'garage_admin', 'Active')
    `);
  } else {
    db.run("UPDATE users SET garage_id = 1, role = 'garage_admin', status = 'Active' WHERE email = 'garage@autocare.com'");
  }

  // 6. Master Rate Card & Service Pricing Table
  db.run(`
    CREATE TABLE IF NOT EXISTS services_rate_card (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      garage_id INTEGER DEFAULT 1,
      service_code TEXT NOT NULL,
      service_name TEXT NOT NULL,
      category TEXT NOT NULL,
      base_price REAL NOT NULL,
      estimated_time_mins INTEGER DEFAULT 60,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const countRateCard = queryOne(db, "SELECT COUNT(*) as cnt FROM services_rate_card");
  if (!countRateCard || countRateCard.cnt === 0) {
    db.run(`
      INSERT INTO services_rate_card (garage_id, service_code, service_name, category, base_price, estimated_time_mins, description) VALUES
      (1, 'SRV-WASH', 'Foam Washing & Vacuum', 'Cleaning & Wash', 35, 45, 'High pressure snow foam body wash, underbody rinse, cabin vacuum, dashboard polish'),
      (1, 'SRV-OIL', 'Synthetic Engine Oil & Filter Flush', 'Fluids & Lubricants', 85, 40, 'Full synthetic engine oil replacement, OEM spin-on filter, fluid top-up'),
      (1, 'SRV-NORMAL', 'Normal / Periodic Full Service', 'Periodic Service', 150, 120, '40-point vehicle inspection, spark plugs, filters check, brake cleaning, engine tuning'),
      (1, 'SRV-DEEP', 'Complete Deep Detailing & Steam Wash', 'Detailing', 220, 180, 'Full interior steam extraction, exterior clay bar, high-gloss machine polish & ceramic sealant'),
      (1, 'SRV-BRAKE', 'Brake Pad Replacement & Rotor Check', 'Mechanical & Brakes', 65, 60, 'Front/Rear brake pad inspection, caliper slide pin greasing, rotor thickness measurement'),
      (1, 'SRV-AC', 'AC Diagnostic & Gas Recharge', 'AC & Electrical', 75, 45, 'Refrigerant R134a recovery & refill, leak testing, cabin filter check, antibacterial duct clean'),
      (1, 'SRV-WHEEL', 'Wheel Balancing & 3D Laser Alignment', 'Mechanical & Brakes', 50, 45, 'Computerized 4-wheel laser alignment, alloy dynamic balancing, tire pressure optimization'),
      (1, 'SRV-BATTERY', 'Battery Health & Electrical Diagnosis', 'AC & Electrical', 40, 30, 'Cold Cranking Amps (CCA) load test, alternator charging rate, starter motor current draw');
    `);
  }

  // 7. Garage Settings & Country Tax Configuration
  db.run(`
    CREATE TABLE IF NOT EXISTS garage_settings (
      garage_id INTEGER PRIMARY KEY,
      garage_name TEXT DEFAULT 'Apex Performance AutoCare',
      tagline TEXT DEFAULT 'Premium Multi-Brand Auto Care & Performance Studio',
      phone TEXT DEFAULT '+91 98765 43210',
      email TEXT DEFAULT 'contact@apexauto.com',
      address TEXT DEFAULT 'Plot 42, Motor Way Hub, Sector 18, Gurugram, India',
      country TEXT DEFAULT 'India',
      currency_symbol TEXT DEFAULT '₹',
      currency_code TEXT DEFAULT 'INR',
      tax_enabled INTEGER DEFAULT 1,
      tax_name TEXT DEFAULT 'GST',
      tax_rate REAL DEFAULT 18.0,
      tax_number TEXT DEFAULT '07AAPCA1234F1Z5',
      tax_label TEXT DEFAULT 'GSTIN',
      invoice_prefix TEXT DEFAULT 'INV',
      footer_notes TEXT DEFAULT 'Thank you for choosing Apex Performance AutoCare! Drive safe with confidence.',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const existingSettings = queryOne(db, "SELECT * FROM garage_settings WHERE garage_id = 1");
  if (!existingSettings) {
    db.run(`
      INSERT INTO garage_settings (garage_id, garage_name, tagline, phone, email, address, country, currency_symbol, currency_code, tax_enabled, tax_name, tax_rate, tax_number, tax_label, invoice_prefix, footer_notes)
      VALUES (1, 'Apex Performance AutoCare', 'Premium Multi-Brand Auto Care & Performance Studio', '+91 98765 43210', 'contact@apexauto.com', 'Plot 42, Motor Way Hub, Sector 18, Gurugram, India', 'India', '₹', 'INR', 1, 'GST', 18.0, '07AAPCA1234F1Z5', 'GSTIN', 'INV', 'Thank you for choosing Apex Performance AutoCare! Drive safe with confidence.')
    `);
  }
}

function saveDB(db = dbInstance) {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function initTables(db) {
  db.run(`
    -- 1. Users (Customers & Admins/Staff)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'customer', -- 'admin', 'staff', 'customer'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Vehicles
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      reg_number TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      fuel_type TEXT,
      year INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 3. Bookings
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      reg_number TEXT,
      vehicle_name TEXT,
      service_type TEXT NOT NULL,
      booking_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      issue_description TEXT,
      answers_json TEXT,
      status TEXT DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Rescheduled', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'
      assigned_staff_id INTEGER,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Store Inventory
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      part_name TEXT NOT NULL,
      category TEXT NOT NULL,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      min_threshold INTEGER NOT NULL DEFAULT 5,
      unit_cost REAL NOT NULL,
      selling_price REAL NOT NULL,
      location TEXT,
      vendor_id INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL, -- 'Parts Purchase', 'Rent', 'Electricity', 'Salaries', 'Tools', 'Miscellaneous'
      amount REAL NOT NULL,
      expense_date DATE NOT NULL,
      payment_mode TEXT DEFAULT 'Bank Transfer', -- 'Cash', 'UPI', 'Bank Transfer', 'Card'
      notes TEXT,
      recorded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Staff Mode
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'Chief Mechanic', 'Technician', 'Service Advisor', 'Electrician', 'Manager'
      phone TEXT NOT NULL,
      email TEXT,
      salary REAL DEFAULT 0,
      status TEXT DEFAULT 'Active', -- 'Active', 'On-Leave', 'Inactive'
      joined_date DATE,
      skills TEXT
    );

    -- 7. Vendors Mode
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      category TEXT, -- 'Engine Oils', 'Tyres', 'Body Parts', 'Brake Pads', 'Accessories'
      gst_number TEXT,
      pending_payment REAL DEFAULT 0
    );
  `);

  // Seed sample default admin & data
  db.run(`
    INSERT INTO users (name, email, password, phone, role) 
    VALUES ('Garage Admin', 'admin@garage.com', 'admin123', '9876543210', 'admin');
  `);

  // Seed initial Staff
  db.run(`
    INSERT INTO staff (name, role, phone, email, salary, status, joined_date, skills) VALUES
    ('David Miller', 'Chief Master Mechanic', '+1 (555) 234-5678', 'david@apexauto.com', 5200, 'Active', '2023-01-15', 'Engine Diagnostics, Powertrain, Calibration'),
    ('Alex Turner', 'Lead Auto Electrician', '+1 (555) 234-5679', 'alex@apexauto.com', 4800, 'Active', '2023-06-10', 'OBD-II, CAN Bus, Hybrid/EV Wiring'),
    ('Sarah Jenkins', 'Service Advisor', '+1 (555) 234-5680', 'sarah@apexauto.com', 4200, 'Active', '2024-02-01', 'Client Onboarding, Work Orders, Billing');
  `);

  // Seed initial Vendors
  db.run(`
    INSERT INTO vendors (company_name, contact_person, phone, email, address, category, gst_number, pending_payment) VALUES
    ('Brembo North America Spares', 'Marcus Vance', '+1 (555) 111-2233', 'sales@brembo-na.com', 'Detroit, Michigan', 'Brake Systems & Calipers', 'EIN-84-1234567', 1850),
    ('Mobil 1 Lubricants Direct', 'Robert Hayes', '+1 (555) 222-3344', 'contact@mobil1dist.com', 'Houston, Texas', 'Full Synthetic Fluids & Filters', 'EIN-76-9876543', 950),
    ('Bosch Automotive Supply', 'Elena Rostova', '+1 (555) 333-4455', 'elena@bosch-usa.com', 'Chicago, Illinois', 'Ignition & Electronics', 'EIN-38-5544332', 0);
  `);

  // Seed initial Inventory
  db.run(`
    INSERT INTO inventory (sku, part_name, category, stock_qty, min_threshold, unit_cost, selling_price, location, vendor_id) VALUES
    ('OIL-SYN-5W30', 'Mobil 1 Extended Performance 5W-30 (5 Qt)', 'Fluids & Lubricants', 24, 6, 28, 45, 'Rack A-1', 2),
    ('BRK-CER-F', 'Brembo Ceramic Front Brake Pad Set', 'Brake System', 12, 4, 48, 85, 'Rack B-2', 1),
    ('FIL-AIR-PRO', 'K&N High-Flow Air Filter Element', 'Filters', 18, 5, 22, 38, 'Rack A-3', 1),
    ('PLG-IRID-4', 'NGK Laser Iridium Spark Plugs (Pack of 4)', 'Ignition', 8, 3, 32, 60, 'Rack C-1', 3),
    ('CLNT-5050', 'Valvoline ZEREX Multi-Vehicle Coolant (1 Gal)', 'Fluids & Lubricants', 15, 5, 12, 22, 'Rack A-2', 2),
    ('WPR-BEAM-24', 'Bosch ICON 24" Premium Beam Wiper Blade', 'Accessories', 3, 5, 14, 26, 'Rack D-1', 3);
  `);

  // Seed initial Expenses
  db.run(`
    INSERT INTO expenses (title, category, amount, expense_date, payment_mode, notes) VALUES
    ('Workshop Facility Rent', 'Rent', 3200, '2026-10-01', 'Bank Transfer', 'Monthly lease payment'),
    ('Snap-on Diagnostics Scanner Tool', 'Tools', 1450, '2026-10-05', 'Card', 'Commercial ECU scanner update'),
    ('Commercial Electricity & Air Compressor Utilities', 'Electricity', 680, '2026-10-08', 'Bank Transfer', 'September electrical utility'),
    ('Brembo Bulk Consignment Restock', 'Parts Purchase', 1200, '2026-10-12', 'Bank Transfer', 'Invoice #BR-4491');
  `);

  // Seed initial Bookings
  db.run(`
    INSERT INTO bookings (booking_number, customer_id, customer_name, customer_phone, customer_email, reg_number, vehicle_name, service_type, booking_date, time_slot, issue_description, answers_json, status, assigned_staff_id, total_amount, notes) VALUES
    ('BK-1001', 1, 'Michael Scott', '+1 (555) 912-3456', 'michael@scranton.com', '7XYZ991', 'Ford F-150 (2022 EcoBoost)', 'Periodic Full Service', '2026-10-17', '10:00 AM - 12:00 PM', 'Engine vibration at highway speed and AC cooling weak', '{"pickup":"yes","oilChange":"yes","acCheck":"yes"}', 'Confirmed', 1, 149, 'Client requested morning priority bay'),
    ('BK-1002', 1, 'Rachel Green', '+1 (555) 711-2233', 'rachel@fashion.com', '6ABC412', 'Tesla Model 3 (2021 Dual Motor)', 'Brake & Suspension', '2026-10-17', '02:00 PM - 04:00 PM', 'Slight brake noise on gentle braking', '{"pickup":"no","oilChange":"no","acCheck":"no"}', 'In-Progress', 2, 89, 'Front brake caliper inspection assigned to Alex'),
    ('BK-1003', 1, 'David Wallace', '+1 (555) 887-7665', 'david@cfo.com', '8MNO554', 'BMW 330i (2023 Turbo)', 'Comprehensive Detailing', '2026-10-18', '09:00 AM - 11:00 AM', '30k miles comprehensive detailing & coating', '{"pickup":"yes","oilChange":"yes","acCheck":"yes"}', 'Pending', NULL, 199, 'Drop-off at 8:45 AM');
  `);
}

// Helper query function returning array of objects
function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper query function returning single object or null
function queryOne(db, sql, params = []) {
  const all = queryAll(db, sql, params);
  return all.length > 0 ? all[0] : null;
}

// Helper execute function
function execute(db, sql, params = []) {
  db.run(sql, params);
  // Get last inserted id before saveDB/export resets it
  const res = queryOne(db, "SELECT last_insert_rowid() as id");
  saveDB(db);
  return res ? res.id : null;
}

module.exports = {
  getDB,
  saveDB,
  queryAll,
  queryOne,
  execute
};
