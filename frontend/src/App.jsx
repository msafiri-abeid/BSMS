// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import Dashboard from './pages/dashboard/Dashboard';
import PartnersPage from './pages/partners/PartnersPage';
import ShopsPage from './pages/partners/ShopsPage';
import MachinesPage from './pages/machines/MachinesPage';
import MachineDetailPage from './pages/machines/MachineDetailPage';
import CollectionsPage from './pages/collections/CollectionsPage';
import MyAssignmentsPage from './pages/collections/MyAssignmentsPage';
import WeeklyTargetsPage from './pages/collections/WeeklyTargetsPage';
import ExpensesPage from './pages/finance/ExpensesPage';
import InvoicesPage from './pages/finance/InvoicesPage';
import PayrollPage from './pages/finance/PayrollPage';
import TokenInventoryPage from './pages/inventory/TokenInventoryPage';
import ShopInventoryPage from './pages/inventory/ShopInventoryPage';
import TicketsPage from './pages/tickets/TicketsPage';
import TicketDetailPage from './pages/tickets/TicketDetailPage';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import StaffPage from './pages/staff/StaffPage';
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
              <Route path="shops" element={<ShopsPage />} />
              <Route path="machines" element={<MachinesPage />} />
              <Route path="machines/:id" element={<MachineDetailPage />} />
              <Route path="collections" element={<CollectionsPage />} />
              <Route path="my-assignments" element={<MyAssignmentsPage />} />
              <Route path="weekly-targets" element={<WeeklyTargetsPage />} />
              <Route path="finance/expenses" element={<ExpensesPage />} />
              <Route path="finance/invoices" element={<InvoicesPage />} />
              <Route path="finance/payroll" element={<PayrollPage />} />
              <Route path="inventory/tokens" element={<TokenInventoryPage />} />
              <Route path="inventory/shop" element={<ShopInventoryPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="tickets/:id" element={<TicketDetailPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="staff" element={<StaffPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </QueryClientProvider>
  );
}
