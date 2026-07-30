export const ROLES = ['Admin', 'Manager', 'Accounting Admin', 'Member', 'Viewer'];

// ── Granular permissions ───────────────────────────────────────────────────────
export const PERMISSIONS = {
  // Inventory
  INVENTORY_VIEW:    'inventory.view',
  INVENTORY_EDIT:    'inventory.edit',
  INVENTORY_DELETE:  'inventory.delete',
  // Moves
  MOVES_REQUEST:     'moves.request',
  MOVES_APPROVE:     'moves.approve',
  // Purchases
  PURCHASES_VIEW:    'purchases.view',
  PURCHASES_EDIT:    'purchases.edit',
  // Borrows
  BORROWS_VIEW:      'borrows.view',
  BORROWS_MANAGE:    'borrows.manage',
  // Finance (per-area)
  FINANCE_TRANSACTIONS_VIEW: 'finance.transactions.view',
  FINANCE_TRANSACTIONS_EDIT: 'finance.transactions.edit',
  FINANCE_BUDGET_VIEW:       'finance.budget.view',
  FINANCE_BUDGET_EDIT:       'finance.budget.edit',
  FINANCE_GOALS_VIEW:        'finance.goals.view',
  FINANCE_GOALS_EDIT:        'finance.goals.edit',
  FINANCE_FUNDRAISERS_VIEW:  'finance.fundraisers.view',
  FINANCE_FUNDRAISERS_EDIT:  'finance.fundraisers.edit',
  FINANCE_REIMBURSEMENTS_VIEW:    'finance.reimbursements.view',
  FINANCE_REIMBURSEMENTS_REQUEST: 'finance.reimbursements.request',
  FINANCE_REIMBURSEMENTS_APPROVE: 'finance.reimbursements.approve',
  FINANCE_REPORTS_VIEW:      'finance.reports.view',
  // Approvals
  APPROVALS_MANAGE:  'approvals.manage',
  // Audit / Activity
  AUDIT_VIEW:        'audit.view',
  // Admin
  ADMIN_USERS:       'admin.users',
  ADMIN_LOCATIONS:   'admin.locations',
};

/** All finance permission keys (for nav / route access). */
export const FINANCE_PERMISSIONS = [
  PERMISSIONS.FINANCE_TRANSACTIONS_VIEW,
  PERMISSIONS.FINANCE_TRANSACTIONS_EDIT,
  PERMISSIONS.FINANCE_BUDGET_VIEW,
  PERMISSIONS.FINANCE_BUDGET_EDIT,
  PERMISSIONS.FINANCE_GOALS_VIEW,
  PERMISSIONS.FINANCE_GOALS_EDIT,
  PERMISSIONS.FINANCE_FUNDRAISERS_VIEW,
  PERMISSIONS.FINANCE_FUNDRAISERS_EDIT,
  PERMISSIONS.FINANCE_REIMBURSEMENTS_VIEW,
  PERMISSIONS.FINANCE_REIMBURSEMENTS_REQUEST,
  PERMISSIONS.FINANCE_REIMBURSEMENTS_APPROVE,
  PERMISSIONS.FINANCE_REPORTS_VIEW,
];

export const FINANCE_VIEW_PERMISSIONS = [
  PERMISSIONS.FINANCE_TRANSACTIONS_VIEW,
  PERMISSIONS.FINANCE_BUDGET_VIEW,
  PERMISSIONS.FINANCE_GOALS_VIEW,
  PERMISSIONS.FINANCE_FUNDRAISERS_VIEW,
  PERMISSIONS.FINANCE_REIMBURSEMENTS_VIEW,
  PERMISSIONS.FINANCE_REPORTS_VIEW,
];

const ALL_FINANCE = [...FINANCE_PERMISSIONS];

