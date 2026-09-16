# Restaurant Operations Manager

A full-stack, real-time restaurant operations platform designed for front-of-house service, back-of-house inventory and recipe costing, staff shifts and tip management, and table reservations.

Built with **React 19**, **TypeScript**, **Tailwind CSS**, **Express**, and a persistent on-disk **SQLite** database (`sql.js`), this application operates as a standalone full-stack service with zero external database setup required.

---

## Key Modules & Features

### 1. Live Dining & POS Ordering (`OrdersModule`)
- **Floor & Table View**: Visual table status indicators (Available, Occupied, Check Out) with live seated party timers.
- **Dynamic Order Tickets**: Add dishes with custom kitchen instructions and modifiers, adjust quantities, and calculate subtotals, tax (8.25%), and total balance in real time.
- **Payment Processing**:
  - **Integrated Card Terminal Simulator**: Tap, chip, or swipe flow with approval codes and tip entry presets (15%, 18%, 20%, 25%, Custom).
  - **Cash Tendered Calculator**: Exact change calculation and cash drawer balancing.
  - **Split Bill Support**: Split checks evenly across guest seats or by dollar amounts.
- **Order Lifecycle**: Filter tickets by Status (Open, In Prep, Ready, Paid, Void) and Order Type (Dine-In, Takeout, Bar).

### 2. Menu Item Management & Recipe Costing (`MenuModule`)
- **Plate Cost Engine**: Automatically tracks prime costs per dish, separated into:
  - **Raw Food Cost**: Sum of linked inventory cost drivers and components.
  - **Pantry Buffer**: Estimated seasoning, oil, and dry stock allotment.
  - **Labor Cost**: Prep and plating labor allotment.
- **Gross Margin Analytics**: Real-time margin calculation, margin health alerts (below 50% flag, healthy target $\ge 60\%$), and average plate profitability.
- **Mandatory Cost Driver SKU Linking**:
  - Combined **"Driver Name / Component"** searchable select with 3-character threshold and 0.5-second debounce.
  - Direct connection to perpetual inventory stock items with automatic unit cost calculation.
  - On-the-fly SKU creation modal when an ingredient does not yet exist in inventory.
- **Manage Menu Item Categories**: Add, reorder, and delete custom menu categories with automatic item reassignment safeguards.
- **Availability Toggle**: Instant 86’d / In Stock switch reflecting across the POS floor.

### 3. Inventory & Perpetual Stock Management (`InventoryModule`)
- **Live Stock Tracking**: Real-time quantity on hand, unit costs, stock valuation, and supplier details.
- **Reorder & Low Stock Alerts**: Automatic indicators when quantities dip below custom minimum thresholds.
- **Stock Audit & Adjustments**: Quick physical count adjustments and waste logging with historical audit trails.
- **Manage Inventory Item Categories**: Create, edit, and delete dedicated inventory categories (Produce, Meat, Seafood, Dairy, Pantry, etc.) with automatic item cascade protection.

### 4. Staff Shifts, Time Clock & Tip Management (`StaffModule`)
- **PIN-Protected Time Clock**: Fast staff punch-in and punch-out using 4-digit employee PINs.
- **Active Shift Tracking**: Live monitoring of clocked-in team members, active shift duration, and earned wages.
- **Tip Pooling Engine**: Collects credit card and cash tips from completed tickets, computes shift hours worked by eligible team members, and distributes tip pools proportionally.
- **External Payroll CSV Export**: One-click download of payroll timesheets including regular hours, hourly rates, total wages, allocated tips, and total compensation.

### 5. Table Reservations & Seating (`ReservationsModule`)
- **Reservation Book**: Schedule guest bookings with party size, contact info, requested times, and special dietary/occasion notes.
- **One-Click Seating**: Transition reservations directly from booked status to active dining tables, automatically opening an active POS order ticket for the party.

---

## Technology Stack

- **Frontend**:
  - React 19
  - TypeScript
  - Tailwind CSS v4
  - Lucide React (Icons)
  - Motion (Smooth transitions)
- **Backend & API**:
  - Express (Node.js)
  - `tsx` (TypeScript runtime execution)
  - `esbuild` (Production server bundler)
- **Database & Persistence**:
  - `sql.js` (WebAssembly SQLite)
  - Persistent disk storage in `./data/restaurant.db`
  - Automatic table schema migration and baseline starter dataset seeding on first boot

