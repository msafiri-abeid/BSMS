import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Select, DatePicker, Spin, Table, Tag, Typography, Alert } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import {
  Cpu, Wallet, Calendar, Store, Ticket, FileText, CheckSquare,
  TrendingUp, ArrowDownRight, TrendingDown, Package, CircleDollarSign,
  BadgeAlert, LogIn, ShoppingCart, DollarSign, Receipt, AlertTriangle,
  BarChart3, Plus, Euro, Handshake, Users, Briefcase, Headphones,
  Wrench, ShoppingBag,
} from 'lucide-react';
import { dashboardAPI, shopsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

const DashboardKpiCard = ({ title, value, formatter, icon: Icon, bgIconColor, iconColor, link, onClick: externalClick }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (externalClick) { externalClick(); return; }
    if (link) navigate(link);
  };
  const isClickable = !!(link || externalClick);
  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-xl border border-slate-100 p-4 h-full ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-slate-200' : ''} transition-all duration-200`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 truncate">{title}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {formatter ? formatter(value) : (value ?? 0)}
            </p>
            {isClickable && <ArrowRightIcon className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
          </div>
        </div>
        <div className={`p-3 rounded-xl ${bgIconColor} flex items-center justify-center ml-3 shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
};

const ArrowRightIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

const SectionHeader = ({ label }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="flex-1 h-px bg-slate-100" />
  </div>
);

const BUSINESS_TYPE_OPTIONS = [
  { value: 'slot', label: 'Bentabet' },
  { value: 'meteora', label: 'Meteora' },
];

function DashboardFilter({
  businessType, fixedLabel, fixedBusinessType,
  showShop, showDateRange,
  businessFilter, setBusinessFilter,
  shopFilter, setShopFilter,
  dateRange, setDateRange,
  hasFilters, clearFilters,
}) {
  const shopQueryKey = businessType === 'fixed' ? ['shops-by-type', fixedBusinessType] : ['shops-by-business-type', businessFilter];
  const shopQueryFn = businessType === 'fixed'
    ? () => shopsAPI.list({ business_type: fixedBusinessType }).then(r => r.data.data?.rows || r.data.data)
    : () => shopsAPI.list({ business_type: businessFilter }).then(r => r.data.data?.rows || r.data.data);
  const shopEnabled = businessType === 'fixed' || !!businessFilter;

  const { data: shops } = useQuery({
    queryKey: shopQueryKey,
    queryFn: shopQueryFn,
    enabled: shopEnabled,
  });
  const shopList = Array.isArray(shops) ? shops : [];

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filters</span>
        {businessType !== 'hidden' && (
          businessType === 'fixed' ? (
            <Select
              placeholder={fixedLabel}
              value={fixedLabel}
              disabled
              className="!w-full sm:!w-48"
            >
              <Select.Option value={fixedLabel}>{fixedLabel}</Select.Option>
            </Select>
          ) : (
            <Select
              placeholder="All Businesses"
              value={businessFilter || undefined}
              onChange={(v) => { setBusinessFilter(v || null); setShopFilter(null); }}
              allowClear
              className="!w-full sm:!w-48"
            >
              {BUSINESS_TYPE_OPTIONS.map(b => (
                <Select.Option key={b.value} value={b.value}>{b.label}</Select.Option>
              ))}
            </Select>
          ))}
        {showShop && (
          <Select
            placeholder="All Shops"
            value={shopFilter || undefined}
            onChange={(v) => setShopFilter(v || null)}
            allowClear showSearch optionFilterProp="children"
            className="!w-full sm:!w-56"
            disabled={!shopEnabled}
          >
            {shopList.map(s => (
              <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
            ))}
          </Select>
        )}
        {showDateRange && (
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            className="!w-full sm:!w-56"
          />
        )}
        {hasFilters && (
          <Button size="small" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [businessFilter, setBusinessFilter] = useState(null);
  const [shopFilter, setShopFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  const params = {};
  if (businessFilter) params.business_type = businessFilter;
  if (shopFilter) params.shop_id = shopFilter;
  if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
  if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-admin', params],
    queryFn: () => dashboardAPI.admin(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};
  const hasFilters = businessFilter || shopFilter || dateRange;

  const allMachines = d.topMachines || [];
  const novomaticMachines = allMachines.filter(m => m.machine?.manufacturer === 'Novomatic');
  const meteoraMachines = allMachines.filter(m => m.machine?.manufacturer === 'Meteora');

  const baseCol = [
    { title: '#', width: 30, render: (_, __, i) => <span className="text-xs font-bold text-slate-400">{i + 1}</span> },
    { title: 'Machine', dataIndex: ['machine', 'slot_code'], render: v => <span className="text-xs font-semibold text-slate-700">{v}</span> },
    { title: 'Shop', dataIndex: ['shop', 'name'], render: v => <span className="text-xs text-slate-500">{v || '-'}</span> },
    { title: 'Gross (TZS)', dataIndex: 'total_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-emerald-700">{fmt(Number(v))}</span> },
  ];
  const meteoraCols = [
    ...baseCol,
    { title: 'Office (TZS)', dataIndex: 'office_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-blue-700">{fmt(Number(v))}</span> },
    { title: 'Owner (TZS)', dataIndex: 'owner_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-amber-700">{fmt(Number(v))}</span> },
  ];

  return (
    <div className="space-y-6">
      <DashboardFilter
        businessType="selectable"
        showShop showDateRange
        businessFilter={businessFilter} setBusinessFilter={setBusinessFilter}
        shopFilter={shopFilter} setShopFilter={setShopFilter}
        dateRange={dateRange} setDateRange={setDateRange}
        hasFilters={hasFilters}
        clearFilters={() => { setBusinessFilter(null); setShopFilter(null); setDateRange(null); }}
      />

      <SectionHeader label="Operations" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardKpiCard title="Active Machines" value={d.kpis?.totalMachines} icon={Cpu} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/machines" />
        <DashboardKpiCard title="Active Shops" value={d.kpis?.activeShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/shops" />
        <DashboardKpiCard title={hasFilters ? "Logins" : "Today's Login"} value={d.kpis?.todayLogins} icon={LogIn} bgIconColor="bg-cyan-50" iconColor="text-cyan-600" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardKpiCard title={hasFilters ? "Total Collections" : "Today Collections"} value={d.kpis?.todayCollections} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" link="/collections" />
        <DashboardKpiCard title={hasFilters ? "Total (Filtered)" : "This Week"} value={d.kpis?.weekCollections} formatter={fmt} icon={Calendar} bgIconColor="bg-purple-50" iconColor="text-purple-600" link="/collections" />
        <DashboardKpiCard title="Open Tickets" value={d.kpis?.openTickets} icon={Ticket} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
      </div>

      <SectionHeader label="Revenue &amp; Expenses" />
      {businessFilter === 'slot' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DashboardKpiCard title="Gross Revenue" value={d.financialKpis?.periodGross ?? 0} formatter={fmt} icon={TrendingUp} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/collections" />
            <DashboardKpiCard title="Office Share" value={0} formatter={fmt} icon={Wallet} bgIconColor="bg-slate-50" iconColor="text-slate-400" />
            <DashboardKpiCard title="Return To Player" value={d.financialKpis?.periodOwner ?? 0} formatter={fmt} icon={Users} bgIconColor={(d.financialKpis?.periodOwner ?? 0) <= 0 ? 'bg-rose-50' : 'bg-amber-50'} iconColor={(d.financialKpis?.periodOwner ?? 0) <= 0 ? 'text-rose-500' : 'text-amber-600'} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DashboardKpiCard title="Total Expenses" value={d.financialKpis?.totalExpenses ?? 0} formatter={fmt} icon={FileText} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/finance/expenses" />
            <DashboardKpiCard title="Net Revenue" value={d.financialKpis?.netRevenue ?? 0} formatter={fmt} icon={DollarSign} bgIconColor={(d.financialKpis?.netRevenue ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-rose-50'} iconColor={(d.financialKpis?.netRevenue ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DashboardKpiCard title="Gross Revenue" value={d.financialKpis?.periodGross ?? 0} formatter={fmt} icon={TrendingUp} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/collections" />
            <DashboardKpiCard title="Office Share" value={d.financialKpis?.periodOffice ?? 0} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" />
            <DashboardKpiCard title="Owner Payout" value={d.financialKpis?.periodOwner ?? 0} formatter={fmt} icon={Users} bgIconColor="bg-amber-50" iconColor="text-amber-600" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DashboardKpiCard title="Total Expenses" value={d.financialKpis?.totalExpenses ?? 0} formatter={fmt} icon={FileText} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/finance/expenses" />
            <DashboardKpiCard title="Net Revenue" value={d.financialKpis?.netRevenue ?? 0} formatter={fmt} icon={DollarSign} bgIconColor={(d.financialKpis?.netRevenue ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-rose-50'} iconColor={(d.financialKpis?.netRevenue ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          </div>
        </>
      )}

      <SectionHeader label="Token Management" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardKpiCard title="Office Token Stock" value={d.tokenKpis?.officeStock ?? 0} icon={Package} bgIconColor="bg-indigo-50" iconColor="text-indigo-600" link="/inventory/tokens" />
        <DashboardKpiCard title="Pending Token Debts" value={d.tokenKpis?.pendingDebtCount ?? 0} icon={BadgeAlert} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/debts" />
        <DashboardKpiCard title="Outstanding Token Debt" value={d.tokenKpis?.outstandingDebtAmount ?? 0} formatter={fmt} icon={CircleDollarSign} bgIconColor="bg-amber-50" iconColor="text-amber-600" />
      </div>

      <SectionHeader label="Alerts & Risks" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DashboardKpiCard title="Stock Alerts" value={d.salesKpis?.stockAlertCount ?? 0} icon={AlertTriangle} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/inventory/stock" />
        <DashboardKpiCard title="Pending Expenses" value={d.kpis?.pendingExpenses ?? 0} icon={FileText} bgIconColor="bg-amber-50" iconColor="text-amber-600" link="/finance/expenses" />
      </div>

      <SectionHeader label="Trends" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-sm font-bold text-slate-700 mb-3">Collections — Last 30 Days</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.charts?.collections || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Date: ${l}`} />
              <Bar dataKey="total" fill="#021559" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-sm font-bold text-slate-700 mb-3">Sales — Last 30 Days</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.charts?.sales || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Date: ${l}`} />
              <Bar dataKey="total" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-sm font-bold text-slate-700 mb-3">Top Machines This Week</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Novomatic <span className="text-slate-300 font-normal normal-case">(all gross)</span></p>
          <Table
            dataSource={novomaticMachines}
            rowKey="machine_id"
            size="small"
            pagination={false}
            columns={baseCol}
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Meteora <span className="text-slate-300 font-normal normal-case">(office + owner split)</span></p>
          <Table
            dataSource={meteoraMachines}
            rowKey="machine_id"
            size="small"
            pagination={false}
            columns={meteoraCols}
          />
        </div>
      </div>
    </div>
  );
}

