'use strict';

const { APP_ID, APP_NAME, APP_VERSION } = require('./config');
const { hasScope, ACTION_SCOPES } = require('./scopes');

function dataUrl(key) {
  return `/hub/v1/data/${key}`;
}

function actionAllowed(actionId, scopes) {
  const needed = ACTION_SCOPES[actionId];
  return needed ? hasScope(scopes, needed) : false;
}

function scopeForDataUrl(url) {
  const m = String(url || '').match(/\/hub\/v1\/data\/([^?]+)/);
  return m ? m[1] : null;
}

function buildScreens() {
  return [
    {
      id: 'home',
      title: 'Robotics Inventory',
      components: [
        { type: 'header', text: 'Overview' },
        { type: 'stat_row', data_url: dataUrl('home.summary') },
        {
          type: 'list',
          id: 'home-approvals',
          data_url: dataUrl('home.approvals'),
          item_nav: { screen_id: 'approvals', param: 'id' },
          empty_message: 'No pending approvals',
        },
        { type: 'button', label: 'Inventory', style: 'primary', nav: { screen_id: 'inventory' } },
        { type: 'button', label: 'Purchases', style: 'secondary', nav: { screen_id: 'purchases' } },
        { type: 'button', label: 'Borrows', style: 'secondary', nav: { screen_id: 'borrows' } },
        { type: 'button', label: 'Finance', style: 'secondary', nav: { screen_id: 'finance' } },
      ],
    },
    {
      id: 'inventory',
      title: 'Inventory',
      components: [
        {
          type: 'search_field',
          placeholder: 'Search items',
          binds_to: 'inventory-list',
          query_param: 'q',
        },
        {
          type: 'list',
          id: 'inventory-list',
          data_url: dataUrl('inventory.list'),
          item_nav: { screen_id: 'item', param: 'id' },
          empty_message: 'No items match',
        },
      ],
    },
    {
      id: 'item',
      title: 'Item',
      params: ['id'],
      components: [
        { type: 'stat_row', data_url: dataUrl('inventory.item') },
        {
          type: 'form',
          action_id: 'inventory.adjust_stock',
          submit_label: 'Adjust stock',
          fields: [
            { name: 'id', label: 'Item ID', field_type: 'text', required: true },
            { name: 'change', label: 'Quantity change (+/−)', field_type: 'number', required: true },
            { name: 'reason', label: 'Reason', field_type: 'text' },
          ],
        },
        {
          type: 'form',
          action_id: 'inventory.update_condition',
          submit_label: 'Update condition',
          fields: [
            { name: 'id', label: 'Item ID', field_type: 'text', required: true },
            {
              name: 'condition',
              label: 'Condition',
              field_type: 'select',
              required: true,
              options: [
                { value: 'New', label: 'New' },
                { value: 'Good', label: 'Good' },
                { value: 'Fair', label: 'Fair' },
                { value: 'Poor', label: 'Poor' },
              ],
            },
            { name: 'note', label: 'Note', field_type: 'textarea' },
          ],
        },
        {
          type: 'button',
          label: 'Mark Good',
          style: 'secondary',
          action_id: 'inventory.update_condition',
          params: { id: '{{nav.id}}', condition: 'Good' },
        },
      ],
    },
    {
      id: 'purchases',
      title: 'Purchases',
      components: [
        {
          type: 'list',
          id: 'purchases-list',
          data_url: dataUrl('purchases.list'),
          empty_message: 'No purchase requests',
        },
        {
          type: 'form',
          action_id: 'purchases.create',
          submit_label: 'Add purchase',
          fields: [
            { name: 'name', label: 'Item name', field_type: 'text', required: true },
            { name: 'quantity', label: 'Quantity', field_type: 'number', required: true },
            {
              name: 'priority',
              label: 'Priority',
              field_type: 'select',
              options: [
                { value: 'Low', label: 'Low' },
                { value: 'Medium', label: 'Medium' },
                { value: 'High', label: 'High' },
              ],
            },
            { name: 'notes', label: 'Notes', field_type: 'textarea' },
          ],
        },
      ],
    },
    {
      id: 'borrows',
      title: 'Borrows',
      components: [
        {
          type: 'list',
          id: 'borrows-list',
          data_url: dataUrl('borrows.list'),
          empty_message: 'No active borrows',
        },
        {
          type: 'form',
          action_id: 'borrows.create',
          submit_label: 'Check out',
          fields: [
            { name: 'itemId', label: 'Item ID', field_type: 'text', required: true },
            { name: 'borrowerName', label: 'Borrower', field_type: 'text', required: true },
            { name: 'expectedReturnDate', label: 'Return date', field_type: 'date' },
            { name: 'notes', label: 'Notes', field_type: 'textarea' },
          ],
        },
        {
          type: 'form',
          action_id: 'borrows.return',
          submit_label: 'Mark returned',
          fields: [
            { name: 'id', label: 'Borrow ID', field_type: 'text', required: true },
          ],
        },
      ],
    },
    {
      id: 'approvals',
      title: 'Approvals',
      components: [
        {
          type: 'list',
          id: 'approvals-list',
          data_url: dataUrl('approvals.pending'),
          empty_message: 'Nothing waiting',
        },
        {
          type: 'form',
          action_id: 'approvals.decide',
          submit_label: 'Submit decision',
          fields: [
            { name: 'id', label: 'Request ID', field_type: 'text', required: true },
            {
              name: 'type',
              label: 'Type',
              field_type: 'select',
              required: true,
              options: [
                { value: 'move', label: 'Move request' },
                { value: 'reimbursement', label: 'Reimbursement' },
              ],
            },
            {
              name: 'decision',
              label: 'Decision',
              field_type: 'select',
              required: true,
              options: [
                { value: 'approve', label: 'Approve' },
                { value: 'deny', label: 'Deny' },
              ],
            },
            { name: 'reason', label: 'Denial reason', field_type: 'textarea' },
          ],
        },
      ],
    },
    {
      id: 'finance',
      title: 'Finance',
      components: [
        { type: 'stat_row', data_url: dataUrl('finance.summary') },
        {
          type: 'list',
          id: 'finance-txns',
          data_url: dataUrl('finance.transactions'),
          empty_message: 'No transactions',
        },
        {
          type: 'form',
          action_id: 'finance.add_transaction',
          submit_label: 'Add transaction',
          fields: [
            { name: 'amount', label: 'Amount', field_type: 'number', required: true },
            {
              name: 'type',
              label: 'Type',
              field_type: 'select',
              required: true,
              options: [
                { value: 'Purchase', label: 'Purchase / expense' },
                { value: 'Donation', label: 'Donation' },
                { value: 'FundraiserIncome', label: 'Fundraiser income' },
                { value: 'Reimbursement', label: 'Reimbursement' },
              ],
            },
            { name: 'description', label: 'Description', field_type: 'text', required: true },
            { name: 'category', label: 'Category', field_type: 'text' },
            { name: 'date', label: 'Date', field_type: 'date' },
          ],
        },
      ],
    },
  ];
}

