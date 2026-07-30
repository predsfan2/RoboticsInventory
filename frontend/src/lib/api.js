const BASE = '/api';

const TOKEN_KEY = 'rt_token';
const USER_KEY = 'rt_user';

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(user, token) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(method, path, body, isFormData = false) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers, credentials: 'include' };
  if (body !== undefined) {
    opts.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }

  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

// Auth
export const login = (name, password) => api.post('/auth/login', { name, password });
export const logout = () => api.post('/auth/logout');
export const getUsernames = () => api.get('/auth/usernames');

// Items
export const getItems = () => api.get('/items');
export const createItem = (body) => api.post('/items', body);
export const updateItem = (id, body) => api.put(`/items/${id}`, body);
export const deleteItem = (id) => api.del(`/items/${id}`);
export const adjustStock = (id, change, reason) => api.post(`/items/${id}/stock`, { change, reason });
export const updateCondition = (id, condition, note) => api.post(`/items/${id}/condition`, { condition, note });
export const createMoveRequest = (id, body) => api.post(`/items/${id}/move-request`, body);
export const moveItemDirect = (id, body) => api.post(`/items/${id}/move`, body);
export const getItemUnits = (id) => api.get(`/items/${id}/units`);
export const updateUnit = (unitId, body) => api.put(`/items/units/${unitId}`, body);
export const uploadItemImage = (id, base64, mimeType) => api.post(`/items/${id}/image`, { base64, mimeType });
export const uploadInvoice = (itemId, base64, name, mimeType) =>
  api.post(`/items/invoices/${itemId}`, { base64, name, mimeType });
export const deleteInvoice = (itemId, invoiceId) => api.del(`/items/invoices/${itemId}/${invoiceId}`);
export const addComment = (itemId, text) => api.post(`/items/${itemId}/comments`, { text });

// Move requests
export const getMoveRequests = (status) => api.get('/move-requests' + (status ? `?status=${status}` : ''));
export const approveMoveRequest = (id) => api.post(`/move-requests/${id}/approve`);
export const denyMoveRequest = (id, reason) => api.post(`/move-requests/${id}/deny`, { reason });

// Purchases
export const getPurchases = () => api.get('/purchases');
export const createPurchase = (body) => api.post('/purchases', body);
export const updatePurchase = (id, body) => api.put(`/purchases/${id}`, body);
export const deletePurchase = (id) => api.del(`/purchases/${id}`);
export const setPurchaseStatus = (id, status) => api.patch(`/purchases/${id}/status`, { status });

// Borrows
export const getBorrows = () => api.get('/borrows');
export const createBorrow = (body) => api.post('/borrows', body);
export const updateBorrow = (id, body) => api.put(`/borrows/${id}`, body);
export const returnBorrow = (id) => api.post(`/borrows/${id}/return`);
export const deleteBorrow = (id) => api.del(`/borrows/${id}`);

// Accounting
export const getTransactions = () => api.get('/transactions');
export const getBalance = () => api.get('/transactions/balance');
export const createTransaction = (body) => api.post('/transactions', body);
export const updateTransaction = (id, body) => api.put(`/transactions/${id}`, body);
export const deleteTransaction = (id) => api.del(`/transactions/${id}`);

export const getBudgets = () => api.get('/budgets');
export const createBudget = (body) => api.post('/budgets', body);
export const updateBudget = (id, body) => api.put(`/budgets/${id}`, body);
export const deleteBudget = (id) => api.del(`/budgets/${id}`);

export const getGoals = () => api.get('/goals');
export const createGoal = (body) => api.post('/goals', body);
export const updateGoal = (id, body) => api.put(`/goals/${id}`, body);
export const deleteGoal = (id) => api.del(`/goals/${id}`);
export const addFundsToGoal = (id, amount, description) =>
  api.post(`/goals/${id}/add-funds`, { amount, description });
export const linkTransactionToGoal = (id, transactionId, description) =>
  api.post(`/goals/${id}/link-transaction`, { transactionId, description });

export const getReimbursements = () => api.get('/reimbursements');
export const createReimbursement = (body) => api.post('/reimbursements', body);
export const approveReimbursement = (id) => api.post(`/reimbursements/${id}/approve`);
export const denyReimbursement = (id, reason) => api.post(`/reimbursements/${id}/deny`, { reason });
export const deleteReimbursement = (id) => api.del(`/reimbursements/${id}`);
export const uploadReceipt = (base64, name, mimeType) =>
  api.post('/receipts/upload', { base64, name, mimeType });

export const getFundraisers = () => api.get('/fundraisers');
export const createFundraiser = (body) => api.post('/fundraisers', body);
export const updateFundraiser = (id, body) => api.put(`/fundraisers/${id}`, body);
export const deleteFundraiser = (id) => api.del(`/fundraisers/${id}`);
export const addDonation = (id, body) => api.post(`/fundraisers/${id}/donations`, body);
export const addQuickTotal = (id, body) => api.post(`/fundraisers/${id}/quick-total`, body);

export const getBalanceSheet = () => api.get('/reports/balance-sheet');
export const getBudgetVsActual = () => api.get('/reports/budget-vs-actual');
export const getDonationsReport = () => api.get('/reports/donations');

// Approvals
export const getPendingApprovals = () => api.get('/approvals/pending');

// Admin
export const getUsers = () => api.get('/users');
export const createUser = (body) => api.post('/users', body);
export const updateUser = (id, body) => api.put(`/users/${id}`, body);
export const deleteUser = (id) => api.del(`/users/${id}`);
export const changePassword = (id, password) => api.post(`/users/${id}/password`, { password });

export const getLocations = () => api.get('/locations');
export const createLocation = (name) => api.post('/locations', { name });
export const updateLocation = (id, name) => api.put(`/locations/${id}`, { name });
export const deleteLocation = (id) => api.del(`/locations/${id}`);

export const getCustomFields = () => api.get('/custom-fields');
export const createCustomFields = (body) => api.post('/custom-fields', body);
export const updateCustomFields = (id, body) => api.put(`/custom-fields/${id}`, body);
export const deleteCustomFields = (id) => api.del(`/custom-fields/${id}`);

// Audit
export const getAuditLog = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return api.get('/audit' + (q ? `?${q}` : ''));
};
export const undoAction = (auditId) => api.post('/audit/undo', auditId ? { auditId } : {});

// Activity
export const getActivity = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return api.get('/activity' + (q ? `?${q}` : ''));
};
