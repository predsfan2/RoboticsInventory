# Robotics Inventory — Complete Feature Catalog

This is an exhaustive inventory of every user-facing and platform feature in this repository. There is **no “venues” entity**. Storage sites are **Locations**. Fundraising events are **Fundraisers**. Both are documented below with every add / edit / delete control.

App type: dark-themed inventory + accounting system for robotics teams. React (Vite + Tailwind) frontend, Express backend, flat-file JSON database (`data.json`).

---

## Table of contents

1. [What the product is](#1-what-the-product-is)
2. [App shell and global UX](#2-app-shell-and-global-ux)
3. [Authentication](#3-authentication)
4. [Roles, permissions, and route gates](#4-roles-permissions-and-route-gates)
5. [Dashboard](#5-dashboard)
6. [Inventory](#6-inventory)
7. [Whereabouts](#7-whereabouts)
8. [Condition Tracker](#8-condition-tracker)
9. [Purchases](#9-purchases)
10. [Borrows](#10-borrows)
11. [Approvals](#11-approvals)
12. [Finance](#12-finance)
13. [Activity and Audit](#13-activity-and-audit)
14. [Team](#14-team)
15. [Hub devices](#15-hub-devices)
16. [Custom Fields](#16-custom-fields)
17. [Locations](#17-locations)
18. [Homelab Hub (Android native protocol)](#18-homelab-hub-android-native-protocol)
19. [Platform, data, security, and ops](#19-platform-data-security-and-ops)
20. [Shared UI primitives](#20-shared-ui-primitives)
21. [REST API surface](#21-rest-api-surface)
22. [Seed data shipped with the repo](#22-seed-data-shipped-with-the-repo)

---

## 1. What the product is

Robotics Inventory lets a team:

- Track parts, tools, kits, condition, and physical location
- Request or directly move items between locations
- Log purchase requests that can auto-create or increment inventory when marked Received
- Check items out to borrowers and mark them returned
- Approve pending moves and reimbursements
- Run team finance: transactions, budgets, savings goals, fundraisers, reimbursements, reports
- Manage users, granular permissions, custom fields per category, and locations
- Pair Android Homelab Hub phones for a native (non-WebView) UI

Default production URL (Docker): `http://localhost:3000`. Local dev: frontend `:5173`, backend `:3001`.

---

## 2. App shell and global UX

### Branding

- Sidebar logo: robot emoji + “Robotics Inventory”
- Dark theme (`gray-950` background)

### Desktop sidebar navigation

Visible items are filtered by the signed-in user’s permissions. Each item is a `NavLink` with icon + label. Active state: indigo highlight.

| Path | Label | Icon | Shown when |
| --- | --- | --- | --- |
| `/dashboard` | Dashboard | 📊 | Always (logged in) |
| `/inventory` | Inventory | 📦 | `inventory.view` |
| `/whereabouts` | Whereabouts | 📍 | `inventory.view` |
| `/condition` | Condition | 🔧 | `inventory.view` |
| `/purchases` | Purchases | 🛒 | `purchases.view` |
| `/borrows` | Borrows | 📋 | `borrows.view` |
| `/approvals` | Approvals | ✅ | `approvals.manage` |
| `/finance` | Finance | 💰 | any finance permission |
| `/activity` | Activity | 📜 | `audit.view` |
| `/team` | Team | 👥 | `admin.users` |
| `/hub/pair` | Hub devices | 📱 | `admin.users` |
| `/custom-fields` | Custom Fields | 🧩 | `admin.users` |
| `/locations` | Locations | 🗺 | `admin.locations` |

Unknown routes redirect to `/dashboard`. Permission-blocked routes also redirect to `/dashboard`.

### Sidebar footer (desktop)

- **Search** button — opens global search; shows `Ctrl+K` hint
- Avatar circle with first letter of name
- Display name and role
- **Sign out** (⏏)

### Mobile chrome

- Top bar: hamburger ☰, current page title, search 🔍
- Overlay drawer: same nav as desktop, close ✕, name/role, **Sign out**
- Bottom tab bar: first **4** visible nav items only
- Main content has bottom padding so the tab bar does not cover pages

### Global search (`Ctrl+K` / `Cmd+K`, Search button, mobile 🔍)

Command-palette overlay. Searches:

- Inventory (name, category, location, notes, item number) — up to 5
- Purchases (name, category, notes) — up to 3
- Borrows (item name, borrower name) — up to 3

Keyboard: ↑↓ navigate, Enter open (goes to `/inventory`, `/purchases`, or `/borrows`), Esc close. Click overlay to close. Footer shows result count.

### Toasts

Bottom-right stack. Types: success, error, info, warning. Auto-dismiss ~3.5s. Manual ✕ on each toast.

### Confirm dialogs

Used for destructive actions. Title, message, **Cancel**, confirm button (danger styling). Esc and overlay click cancel.

### Session handling

JWT stored in `localStorage` (`rt_token`, `rt_user`) and as HttpOnly cookie `rt_token`. 401 responses clear session and send the user to `/login`.

---

## 3. Authentication

### Login page (`/login`)

- Robot emoji, “Robotics Inventory”, “Sign in to continue”
- Loads public username directory (`GET /api/auth/usernames` — names and roles, no passwords)
- Account picker grid (2–3 columns): each user is a button with role-colored border, role icon, name, role
  - Admin 👑, Manager 🔑, Accounting Admin 💹, Member 👤, Viewer 👁
- After selecting an account: password field (“Password for {name}”)
- If username list fails: fallback username text field
- **Sign In** (disabled until an account is selected when the picker is shown)
- Error banner for invalid credentials
- Dev-only hint: `Admin / admin123`
- Logged-in users hitting `/login` are redirected to `/dashboard`

### Login API behavior

- Rate limited: 30 attempts / 15 minutes
- Case-insensitive name match
- Passwords hashed with bcrypt (legacy plaintext accepted until migration hashes them)
- Sets HttpOnly `rt_token` cookie (SameSite=Lax, Secure in production, 7-day Max-Age)
- Returns JWT + user without password

### Logout

- `POST /api/auth/logout` clears cookie
- Client clears localStorage and navigates to `/login`

---

## 4. Roles, permissions, and route gates

### Roles

`Admin`, `Manager`, `Accounting Admin`, `Member`, `Viewer`.

Admin **bypasses all permission checks** on both frontend and backend.

If a user has no `permissions` array, role defaults apply.

### Granular permission keys

**Inventory:** `inventory.view`, `inventory.edit`, `inventory.delete`

**Moves:** `moves.request`, `moves.approve`

**Purchases:** `purchases.view`, `purchases.edit`

**Borrows:** `borrows.view`, `borrows.manage`

**Finance:**

- `finance.transactions.view` / `.edit`
- `finance.budget.view` / `.edit`
- `finance.goals.view` / `.edit`
- `finance.fundraisers.view` / `.edit`
- `finance.reimbursements.view` / `.request` / `.approve`
- `finance.reports.view`

**Approvals & logs:** `approvals.manage`, `audit.view`

**Admin:** `admin.users`, `admin.locations`

### Default permissions by role

| Role | Defaults |
| --- | --- |
| Admin | All keys (and bypasses checks anyway) |
| Manager | Inventory view/edit, moves request/approve, purchases view/edit, borrows view/manage, all finance, approvals, audit |
| Accounting Admin | Inventory view, purchases view, all finance, audit |
| Member | Inventory view, moves request, purchases view/edit, borrows view/manage, reimbursements view + request |
| Viewer | Inventory view, purchases view, borrows view |

### Extra backend rule

Condition updates are allowed for `inventory.edit`, **or** for `inventory.view` when the role is not Viewer. Viewers cannot update condition.

---

## 5. Dashboard (`/dashboard`)

Always reachable when logged in. Content is permission-gated.

### Stat cards

- **Total Units** (sum of `totalQty`) + item count — needs `inventory.view`
- **Low Stock** count (qty ≤ minStock when minStock > 0) — `inventory.view`
- **Pending Moves** — `approvals.manage`
- **Net Balance** (`$income` subtitle) — any finance *view* permission
- **Budget Used** percent (`$actual / $allocated` for current year/month, including annual budgets) — finance view

### Inventory charts (`inventory.view`)

- Pie: condition distribution (New / Good / Fair / Poor)
- Line: items added last 30 days (by `createdAt`)
- Bar: items by category (top 8)

### Finance overview (finance view)

- Link: **Open Finance →**
- Bar: Income vs Expenses, last 6 months (Donation + FundraiserIncome = income; everything else = expense)
- Bar: Spending by category (top 8 expense categories)
- Budget utilization list (up to 5 rows with color: emerald &lt;80%, amber ≥80%, red ≥100%); **+N more →** if more than 5
- Recent transactions (5 newest) with signed amounts; **View all →**

### Action lists

- **Low Stock Items** (up to 5) — name, category, qty/minStock, **View all →** inventory
- **Overdue Borrows** (up to 5) — item name, borrower, due date, **View all →** borrows
- **Pending Move Requests** (up to 5) — item, destination, requester, **View all →** approvals

---

## 6. Inventory (`/inventory`)

Permission: `inventory.view`. Edit/delete/move extra gated as noted.

### Toolbar

- Search box: name, category, notes, item number
- Sort dropdown (persisted in `localStorage` as `rt_inv_sort`):
  - Name A→Z / Z→A
  - Qty High→Low / Low→High
  - Condition Poor first / Good first
  - Category
  - Location
- View toggle (persisted as `rt_inv_view`): **Grid** ⊞ / **List** ☰
- **+ Add** (`inventory.edit`) — opens Add Item modal
- **Bulk Add** (`inventory.edit`) — spreadsheet-style modal

### Filter chips (toggle on/off)

- Condition chips with live counts: New, Good, Fair, Poor
- Up to 5 category chips (from data)
- Up to 4 location chips (📍 name)
- **Clear filters ✕** when any filter is active

### Results

- Count: “N items (filtered from M)”
- Empty: 📦 “No items found”
- Loading: “Loading…”

### Grid card (each item)

- Image or 📦 placeholder
- Name, condition badge, item #, category
- Location, qty (⚠ + amber border if low stock), assigned person
- Buttons:
  - **Details**
  - 📍 Request move
  - ↪ Direct move (only if `moves.approve`)

### List row (each item)

Same data + **Details**, 📍, ↪. Low-stock left amber bar and “⚠ Low”.

---

### Add / Edit Item modal

Title: **Add Item** or **Edit Item**. Overlay click and ✕ close. **Cancel** / **Save**.

Fields:

- **Name *** (required)
- **Item #** (e.g. TOOL-001)
- **Category** select: Mechanical, Electronics, Pneumatics, Tools, Software, Safety, Consumables, Structural, Drive Train, Sensors, Fasteners, Other
- **Qty** (create only, min 1). Edit shows a warning: qty is not editable here; use stock adjust on the detail page
- **Min Stock**
- **Condition**: New / Good / Fair / Poor
- **Location** select from Locations (or None)
- **Assigned Person**
- **Notes**
- **This is a kit** checkbox

When kit is checked: BOM editor

- Search other non-kit items
- Click match to add with qty 1
- Per-component qty input and ✕ remove
- “No components yet” empty state

If the category has custom field definitions: extra text / number / select fields.

Creating an item with qty &gt; 1 also generates per-unit records (capped at 500 units).

---

### Bulk Add modal

Table of rows: Name *, Category, Qty, Condition, Location, ✕ remove row.

- **+ Add row** (copies previous row’s category and location)
- **Cancel**
- **Add N items** (only named rows are saved; sequential create)

---

### Direct Move modal (inventory)

Title **Move: {name}**. Location, Assigned Person, Notes. **Cancel** / **Move**. Requires `moves.approve`. Writes a location-log entry.

---

### Item Detail modal

Escape closes. Header: name, condition badge, Kit badge if kit, item #.

Header buttons (`inventory.edit`):

- **Update Condition**
- **Edit** (opens item form; only when opened from Inventory)
- **Delete** (confirm; only with `inventory.delete` and when opened from Inventory)
- ✕ close

Tabs:

#### Overview

Stats: Quantity, Condition, Category, Location, Assigned To, Min Stock.

- Low-stock banner
- Kit components list
- Custom field values
- Notes
- **Adjust Stock** (`inventory.edit`): qty + optional reason, **+ Add** / **– Remove**
- Recent stock changes (last 5 of quantity log)

#### Comments (`Comments (N)`)

Any `inventory.view` user:

- Textarea, Ctrl/Cmd+Enter to post, **Post Comment**
- Reverse-chronological list with avatar initial, name, timestamp

#### History

Merged timeline of moves, condition changes, and stock changes (newest first).

#### Files (`Files (N)`)

- Main image: preview, **Change** or **+ Upload Image** (`inventory.edit`)
- Attachments: **+ Upload** (PDF, DOC/DOCX, XLS/XLSX, CSV, images; 4 MB)
  - Per file: name, uploader, date, **Open**, ✕ delete (`inventory.edit`)

#### Units (only if `totalQty > 1`)

Per-unit SKU, condition, location, person, **Edit** → Unit Manager modal.

---

### Unit Manager modal

Title **Edit Unit** + SKU. Condition history (scrollable). Fields: Condition, Condition Note, Location, Assigned Person. **Cancel** / **Save Unit**.

---

### Condition Update modal (from detail or Condition page)

Grid of New / Good / Fair / Poor. Optional note. **Cancel** / **Update**. Appends a condition-log entry.

---

### Move Request modal

Title **Request Move**. Requested Location, Assign To Person, Notes. **Cancel** / **Submit Request**. Requires `moves.request`. Creates a pending move request for Approvals.

---

### Delete Item confirm

“Permanently delete "{name}"? This cannot be undone.” **Cancel** / **Delete**. Also deletes child units.

---

## 7. Whereabouts (`/whereabouts`)

Permission: `inventory.view`.

- Header: “Whereabouts” + “N items · M locations”
- Items grouped by `currentLocation`
  - Known locations first (Locations list order)
  - Then unknown location names (amber “Unknown location”)
  - Then “No Location” (❓)
- Group header button: expand/collapse (▾ / ▸), count badge. Groups start expanded
- Per item: click name → Item Detail; category; assigned person; condition; qty
  - 📍 Request move
  - ↪ Direct move (`moves.approve`) — **New Location** required (Select…), person, notes, **Cancel** / **Move**
- Empty: “No items in inventory”

---

## 8. Condition Tracker (`/condition`)

Permission: `inventory.view`.

- Filter pills: **All (N)**, New, Good, Fair, Poor (each with count). Sorted Poor → New
- Card per item: color bar, clickable name → detail, condition badge, category, location
- Last condition-log line: date, user, note
- **Update** → Condition Update modal
- Empty: “No items in this condition”

---

## 9. Purchases (`/purchases`)

Permission: `purchases.view`. Mutating needs `purchases.edit`.

### Page chrome

- Title **Purchases**
- **+ Add Request** (`purchases.edit`)
- Status filters: **All (N)**, Needed, Ordered, Received (counts)

### Each purchase row

- Name, status badge (Needed amber / Ordered blue / Received emerald)
- Priority: 🔴 High / 🟡 Medium / 🟢 Low
- Qty, category, requester, **🔗 Link** (opens URL), notes
- Status dropdown (Needed / Ordered / Received) — changing to **Received** auto-updates inventory:
  - If a matching item exists (linked id or same name, case-insensitive), stock is increased and a quantity-log entry is written
  - Otherwise a new inventory item is created (condition New, notes “Created from purchase order …”)
  - Units cap 500
- **Edit**
- ✕ Delete → confirm “Delete "{name}"?”

### Add / Edit Purchase modal

Fields: Item Name *, Quantity, Category, Priority (Low/Medium/High), Status, Link/URL, Notes, Requester. **Cancel** / **Save**.

---

## 10. Borrows (`/borrows`)

Permission: `borrows.view` (page-level lock message if missing). Manage needs `borrows.manage`.

- **+ Add Borrow**
- Tabs: **Active (N)** / **Returned (N)**
- Card: item name, **Overdue** badge if past expected return, borrower, contact, due date (red if overdue), returned date, created date, notes
- **Return** (active only) — marks returned with timestamp
- **Edit** (active only)
- ✕ Delete → confirm
- Overdue cards get a red border

### Add / Edit Borrow modal

- Item * — typeahead search of inventory; selected chip with ✕ to clear (create only; item locked on edit)
- Borrower Name *
- Contact Info
- Expected Return Date
- Notes
- **Cancel** / **Create Borrow** or **Save**

---

## 11. Approvals (`/approvals`)

Permission: `approvals.manage`.

- Title + red **N pending** badge
- Empty: ✅ “No pending approvals”
- Two sections: **Move Requests** and **Reimbursement Requests**

### Move request card

Item name, from location, to location, assign-to person, requested by, notes.

Buttons: **Approve** (applies the move immediately), **Deny**.

### Reimbursement card

Amount, requester name, reason, **📎 Receipt** link, submitted date.

Buttons: **Approve** (creates a finance transaction of type Reimbursement), **Deny**.

### Deny modal

Optional reason textarea. **Cancel** / **Deny**.

---

## 12. Finance (`/finance/*`)

Gate: any finance permission. Tabs only show if the matching view/request/approve permission is present. URL: `/finance/transactions`, `/finance/budget`, `/finance/goals`, `/finance/reimburse`, `/finance/fundraisers`, `/finance/reports`. First allowed tab is used if the path is invalid.

Restricted copy: “Finance is restricted.” / “No finance areas available.”

---

### 12.1 Transactions (`finance.transactions.view`)

Header: **Import CSV** + **+ Add** (`finance.transactions.edit`).

Stat cards: Total Income, Total Expenses, Net Balance.

Filters: search description/category; type dropdown (Purchase, Donation, FundraiserIncome, Reimbursement).

List: grouped by date, 25 per page, running balance.

Per row:

- Description, type badge (FundraiserIncome shown as “Fundraiser”), category, receipt link
- Signed amount (green income / red expense)
- Running balance
- ⋯ menu: **Edit**, **Delete** (danger)

Pagination: Previous / Next, “a–b of N”.

#### Add / Edit Transaction modal

- Type, Date, Description *, Amount ($) *, Category (inventory categories plus Travel, Food, Registration, Fundraiser, Savings, Reimbursement, Other)
- If type is Purchase: **Link to Purchase Order** dropdown
- Receipt: URL or file upload (see Receipt field)
- **Cancel** / **Save**

#### Import CSV modal

- Explains one CSV for all types; optional `fundraiser` column links FundraiserIncome by name
- **Choose CSV…**
- **Download template** (`transactions-import-template.csv`)
- Error list by row
- Preview of valid rows (date, type, description, amount, fundraiser link or “unlinked”)
- **Cancel** / **Import N valid**
- Types aliases: purchase/expense → Purchase; donation/income → Donation; fundraiser/fundraiserincome → FundraiserIncome; reimbursement → Reimbursement
- Dates: `YYYY-MM-DD` or `M/D/YYYY`
- Linked FundraiserIncome rows also create donation entries on the fundraiser

#### Delete Transaction confirm

“Delete "{description}"?”

---

### 12.2 Budget (`finance.budget.view`)

- Year select (previous / current / next)
- Month select (Jan–Dec)
- **+ Add Budget** (`finance.budget.edit`)
- Stats: Allocated, Actual (computed from Purchase + Reimbursement transactions matching category/year/month), Variance (under / over / on budget)
- Bar chart: Allocated vs Actual (actual bar red if over, green if under)
- Rows: category, allocated, actual, variance badge, usage bar (emerald / amber ≥80% / red ≥100%), “N% used”
- ⋯ **Edit** / **Delete**

#### Add / Edit Budget modal

Category * (Tools, Electronics, Pneumatics, Mechanical, Structural, Drive Train, Safety, Travel, Food, Registration, Sensors, Other), Year, Month (1–12, blank = annual), Allocated ($). **Cancel** / **Save**.

Annual budgets (`month` null) appear in every month of that year in the viewer.

#### Delete Budget confirm

“Delete budget for "{category}"?”

---

### 12.3 Savings Goals (`finance.goals.view`)

- **+ New Goal** (`finance.goals.edit`)
- Card: name, **Complete** if current ≥ target, **Overdue** if past deadline and incomplete, deadline, progress bar
- **+ Funds** (not shown if complete)
- ⋯ **Edit** / **Delete**

#### New / Edit Savings Goal modal

Goal Name *, Target ($), Current ($), Deadline. **Cancel** / **Create Goal** or **Save**.

#### Add Funds modal

Toggle **New Transaction** vs **Link Existing**.

- New: amount, description (default “Contribution to: {name}”) → creates a Donation transaction linked to the goal and increments `currentAmount`
- Link Existing: dropdown of Donation / FundraiserIncome transactions not already linked; **Link**
- Empty warning if no available income transactions
- **Cancel** / **Add Funds** or **Link**

#### Delete Goal confirm

“Delete goal "{name}"?”

---

### 12.4 Reimbursements

Visible with view, request, or approve permission.

- **N pending** badge
- **+ Request** (`finance.reimbursements.request`)
- Segmented filter: All / Pending / Approved / Denied (counts)
- Card: amount, status badge, requester (if can approve), reason, submitted date, approved/denied date + by whom, denial reason, receipt link
- Pending + can approve (`finance.reimbursements.approve` **or** `approvals.manage`): **Approve**, **Deny**
- Approvers: ⋯ **Delete**

Approve creates a Reimbursement transaction (same as Approvals page).

#### Request Reimbursement modal

Amount ($) *, Reason *, Receipt (URL or upload). **Cancel** / **Submit**.

#### Deny Reimbursement modal

Optional reason. **Cancel** / **Deny**.

#### Delete Reimbursement confirm

“Delete reimbursement for $X.XX?”

---

### 12.5 Fundraisers (`finance.fundraisers.view`)

These are fundraising **events** (car wash, bake sale, booth), not physical locations.

- **+ New Fundraiser** (`finance.fundraisers.edit`)
- Card: event name, date, progress vs target, entry count
- **Quick Total** — end-of-day cash / stand total (no donor required)
- **+ Donation** — named donor
- ⋯ **Edit** / **Delete**
- **Show entries** / **Hide entries** expander: date, donor (or Anonymous), **Total** badge for quick totals, notes, amount

#### New / Edit Fundraiser modal

Event Name *, Date, Target ($), Starting Amount / Actual ($). **Cancel** / **Create** or **Save**.

#### Record Daily Total (Quick Total) modal

Help text: “Use this for end-of-day cash totals (stand, booth, etc.).”

- Total Amount Earned ($) *
- Label (default “Daily total”)
- Date
- Notes
- **Cancel** / **+ Record $X.XX**

Creates a FundraiserIncome transaction and a donation entry flagged `isQuickTotal`.

#### Add Donation modal

Donor Name (placeholder Anonymous), Amount ($) *, Date, Notes. **Cancel** / **Record**. Also creates a FundraiserIncome transaction.

#### Delete Fundraiser confirm

“Delete "{name}" and all entries?”

---

### 12.6 Reports (`finance.reports.view`)

Header export buttons:

- **Export Transactions** → `transactions.csv` (date, type, description, category, amount, receiptUrl)
- **Export Budget** → `budget-vs-actual.csv` (disabled if empty)
- **Export Donations** → `donations.csv` (disabled until donations report loads; no-op toast if no rows)

#### Balance Sheet

Income, Expenses, Net. Breakdown by transaction type (income vs expense columns).

#### Donation Summary

Grand total across fundraisers. Per fundraiser: name, date, donation count, actual vs target.

#### Budget vs Actual

Per budget line: category, variance under/over, progress bar.

---

### Receipt field (shared by transactions and reimbursements)

Toggle **🔗 URL / Link** vs **📎 Upload File**.

- URL input (Drive links, etc.)
- File picker: JPEG/PNG/GIF/WebP/PDF, max **10 MB** (receipts); preview, **Open ↗**, ✕ clear
- Uploading spinner

Item invoice attachments remain **4 MB** and allow extra office formats.

---

## 13. Activity and Audit (`/activity`)

Permission: `audit.view`.

Tabs: **Activity** vs **Audit**.

Filters: search user/item; action dropdown:

- CREATE_ITEM, UPDATE_ITEM, DELETE_ITEM
- ADJUST_STOCK, UPDATE_CONDITION
- MOVE_ITEM, MOVE_REQUEST, MOVE_APPROVED, MOVE_DENIED
- CREATE_PURCHASE, PURCHASE_RECEIVED
- BORROW_CREATED, BORROW_RETURNED
- UNDO

Table: Time, User, Action, Item, Details. 50 per page. **← Prev** / **Next →**. “N entries · page X of Y”.

### Audit-only Undo (Admin role only)

Shown for `UPDATE_ITEM`, `UPDATE_CONDITION`, `MOVE_ITEM`, `ADJUST_STOCK` when a `before` snapshot exists and the entry has not already been undone. **Undo** restores the item snapshot and writes an UNDO audit/activity entry.

---

## 14. Team (`/team`)

Permission: `admin.users`. Title **Team Management**.

### **+ Add User**

Modal: Name *, Password * (create only, min 6 chars backend), Role select. **Cancel** / **Save**. New users get that role’s default permissions.

### User row

Avatar initial, name, “(you)” on current user, role badge, “N custom permissions” or “N default”, **custom** purple badge if a permissions array is stored.

Buttons:

- **🔐 Permissions**
- **Edit** (name + role; changing role resets permissions to the new role’s defaults)
- 🔑 Change password
- ✕ Delete (hidden for yourself; backend also rejects self-delete)

### Permissions modal

Non-Admin:

- Checkboxes grouped: Inventory, Moves, Purchases, Borrows, Finance, Approvals & Logs, Administration
- “default” tag on keys that are the role default
- **↺ Reset to {role} defaults**, **Select all**, **Clear all**
- Count of selected permissions
- **Cancel** / **Save Permissions**

Admin target: notice that Admins bypass all checks; **Close** only.

### Change Password modal

New Password, Confirm Password (client match check). **Cancel** / **Change**. Min 6 characters on the server.

### Delete User confirm

“Delete "{name}"? This cannot be undone.”

### Role guide card

Lists default permission labels for Manager, Accounting Admin, Member, Viewer.

Usernames must be unique (409 on duplicate).

---

## 15. Hub devices (`/hub/pair`)

Permission: `admin.users`. Pairs Homelab Hub Android phones.

Copy explains private-network pairing unless `HUB_PAIRING_NETWORK=public_allowed`.

### Approve pairing code card

- Code input (mono, uppercase, max 9 chars, placeholder `ABCD-EFGH`)
- Bind-as user dropdown: **Act as me (approver)** or any team user (scopes then match that person)
- **Approve**

### Pending codes

Per pending session: user code, device name, expiry. **Approve** / **Deny**. Empty: “No phones waiting.”

### Paired devices

Name, last seen, active/revoked. **Revoke** → confirm “Revoke “{name}”? It will need to pair again.” Revoked rows show **Revoked**.

---

## 16. Custom Fields (`/custom-fields`)

Permission: `admin.users`. Extra fields **per inventory category** (one definition per category).

- Subtitle: “Define extra fields per inventory category”
- **+ New Definition**
- Card: category name, field count, **Edit**, ✕ Delete
  - Each field: label, key (mono), type badge, select options preview

### New / Edit Custom Fields modal

- Category * (only unused categories, plus current when editing)
- Field editor:
  - **+ Add Field**
  - Per field: Key (auto snake_case), Label, Type (`text` / `number` / `select`), Options comma-separated if select, ✕ remove field
- **Cancel** / **Save**
- Validation: at least one named+labeled field

### Delete Custom Fields confirm

“Delete custom field definition for "{category}"? Existing item values are kept but will no longer show in forms.”

---

## 17. Locations (`/locations`)

Permission: `admin.locations`. These are the app’s storage **sites** (shop, trailer, lab, etc.). There is no separate venues CRUD.

### Add location

Text field “New location name…” + **Add** (disabled when empty). Toast: “Location added”.

### Location list

Each row: 📍, name, “N item(s)” at that `currentLocation`, **Edit**, ✕ delete.

### Rename (inline)

Input + **Save** + **Cancel**. Toast: “Location renamed”.

### Delete Location confirm

“Delete "{name}"? Items at this location will remain but the location will no longer appear in menus. Items retain their currentLocation value.” Toast explains items stay until reassigned.

Empty: 📍 “No locations defined”.

Locations appear in Inventory add/edit, Bulk Add, Direct Move, Move Request, and Whereabouts grouping.

---

## 18. Homelab Hub (Android native protocol)

Protocol **Hub v1** at `/hub/v1`. `app_id` = `robotics.inventory`. Native UI, not a WebView. Browser login is separate.

### Discovery and pairing

- `GET /hub/v1/hello` — unauthenticated discovery
- `POST /hub/v1/pair/start` — phone starts pairing; shows `ABCD-EFGH`
  - Blocked from public IPs unless `HUB_PAIRING_NETWORK=public_allowed`
  - Private: Tailscale `100.64.0.0/10`, RFC1918, localhost
- Phone polls `POST /hub/v1/pair/poll`
- Admin approves via UI or `POST /hub/v1/pair/approve`
- `POST /hub/v1/pair/deny`
- Token refresh `POST /hub/v1/token`; refresh tokens hashed and rotated; reuse of an old refresh **revokes the device**
- `POST /hub/v1/revoke`
- Access TTL default 15 minutes; refresh 30 days

### Scopes (from bound user’s permissions at approve time)

| Scope | App permission |
| --- | --- |
| `read:inventory` | `inventory.view` |
| `write:inventory` | `inventory.edit` |
| `read:purchases` | `purchases.view` |
| `write:purchases` | `purchases.edit` |
| `read:borrows` | `borrows.view` |
| `write:borrows` | `borrows.manage` |
| `read:approvals` | `approvals.manage` |
| `write:approvals` | `approvals.manage` |
| `read:finance` | `finance.transactions.view` |
| `write:finance` | `finance.transactions.edit` |
| `admin:devices` | `admin.users` |

Manifest is filtered so the phone only sees screens/actions it can use. Mutating actions require `idempotency_key`.

### Hub screens and controls

**Home:** header, stat row (items, low stock, open purchases, active borrows, pending approvals, balance/income/expenses as scoped), pending-approvals list, buttons Inventory / Purchases / Borrows / Finance.

**Inventory:** search field bound to list; tap item → Item screen.

**Item:** stats (name, qty, condition, location, with, category, SKU); form **Adjust stock** (id, change, reason); form **Update condition** (id, New/Good/Fair/Poor, note); button **Mark Good**.

**Purchases:** list; form **Add purchase** (name, quantity, priority Low/Medium/High, notes). Status-change action exists in the action runner (`purchases.set_status`) even if not on the default form.

**Borrows:** active list; **Check out** (itemId, borrower, return date, notes); **Mark returned** (borrow id).

**Approvals:** pending list; **Submit decision** (id, type move/reimbursement, approve/deny, denial reason).

**Finance:** summary stats, recent transactions, **Add transaction** (amount, type, description, category, date).

### Hub admin API (browser JWT)

- List pairing, list devices, revoke device (`POST /hub/v1/admin/devices/:id/revoke`)

---

## 19. Platform, data, security, and ops

### Health

`GET /api/health` — `{ ok, uptime, hasData }` (503 if data unreadable). Docker healthcheck uses this.

### Database

Flat JSON file `backend/data/data.json`. Atomic write via temp file + backup `data.json.bak`. Serialized write mutex.

Tables: `rt:users`, `rt:locs`, `rt:items`, `rt:units`, `rt:purchases`, `rt:borrows`, `rt:moveRequests`, `rt:auditLog`, `rt:customFields`, `rt:accountingTransactions`, `rt:budgets`, `rt:savingsGoals`, `rt:reimbursements`, `rt:fundraisers`, `rt:activityLog`, `hub:devices`, `hub:pairingSessions`, `hub:refreshTokens`, `hub:idempotency`.

First boot: copy `seed-data.json` then run idempotent migration (missing tables, hash passwords, expand finance permissions, generate units, drop abandoned `rt:kits`).

Quantity cap: **500 units** per item.

### Uploads

Stored under `backend/data/uploads/`. Served at `/uploads` **behind auth**. Non-images forced as attachment; HTML/SVG/JS served as octet-stream. MIME sniffing on save.

### Security middleware

- Helmet (CSP off for SPA)
- CORS (allow all or `CORS_ORIGIN` list) with credentials
- JSON body limit 10 MB
- Login rate limit 30 / 15 min
- Hub pairing/token/action rate limits
- JWT via Bearer header, cookie, or `?token=`
- Passwords bcrypt, 6-character minimum on create/change

### Config (env)

`PORT`, `DATA_DIR`, `NODE_ENV`, `SESSION_SECRET`, `CORS_ORIGIN`, `TOKEN_TTL`, `HUB_PUBLIC_URL`, `HUB_TAILSCALE_URL`, `HUB_JWT_SECRET`, `HUB_PAIRING_NETWORK`, `HUB_ACCESS_TTL_SECONDS`, `HUB_REFRESH_TTL_SECONDS`.

### Docker

Single service `inventory-app` on port 3000, volume `inventory-data`, restart unless-stopped. Multi-stage production image serves built SPA from `/public`.

### SPA serving

In production, Express serves `public/` and falls back to `index.html` except `/api`, `/uploads`, `/hub/v1`.

### Graceful shutdown

SIGTERM/SIGINT close the HTTP server (10s force exit).

### Audit vs activity

Mutations write human-readable **activity** entries and (for inventory mutations) **audit** snapshots with `before`/`after` for undo.

---

## 20. Shared UI primitives

- **ConfirmDialog** — Cancel / confirm, Esc, overlay dismiss
- **Toaster** — typed toasts with dismiss
- **RowActions** — ⋯ overflow (Edit/Delete), click-outside and Esc
- **FinancePageHeader** — title + optional badge + action slot
- **MoneyStat** — labeled money figure
- **FinanceProgress** — current vs target bar
- **FinanceEmpty** — empty-state copy
- **ReceiptField** — URL vs upload
- **ItemCard** / **ItemListRow** — inventory presentations

Categories used across inventory/purchases: Mechanical, Electronics, Pneumatics, Tools, Software, Safety, Consumables, Structural, Drive Train, Sensors, Fasteners, Other.

Conditions: New, Good, Fair, Poor (color badges).

---

## 21. REST API surface

All `/api/*` except health, login, usernames, logout require auth. Permission shown in parentheses.

### Auth / health

- `GET /api/health`
- `GET /api/auth/usernames`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Items

- `GET /api/items` (inventory.view)
- `POST /api/items` (inventory.edit)
- `PUT /api/items/:id` (inventory.edit) — does not change `totalQty`
- `DELETE /api/items/:id` (inventory.delete)
- `POST /api/items/:id/stock` (inventory.edit)
- `POST /api/items/:id/condition` (edit, or view if not Viewer)
- `POST /api/items/:id/move-request` (moves.request)
- `POST /api/items/:id/move` (moves.approve)
- `GET /api/items/:id/units` (inventory.view)
- `PUT /api/items/units/:unitId` (inventory.edit)
- `POST /api/items/:id/image` (inventory.edit)
- `GET /api/items/:id/image` (inventory.view)
- `POST /api/items/invoices/:itemId` (inventory.edit)
- `DELETE /api/items/invoices/:itemId/:invoiceId` (inventory.edit)
- `POST /api/items/:id/comments` (inventory.view)

### Moves / purchases / borrows / approvals

- `GET /api/move-requests?status=` (moves.approve or approvals.manage)
- `POST /api/move-requests/:id/approve` / `.../deny`
- `GET|POST /api/purchases`, `GET|PUT|DELETE /api/purchases/:id`, `PATCH /api/purchases/:id/status`
- `GET|POST /api/borrows`, `GET|PUT|DELETE /api/borrows/:id`, `POST /api/borrows/:id/return`
- `GET /api/approvals/pending`

### Accounting

- Receipts: `POST /api/receipts/upload`
- Transactions: list, balance, create, import, update, delete
- Budgets, goals (`/add-funds`, `/link-transaction`)
- Reimbursements create/approve/deny/delete
- Fundraisers + `/donations` + `/quick-total`
- Reports: `/reports/balance-sheet`, `/reports/budget-vs-actual`, `/reports/donations`

### Admin

- Users CRUD + `POST /api/users/:id/password`
- Locations CRUD (`GET` also allowed with inventory.view)
- Custom-fields CRUD (`GET` also allowed with inventory.view)

### Logs

- `GET /api/audit` (pagination, search, action/user/item filters)
- `POST /api/audit/undo` (Admin role)
- `GET /api/activity`

### Hub

- `/hub/v1/hello`, pair start/poll/approve/deny, token, revoke
- `/hub/v1/manifest`, `/hub/v1/data/:key`, `/hub/v1/actions/:action_id`
- `/hub/v1/devices`, `/hub/v1/admin/pairing`, `/hub/v1/admin/devices`, revoke

---

## 22. Seed data shipped with the repo

Copied to `data.json` on first boot:

- Users: Admin / admin123; Alex Manager, Sam Accounting, Jordan Member, Casey Viewer (password `changeme1`)
- Locations: Shop Storage, Team Trailer, School Lab, Offsite Storage
- A populated inventory (tools, electronics, etc. with condition/location logs)

Change the Admin password immediately on a real deployment.

---

## Feature checklist (every primary button / control)

Use this as a flat index of named controls. Permission may hide the control.

**Global:** Search, Ctrl+K, Sign out, hamburger, sidebar links (13 destinations), mobile bottom tabs, toast dismiss.

**Login:** account tiles, username fallback, password, Sign In.

**Dashboard:** Open Finance, View all (finance / inventory / borrows / approvals), +N more budgets.

**Inventory:** Search, Sort, Grid, List, + Add, Bulk Add, condition/category/location chips, Clear filters, Details, 📍, ↪, Save/Cancel/✕ on item form, kit search add, kit qty, kit ✕, + Add row, Add N items, Move, Submit Request, Update Condition, Edit, Delete, + Add / – Remove stock, Post Comment, Change/Upload image, + Upload attachment, Open, attachment ✕, unit Edit, Save Unit.

**Whereabouts:** group expand, item name, 📍, ↪, Move.

**Condition:** All/New/Good/Fair/Poor pills, item name, Update.

**Purchases:** + Add Request, All/Needed/Ordered/Received, status dropdown, Edit, ✕, Link, Save.

**Borrows:** + Add Borrow, Active/Returned, Return, Edit, ✕, item typeahead, Create Borrow/Save.

**Approvals:** Approve, Deny, Deny modal Cancel/Deny.

**Finance tabs:** Transactions, Budget, Savings Goals, Reimbursements, Fundraisers, Reports.

**Transactions:** Import CSV, + Add, search, type filter, ⋯ Edit/Delete, Previous/Next, Choose CSV, Download template, Import N valid, Receipt URL/Upload/Open/clear.

**Budget:** year, month, + Add Budget, ⋯ Edit/Delete.

**Goals:** + New Goal, + Funds, ⋯ Edit/Delete, New Transaction / Link Existing, Add Funds / Link.

**Reimbursements:** + Request, All/Pending/Approved/Denied, Approve, Deny, ⋯ Delete, Submit.

**Fundraisers:** + New Fundraiser, Quick Total, + Donation, ⋯ Edit/Delete, Show/Hide entries, Record $amount, Record donation.

**Reports:** Export Transactions, Export Budget, Export Donations.

**Activity:** Activity/Audit tabs, search, action filter, Prev/Next, Undo.

**Team:** + Add User, Permissions, Edit, 🔑, ✕, Reset/Select all/Clear all, Save Permissions, Change password.

**Hub devices:** Approve, Deny, Revoke, user bind dropdown, code field.

**Custom Fields:** + New Definition, Edit, ✕, + Add Field, field ✕, Save.

**Locations:** Add, Edit, Save, Cancel, ✕ delete.