function CashierDashboard() {
  const [shopFilter, setShopFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  const params = {};
  if (shopFilter) params.shop_id = shopFilter;
  if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
  if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-cashier', params],
    queryFn: () => dashboardAPI.cashier(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};
  const hasFilters = shopFilter || dateRange;

  const recentCols = [
    { title: 'Shop', dataIndex: ['shop', 'name'], className: 'text-xs text-slate-700 font-medium' },
    { title: 'Amount', dataIndex: 'net_amount_tzs', render: v => <span className="text-xs font-semibold">{fmt(v)}</span> },
    { title: 'Time', dataIndex: 'created_at', render: v => <span className="text-xs text-slate-500">{dayjs(v).format('HH:mm')}</span> },
  ];

  return (
    <div className="space-y-6">
      <DashboardFilter
        businessType="fixed" fixedLabel="Bentabet" fixedBusinessType="slot"
        showShop showDateRange
        setBusinessFilter={() => {}}
        businessFilter={null}
        shopFilter={shopFilter} setShopFilter={setShopFilter}
        dateRange={dateRange} setDateRange={setDateRange}
        hasFilters={hasFilters}
        clearFilters={() => { setShopFilter(null); setDateRange(null); }}
      />

      <SectionHeader label="Operations" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardKpiCard title="Active Machines" value={d.kpis?.activeMachines} icon={Cpu} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/machines/novomatic" />
        <DashboardKpiCard title="Active Shops" value={d.kpis?.activeShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/shops/slot" />
        <DashboardKpiCard title="Open Tickets" value={d.kpis?.openTickets} icon={Ticket} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
      </div>

      <SectionHeader label="Today's Activity" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard title={hasFilters ? "Total Collections" : "Today Collections"} value={d.kpis?.todayCollections} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" link="/collections" />
        <DashboardKpiCard title={hasFilters ? "Total Sales" : "Today Sales"} value={d.kpis?.todaySales} formatter={fmt} icon={ShoppingCart} bgIconColor="bg-teal-50" iconColor="text-teal-600" link="/inventory/sales" />
        <DashboardKpiCard title={hasFilters ? "Total Purchases" : "Today Purchases"} value={d.kpis?.todayPurchases} formatter={fmt} icon={ShoppingBag} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/inventory/stock" />
        <DashboardKpiCard title={hasFilters ? "Total Transactions" : "Today Transactions"} value={d.kpis?.todayTransactions} icon={Receipt} bgIconColor="bg-cyan-50" iconColor="text-cyan-600" />
      </div>

      <SectionHeader label="Financial" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardKpiCard title={hasFilters ? "Total Expenses" : "Today Expenses"} value={d.kpis?.todayExpenses} formatter={fmt} icon={FileText} bgIconColor="bg-amber-50" iconColor="text-amber-600" link="/finance/expenses" />
        <DashboardKpiCard title="Pending Expenses" value={d.kpis?.pendingExpenses} icon={AlertTriangle} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/finance/expenses" />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-sm font-bold text-slate-700 mb-3">Recent Sales</p>
        <Table dataSource={d.recentSales || []} columns={recentCols} rowKey="id" size="small" pagination={false} />
      </div>
    </div>
  );
}

function CollectorDashboard() {
  const [shopFilter, setShopFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  const params = {};
  if (shopFilter) params.shop_id = shopFilter;
  if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
  if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-collector', params],
    queryFn: () => dashboardAPI.collector(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};
  const hasFilters = shopFilter || dateRange;
  const weekTotal = (d.myWeekCollections || []).reduce((s, c) => s + c.gross_tzs, 0);

  const cols = [
    { title: 'Machine', dataIndex: ['machine', 'slot_code'], className: 'text-xs text-slate-700 font-medium' },
    { title: 'Shop', dataIndex: ['shop', 'name'], className: 'text-xs text-slate-600' },
    { title: 'Status', dataIndex: 'status', render: v => (
      <Tag className="rounded-full px-2.5 font-medium uppercase text-[10px]" color={v === 'done' ? 'success' : 'warning'}>{v}</Tag>
    )},
  ];

  return (
    <div className="space-y-6">
      <DashboardFilter
        businessType="fixed" fixedLabel="Meteora" fixedBusinessType="meteora"
        showShop showDateRange
        setBusinessFilter={() => {}}
        businessFilter={null}
        shopFilter={shopFilter} setShopFilter={setShopFilter}
        dateRange={dateRange} setDateRange={setDateRange}
        hasFilters={hasFilters}
        clearFilters={() => { setShopFilter(null); setDateRange(null); }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <DashboardKpiCard title={hasFilters ? "Assignments" : "Today's Assignments"} value={d.assignments?.length || 0} icon={CheckSquare} bgIconColor="bg-blue-50" iconColor="text-blue-600" />
        <DashboardKpiCard title={hasFilters ? "Total Collections" : "This Week Collections"} value={weekTotal} formatter={fmt} icon={Wallet} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" />
        <DashboardKpiCard title="Open Tickets" value={d.openTickets || 0} icon={Ticket} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
        <DashboardKpiCard title="Efficiency" value={d.collectionEfficiency != null ? `${d.collectionEfficiency}%` : 0} icon={TrendingUp} bgIconColor="bg-purple-50" iconColor="text-purple-600" />
      </div>
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-sm font-bold text-slate-700 mb-3">Today's Assignments</p>
        <Table dataSource={d.assignments || []} columns={cols} rowKey="id" size="small" pagination={false} />
      </div>
    </div>
  );
}

function FinanceDashboard() {
  const [businessFilter, setBusinessFilter] = useState(null);
  const [shopFilter, setShopFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  const params = {};
  if (businessFilter) params.business_type = businessFilter;
  if (shopFilter) params.shop_id = shopFilter;
  if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
  if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-finance', params],
    queryFn: () => dashboardAPI.finance(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};
  const hasFilters = businessFilter || shopFilter || dateRange;

  return (
    <div className="space-y-6">
      <DashboardFilter
        businessType="selectable"
        showShop showDateRange
        businessFilter={businessFilter} setBusinessFilter={setBusinessFilter}
        shopFilter={shopFilter} setShopFilter={setShopFilter}
        dateRange={dateRange} setDateRange={setDateRange}
        hasFilters={hasFilters}
        clearFilters={() => { setBusinessFilter(null); setShopFilter(null); setDateRange(null); }}
      />

      <SectionHeader label="Financial Overview" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard title="Pending Approvals" value={d.pendingExpenses?.length || 0} icon={CheckSquare} bgIconColor="bg-amber-50" iconColor="text-amber-600" link="/finance/expenses" />
        <DashboardKpiCard title="Invoice Due" value={d.dueSoonInvoices?.length || 0} icon={Receipt} bgIconColor="bg-red-50" iconColor="text-red-600" link="/finance/invoices" />
        <DashboardKpiCard title="Invoice Due Amount" value={d.invoiceDueAmount || 0} formatter={fmt} icon={DollarSign} bgIconColor="bg-red-50" iconColor="text-red-600" />
        <DashboardKpiCard title="Stock Alerts" value={d.stockAlertCount || 0} icon={AlertTriangle} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/inventory/stock" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardKpiCard title={hasFilters ? "Total Income" : "Month Income"} value={d.monthIncome || 0} formatter={fmt} icon={TrendingUp} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/collections" />
        <DashboardKpiCard title={hasFilters ? "Total Expenses" : "Month Expenses"} value={d.monthExpenses || 0} formatter={fmt} icon={ArrowDownRight} bgIconColor="bg-red-50" iconColor="text-red-600" link="/finance/expenses" />
        <DashboardKpiCard title={hasFilters ? "Net (Filtered)" : "Net (Month)"} value={(d.monthIncome || 0) - (d.monthExpenses || 0)} formatter={fmt} icon={DollarSign} bgIconColor="bg-blue-50" iconColor="text-blue-600" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DashboardKpiCard title="Pending Expenses (Count)" value={d.pendingExpenses?.length || 0} icon={FileText} bgIconColor="bg-amber-50" iconColor="text-amber-600" />
        <DashboardKpiCard title="Pending Expenses (Amount)" value={d.pendingExpensesTotal || 0} formatter={fmt} icon={AlertTriangle} bgIconColor="bg-rose-50" iconColor="text-rose-600" />
      </div>
      {(d.pendingExpenses || []).length > 0 && (
        <Alert type="warning" message={`${d.pendingExpenses.length} expense(s) awaiting your approval`} showIcon
          className="rounded-lg font-medium text-amber-800 border border-amber-200" />
      )}
    </div>
  );
}

function DirectorDashboard() {
  const [businessFilter, setBusinessFilter] = useState(null);
  const [shopFilter, setShopFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  const params = {};
  if (businessFilter) params.business_type = businessFilter;
  if (shopFilter) params.shop_id = shopFilter;
  if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
  if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-director', params],
    queryFn: () => dashboardAPI.director(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};
  const hasFilters = businessFilter || shopFilter || dateRange;
  const isProfit = (d.netProfit || 0) >= 0;

  return (
    <div className="space-y-6">
      <DashboardFilter
        businessType="selectable"
        showShop showDateRange
        businessFilter={businessFilter} setBusinessFilter={setBusinessFilter}
        shopFilter={shopFilter} setShopFilter={setShopFilter}
        dateRange={dateRange} setDateRange={setDateRange}
        hasFilters={hasFilters}
        clearFilters={() => { setBusinessFilter(null); setShopFilter(null); setDateRange(null); }}
      />

      <SectionHeader label="Executive Summary" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard title={hasFilters ? "Total Revenue" : "Month Revenue"} value={d.monthRevenue || 0} formatter={fmt} icon={TrendingUp} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/collections" />
        <DashboardKpiCard title={hasFilters ? "Total Expenses" : "Month Expenses"} value={d.monthExpenses || 0} formatter={fmt} icon={ArrowDownRight} bgIconColor="bg-red-50" iconColor="text-red-600" link="/finance/expenses" />
        <DashboardKpiCard title={hasFilters ? "Net (Filtered)" : "Net Profit"} value={d.netProfit || 0} formatter={fmt} icon={isProfit ? TrendingUp : TrendingDown}
          bgIconColor={isProfit ? "bg-emerald-50" : "bg-rose-50"} iconColor={isProfit ? "text-emerald-600" : "text-rose-600"} />
        <DashboardKpiCard title="Stock Alerts" value={d.kpis?.stockAlerts || 0} icon={AlertTriangle} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/inventory/stock" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardKpiCard title="Active Shops" value={d.kpis?.activeShops || 0} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/shops" />
        <DashboardKpiCard title="Active Machines" value={d.kpis?.activeMachines || 0} icon={Cpu} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/machines" />
        <DashboardKpiCard title="Open Tickets" value={d.kpis?.openTickets || 0} icon={Ticket} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
      </div>
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-sm font-bold text-slate-700 mb-3">Revenue Trend — Last 6 Months</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={d.trend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Line type="monotone" dataKey="revenue" stroke="#021559" strokeWidth={2.5} dot={{ fill: '#021559', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SalesDashboard() {
  const navigate = useNavigate();
  const [businessFilter, setBusinessFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  const params = {};
  if (businessFilter) params.business_type = businessFilter;
  if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
  if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-sales', params],
    queryFn: () => dashboardAPI.sales(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};
  const hasFilters = businessFilter || dateRange;

      const topColumns = [
        { title: '#', width: 30, render: (_, __, i) => <span className="text-xs font-bold text-slate-400">{i + 1}</span> },
        { title: 'Machine', dataIndex: ['machine', 'slot_code'], render: v => <span className="text-xs font-semibold text-slate-700">{v}</span> },
        { title: 'Shop', dataIndex: ['shop', 'name'], render: v => <span className="text-xs text-slate-500">{v || '-'}</span> },
        { title: 'Gross (TZS)', dataIndex: 'total_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-emerald-700">{fmt(Number(v))}</span> },
        ...(businessFilter !== 'slot' ? [
          { title: 'Office (TZS)', dataIndex: 'office_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-blue-700">{fmt(Number(v))}</span> },
          { title: 'Owner (TZS)', dataIndex: 'owner_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-amber-700">{fmt(Number(v))}</span> },
        ] : []),
      ];

      return (
    <div className="space-y-6">
      <DashboardFilter
        businessType="selectable"
        showShop showDateRange
        businessFilter={businessFilter} setBusinessFilter={setBusinessFilter}
        shopFilter={shopFilter} setShopFilter={setShopFilter}
        dateRange={dateRange} setDateRange={setDateRange}
        hasFilters={hasFilters}
        clearFilters={() => { setBusinessFilter(null); setShopFilter(null); setDateRange(null); }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardKpiCard title="Total Partners" value={d.kpis?.totalPartners} icon={Handshake} bgIconColor="bg-purple-50" iconColor="text-purple-600" link="/partners" />
        <DashboardKpiCard title="Active Shops" value={d.kpis?.activeShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/shops" />
        <DashboardKpiCard title="New Partners (Month)" value={d.kpis?.newPartnersThisMonth} icon={Users} bgIconColor="bg-blue-50" iconColor="text-blue-600" />
      </div>
      <div className="bg-gradient-to-r from-brand-dark to-[#0a206a] rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-white text-lg font-bold tracking-tight">Quick Actions</p>
          <p className="text-blue-200 text-xs mt-0.5">Manage partners and shops</p>
        </div>
        <div className="flex gap-2">
          <Button type="default" icon={<Handshake size={14} />} onClick={() => navigate('/partners')} className="!bg-white !text-brand-dark !border-0 !text-xs !font-semibold">
            Partners
          </Button>
          <Button type="default" icon={<Store size={14} />} onClick={() => navigate('/shops')} className="!bg-white !text-brand-dark !border-0 !text-xs !font-semibold">
            Shops
          </Button>
        </div>
      </div>
    </div>
  );
}

function TechnicianDashboard() {
  const [dateRange, setDateRange] = useState(null);

  const params = {};
  if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
  if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-technician', params],
    queryFn: () => dashboardAPI.technician(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};
  const hasFilters = dateRange;

  const ticketCols = [
    { title: 'Ticket', dataIndex: 'id', render: (v) => <span className="text-xs font-mono">#{v}</span> },
    { title: 'Machine', dataIndex: ['machine', 'slot_code'], className: 'text-xs text-slate-700 font-medium' },
    { title: 'Shop', dataIndex: ['shop', 'name'], className: 'text-xs text-slate-600' },
    { title: 'Status', dataIndex: 'status', render: v => (
      <Tag className="rounded-full px-2.5 font-medium uppercase text-[10px]" color={v === 'open' ? 'blue' : v === 'in_progress' ? 'processing' : 'default'}>{v}</Tag>
    )},
  ];

  return (
    <div className="space-y-6">
      <DashboardFilter
        businessType="hidden"
        showShop={false} showDateRange
        businessFilter={null} setBusinessFilter={() => {}}
        shopFilter={null} setShopFilter={() => {}}
        dateRange={dateRange} setDateRange={setDateRange}
        hasFilters={hasFilters}
        clearFilters={() => { setDateRange(null); }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardKpiCard title="My Open Tickets" value={d.kpis?.myOpenTickets} icon={Headphones} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
        <DashboardKpiCard title="Resolved Today" value={d.kpis?.resolvedToday} icon={CheckSquare} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" />
        <DashboardKpiCard title="All Open Tickets" value={d.kpis?.allOpenTickets} icon={Ticket} bgIconColor="bg-amber-50" iconColor="text-amber-600" />
      </div>
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-sm font-bold text-slate-700 mb-3">My Open Tickets</p>
        <Table dataSource={d.myOpenTickets || []} columns={ticketCols} rowKey="id" size="small" pagination={false} />
      </div>
    </div>
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
    'Cashier': 'Cashier Dashboard',
    'Sales': 'Sales Dashboard',
    'Technician': 'Technician Dashboard',
  };

  return (
    <div className="p-1 sm:p-2 bg-slate-50 min-h-screen">
      <div className="mb-6 pb-4 border-b border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Title level={4} className="!m-0 !text-slate-800 !font-extrabold !tracking-tight">
            {titleMap[role] || 'Dashboard'}
          </Title>
          <span className="text-xs text-slate-400 font-medium">
            {dayjs().format('dddd, D MMMM YYYY')}
          </span>
        </div>
        <span className="text-xs font-semibold bg-slate-200/70 text-slate-600 px-3 py-1 rounded-full uppercase tracking-wider">
          {role || 'Staff'}
        </span>
      </div>

      {['Admin', 'General Manager', 'Operations Manager'].includes(role) && <AdminDashboard />}
      {role === 'Collector' && <CollectorDashboard />}
      {role === 'Finance' && <FinanceDashboard />}
      {role === 'Director' && <DirectorDashboard />}
      {role === 'Cashier' && <CashierDashboard />}
      {role === 'Sales' && <SalesDashboard />}
      {role === 'Technician' && <TechnicianDashboard />}
      {!['Admin', 'General Manager', 'Operations Manager', 'Collector', 'Finance', 'Director', 'Cashier', 'Sales', 'Technician'].includes(role) && <AdminDashboard />}
    </div>
  );
}
