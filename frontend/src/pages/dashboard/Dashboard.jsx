// src/pages/dashboard/Dashboard.jsx
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Statistic, Spin, Table, Tag, Typography, Alert } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { dashboardAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-admin'], queryFn: () => dashboardAPI.admin().then(r => r.data.data) });
  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  const d = data || {};
  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Active Machines', value: d.kpis?.totalMachines, color: '#1a6b3a' },
          { title: 'Today Collections', value: d.kpis?.todayCollections, formatter: fmt, color: '#1890ff' },
          { title: 'This Week', value: d.kpis?.weekCollections, formatter: fmt, color: '#722ed1' },
          { title: 'Active Shops', value: d.kpis?.activeShops, color: '#fa8c16' },
          { title: 'Open Tickets', value: d.kpis?.openTickets, color: '#f5222d' },
          { title: 'Pending Expenses', value: d.kpis?.pendingExpenses, color: '#faad14' },
        ].map(({ title, value, formatter, color }) => (
          <Col xs={12} sm={8} md={4} key={title}>
            <Card size="small">
              <Statistic title={title} value={value ?? 0} formatter={formatter} valueStyle={{ color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Collections — Last 30 Days" size="small">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.chart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Date: ${l}`} />
                <Bar dataKey="total" fill="#1a6b3a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Top Machines This Week" size="small" style={{ height: '100%' }}>
            {(d.topMachines || []).map((m, i) => (
              <div key={m.machine_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < d.topMachines.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                <Text style={{ fontSize: 13 }}>#{i + 1} {m.machine?.slot_code}</Text>
                <Text strong style={{ fontSize: 13, color: '#1a6b3a' }}>{fmt(m.dataValues?.total_tzs)}</Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </>
  );
}

function CollectorDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-collector'], queryFn: () => dashboardAPI.collector().then(r => r.data.data) });
  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  const d = data || {};
  const weekTotal = (d.myWeekCollections || []).reduce((s, c) => s + c.gross_tzs, 0);
  const cols = [
    { title: 'Machine', dataIndex: ['machine', 'slot_code'] },
    { title: 'Shop', dataIndex: ['shop', 'name'] },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'done' ? 'green' : 'orange'}>{v}</Tag> },
  ];
  return (
    <>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}><Card size="small"><Statistic title="Today's Assignments" value={d.assignments?.length || 0} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="This Week Collections" value={weekTotal} formatter={fmt} valueStyle={{ color: '#1a6b3a' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Open Tickets" value={d.openTickets || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>
      <Card title="Today's Assignments" size="small">
        <Table dataSource={d.assignments || []} columns={cols} rowKey="id" size="small" pagination={false} />
      </Card>
    </>
  );
}

function FinanceDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-finance'], queryFn: () => dashboardAPI.finance().then(r => r.data.data) });
  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  const d = data || {};
  return (
    <>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}><Card size="small"><Statistic title="Pending Approvals" value={d.pendingExpenses?.length || 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Month Income" value={d.monthIncome || 0} formatter={fmt} valueStyle={{ color: '#1a6b3a' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Month Expenses" value={d.monthExpenses || 0} formatter={fmt} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>
      {(d.pendingExpenses || []).length > 0 && (
        <Alert type="warning" message={`${d.pendingExpenses.length} expense(s) awaiting your approval`} showIcon style={{ marginBottom: 16 }} />
      )}
    </>
  );
}

function DirectorDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-director'], queryFn: () => dashboardAPI.director().then(r => r.data.data) });
  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  const d = data || {};
  return (
    <>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}><Card size="small"><Statistic title="Month Revenue" value={d.monthRevenue || 0} formatter={fmt} valueStyle={{ color: '#1a6b3a' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Month Expenses" value={d.monthExpenses || 0} formatter={fmt} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Net Profit" value={d.netProfit || 0} formatter={fmt} valueStyle={{ color: d.netProfit >= 0 ? '#1a6b3a' : '#f5222d' }} /></Card></Col>
      </Row>
      <Card title="Revenue Trend — Last 6 Months" size="small">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={d.trend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Line type="monotone" dataKey="revenue" stroke="#1a6b3a" strokeWidth={2} dot={{ fill: '#1a6b3a' }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}

export default function Dashboard() {
  const getRoleName = useAuthStore(s => s.getRoleName);
  const role = getRoleName();

  const titleMap = {
    'Collector': 'My Daily Dashboard',
    'Finance': 'Finance Dashboard',
    'Director': 'Executive Dashboard',
    'Operations Manager': 'Operations Dashboard',
  };

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>{titleMap[role] || 'Dashboard'}</Title>
      </div>

      {['Admin', 'General Manager', 'Operations Manager'].includes(role) && <AdminDashboard />}
      {role === 'Collector' && <CollectorDashboard />}
      {role === 'Finance' && <FinanceDashboard />}
      {role === 'Director' && <DirectorDashboard />}
      {!['Admin', 'General Manager', 'Operations Manager', 'Collector', 'Finance', 'Director'].includes(role) && <AdminDashboard />}
    </div>
  );
}
