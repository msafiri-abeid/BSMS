import { useState, useEffect } from "react";
import { Layout, Menu, Avatar, Dropdown, Space, Badge, Typography, Button } from "antd";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Wallet, ClipboardList, ListChecks, Crosshair,
  Cpu, Monitor, FileText, Users, Handshake, Store,
  DollarSign, Receipt, FileSignature, Banknote, Headphones,
  Package, Coins, ShoppingCart, ClipboardCheck, TrendingUp, Undo2, AlertTriangle, BarChart3,
  Shield, UserCheck, Building2, Briefcase,
  Settings, User, LogOut, PanelLeftClose, PanelLeftOpen, Bell, Plus,
  Landmark,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { authAPI } from "../services/api";
import { App } from "antd";
import logo from "./../assets/logo.png";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const ALL_NAV = [
  { key: "/", label: "Dashboard", icon: <LayoutDashboard size={16} />, module: null },
  {
    key: "collections-group",
    label: "Collections",
    icon: <Wallet size={16} />,
    module: "collections",
    children: [
      { key: "/collections", label: "All Collections", icon: <ListChecks size={16} />, module: "collections" },
      { key: "/my-assignments", label: "Assignments", icon: <ClipboardList size={16} />, module: "collections", roles: ['Admin', 'General Manager', 'Operations Manager', 'Collector'] },
      { key: "/weekly-targets", label: "Weekly Targets", icon: <Crosshair size={16} />, module: "collections", roles: ['Admin', 'General Manager', 'Operations Manager'] },
    ],
  },
  {
    key: "machines-group",
    label: "Machines",
    icon: <Cpu size={16} />,
    module: "machines",
    children: [
      { key: "/machines/novomatic", label: "Novomatic", icon: <Monitor size={16} />, module: "machines" },
      { key: "/machines/meteora", label: "Meteora", icon: <Monitor size={16} />, module: "machines", roles: ['Admin', 'General Manager', 'Operations Manager'] },
      { key: "/debts", label: "Debts", icon: <FileText size={16} />, module: "machines", roles: ['Admin', 'General Manager', 'Operations Manager'] },
    ],
  },
  {
    key: "partners-group",
    label: "Shops & Partners",
    icon: <Users size={16} />,
    module: "partners",
    children: [
      { key: "/shops/slot", label: "Slot Shops", icon: <Store size={16} />, module: "shops" },
      { key: "/shops/meteora", label: "Meteora Shops", icon: <Store size={16} />, module: "shops" },
      { key: "/partners", label: "Partners", icon: <Handshake size={16} />, module: "partners" },
    ],
  },
  {
    key: "finance-group",
    label: "Finance",
    icon: <DollarSign size={16} />,
    module: "finance",
    children: [
      { key: "/finance/expenses", label: "Expenses", icon: <Receipt size={16} />, module: "finance" },
      { key: "/finance/invoices", label: "Invoices", icon: <FileSignature size={16} />, module: "finance", roles: ['Admin', 'General Manager', 'Finance'] },
      { key: "/finance/payroll", label: "Payroll", icon: <Banknote size={16} />, module: "finance", roles: ['Admin', 'General Manager', 'Finance'] },
    ],
  },
  {
    key: "/tickets",
    label: "Tickets",
    icon: <Headphones size={16} />,
    module: "tickets",
  },
  {
    key: "inventory-group",
    label: "Inventory",
    icon: <Package size={16} />,
    module: "inventory",
    roles: ['Admin', 'General Manager', 'Operations Manager', 'Sales'],
    children: [
      { key: "/inventory/tokens", label: "Token Stock", icon: <Coins size={16} />, module: "inventory" },
      { key: "/inventory/products", label: "Products", icon: <ShoppingCart size={16} />, module: "inventory" },
      { key: "/inventory/stock", label: "Stock Management", icon: <ClipboardCheck size={16} />, module: "inventory" },
      { key: "/inventory/sales", label: "Sales", icon: <TrendingUp size={16} />, module: "inventory" },
      { key: "/inventory/returns", label: "Returns", icon: <Undo2 size={16} />, module: "inventory" },
      { key: "/inventory/alerts", label: "Alerts", icon: <AlertTriangle size={16} />, module: "inventory" },
      { key: "/inventory/accounting", label: "Accounting", icon: <BarChart3 size={16} />, module: "inventory" },
    ],
  },
  {
    key: "staff-group",
    label: "Staff & HR",
    icon: <Shield size={16} />,
    module: "staff",
    children: [
      { key: "/staff/employees", label: "Employees", icon: <UserCheck size={16} />, module: "staff" },
      { key: "/staff/departments", label: "Departments", icon: <Building2 size={16} />, module: "staff" },
      { key: "/staff/positions", label: "Positions", icon: <Briefcase size={16} />, module: "staff" },
    ],
  },
  {
    key: "/reports",
    label: "Reports",
    icon: <BarChart3 size={16} />,
    module: "reports",
  },
  {
    key: "accounting-group",
    label: "Accounting",
    icon: <Landmark size={16} />,
    module: "accounts",
    children: [
      { key: "/finance/accounts", label: "Accounts", icon: <Landmark size={16} />, module: "accounts" },
      { key: "/finance/reports/balance-sheet", label: "Balance Sheet", icon: <BarChart3 size={16} />, module: "accounts", roles: ['Admin', 'General Manager', 'Finance', 'Director'] },
      { key: "/finance/reports/trial-balance", label: "Trial Balance", icon: <BarChart3 size={16} />, module: "accounts", roles: ['Admin', 'General Manager', 'Finance', 'Director'] },
      { key: "/finance/reports/cash-flow", label: "Cash Flow", icon: <BarChart3 size={16} />, module: "accounts", roles: ['Admin', 'General Manager', 'Finance', 'Director'] },
      { key: "/finance/reports/account-report", label: "Account Report", icon: <BarChart3 size={16} />, module: "accounts", roles: ['Admin', 'General Manager', 'Finance', 'Director'] },
    ],
  },
  {
    key: "settings-group",
    label: "Settings",
    icon: <Settings size={16} />,
    module: null,
    children: [
      { key: "/settings/profile", label: "My Profile", icon: <User size={16} />, module: null },
      { key: "/settings/company", label: "Company Profile", icon: <Building2 size={16} />, module: "settings" },
      { key: "/settings/machines", label: "Machine Settings", icon: <Cpu size={16} />, module: "settings" },
      { key: "/settings/finance", label: "Finance & SLA", icon: <DollarSign size={16} />, module: "settings" },
      { key: "/settings/notifications", label: "Notifications & SMS", icon: <Bell size={16} />, module: "settings" },
      { key: "/settings/roles", label: "Role Builder", icon: <Shield size={16} />, module: "settings" },
      { key: "/settings/businesses", label: "Business Management", icon: <Store size={16} />, module: "settings" },
      { key: "/settings/system", label: "System", icon: <Settings size={16} />, module: "settings" },
    ],
  },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const { user, refreshToken, clearAuth, hasPermission, getRoleName } = useAuthStore();

  const handleLogout = async () => {
    try { await authAPI.logout(refreshToken); } catch {}
    clearAuth();
    navigate("/login");
  };

  const filterNav = (items) =>
    items
      .filter((item) => {
        if (item.roles && !item.roles.includes(getRoleName())) return false;
        return item.module === null || hasPermission(item.module, "read");
      })
      .map((item) => ({ ...item, children: item.children ? filterNav(item.children) : undefined }))
      .filter((item) => !item.children || item.children.length > 0);

  const navItems = filterNav(ALL_NAV);

  const collectNavKeys = (items) =>
    items.flatMap((item) =>
      item.children
        ? collectNavKeys(item.children)
        : item.key && !String(item.key).includes("-group")
          ? [item.key]
          : [],
    );

  const selectedKey =
    collectNavKeys(navItems)
      .filter((k) => location.pathname === k || location.pathname.startsWith(`${k}/`))
      .sort((a, b) => b.length - a.length)[0] ?? location.pathname;

  const selectedKeys = [selectedKey];
  const openKeys = ALL_NAV.filter((item) =>
    item.children?.some((c) => location.pathname.startsWith(c.key)),
  ).map((item) => item.key);

  const userMenuItems = [
    { key: "profile", label: `${user?.name}`, disabled: true },
    { type: "divider" },
    { key: "my-profile", label: "My Profile", icon: <User size={14} />, onClick: () => navigate('/settings/profile') },
    { key: "logout", label: "Sign Out", icon: <LogOut size={14} />, danger: true, onClick: handleLogout },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        theme="dark"
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={260}
        className="!bg-brand-dark fixed left-0 top-0 h-screen overflow-y-auto z-50"
      >
        <div className="px-4 py-5 border-b border-white/10">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <img src={logo} alt="Bentabet Logo" className="w-8 h-8 object-contain" />
              <div>
                <h1 className="text-white font-bold text-base leading-none">BENTABET</h1>
                <p className="text-[11px] text-slate-400 mt-1">Slot Management System</p>
              </div>
            </div>
          ) : (
            <img src={logo} alt="Bentabet Logo" className="w-10 h-10 object-contain mx-auto" />
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={navItems}
          onClick={({ key }) => { if (!key.includes("-group")) navigate(key); }}
          className="!bg-brand-dark border-none pt-2"
        />
      </Sider>

      <Layout className={`transition-all duration-200 ${collapsed ? "ml-[80px]" : "ml-[260px]"}`}>
        <Header className="sticky top-0 z-40 flex items-center justify-between bg-white px-6 border-b border-slate-200 h-14">
          <Button
            type="text"
            icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space>
            {['Admin', 'General Manager', 'Operations Manager', 'Cashier'].includes(getRoleName()) && (
              <Button
                type="primary"
                size="small"
                icon={<Plus size={14} />}
                onClick={() => navigate('/inventory/sales?quick=1')}
                className="!bg-brand-dark !border-0 !font-semibold !shadow-sm hover:!bg-brand-light !flex !items-center !gap-1.5 !px-3"
              >
                Record Sale
              </Button>
            )}
            <Badge count={0} size="small">
              <Button type="text" icon={<Bell size={18} />} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: "pointer" }}>
                <Avatar size={32} className="!bg-brand-dark" icon={<User size={16} />} />
                {!collapsed && <Text style={{ fontSize: 13 }}>{user?.name}</Text>}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content className="m-6 min-h-[calc(100vh-104px)] bg-slate-50">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
