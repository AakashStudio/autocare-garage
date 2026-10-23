# AutoCare Pro - Vehicle Garage ERP & Service Booking System

Ek modern, scalable aur enterprise-grade **Automotive Garage & Service Booking Management System**, jo customer ke liye hassle-free slot booking aur garage owners/shopkeepers ke liye complete shop floor management provide karta hai.

---

## 🌟 Key Features

### 1. Customer Self-Service Booking Portal
- **Vehicle & Customer Info:** Customer name, phone, registration number, make & model.
- **Service Package Selector:**
  - Periodic Full Service
  - Brake & Suspension Inspection
  - AC Service & Gas Recharge
  - Comprehensive Deep Detailing
- **Live Slot Availability:** Real-time checking per date with automatic bay capacity limits (e.g. 09:00 AM - 11:00 AM, 11:00 AM - 01:00 PM, 02:00 PM - 04:00 PM, 04:00 PM - 06:00 PM).
- **Vehicle Health Questionnaire:** Doorstep pickup & drop, oil change, wheel balancing, AC cooling checks.
- **Instant Alerts to Shopkeeper:** Confirmation SMS/WhatsApp notification payload immediately sent to garage manager so they can call or confirm.

### 2. Booking Operations (Admin Panel)
- **Real-Time Job Queue:** Track incoming cars, pending approvals, and active servicing.
- **Move to Tomorrow / Reschedule:** One-click modal to move today's booking to tomorrow or another date with reason logging.
- **Status Lifecycles:** `Pending` ➔ `Confirmed` ➔ `In-Progress` ➔ `Completed` ➔ `Rescheduled` ➔ `No-Show` / `Cancelled`.

### 3. Store Inventory Management
- **Spare Parts Database:** Track SKU, category, stock quantities, and rack shelf locations (e.g. `Rack A-1`).
- **Low Stock Threshold Alert:** Automatic visual badge when parts fall below the safety limit (`stock_qty <= min_threshold`).
- **Margin & Valuation:** Real-time cost price vs. selling price tracking.
- **Quick Adjust:** 1-click `+1` / `-1` stock adjustments.

### 4. Expense Tracker
- **Categories:** Shop Rent, Commercial Electricity, Parts Purchase, Tools & Equipment, Staff Salaries, Miscellaneous.
- **Outflow Aggregation:** Dynamic category-wise outflow calculation and payment mode logging (UPI, Bank Transfer, Cash).

### 5. Staff Mode
- **Mechanics & Advisors Directory:** Track Chief Mechanics, Auto Electricians, Technicians, Service Advisors.
- **Work Status:** 1-click status switch (`Active` vs. `On-Leave`).
- **Specializations & Salaries:** Skills mapping for intelligent job card assignments.

### 6. Vendors Mode
- **Suppliers Directory:** Spares distributors, lubricant suppliers, and performance parts vendors.
- **Balances:** GST number records and pending payable balances.

---

## 🎨 Enterprise Design System Combination

1. **Oracle NetSuite 26.1:** Deep Navy Blue header (`#0f2d4a`), Sky Blue accents (`#0076ce`), dense operational data tables, and breadcrumb layout.
2. **Oracle Redwood Design:** Warm sand canvas background (`#f8f6f2`), terracotta alert badges (`#c74634`), sage green success indicators (`#2a6f57`), and clean card typography.
3. **Atlassian Atlas:** Elevated card modules, subtle border contrast (`#dfe1e6`), clear form labels, and modal overlays.

---

## 🛠️ Project Structure

```text
d:\M\autocare-garage\
├── db.js             # SQLite Database wrapper (sql.js) with pre-seeded data & clean query helpers
├── server.js         # Lightweight Express.js REST API (< 260 lines)
├── package.json      # Dependencies (express, cors, sql.js)
└── public/
    ├── index.html    # Single Page Application with tabbed modules & modals
    ├── style.css     # NetSuite 26.1 + Redwood + Atlas CSS Design System
    └── app.js        # Easy-to-understand vanilla JS controller (NO complex framework bloat)
```

---

## 🚀 How to Run

1. Open terminal in project directory:
   ```bash
   cd d:\M\autocare-garage
   ```
2. Run server:
   ```bash
   npm start
   ```
3. Open browser:
   ```text
   http://localhost:3000
   ```
