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
import MeteoraShopsPage from './pages/partners/MeteoraShopsPage';
import SlotShopsPage from './pages/partners/SlotShopsPage';
import ShopDetailPage from './pages/partners/ShopDetailPage';
import MeteoraMachinesPage from './pages/machines/MeteoraMachinesPage';
import NovomaticMachinesPage from './pages/machines/NovomaticMachinesPage';
import MachineDetailPage from './pages/machines/MachineDetailPage';
import CollectionsPage from './pages/collections/CollectionsPage';
import MyAssignmentsPage from './pages/collections/MyAssignmentsPage';
import WeeklyTargetsPage from './pages/collections/WeeklyTargetsPage';
import DebtsPage from './pages/debts/DebtsPage';

import ExpensesPage from './pages/finance/ExpensesPage';
import InvoicesPage from './pages/finance/InvoicesPage';
import PayrollPage from './pages/finance/PayrollPage';
import AccountsPage from './pages/finance/AccountsPage';
import AccountDetailPage from './pages/finance/AccountDetailPage';
import BalanceSheetPage from './pages/finance/BalanceSheetPage';
import TrialBalancePage from './pages/finance/TrialBalancePage';
import CashFlowPage from './pages/finance/CashFlowPage';
import AccountReportPage from './pages/finance/AccountReportPage';
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
import StaffLayout from './pages/staff/StaffLayout';
import EmployeesPage from './pages/staff/EmployeesPage';
import EmployeeDetailPage from './pages/staff/EmployeeDetailPage';
import DepartmentsPage from './pages/staff/DepartmentsPage';
import PositionsPage from './pages/staff/PositionsPage';

import SettingsLayout from './pages/settings/SettingsLayout';
import ProfileTab from './pages/settings/ProfileTab';
import CompanyTab from './pages/settings/CompanyTab';
import MachineSettingsTab from './pages/settings/MachineSettingsTab';
import FinanceSettingsTab from './pages/settings/FinanceSettingsTab';
import NotificationsTab from './pages/settings/NotificationsTab';
import RoleBuilderTab from './pages/settings/RoleBuilderTab';
import BusinessManagementTab from './pages/settings/BusinessManagementTab';
import SystemTab from './pages/settings/SystemTab';

import NotFoundPage from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5000, refetchOnWindowFocus: true },
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
              <Route path="shops/meteora" element={<MeteoraShopsPage />} />
              <Route path="shops/slot" element={<SlotShopsPage />} />
              <Route path="shops/meteora/:id" element={<ShopDetailPage />} />
              <Route path="shops/slot/:id" element={<ShopDetailPage />} />
              <Route path="shops/:id" element={<ShopDetailPage />} />
              <Route path="machines/meteora" element={<MeteoraMachinesPage />} />
              <Route path="machines/novomatic" element={<NovomaticMachinesPage />} />
              <Route path="machines/meteora/:id" element={<MachineDetailPage />} />
              <Route path="machines/novomatic/:id" element={<MachineDetailPage />} />
              <Route path="machines/:id" element={<MachineDetailPage />} />
              <Route path="collections" element={<CollectionsPage />} />
              <Route path="my-assignments" element={<MyAssignmentsPage />} />
              <Route path="weekly-targets" element={<WeeklyTargetsPage />} />
              <Route path="debts" element={<DebtsPage />} />
              <Route path="finance/expenses" element={<ExpensesPage />} />
              <Route path="finance/invoices" element={<InvoicesPage />} />
              <Route path="finance/payroll" element={<PayrollPage />} />
              <Route path="finance/accounts" element={<AccountsPage />} />
              <Route path="finance/accounts/:id" element={<AccountDetailPage />} />
              <Route path="finance/reports/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="finance/reports/trial-balance" element={<TrialBalancePage />} />
              <Route path="finance/reports/cash-flow" element={<CashFlowPage />} />
              <Route path="finance/reports/account-report" element={<AccountReportPage />} />
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
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<ProfileTab />} />
                <Route path="company" element={<CompanyTab />} />
                <Route path="machines" element={<MachineSettingsTab />} />
                <Route path="finance" element={<FinanceSettingsTab />} />
                <Route path="notifications" element={<NotificationsTab />} />
                <Route path="roles" element={<RoleBuilderTab />} />
                <Route path="businesses" element={<BusinessManagementTab />} />
                <Route path="system" element={<SystemTab />} />
              </Route>
              <Route path="staff" element={<StaffLayout />}>
                <Route index element={<Navigate to="employees" replace />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="employees/:id" element={<EmployeeDetailPage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="positions" element={<PositionsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </QueryClientProvider>
  );
}
