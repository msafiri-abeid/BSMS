// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
        const newToken = data.data.accessToken;

        // Update store
        const authState = JSON.parse(localStorage.getItem('bentabet-auth'));
        authState.state.accessToken = newToken;
        if (data.data.refreshToken) authState.state.refreshToken = data.data.refreshToken;
        localStorage.setItem('bentabet-auth', JSON.stringify(authState));

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
};

export const usersAPI = {
  list: (p) => api.get('/users', { params: p }),
  create: (d) => api.post('/users', d),
  update: (id, d) => api.put(`/users/${id}`, d),
};

export const partnersAPI = {
  list: (p) => api.get('/partners', { params: p }),
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

export const machinesAPI = {
  list: (p) => api.get('/machines', { params: p }),
  get: (id) => api.get(`/machines/${id}`),
  create: (d) => api.post('/machines', d),
  update: (id, d) => api.put(`/machines/${id}`, d),
  deploy: (id, d) => api.post(`/machines/${id}/deploy`, d),
  exchange: (id, d) => api.post(`/machines/${id}/exchange`, d),
  refill: (id, d) => api.post(`/machines/${id}/refill`, d),
};

export const collectionsAPI = {
  list: (p) => api.get('/collections', { params: p }),
  submit: (d) => api.post('/collections', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  ocr: (d) => api.post('/collections/ocr', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  myAssignments: (p) => api.get('/collections/my-assignments', { params: p }),
  createAssignment: (d) => api.post('/collections/assignments', d),
  weeklyTargets: (p) => api.get('/collections/weekly-targets', { params: p }),
};

export const financeAPI = {
  listExpenses: (p) => api.get('/finance/expenses', { params: p }),
  submitExpense: (d) => api.post('/finance/expenses', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  pendingExpenses: () => api.get('/finance/expenses/pending'),
  approveExpense: (id, d) => api.put(`/finance/expenses/${id}/approve`, d),
  listInvoices: (p) => api.get('/finance/invoices', { params: p }),
  createInvoice: (d) => api.post('/finance/invoices', d),
  recordPayment: (id, d) => api.post(`/finance/invoices/${id}/payment`, d),
  listPayroll: () => api.get('/finance/payroll'),
  createPayroll: (d) => api.post('/finance/payroll', d),
  exportCollections: () => api.get('/finance/export/collections', { responseType: 'blob' }),
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
  updatePermissions: (roleId, d) => api.put(`/settings/roles/${roleId}/permissions`, d),
  testSMS: (d) => api.post('/settings/sms-test', d),
};

export const dashboardAPI = {
  admin: () => api.get('/dashboard/admin'),
  collector: () => api.get('/dashboard/collector'),
  finance: () => api.get('/dashboard/finance'),
  director: () => api.get('/dashboard/director'),
};

export const inventoryAPI = {
  // Products & Categories
  tokens: () => api.get('/inventory/tokens'),
  addTokenMovement: (d) => api.post('/inventory/tokens', d),
  products: (p) => api.get('/inventory/products', { params: p }),
  createProduct: (d) => api.post('/inventory/products', d),
  categories: (shopId) => api.get('/inventory/categories', { params: { shop_id: shopId } }),
  
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

export const staffAPI = {
  employees: () => api.get('/staff/employees'),
  getEmployee: (id) => api.get(`/staff/employees/${id}`),
  createEmployee: (d, config) => api.post('/staff/employees', d, config),
  updateEmployee: (id, d, config) => api.put(`/staff/employees/${id}`, d, config),
  deleteEmployee: (id) => api.delete(`/staff/employees/${id}`),
  departments: () => api.get('/staff/departments'),
  createDepartment: (d) => api.post('/staff/departments', d),
  updateDepartment: (id, d) => api.put(`/staff/departments/${id}`, d),
  deleteDepartment: (id) => api.delete(`/staff/departments/${id}`),
  organization: () => api.get('/staff/organization'),
  positions: () => api.get('/staff/positions'),
  createPosition: (d) => api.post('/staff/positions', d),
  updatePosition: (id, d) => api.put(`/staff/positions/${id}`, d),
  deletePosition: (id) => api.delete(`/staff/positions/${id}`),
  roles: () => api.get('/staff/roles'),
};
