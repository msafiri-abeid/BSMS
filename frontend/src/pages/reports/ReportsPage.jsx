import { useState } from 'react';
import { Tabs, Table, Button, DatePicker, Select, Card, Typography, Space, Tag } from 'antd';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { collectionsAPI, financeAPI, ticketsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

const KpiCard = ({ title, value, formatter, color }) => (
  <div className="rounded-lg border border-slate-100 p-4 bg-white">
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
    <p className={`text-2xl font-bold tracking-tight mt-1 ${color || 'text-slate-800'}`}>
      {formatter ? formatter(value) : (value ?? 0)}
    </p>
  </div>
);

// ── Collections Report ────────────────────────────────────────
function CollectionsReport() {
  const [filters, setFilters] = useState({ limit: 100, offset: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['report-collections', filters],
    queryFn: () => collectionsAPI.list(filters).then(r => r.data.data),
  });

  const rows = data?.rows || [];
  const totals = rows.reduce((a, c) => ({
    gross: a.gross + (c.gross_tzs || 0),
    office: a.office + (c.office_tzs || 0),
    owner: a.owner + (c.owner_tzs || 0),
    diff: a.diff + (c.difference || 0),
  }), { gross: 0, office: 0, owner: 0, diff: 0 });

  const handleExport = async () => {
    const res = await financeAPI.exportCollections();
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `collections-report-${dayjs().format('YYYY-MM-DD')}.xlsx`;
    a.click();
  };

  const cols = [
    { title: 'Date', dataIndex: 'collected_at', render: v => dayjs(v).format('DD MMM YYYY'), width: 100 },
    { title: 'Slot Code', dataIndex: ['machine', 'slot_code'], width: 110 },
    { title: 'Manufacturer', dataIndex: ['machine', 'manufacturer'], render: v => <Tag className="!text-[10px]">{v}</Tag>, width: 110 },
    { title: 'Shop', dataIndex: ['shop', 'name'], width: 130 },
    { title: 'Collector', dataIndex: ['collector', 'name'], width: 120 },
    { title: 'Prev Count', dataIndex: 'prev_count', render: v => v?.toLocaleString(), width: 100 },
    { title: 'Curr Count', dataIndex: 'curr_count', render: v => v?.toLocaleString(), width: 100 },
    { title: 'Difference', dataIndex: 'difference', render: v => v?.toLocaleString(), width: 100 },
    { title: 'Gross (TZS)', dataIndex: 'gross_tzs', render: v => v?.toLocaleString(), width: 120 },
    { title: 'Office (TZS)', dataIndex: 'office_tzs', render: v => <span className="text-green-700">{v?.toLocaleString()}</span>, width: 120 },
    { title: 'Owner (TZS)', dataIndex: 'owner_tzs', render: v => <span className="text-purple-700">{v?.toLocaleString()}</span>, width: 120 },
  ];

  return (
    <>
      <div className="flex justify-between mb-4">
        <Space>
          <RangePicker onChange={d => setFilters(f => ({ ...f, date_from: d?.[0]?.toISOString(), date_to: d?.[1]?.toISOString() }))} />
        </Space>
        <Button icon={<Download className="w-4 h-4" />} onClick={handleExport} className="flex items-center gap-1.5">Export Excel</Button>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <KpiCard title="Total Gross" value={totals.gross} formatter={fmt} color="text-green-700" />
        <KpiCard title="Office Total" value={totals.office} formatter={fmt} />
        <KpiCard title="Owner Total" value={totals.owner} formatter={fmt} color="text-purple-700" />
        <KpiCard title="Records" value={data?.count || 0} />
      </div>
      <Table
        dataSource={rows}
        columns={cols}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 50, total: data?.count, onChange: p => setFilters(f => ({ ...f, offset: (p - 1) * 50 })) }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row className="font-semibold bg-slate-100">
              <Table.Summary.Cell index={0} colSpan={7}>TOTALS</Table.Summary.Cell>
              <Table.Summary.Cell index={7}>{totals.diff.toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={8}>{totals.gross.toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={9}>{totals.office.toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={10}>{totals.owner.toLocaleString()}</Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </>
  );
}

// ── Finance Report ────────────────────────────────────────────
function FinanceReport() {
  const chartData = [
    { month: 'Jan', income: 3200000, expenses: 800000 },
    { month: 'Feb', income: 4100000, expenses: 950000 },
    { month: 'Mar', income: 3800000, expenses: 720000 },
    { month: 'Apr', income: 4600000, expenses: 1100000 },
    { month: 'May', income: 5200000, expenses: 890000 },
    { month: 'Jun', income: 4900000, expenses: 1050000 },
  ];

  const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
  const totalExpenses = chartData.reduce((s, d) => s + d.expenses, 0);

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Income (6mo)" value={totalIncome} formatter={fmt} color="text-green-600" />
        <KpiCard title="Total Expenses (6mo)" value={totalExpenses} formatter={fmt} color="text-red-600" />
        <KpiCard title="Net Profit (6mo)" value={totalIncome - totalExpenses} formatter={fmt} color="text-blue-600" />
      </div>
      <Card title="Income vs Expenses" size="small">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip formatter={v => fmt(v)} />
            <Legend />
            <Bar dataKey="income" fill="#1a6b3a" name="Income" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" fill="#f5222d" name="Expenses" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}

// ── Ticket Report ─────────────────────────────────────────────
function TicketReport() {
  const { data: counts } = useQuery({ queryKey: ['ticket-counts-report'], queryFn: () => ticketsAPI.counts().then(r => r.data.data) });

  const statusData = counts ? Object.entries(counts)
    .filter(([k]) => k !== 'total')
    .map(([status, count]) => ({ status, count })) : [];

  const cols = [
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={{ open: 'blue', pending: 'orange', in_progress: 'processing', resolved: 'green', closed: 'default', reopened: 'volcano' }[v]} className="!text-[10px]">{v}</Tag> },
    { title: 'Count', dataIndex: 'count', render: v => <span className="font-semibold">{v}</span> },
    { title: 'Share %', dataIndex: 'count', render: (v) => `${counts?.total ? Math.round((v / counts.total) * 100) : 0}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card size="small" title="Tickets by Status">
        <Table dataSource={statusData} columns={cols} rowKey="status" size="small" pagination={false} />
      </Card>
      <Card size="small" title="Summary">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Tickets</p>
            <p className="text-2xl font-bold text-slate-800">{counts?.total || 0}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open + In Progress</p>
            <p className="text-2xl font-bold text-amber-500">{(counts?.open || 0) + (counts?.in_progress || 0)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resolved</p>
            <p className="text-2xl font-bold text-green-600">{counts?.resolved || 0}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Main Report Page ──────────────────────────────────────────
export default function ReportsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <h4 className="text-base font-bold text-slate-800 m-0">Reports</h4>
      </div>
      <Tabs
        items={[
          { key: 'collections', label: 'Collections', children: <CollectionsReport /> },
          { key: 'finance', label: 'Finance (Income vs Expenses)', children: <FinanceReport /> },
          { key: 'tickets', label: 'Tickets', children: <TicketReport /> },
          {
            key: 'expenses',
            label: 'Expenses',
            children: (
              <Card size="small">
                <Text type="secondary">Expense report with category breakdown — uses Expenses module filters.</Text>
              </Card>
            ),
          },
        ]}
        size="small"
      />
    </div>
  );
}
