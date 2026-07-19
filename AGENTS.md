# AGENTS.md — AI / contributor index

Robotics team inventory + accounting app (React/Vite frontend, Express + JSON-file backend).

Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design. Use this file to find the right edit points quickly.

---

## Run (local)

```bash
# Terminal 1
cd backend && npm install && npm run dev    # :3001

# Terminal 2
cd frontend && npm install && npm run dev   # :5173, proxies /api → :3001
```

Docker: `docker compose up -d` → http://localhost:3000  
Data file: `backend/data/data.json` (created from `seed-data.json` on first boot).

---

## Directory index — edit here when…

| Path | Edit when you need to… |
|------|------------------------|
| `backend/server.js` | Boot/migrate order, global middleware, mount a new router, SPA/static paths, login endpoint |
| `backend/routes/items.js` | Inventory CRUD, stock, condition, direct move, move-request create, units, images, invoices, comments |
| `backend/routes/moves.js` | Approve/deny move requests |
| `backend/routes/purchases.js` | Purchase requests; receive → inventory |
| `backend/routes/borrows.js` | Borrow / return lifecycle |
| `backend/routes/accounting.js` | Transactions, budgets, goals, reimbursements, fundraisers, reports, receipts |
| `backend/routes/approvals.js` | Combined pending queue for managers |
| `backend/routes/admin.js` | Users, locations, custom-field **definitions** |
| `backend/routes/audit.js` | Audit log + undo |
| `backend/routes/activity.js` | Activity feed |
| `backend/utils/storage.js` | How JSON is read/written (atomic rename, mutex) — change carefully |
| `backend/utils/migration.js` | New tables, field defaults, role→permission defaults, legacy normalizers |
| `frontend/src/App.jsx` | Routes, auth/toast context, `PermRoute` gates |
| `frontend/src/lib/api.js` | Client API wrappers (`X-User-Id` header lives here) |
| `frontend/src/lib/constants.js` | Categories, conditions, roles, permission keys/groups, nav items, enums |
| `frontend/src/lib/permissions.js` | `hasPermission` / role fallback logic |
| `frontend/src/pages/*.jsx` | Screen UI per domain |
| `frontend/src/pages/finance/*.jsx` | Finance sub-tabs |
| `frontend/src/components/*` | Shared chrome (Layout, Login, search, cards) |
| `frontend/src/modals/*` | Item detail / move / units / condition dialogs |
| `frontend/vite.config.js` | Dev proxy, build `outDir` (`../public`) |
| `seed-data.json` | Bootstrap data for **new** installs only |
| `docker-compose.yml` / `Dockerfile` | Deploy ports, volume, env |

---

## Recipes

### Add an API endpoint

1. Implement handler in the matching `backend/routes/<domain>.js` (or new file).
2. If new router file: `app.use('/api/...', require('./routes/...'))` in `server.js`.
3. Guard with local `requireRole(...)` (copied pattern in each route file — there is no shared middleware module yet).
4. Mutate via `readData()` / `writeData()`; push activity/audit entries the same way neighboring handlers do.
5. Add a named function in `frontend/src/lib/api.js`.
6. Call it from the page/modal.

### Add a page / nav item

1. Create `frontend/src/pages/YourPage.jsx`.
2. Add `<Route>` (+ optional `PermRoute`) in `App.jsx`.
3. Add `{ path, label, icon, permission? }` to `NAV_ITEMS` in `constants.js`.
4. Wire API calls through `lib/api.js`.

### Add a permission key

1. Add constant + group entry in `frontend/src/lib/constants.js` (`PERMISSIONS`, `PERMISSION_GROUPS`).
2. Update `ROLE_DEFAULT_PERMISSIONS` in **both**:
   - `frontend/src/lib/constants.js`
   - `backend/utils/migration.js`
3. Gate UI with `hasPermission` / `PermRoute` / `NAV_ITEMS.permission`.
4. Note: most **backend** routes still check **roles**, not granular keys. If the API must enforce the new key, add an explicit check in the route (or extend `requireRole` usage). Existing users already have a stored `permissions` array — migration only fills permissions when the array is missing.

### Add a data table / schema field

1. Add key to `TABLE_DEFAULTS` in `migration.js` (for new collections).
2. Add normalizer logic in `migrateData` for defaults on existing rows.
3. Read/write the key in the relevant route(s).
4. Optionally extend `seed-data.json` for fresh installs.
5. Update UI + `api.js` as needed.

---

## Conventions

