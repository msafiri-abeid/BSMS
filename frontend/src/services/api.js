// src/services/api.js
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: 'https://api.betbenta.com',
  timeout: 30000,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('bentabet-auth');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    } catch {}
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const stored = localStorage.getItem('bentabet-auth');
        const { state } = JSON.parse(stored);
        const { data } = await axios.post('/api/auth/refresh', { refreshToken: state.refreshToken });
        const { tokens, user } = data.data;
        const newToken = tokens.accessToken;
        const newRefreshToken = tokens.refreshToken;

        // Update Zustand store (also persists to localStorage via partialize)
        useAuthStore.getState().setAuth(user || state.user, newToken, newRefreshToken);

        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('bentabet-auth');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Resource-specific helpers ──────────────────────────────────

export const authAPI = {
  login: (d) => api.post('/auth/login', d),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (d) => api.put('/auth/password', d),
  updateProfile: (d) => api.put('/auth/profile', d),
  uploadDocuments: (formData) => api.post('/auth/profile/documents', formData),
  deleteDocument: (url) => api.delete('/auth/profile/documents', { data: { url } }),
};

export const usersAPI = {
  list: (p) => api.get('/users', { params: p }),
  create: (d) => api.post('/users', d),
  update: (id, d) => api.put(`/users/${id}`, d),
};

export const partnersAPI = {
  list: (p) => api.get('/partners', { params: p }),
  listOwn: () => api.get('/partners/own'),
  get: (id) => api.get(`/partners/${id}`),
  create: (d) => api.post('/partners', d),
  update: (id, d) => api.put(`/partners/${id}`, d),
  delete: (id) => api.delete(`/partners/${id}`),
};

export const shopsAPI = {
  list: (p) => api.get('/shops', { params: p }),
  get: (id) => api.get(`/shops/${id}`),
  create: (d) => api.post('/shops', d),
  update: (id, d) => api.put(`/shops/${id}`, d),
  delete: (id) => api.delete(`/shops/${id}`),
};

export const regionsAPI = {
  list: () => api.get('/regions'),
};

export const districtsAPI = {
  list: (regionId) => api.get('/districts', { params: { region_id: regionId } }),
};

export const wardsAPI = {
  list: (districtId) => api.get('/wards', { params: { district_id: districtId } }),
};

export const streetsAPI = {
  list: (wardId) => api.get('/streets', { params: { ward_id: wardId } }),
};

export const machinesAPI = {
  list: (p) => api.get('/machines', { params: p }),
  get: (id) => api.get(`/machines/${id}`),
  stats: (id, p) => api.get(`/machines/${id}/stats`, { params: p }),
  create: (d) => api.post('/machines', d),
  update: (id, d) => api.put(`/machines/${id}`, d),
  remove: (id) => api.delete(`/machines/${id}`),
  deploy: (id, d) => api.post(`/machines/${id}/deploy`, d),
  exchange: (id, d) => api.post(`/machines/${id}/exchange`, d),
  refill: (id, d) => api.post(`/machines/${id}/refill`, d),
  export: () => api.get('/machines/export', { responseType: 'blob' }),
  exportPDF: (id) => api.get(`/machines/${id}/pdf`, { responseType: 'blob' }),
  recordCollection: (id, d) => api.post(`/machines/${id}/collections`, d),
};