---

## Local Development & Testing Instructions

Follow these steps to run the application on your local machine.

### Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9 or higher (or `pnpm` / `bun`)
- **Git**: Installed on your system

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd <YOUR_REPO_DIRECTORY>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables (Optional)

Copy the example environment template:

```bash
cp .env.example .env
```

> **Note**: For local POS, inventory, menu, and staff testing, no external API keys are required. The SQLite database self-initializes automatically. If you wish to use Gemini features, set your `GEMINI_API_KEY` in `.env`.

### 4. Start the Development Server

```bash
npm run dev
```

The application will start on **`http://localhost:3000`** with Vite Hot Module Reloading for the client and `tsx` running the backend API routes on the same port.

### 5. Open in Your Browser

Navigate to:
```
http://localhost:3000
```

---

## Default Testing Accounts & Seed Data

On its initial launch, the system automatically provisions sample data so you can test all workflows immediately:

### Staff PINs (for Time Clock Testing)

| Staff Name | Role | 4-Digit PIN | Hourly Rate |
| :--- | :--- | :--- | :--- |
| **Elena Vasquez** | Server | `1234` | $16.50 / hr |
| **Marcus Chen** | Server | `2345` | $16.50 / hr |
| **Dave Miller** | Bartender | `3456` | $18.00 / hr |
| **Chef Antonio Rossi** | Head Chef | `4567` | $28.00 / hr |
| **Sarah Jenkins** | Host | `5678` | $16.00 / hr |
| **Liam O'Connor** | Manager | `9999` | $26.00 / hr |

### Quick Testing Walkthrough

1. **Test Order Entry & POS Checkout**:
   - Go to **Floor & Orders**. Select Table 4 (Occupied) or an Available table.
   - Add dishes from the menu catalog on the left into the ticket.
   - Click **Pay with Terminal** to simulate an EMV credit card transaction with tip presets, or select **Pay with Cash** to calculate exact change.
2. **Test Recipe Costing & Inventory Linking**:
   - Go to **Menu Items**.
   - Click **Add Menu Item**.
   - Type in the **"Driver Name / Component"** field: type at least 3 letters (e.g. `Rib`, `Sal`, `Salm`, or `Tru`) to trigger the debounced inventory search.
   - Select a linked SKU or use **+ Create New Inventory SKU** to register a fresh ingredient without leaving the form.
   - Click **Manage Menu Item Categories** to add or remove dish categories.
3. **Test Inventory Categories**:
   - Go to **Inventory**.
   - Click **Manage Inventory Item Categories** to create or delete inventory categories (e.g., Bakery, Dairy, Produce, Seafood).
   - Filter items by category or search by ingredient/supplier.
4. **Test Staff Shifts & Tip Export**:
   - Go to **Staff & Shifts**.
   - Click **Clock In / Out** in the top navigation or Staff tab using PIN `1234` or `9999`.
   - Complete an order in the POS with a card tip, then check **Staff Tip Management & Pooling** to observe the proportional tip distribution.
   - Click **Export Payroll CSV** to review the generated pay period spreadsheet.
5. **Test Reservations to Floor Seating**:
   - Go to **Reservations**.
   - Book a party or click **Seat Guests** on an existing booking to seat them at a table and immediately open their POS order ticket.

---

## Available NPM Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `tsx server.ts` | Runs the Express API server with Vite middleware in development mode on port 3000. |
| `npm run build` | `vite build && esbuild server.ts ...` | Compiles frontend assets into `dist/` and bundles `server.ts` into `dist/server.cjs`. |
| `npm run start` | `node dist/server.cjs` | Runs the production-compiled server. |
| `npm run lint` | `tsc --noEmit` | Runs the TypeScript compiler to validate types and syntax. |
| `npm run clean` | `rm -rf dist server.js` | Removes compiled build artifacts. |

---

## Database Storage & Resetting Data

The SQLite database file is stored locally at:
```
./data/restaurant.db
```
To completely reset the database back to initial factory demonstration data:
1. Stop the running dev server (`Ctrl + C`).
2. Delete `./data/restaurant.db`:
   ```bash
   rm -f data/restaurant.db
   ```
3. Restart the server (`npm run dev`). The database will recreate itself with fresh sample records.

---

## License

This project is released under the MIT License.