// Grouped for the permission-editor UI
export const PERMISSION_GROUPS = [
  {
    label: 'Inventory',
    perms: [
      { key: 'inventory.view',   label: 'View items' },
      { key: 'inventory.edit',   label: 'Create & edit items' },
      { key: 'inventory.delete', label: 'Delete items' },
    ],
  },
  {
    label: 'Moves',
    perms: [
      { key: 'moves.request', label: 'Request moves' },
      { key: 'moves.approve', label: 'Approve / deny moves' },
    ],
  },
  {
    label: 'Purchases',
    perms: [
      { key: 'purchases.view', label: 'View purchases' },
      { key: 'purchases.edit', label: 'Create & edit purchases' },
    ],
  },
  {
    label: 'Borrows',
    perms: [
      { key: 'borrows.view',   label: 'View borrows' },
      { key: 'borrows.manage', label: 'Create & return borrows' },
    ],
  },
  {
    label: 'Finance',
    perms: [
      { key: 'finance.transactions.view', label: 'View transactions' },
      { key: 'finance.transactions.edit', label: 'Edit transactions' },
      { key: 'finance.budget.view', label: 'View budget' },
      { key: 'finance.budget.edit', label: 'Edit budget' },
      { key: 'finance.goals.view', label: 'View savings goals' },
      { key: 'finance.goals.edit', label: 'Edit savings goals' },
      { key: 'finance.fundraisers.view', label: 'View fundraisers' },
      { key: 'finance.fundraisers.edit', label: 'Edit fundraisers' },
      { key: 'finance.reimbursements.view', label: 'View reimbursements' },
      { key: 'finance.reimbursements.request', label: 'Request reimbursements' },
      { key: 'finance.reimbursements.approve', label: 'Approve reimbursements' },
      { key: 'finance.reports.view', label: 'View reports & exports' },
    ],
  },
  {
    label: 'Approvals & Logs',
    perms: [
      { key: 'approvals.manage', label: 'Approve / deny requests' },
      { key: 'audit.view',       label: 'View audit & activity log' },
    ],
  },
  {
    label: 'Administration',
    perms: [
      { key: 'admin.users',     label: 'Manage users & roles' },
      { key: 'admin.locations', label: 'Manage locations' },
    ],
  },
];

// Default permissions per role (used when user.permissions is absent,
// and as the starting point when the admin edits a user's permissions).
export const ROLE_DEFAULT_PERMISSIONS = {
  Admin: Object.values(PERMISSIONS), // all — but Admin bypasses checks anyway
  Manager: [
    'inventory.view', 'inventory.edit',
    'moves.request', 'moves.approve',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    ...ALL_FINANCE,
    'approvals.manage', 'audit.view',
  ],
  'Accounting Admin': [
    'inventory.view',
    'purchases.view',
    ...ALL_FINANCE,
    'audit.view',
  ],
  Member: [
    'inventory.view',
    'moves.request',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    'finance.reimbursements.view',
    'finance.reimbursements.request',
  ],
  Viewer: [
    'inventory.view',
    'purchases.view',
    'borrows.view',
  ],
};

export const CONDITIONS = ['New', 'Good', 'Fair', 'Poor'];

export const CONDITION_COLORS = {
  New: 'badge-new',
  Good: 'badge-good',
  Fair: 'badge-fair',
  Poor: 'badge-poor',
};

export const CATEGORIES = [
  'Mechanical',
  'Electronics',
  'Pneumatics',
  'Tools',
  'Software',
  'Safety',
  'Consumables',
  'Structural',
  'Drive Train',
  'Sensors',
  'Fasteners',
  'Other',
];

export const PRIORITIES = ['Low', 'Medium', 'High'];

export const PURCHASE_STATUSES = ['Needed', 'Ordered', 'Received'];

export const TRANSACTION_TYPES = [
  'Purchase',
  'Donation',
  'FundraiserIncome',
  'Reimbursement',
];

export const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A→Z' },
  { value: 'name_desc', label: 'Name Z→A' },
  { value: 'qty_desc', label: 'Qty High→Low' },
  { value: 'qty_asc', label: 'Qty Low→High' },
  { value: 'condition_poor', label: 'Condition (Poor first)' },
  { value: 'condition_good', label: 'Condition (Good first)' },
  { value: 'category', label: 'Category' },
  { value: 'location', label: 'Location' },
];

export const CONDITION_ORDER = { Poor: 0, Fair: 1, Good: 2, New: 3 };

// permission: single key for hasPermission, or permissions: array for hasAnyPermission.
// If neither set, the item is always shown to logged-in users.
export const NAV_ITEMS = [
  { path: '/dashboard',   label: 'Dashboard',   icon: '📊' },
  { path: '/inventory',   label: 'Inventory',   icon: '📦', permission: 'inventory.view' },
  { path: '/whereabouts', label: 'Whereabouts', icon: '📍', permission: 'inventory.view' },
  { path: '/condition',   label: 'Condition',   icon: '🔧', permission: 'inventory.view' },
  { path: '/purchases',   label: 'Purchases',   icon: '🛒', permission: 'purchases.view' },
  { path: '/borrows',     label: 'Borrows',     icon: '📋', permission: 'borrows.view' },
  { path: '/approvals',   label: 'Approvals',   icon: '✅', permission: 'approvals.manage' },
  { path: '/finance',     label: 'Finance',     icon: '💰', permissions: FINANCE_PERMISSIONS },
  { path: '/activity',    label: 'Activity',    icon: '📜', permission: 'audit.view' },
  { path: '/team',           label: 'Team',           icon: '👥', permission: 'admin.users' },
  { path: '/custom-fields',  label: 'Custom Fields',  icon: '🧩', permission: 'admin.users' },
  { path: '/locations',      label: 'Locations',      icon: '🗺',  permission: 'admin.locations' },
];
