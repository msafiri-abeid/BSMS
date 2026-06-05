import { useState, useEffect } from "react";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Badge,
  Typography,
  Button,
} from "antd";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  DashboardOutlined,
  TeamOutlined,
  ShopOutlined,
  ThunderboltOutlined,
  MoneyCollectOutlined,
  DollarOutlined,
  InboxOutlined,
  CustomerServiceOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  FileDoneOutlined,
  AimOutlined,
  SafetyOutlined,
  ToolOutlined,
  CheckSquareOutlined,
  ShoppingOutlined,
  UndoOutlined,
  AlertOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../store/authStore";
import { authAPI } from "../services/api";
import { App } from "antd";
import logo from "./../assets/logo.png";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const ALL_NAV = [
  { key: "/", label: "Dashboard", icon: <DashboardOutlined />, module: null },
  {
    key: "partners-group",
    label: "Partners & Shops",
    icon: <TeamOutlined />,
    module: "partners",
    children: [
      { key: "/partners", label: "Partners", module: "partners" },
      { key: "/shops", label: "Shops", module: "shops" },
    ],
  },
  {
    key: "/machines",
    label: "Machines",
    icon: <ThunderboltOutlined />,
    module: "machines",
  },
  {
    key: "collections-group",
    label: "Collections",
    icon: <MoneyCollectOutlined />,
    module: "collections",
    children: [
      { key: "/my-assignments", label: "My Assignments", module: null },
      { key: "/collections", label: "All Collections", module: "collections" },
      {
        key: "/weekly-targets",
        label: "Weekly Targets",
        module: "collections",
      },
    ],
  },
  {
    key: "finance-group",
    label: "Finance",
    icon: <DollarOutlined />,
    module: "finance",
    children: [
      { key: "/finance/expenses", label: "Expenses", module: "finance" },
      { key: "/finance/invoices", label: "Invoices", module: "finance" },
      { key: "/finance/payroll", label: "Payroll", module: "finance" },
    ],
  },
  {
    key: "inventory-group",
    label: "Inventory",
    icon: <InboxOutlined />,
    module: "inventory",
    children: [
      { key: "/inventory/tokens", label: "Token Stock", icon: <DollarOutlined />, module: "inventory" },
      { key: "/inventory/products", label: "Products", icon: <ShoppingOutlined />, module: "inventory" },
      { key: "/inventory/stock", label: "Stock Management", icon: <CheckSquareOutlined />, module: "inventory" },
      { key: "/inventory/sales", label: "Sales", icon: <ShoppingOutlined />, module: "inventory" },
      { key: "/inventory/returns", label: "Returns", icon: <UndoOutlined />, module: "inventory" },
      { key: "/inventory/alerts", label: "Alerts", icon: <AlertOutlined />, module: "inventory" },
      { key: "/inventory/accounting", label: "Accounting", icon: <BarChartOutlined />, module: "inventory" },
    ],
  },
  {
    key: "/tickets",
    label: "Tickets",
    icon: <CustomerServiceOutlined />,
    module: "tickets",
  },
  {
    key: "staff-group",
    label: "Staff & HR",
    icon: <SafetyOutlined />,
    module: "staff",
    children: [
      { key: "/staff/employees", label: "Employees", module: "staff" },
      { key: "/staff/departments", label: "Departments", module: "staff" },
      { key: "/staff/positions", label: "Positions", module: "staff" },
      { key: "/staff/organization", label: "Organization", module: "staff" },
      { key: "/staff/users", label: "System Users", module: "users" },
    ],
  },
  {
    key: "/reports",
    label: "Reports",
    icon: <BarChartOutlined />,
    module: "reports",
  },
  {
    key: "/settings",
    label: "Settings",
    icon: <SettingOutlined />,
    module: "settings",
  },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const { user, refreshToken, clearAuth, hasPermission, getRoleName } =
    useAuthStore();

  const handleLogout = async () => {
    try {
      await authAPI.logout(refreshToken);
    } catch {}
    clearAuth();
    navigate("/login");
  };

  const filterNav = (items) =>
    items
      .filter(
        (item) => item.module === null || hasPermission(item.module, "read"),
      )
      .map((item) => ({
        ...item,
        children: item.children ? filterNav(item.children) : undefined,
      }))
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
      .filter(
        (k) =>
          location.pathname === k ||
          location.pathname.startsWith(`${k}/`),
      )
      .sort((a, b) => b.length - a.length)[0] ?? location.pathname;

  const selectedKeys = [selectedKey];
  const openKeys = ALL_NAV.filter((item) =>
    item.children?.some((c) => location.pathname.startsWith(c.key)),
  ).map((item) => item.key);

  const userMenuItems = [
    {
      key: "profile",
      label: `${user?.name} (${getRoleName()})`,
      disabled: true,
    },
    { type: "divider" },
    {
      key: "logout",
      label: "Sign Out",
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
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
            <>
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Bentabet Logo"
                  className="w-8 h-8 object-contain"
                />

                <div>
                  <h1 className="text-white font-bold text-base leading-none">
                    BENTABET
                  </h1>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Slot Management System
                  </p>
                </div>
              </div>
            </>
          ) : (
            <img
              src={logo}
              alt="Bentabet Logo"
              className="w-10 h-10 object-contain mx-auto"
            />
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={navItems}
          onClick={({ key }) => {
            if (!key.includes("-group")) navigate(key);
          }}
          className="!bg-brand-dark border-none pt-2"
        />
      </Sider>

      <Layout
        className={`transition-all duration-200 ${collapsed ? "ml-[80px]" : "ml-[260px]"}`}
      >
        <Header className="sticky top-0 z-40 flex items-center justify-between bg-white px-6 border-b border-slate-200 h-14">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space>
            <Badge count={0} size="small">
              <Button type="text" icon={<BellOutlined />} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: "pointer" }}>
                <Avatar
                  size={32}
                  className="!bg-brand-dark"
                  icon={<UserOutlined />}
                />
                {!collapsed && (
                  <Text style={{ fontSize: 13 }}>{user?.name}</Text>
                )}
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
