// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import Dashboard from './pages/dashboard/Dashboard';
import PartnersPage from './pages/partners/PartnersPage';
import PartnerDetailPage from './pages/partners/PartnerDetailPage';
import ShopsPage from './pages/partners/ShopsPage';
import ShopDetailPage from './pages/partners/ShopDetailPage';
import MachinesPage from './pages/machines/MachinesPage';
import MachineDetailPage from './pages/machines/MachineDetailPage';
import CollectionsPage from './pages/collections/CollectionsPage';
import MyAssignmentsPage from './pages/collections/MyAssignmentsPage';
import WeeklyTargetsPage from './pages/collections/WeeklyTargetsPage';
import CreateAssignmentPage from './pages/collections/CreateAssignmentPage';
import ExpensesPage from './pages/finance/ExpensesPage';
import InvoicesPage from './pages/finance/InvoicesPage';
import PayrollPage from './pages/finance/PayrollPage';
import TokenInventoryPage from './pages/inventory/TokenInventoryPage';
import ShopInventoryPage from './pages/inventory/ShopInventoryPage';
import StockManagementPage from './pages/inventory/StockManagementPage';
import SalesPage from './pages/inventory/SalesPage';
import SalesReturnsPage from './pages/inventory/SalesReturnsPage';
import AccountingPage from './pages/inventory/AccountingPage';
import AlertsPage from './pages/inventory/AlertsPage';
import TicketsPage from './pages/tickets/TicketsPage';
import TicketDetailPage from './pages/tickets/TicketDetailPage';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import StaffLayout from './pages/staff/StaffLayout';
import EmployeesPage from './pages/staff/EmployeesPage';
import EmployeeDetailPage from './pages/staff/EmployeeDetailPage';
import DepartmentsPage from './pages/staff/DepartmentsPage';
import PositionsPage from './pages/staff/PositionsPage';
import OrganizationPage from './pages/staff/OrganizationPage';
import StaffUsersPage from './pages/staff/StaffUsersPage';
import NotFoundPage from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

const PrivateRoute = ({ children }) => {
  const { accessToken } = useAuthStore();
  return accessToken ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { accessToken } = useAuthStore();
  return !accessToken ? children : <Navigate to="/" replace />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="partners" element={<PartnersPage />} />
              <Route path="partners/:id" element={<PartnerDetailPage />} />
              <Route path="shops" element={<ShopsPage />} />
              <Route path="shops/:id" element={<ShopDetailPage />} />
              <Route path="machines" element={<MachinesPage />} />
              <Route path="machines/:id" element={<MachineDetailPage />} />
              <Route path="collections" element={<CollectionsPage />} />
              <Route path="my-assignments" element={<MyAssignmentsPage />} />
              <Route path="weekly-targets" element={<WeeklyTargetsPage />} />
              <Route path="create-assignment" element={<CreateAssignmentPage />} />
              <Route path="finance/expenses" element={<ExpensesPage />} />
              <Route path="finance/invoices" element={<InvoicesPage />} />
              <Route path="finance/payroll" element={<PayrollPage />} />
              <Route path="inventory">
                <Route path="products" element={<ShopInventoryPage />} />
                <Route path="tokens" element={<TokenInventoryPage />} />
                <Route path="stock" element={<StockManagementPage />} />
                <Route path="sales" element={<SalesPage />} />
                <Route path="returns" element={<SalesReturnsPage />} />
                <Route path="alerts" element={<AlertsPage />} />
                <Route path="accounting" element={<AccountingPage />} />
              </Route>
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="tickets/:id" element={<TicketDetailPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="staff" element={<StaffLayout />}>
                <Route index element={<Navigate to="employees" replace />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="employees/:id" element={<EmployeeDetailPage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="positions" element={<PositionsPage />} />
                <Route path="organization" element={<OrganizationPage />} />
                <Route path="users" element={<StaffUsersPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </QueryClientProvider>
  );
}