export const collectionsAPI = {
  list: (p) => api.get('/collections', { params: p }),
  submit: (d) => api.post('/collections', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  myAssignments: (p) => api.get('/collections/my-assignments', { params: p }),
  listAssignments: (p) => api.get('/collections/assignments', { params: p }),
  createAssignment: (d) => api.post('/collections/assignments', d),
  updateAssignment: (id, d) => api.put(`/collections/assignments/${id}`, d),
  removeAssignment: (id) => api.delete(`/collections/assignments/${id}`),
  openMachine: (id) => api.post(`/collections/assignments/${id}/open`),
  update: (id, d) => api.put(`/collections/${id}`, d),
  remove: (id) => api.delete(`/collections/${id}`),
  weeklyTargets: (p) => api.get('/collections/weekly-targets', { params: p }),
  exportAssignments: (p) => api.get('/collections/assignments/export', { params: p, responseType: 'blob' }),
};

export const financeAPI = {
  listExpenses: (p) => api.get('/finance/expenses', { params: p }),
  submitExpense: (d) => api.post('/finance/expenses', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateExpense: (id, d) => api.put(`/finance/expenses/${id}`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeExpense: (id) => api.delete(`/finance/expenses/${id}`),
  pendingExpenses: () => api.get('/finance/expenses/pending'),
  approveExpense: (id, d) => api.put(`/finance/expenses/${id}/approve`, d),
  listCategories: () => api.get('/finance/expenses/categories'),
  listShopCash: (p) => api.get('/finance/shop-cash', { params: p }),
  submitShopCash: (d) => api.post('/finance/shop-cash', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  approveShopCash: (id, d) => api.put(`/finance/shop-cash/${id}/approve`, d),
  listInvoices: (p) => api.get('/finance/invoices', { params: p }),
  createInvoice: (d) => api.post('/finance/invoices', d),
  recordPayment: (id, d) => api.post(`/finance/invoices/${id}/payment`, d),
  listPayroll: () => api.get('/finance/payroll'),
  createPayroll: (d) => api.post('/finance/payroll', d),
  exportCollections: (p) => api.get('/finance/export/collections', { params: p, responseType: 'blob' }),
};

export const ticketsAPI = {
  list: (p) => api.get('/tickets', { params: p }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (d) => api.post('/tickets', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id, d) => api.put(`/tickets/${id}/status`, d),
  addActivity: (id, d) => api.post(`/tickets/${id}/activity`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  counts: () => api.get('/tickets/counts'),
  groups: () => api.get('/tickets/groups'),
};

export const settingsAPI = {
  getAll: () => api.get('/settings'),
  update: (d) => api.put('/settings', d),
  getRoles: () => api.get('/settings/roles'),
  createRole: (d) => api.post('/settings/roles', d),
  updateRole: (id, d) => api.put(`/settings/roles/${id}`, d),
  deleteRole: (id) => api.delete(`/settings/roles/${id}`),
  updatePermissions: (roleId, d) => api.put(`/settings/roles/${roleId}/permissions`, d),
  testSMS: (d) => api.post('/settings/sms-test', d),
  getBusinesses: () => api.get('/settings/businesses'),
  updateBusiness: (id, d) => api.put(`/settings/businesses/${id}`, d),
  getModules: () => api.get('/settings/modules'),
};

export const dashboardAPI = {
  admin: (p) => api.get('/dashboard/admin', { params: p }),
  collector: (p) => api.get('/dashboard/collector', { params: p }),
  finance: (p) => api.get('/dashboard/finance', { params: p }),
  director: (p) => api.get('/dashboard/director', { params: p }),
  cashier: (p) => api.get('/dashboard/cashier', { params: p }),
  sales: (p) => api.get('/dashboard/sales', { params: p }),
  technician: (p) => api.get('/dashboard/technician', { params: p }),
};

export const accountsAPI = {
  list: (p) => api.get('/finance/accounts', { params: p }),
  get: (id) => api.get(`/finance/accounts/${id}`),
  create: (d) => api.post('/finance/accounts', d),
  update: (id, d) => api.put(`/finance/accounts/${id}`, d),
  delete: (id) => api.delete(`/finance/accounts/${id}`),
  transactions: (id, p) => api.get(`/finance/accounts/${id}/transactions`, { params: p }),
  transfer: (d) => api.post('/finance/accounts/transfer', d),
};

export const reportsAPI = {
  balanceSheet: (p) => api.get('/finance/reports/balance-sheet', { params: p }),
  trialBalance: (p) => api.get('/finance/reports/trial-balance', { params: p }),
  cashFlow: (p) => api.get('/finance/reports/cash-flow', { params: p }),
  accountReport: (id, p) => api.get(`/finance/reports/account-report/${id}`, { params: p }),
};

export const inventoryAPI = {
  // Products & Categories
  tokens: () => api.get('/inventory/tokens'),
  addTokenMovement: (d) => api.post('/inventory/tokens', d),
  products: (p) => api.get('/inventory/products', { params: p }),
  createProduct: (d) => api.post('/inventory/products', d),
  categories: (shopId) => api.get('/inventory/categories', { params: { shop_id: shopId } }),
  addStock: (formData) => api.post('/inventory/stock/add', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  // Sales
  listSales: (p) => api.get('/inventory/sales', { params: p }),
  getSale: (id) => api.get(`/inventory/sales/${id}`),
  recordSale: (d) => api.post('/inventory/sales', d),
  recordPayment: (saleId, d) => api.post(`/inventory/sales/${saleId}/payment`, d),
  getSaleReport: (p) => api.get('/inventory/sales/report/summary', { params: p }),
  
  // Stock Audits
  listAudits: (p) => api.get('/inventory/audits', { params: p }),
  getAudit: (id) => api.get(`/inventory/audits/${id}`),
  startAudit: (d) => api.post('/inventory/audits', d),
  updateAuditItem: (d) => api.put('/inventory/audits/item', d),
  completeAudit: (id) => api.put(`/inventory/audits/${id}/complete`),
  verifyAudit: (id) => api.put(`/inventory/audits/${id}/verify`),
  
  // Stock Transfers
  listTransfers: (p) => api.get('/inventory/transfers', { params: p }),
  getTransfer: (id) => api.get(`/inventory/transfers/${id}`),
  initializeTransfer: (d) => api.post('/inventory/transfers', d),
  approveTransfer: (id) => api.put(`/inventory/transfers/${id}/approve`),
  receiveTransfer: (id) => api.put(`/inventory/transfers/${id}/receive`),
  cancelTransfer: (id) => api.put(`/inventory/transfers/${id}/cancel`),
  
  // Sales Returns
  listReturns: (p) => api.get('/inventory/returns', { params: p }),
  getReturn: (id) => api.get(`/inventory/returns/${id}`),
  processReturn: (d) => api.post('/inventory/returns', d),
  approveReturn: (id) => api.put(`/inventory/returns/${id}/approve`),
  
  // Low Stock Alerts
  listAlerts: (p) => api.get('/inventory/alerts', { params: p }),
  getAlertSummary: (p) => api.get('/inventory/alerts/summary', { params: p }),
  getAlert: (id) => api.get(`/inventory/alerts/${id}`),
  checkLowStock: (p) => api.post('/inventory/alerts/check', p),
  acknowledgeAlert: (id) => api.put(`/inventory/alerts/${id}/acknowledge`),
  
  // Accounting
  getShopProfitLoss: (p) => api.get('/inventory/accounting/profit-loss', { params: p }),
  getProductMargins: (p) => api.get('/inventory/accounting/margins', { params: p }),
  getInventoryValuation: (p) => api.get('/inventory/accounting/valuation', { params: p }),
  getDailyReport: (p) => api.get('/inventory/accounting/daily-report', { params: p }),
};

export const tokensAPI = {
  balances: () => api.get('/tokens/balances'),
  movements: (p) => api.get('/inventory/tokens', { params: p }),
  distribute: (d) => api.post('/tokens/distribute', d),
  returnTokens: (d) => api.post('/tokens/return', d),
  lend: (d) => api.post('/tokens/lend', d),
  addMovement: (d) => api.post('/inventory/tokens', d),
};

export const debtsAPI = {
  list: (p) => api.get('/debts', { params: p }),
  create: (d) => api.post('/debts', d),
  recordPayment: (id, formData) => api.put(`/debts/${id}/pay`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  writeOff: (id, d) => api.put(`/debts/${id}/write-off`, d),
  exportDebts: (p) => api.get('/debts/export', { params: p, responseType: 'blob' }),
};

export const staffAPI = {
  employees: (p) => api.get('/staff/employees', { params: p }),
  getEmployee: (id) => api.get(`/staff/employees/${id}`),
  createEmployee: (d, config) => api.post('/staff/employees', d, config),
  updateEmployee: (id, d, config) => api.put(`/staff/employees/${id}`, d, config),
  deleteEmployee: (id) => api.delete(`/staff/employees/${id}`),
  getSignedDocumentUrl: (url) => api.get('/staff/documents/proxy', { params: { url } }),
  deleteEmployeeDocument: (empId, docUrl) => api.delete(`/staff/employees/${empId}/documents`, { data: { url: docUrl } }),
  exportEmployees: () => api.get('/staff/employees/export', { responseType: 'blob' }),
  departments: () => api.get('/staff/departments'),
  createDepartment: (d) => api.post('/staff/departments', d),
  updateDepartment: (id, d) => api.put(`/staff/departments/${id}`, d),
  deleteDepartment: (id) => api.delete(`/staff/departments/${id}`),
  positions: () => api.get('/staff/positions'),
  createPosition: (d) => api.post('/staff/positions', d),
  updatePosition: (id, d) => api.put(`/staff/positions/${id}`, d),
  deletePosition: (id) => api.delete(`/staff/positions/${id}`),
  roles: () => api.get('/staff/roles'),
};