const DATA_KEY_SCOPE = {
  'home.summary': null,
  'home.approvals': 'read:approvals',
  'inventory.list': 'read:inventory',
  'inventory.item': 'read:inventory',
  'purchases.list': 'read:purchases',
  'borrows.list': 'read:borrows',
  'approvals.pending': 'read:approvals',
  'finance.summary': 'read:finance',
  'finance.transactions': 'read:finance',
};

function componentAllowed(component, scopes) {
  if (component.action_id && !actionAllowed(component.action_id, scopes)) return false;
  if (component.data_url) {
    const key = scopeForDataUrl(component.data_url);
    const needed = key ? DATA_KEY_SCOPE[key] : null;
    if (needed && !hasScope(scopes, needed)) return false;
    if (key === 'home.summary' && !scopes.some((s) => s.startsWith('read:'))) return false;
  }
  if (component.type === 'search_field') {
    return hasScope(scopes, 'read:inventory');
  }
  if (component.type === 'button' && component.nav) {
    const dest = component.nav.screen_id;
    const navScope = {
      inventory: 'read:inventory',
      purchases: 'read:purchases',
      borrows: 'read:borrows',
      finance: 'read:finance',
      approvals: 'read:approvals',
      item: 'read:inventory',
    }[dest];
    if (navScope && !hasScope(scopes, navScope)) return false;
  }
  return true;
}

function filterScreens(screens, scopes) {
  return screens
    .map((screen) => ({
      ...screen,
      components: (screen.components || []).filter((c) => componentAllowed(c, scopes)),
    }))
    .filter((screen) => screen.id === 'home' || (screen.components && screen.components.length > 0));
}

function buildManifest(scopes) {
  const screens = filterScreens(buildScreens(), scopes);
  return {
    protocol: 'hub/v1',
    app_id: APP_ID,
    version: APP_VERSION,
    name: APP_NAME,
    home: { screen_id: 'home' },
    capabilities: ['lists', 'forms', 'actions', 'search'],
    scopes_granted: scopes.slice(),
    screens,
  };
}

module.exports = { buildManifest, buildScreens };