- **Backend:** CommonJS (`require` / `module.exports`), `'use strict'` in some files.
- **Frontend:** React function components, React Router 6, Tailwind utility classes, dark theme classes already in use.
- **`requireRole`:** Duplicated at the top of each route file — copy the same helper when adding a new router.
- **Logging:** `activityLog` / `auditLog` helpers are often **local** to a route file (not a shared util). Mirror the nearest file’s pattern.
- **IDs:** Prefer `uuid` (`v4`) for new records (see admin/items/accounting).
- **Auth header:** Always go through `lib/api.js` so `X-User-Id` stays consistent.
- **Finance UI:** Tab switching is local state in `Finance.jsx`, not nested React Router paths (despite `/finance/*` in `App.jsx`).

---

## Customization cookbook

### 1. Categories, conditions, nav, labels

Edit [`frontend/src/lib/constants.js`](frontend/src/lib/constants.js):

- `CATEGORIES`, `CONDITIONS`, `CONDITION_COLORS`, `PRIORITIES`, `PURCHASE_STATUSES`, `TRANSACTION_TYPES`
- `NAV_ITEMS` — paths, labels, icons, optional `permission`
- `SORT_OPTIONS`, `ROLES`

Budget-only category lists also appear inline in `pages/finance/Budget.jsx` and extras in `Transactions.jsx` — update those if finance categories should stay aligned.

### 2. Roles and default permissions

Keep in sync:

| File | Symbol |
|------|--------|
| `frontend/src/lib/constants.js` | `ROLES`, `ROLE_DEFAULT_PERMISSIONS`, `PERMISSIONS` |
| `backend/utils/migration.js` | `ROLE_DEFAULT_PERMISSIONS` |

Admins can further customize per-user `permissions` in the Team UI (`pages/Team.jsx`).

### 3. Seed / team bootstrap

[`seed-data.json`](seed-data.json) is copied to `data.json` **only when** `data.json` does not exist. Changing the seed does not alter an existing volume/DB.

Legacy seed shape (`pin`, `isAdmin`) is fine — migration converts to `password` + `role` + `permissions`.

Do not commit secrets or live production dumps into the seed if the repo is shared broadly.

### 4. Environment

| Variable | Effect |
|----------|--------|
| `PORT` | Listen port (`3001` local default, `3000` in compose) |
| `DATA_DIR` | Location of `data.json` and `uploads/` |
| `NODE_ENV` | `production` in Docker |

Set via `docker-compose.yml` or root `.env`.

### 5. Item custom fields

- **Definitions:** `rt:customFields` via `/api/custom-fields` ([`routes/admin.js`](backend/routes/admin.js)); client helpers already in `api.js` (`getCustomFields`, etc.).
- **Values:** `item.customFields` object on each item (accepted on create/update in `routes/items.js`).
- **UI:** API client exists; there is **no dedicated admin/editor page** wired yet — adding UI means a new page or section (likely Team/Admin) that calls those helpers, plus fields in `ItemDetailModal` / Inventory forms.

### 6. Uploads and limits

| Type | Limit | Where enforced |
|------|-------|----------------|
| Item image / invoice | 4 MB | `routes/items.js`, `ItemDetailModal.jsx` |
| Finance receipt | 10 MB | `routes/accounting.js`, `ReceiptField.jsx` |
| JSON body | 10 MB | `express.json` in `server.js` |

Files land in `DATA_DIR/uploads` and are served at `/uploads/...`.

---

## API ↔ page crosswalk

| UI | Primary API / routes |
|----|----------------------|
| Login | `POST /api/auth/login` |
| Dashboard | Aggregates from items, purchases, borrows, finance endpoints |
| Inventory / Whereabouts / Condition | `/api/items`, units, condition, move |
| Item modals | `/api/items/*`, invoices, comments, images |
| Purchases | `/api/purchases` |
| Borrows | `/api/borrows` |
| Approvals | `/api/approvals/pending`, move-requests, reimbursements approve/deny |
| Finance → Transactions | `/api/transactions` |
| Finance → Budget | `/api/budgets` |
| Finance → Savings Goals | `/api/goals` |
| Finance → Reimbursements | `/api/reimbursements` |
| Finance → Fundraisers | `/api/fundraisers` |
| Finance → Reports | `/api/reports/*` |
| Activity | `/api/activity` (+ audit for admins) |
| Team | `/api/users`, password change |
| Locations | `/api/locations` |

---

## Do / don’t

**Do**

- Extend existing route modules and `api.js` wrappers.
- Keep frontend permission **strings** identical wherever checked.
- Update **both** role-default maps when changing defaults.
- Preserve atomic write behavior in `storage.js`.
- Prefer small, domain-local changes over new frameworks or a second database.

**Don’t**

- Commit live `backend/data/` or upload blobs.
- Rewrite auth/storage “while here” unless the task is hardening.
- Assume granular `user.permissions` are enforced on every backend route (many use roles only).
- Rely on editing `seed-data.json` to fix a running deployment (it won’t reload over existing `data.json`).
- Paste seed PINs or teammate PII into docs or commit messages.
