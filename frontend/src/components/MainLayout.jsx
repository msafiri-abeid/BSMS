// src/components/MainLayout.jsx
import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Badge, Typography, Button } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, TeamOutlined, ShopOutlined, ThunderboltOutlined,
  MoneyCollectOutlined, DollarOutlined, InboxOutlined, CustomerServiceOutlined,
  BarChartOutlined, SettingOutlined, UserOutlined, LogoutOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined, FileDoneOutlined,
  AimOutlined, SafetyOutlined, ToolOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';
import { App } from 'antd';
import logo from './../assets/logo.png';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const ALL_NAV = [
  { key: '/', label: 'Dashboard', icon: <DashboardOutlined />, module: null },
  { key: 'partners-group', label: 'Partners & Shops', icon: <TeamOutlined />, module: 'partners',
    children: [
      { key: '/partners', label: 'Partners', module: 'partners' },
      { key: '/shops', label: 'Shops', module: 'shops' },
    ]
  },
  { key: '/machines', label: 'Machines', icon: <ThunderboltOutlined />, module: 'machines' },
  { key: 'collections-group', label: 'Collections', icon: <MoneyCollectOutlined />, module: 'collections',
    children: [
      { key: '/my-assignments', label: 'My Assignments', module: null },
      { key: '/collections', label: 'All Collections', module: 'collections' },
      { key: '/weekly-targets', label: 'Weekly Targets', module: 'collections' },
    ]
  },
  { key: 'finance-group', label: 'Finance', icon: <DollarOutlined />, module: 'finance',
    children: [
      { key: '/finance/expenses', label: 'Expenses', module: 'finance' },
      { key: '/finance/invoices', label: 'Invoices', module: 'finance' },
      { key: '/finance/payroll', label: 'Payroll', module: 'finance' },
    ]
  },
  { key: 'inventory-group', label: 'Inventory', icon: <InboxOutlined />, module: 'inventory',
    children: [
      { key: '/inventory/tokens', label: 'Token Stock', module: 'inventory' },
      { key: '/inventory/shop', label: 'Shop Products', module: 'inventory' },
    ]
  },
  { key: '/tickets', label: 'Tickets', icon: <CustomerServiceOutlined />, module: 'tickets' },
  { key: '/staff', label: 'Staff & HR', icon: <SafetyOutlined />, module: 'staff' },
  { key: '/reports', label: 'Reports', icon: <BarChartOutlined />, module: 'reports' },
  { key: '/settings', label: 'Settings', icon: <SettingOutlined />, module: 'settings' },
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
    navigate('/login');
  };

  const filterNav = (items) =>
    items
      .filter(item => item.module === null || hasPermission(item.module, 'read'))
      .map(item => ({
        ...item,
        children: item.children
          ? filterNav(item.children)
          : undefined,
      }))
      .filter(item => !item.children || item.children.length > 0);

  const navItems = filterNav(ALL_NAV);

  const selectedKeys = [location.pathname];
  const openKeys = ALL_NAV
    .filter(item => item.children?.some(c => location.pathname.startsWith(c.key)))
    .map(item => item.key);

  const userMenuItems = [
    { key: 'profile', label: `${user?.name} (${getRoleName()})`, disabled: true },
    { type: 'divider' },
    { key: 'logout', label: 'Sign Out', icon: <LogoutOutlined />, danger: true, onClick: handleLogout },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={240}
        style={{ position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100, overflowY: 'auto' }}
      >
        <div className="logo">
          {!collapsed ? (
            <>
              <div className="title"><img src={logo} alt="Bentabet-logo" style={{ width: '10%', height: '10%', objectFit: 'contain', display: 'inline' }} /> BENTABET</div>
              <div className="subtitle">Slot Management System</div>
            </>
          ) : (
            <div style={{ color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 700 }}>B</div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={navItems}
          onClick={({ key }) => { if (!key.includes('-group')) navigate(key); }}
          style={{ border: 'none', paddingTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header style={{
          background: '#fff', padding: '0 24px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 99,
          borderBottom: '1px solid #f0f0f0', height: 56,
        }}>
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
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size={32} style={{ background: '#1a6b3a' }} icon={<UserOutlined />} />
                {!collapsed && <Text style={{ fontSize: 13 }}>{user?.name}</Text>}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 24, minHeight: 'calc(100vh - 104px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
