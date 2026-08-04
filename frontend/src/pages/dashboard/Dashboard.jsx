import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Select, DatePicker, Spin, Table, Tag, Typography, Alert } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import {
  Cpu, Wallet, Store, Ticket, FileText, CheckSquare,
  TrendingUp, ArrowDownRight, Package, CircleDollarSign,
  BadgeAlert, LogIn, ShoppingCart, DollarSign, Receipt, AlertTriangle,
  BarChart3, Handshake, Users, Briefcase, Headphones,
  ShoppingBag, Banknote,
} from 'lucide-react';
import { dashboardAPI, shopsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getDateRange, DATE_PRESETS, TREND_PRESETS, GRANULARITY_OPTIONS } from '../../utils/datePresets';

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

const useGlobalDate = (initialPreset = 'this_month') => {
  const [preset, setPreset] = useState(initialPreset);
  const [customRange, setCustomRange] = useState(null);
  const { date_from, date_to } = useMemo(() => {
    if (preset === 'custom') {
      if (!customRange) return { date_from: null, date_to: null };
      return { date_from: customRange[0].format('YYYY-MM-DD'), date_to: customRange[1].format('YYYY-MM-DD') };
    }
    return getDateRange(preset);
  }, [preset, customRange]);
  return { preset, setPreset, customRange, setCustomRange, date_from, date_to };
};

const periodLabel = (v, granularity) => {
  if (!v) return '';
  if (granularity === 'month') return dayjs(`${v}-01`).format('MMM');
  if (granularity === 'week') {
    const weekNo = v.split('-W')[1];
    return weekNo ? `W${weekNo}` : v;
  }
  return v.slice(5);
};

const mergeTrend = (coll, sales) => {
  const map = {};
  (coll || []).forEach(r => { map[r.period] = { period: r.period, collections: r.total, sales: 0 }; });
  (sales || []).forEach(r => {
    if (!map[r.period]) map[r.period] = { period: r.period, collections: 0, sales: 0 };
    map[r.period].sales = r.total;
  });
  return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
};

const PartnerEarningsTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{r.partner_label || r.partner_name || 'Partner'}</p>
      <p className="text-slate-500">Gross: <span className="font-semibold text-emerald-700">{fmt(Number(r.gross_tzs))}</span></p>
      <p className="text-slate-500">Office: <span className="font-semibold text-blue-700">{fmt(Number(r.office_tzs))}</span></p>
      <p className="text-slate-500">Owner: <span className="font-semibold text-amber-700">{fmt(Number(r.owner_tzs))}</span></p>
      <p className="text-slate-400 mt-1">{r.shop_count} shops · {r.collection_count} collections</p>
    </div>
  );
};

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

function AdminDashboard() {
  const navigate = useNavigate();

  // Single global date filter drives every section — no "Default" option, always a concrete preset
  const globalDate = useGlobalDate('this_month');
  const [granularity, setGranularity] = useState('day');

  const params = {};
  if (globalDate.date_from) params.date_from = globalDate.date_from;
  if (globalDate.date_to) params.date_to = globalDate.date_to;
  if (granularity) {
    params.chart_granularity = granularity;
    params.trend_granularity = granularity;
  }

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-admin', params],
    queryFn: () => dashboardAPI.admin(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};

  const allMachines = d.topMachines || [];
  const novomaticMachines = allMachines.filter(m => m.machine?.manufacturer === 'Novomatic');
  const meteoraMachines = allMachines.filter(m => m.machine?.manufacturer === 'Meteora');

  const bentabetRev = d.revenueExpenses?.bentabet || {};
  const meteoraRev = d.revenueExpenses?.meteora || {};
  const partnerRows = (d.partnerEarnings || []).map(r => ({
    ...r,
    gross_tzs: Number(r.gross_tzs) || 0,
    office_tzs: Number(r.office_tzs) || 0,
    owner_tzs: Number(r.owner_tzs) || 0,
    shop_count: Number(r.shop_count) || 0,
    collection_count: Number(r.collection_count) || 0,
  }));
  const bentabetTrend = mergeTrend(d.trends?.bentabet?.collections, d.trends?.bentabet?.sales);
  const meteoraTrend = (d.trends?.meteora?.collections || []).map(r => ({ period: r.period, collections: Number(r.total) || 0, sales: 0 }));
  const periodRange = globalDate.date_from && globalDate.date_to
    ? `${dayjs(globalDate.date_from).format('DD MMM YYYY')} → ${dayjs(globalDate.date_to).format('DD MMM YYYY')}`
    : '';

  return (
    <div className="space-y-8">
      {/* ─── Global Filter Bar ─── */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Period</span>
          <Select
            size="small" className="w-44"
            value={globalDate.preset}
            onChange={(v) => globalDate.setPreset(v)}
            options={TREND_PRESETS}
          />
          {globalDate.preset === 'custom' && (
            <RangePicker size="small" className="w-64" value={globalDate.customRange} onChange={globalDate.setCustomRange} />
          )}
          <div className="hidden sm:flex items-center gap-2 ml-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Granularity</span>
            <Select
              size="small" className="w-32"
              value={granularity}
              onChange={(v) => setGranularity(v)}
              options={GRANULARITY_OPTIONS}
            />
          </div>
        </div>
        {periodRange && <p className="text-xs text-slate-400 mt-2">Showing {periodRange}</p>}
      </div>

      {/* ─── Company Overview ─── */}
      <div>
        <SectionHeader label="Company Overview" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <DashboardKpiCard title="Total Employees" value={d.overview?.totalEmployees} icon={Users} bgIconColor="bg-blue-50" iconColor="text-blue-600" link="/staff/employees" />
          <DashboardKpiCard title="Active Employees" value={d.overview?.activeEmployees} icon={CheckSquare} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/staff/employees" />
          <DashboardKpiCard title="Total Partners" value={d.overview?.totalPartners} icon={Handshake} bgIconColor="bg-purple-50" iconColor="text-purple-600" link="/partners" />
          <DashboardKpiCard title="Total Shops" value={d.overview?.totalShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" />
          <DashboardKpiCard title="Today's Login" value={d.overview?.todayLogins} icon={LogIn} bgIconColor="bg-cyan-50" iconColor="text-cyan-600" />
        </div>
      </div>

      {/* ─── Operations · Bentabet ─── */}
      <div>
        <SectionHeader label="Operations · Bentabet (Slot)" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DashboardKpiCard title="Active Machines" value={d.operations?.bentabet?.totalMachines} icon={Cpu} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/machines/novomatic" />
          <DashboardKpiCard title="Active Shops" value={d.operations?.bentabet?.activeShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/shops/slot" />
          <DashboardKpiCard title="Collections (Period)" value={d.operations?.bentabet?.collections} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" link="/collections" />
        </div>
      </div>

      {/* ─── Operations · Meteora ─── */}
      <div>
        <SectionHeader label="Operations · Meteora" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DashboardKpiCard title="Active Machines" value={d.operations?.meteora?.totalMachines} icon={Cpu} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/machines/meteora" />
          <DashboardKpiCard title="Active Shops" value={d.operations?.meteora?.activeShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/shops/meteora" />
          <DashboardKpiCard title="Collections (Period)" value={d.operations?.meteora?.collections} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" link="/collections" />
        </div>
      </div>

      {/* ─── Revenue & Expenses · Bentabet ─── */}
      <div>
        <SectionHeader label="Revenue &amp; Expenses · Bentabet (Slot)" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <DashboardKpiCard title="Gross Revenue" value={bentabetRev.gross} formatter={fmt} icon={TrendingUp} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/collections" />
          <DashboardKpiCard title="Office Share" value={bentabetRev.office} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" />
          <DashboardKpiCard title="Return To Player" value={bentabetRev.owner} formatter={fmt} icon={Users} bgIconColor={bentabetRev.owner <= 0 ? 'bg-rose-50' : 'bg-amber-50'} iconColor={bentabetRev.owner <= 0 ? 'text-rose-500' : 'text-amber-600'} />
          <DashboardKpiCard title="Total Expenses" value={bentabetRev.totalExpenses} formatter={fmt} icon={FileText} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/finance/expenses" />
          <DashboardKpiCard title="Net Revenue" value={bentabetRev.net} formatter={fmt} icon={DollarSign} bgIconColor={bentabetRev.net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'} iconColor={bentabetRev.net >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <DashboardKpiCard title="Total Sales" value={bentabetRev.totalSales} formatter={fmt} icon={ShoppingCart} bgIconColor="bg-teal-50" iconColor="text-teal-600" link="/inventory/sales" />
          <DashboardKpiCard title="Total Purchase" value={bentabetRev.totalPurchase} formatter={fmt} icon={ShoppingBag} bgIconColor="bg-indigo-50" iconColor="text-indigo-600" link="/inventory/stock" />
          <DashboardKpiCard title="Invoice Due" value={bentabetRev.invoiceDue} formatter={fmt} icon={Receipt} bgIconColor="bg-red-50" iconColor="text-red-600" link="/finance/invoices" />
          <DashboardKpiCard title="FY Sales (YTD)" value={bentabetRev.fySales} formatter={fmt} icon={BarChart3} bgIconColor="bg-brand-dark/5" iconColor="text-brand-dark" link="/inventory/sales" />
        </div>
      </div>

      {/* ─── Revenue & Expenses · Meteora ─── */}
      <div>
        <SectionHeader label="Revenue &amp; Expenses · Meteora" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <DashboardKpiCard title="Gross Revenue" value={meteoraRev.gross} formatter={fmt} icon={TrendingUp} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/collections" />
          <DashboardKpiCard title="Office Share" value={meteoraRev.office} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" />
          <DashboardKpiCard title="Owner Payout" value={meteoraRev.owner} formatter={fmt} icon={Users} bgIconColor={meteoraRev.owner <= 0 ? 'bg-rose-50' : 'bg-amber-50'} iconColor={meteoraRev.owner <= 0 ? 'text-rose-500' : 'text-amber-600'} />
          <DashboardKpiCard title="Total Expenses" value={meteoraRev.totalExpenses} formatter={fmt} icon={FileText} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/finance/expenses" />
          <DashboardKpiCard title="Net Revenue" value={meteoraRev.net} formatter={fmt} icon={DollarSign} bgIconColor={meteoraRev.net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'} iconColor={meteoraRev.net >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
        </div>
      </div>

      {/* ─── Partners Earnings ─── */}
      <div>
        <SectionHeader label="Partners Earnings" />
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-sm font-bold text-slate-700">Partner Performance <span className="text-xs font-normal text-slate-400">({periodRange || 'period'})</span></p>
            {!partnerRows.length && <p className="text-xs text-slate-400">No external partner collections in this period</p>}
          </div>
          {partnerRows.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={partnerRows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={(r) => r.partner_label || r.partner_name} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip content={<PartnerEarningsTooltip />} />
                <Bar dataKey="gross_tzs" name="Gross" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="office_tzs" name="Office" fill="#021559" radius={[4, 4, 0, 0]} />
                <Bar dataKey="owner_tzs" name="Owner" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm text-slate-400">No data</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Token Management (Meteora only) ─── */}
      <div>
        <SectionHeader label="Token Management" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardKpiCard title="Office Token Stock" value={d.tokenKpis?.officeStock ?? 0} icon={Package} bgIconColor="bg-indigo-50" iconColor="text-indigo-600" link="/inventory/tokens" />
          <DashboardKpiCard title="Pending Token Debts" value={d.tokenKpis?.pendingDebtCount ?? 0} icon={BadgeAlert} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/debts" />
          <DashboardKpiCard title="Outstanding Token Debt" value={d.tokenKpis?.outstandingDebtAmount ?? 0} formatter={fmt} icon={CircleDollarSign} bgIconColor="bg-amber-50" iconColor="text-amber-600" />
        </div>
      </div>

      {/* ─── Alerts & Risks (general) ─── */}
      <div>
        <SectionHeader label="Alerts &amp; Risks" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DashboardKpiCard title="Stock Alerts" value={d.alerts?.stockAlertCount ?? 0} icon={AlertTriangle} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/inventory/stock" />
          <DashboardKpiCard title="Pending Expenses" value={d.alerts?.pendingExpenses ?? 0} icon={FileText} bgIconColor="bg-amber-50" iconColor="text-amber-600" link="/finance/expenses" />
          <DashboardKpiCard title="Open Tickets" value={d.alerts?.unresolvedTickets ?? 0} icon={Ticket} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
        </div>
      </div>

      {/* ─── Trends ─── */}
      <div>
        <SectionHeader label="Trends" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">Bentabet (Slot) — Collections &amp; Sales</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bentabetTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => periodLabel(v, granularity)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => periodLabel(l, granularity)} />
                <Bar dataKey="collections" name="Collections" fill="#021559" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" name="Sales" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">Meteora — Collections</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={meteoraTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => periodLabel(v, granularity)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => periodLabel(l, granularity)} />
                <Bar dataKey="collections" name="Collections" fill="#021559" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Revenue Trend ─── */}
      <div>
        <SectionHeader label="Revenue Trend" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">Bentabet (Slot)</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={d.revenueTrend?.bentabet || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => periodLabel(v, granularity)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => periodLabel(l, granularity)} />
                <Line type="monotone" dataKey="total" name="Revenue" stroke="#021559" strokeWidth={2.5} dot={{ fill: '#021559', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">Meteora</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={d.revenueTrend?.meteora || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => periodLabel(v, granularity)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => periodLabel(l, granularity)} />
                <Line type="monotone" dataKey="total" name="Revenue" stroke="#0ea5e9" strokeWidth={2.5} dot={{ fill: '#0ea5e9', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Top Machines (Period) ─── */}
      <div>
        <SectionHeader label="Top Machines (Period)" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Bentabet (Novomatic) <span className="text-slate-300 font-normal normal-case">(all gross)</span></p>
            <Table dataSource={novomaticMachines} rowKey={(r) => `${r.machine_id}-${r.shop_id}`} size="small" pagination={false} columns={baseCol} />
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Meteora <span className="text-slate-300 font-normal normal-case">(office + owner split)</span></p>
            <Table dataSource={meteoraMachines} rowKey={(r) => `${r.machine_id}-${r.shop_id}`} size="small" pagination={false} columns={meteoraCols} />
          </div>
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

  const machinesLink = businessFilter === 'slot' ? '/machines/novomatic' : businessFilter === 'meteora' ? '/machines/meteora' : null;
  const shopsLink = businessFilter === 'slot' ? '/shops/slot' : businessFilter === 'meteora' ? '/shops/meteora' : null;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard title="Active Machines" value={d.activeMachines || 0} icon={Cpu} bgIconColor="bg-blue-50" iconColor="text-blue-600" link={machinesLink} />
        <DashboardKpiCard title="Active Shops" value={d.activeShops || 0} icon={Store} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link={shopsLink} />
        <DashboardKpiCard title="Collection Count" value={d.collectionCount || 0} icon={Wallet} bgIconColor="bg-brand-dark/5" iconColor="text-brand-dark" link="/collections" />
        <DashboardKpiCard title="Outstanding Debts" value={d.outstandingDebt || 0} formatter={fmt} icon={CircleDollarSign} bgIconColor="bg-rose-50" iconColor="text-rose-600" />
      </div>

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

  const shopsLink = businessFilter === 'slot' ? '/shops/slot' : businessFilter === 'meteora' ? '/shops/meteora' : null;

      return (
    <div className="space-y-6">
      <DashboardFilter
        businessType="selectable"
        showShop={false} showDateRange
        businessFilter={businessFilter} setBusinessFilter={setBusinessFilter}
        shopFilter={null} setShopFilter={() => {}}
        dateRange={dateRange} setDateRange={setDateRange}
        hasFilters={hasFilters}
        clearFilters={() => { setBusinessFilter(null); setDateRange(null); }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardKpiCard title="Total Partners" value={d.kpis?.totalPartners} icon={Handshake} bgIconColor="bg-purple-50" iconColor="text-purple-600" link="/partners" />
        <DashboardKpiCard title="Active Shops" value={d.kpis?.activeShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" link={shopsLink} />
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
          <Button type="default" icon={<Store size={14} />} onClick={() => navigate(shopsLink || '/shops/slot')} className="!bg-white !text-brand-dark !border-0 !text-xs !font-semibold">
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

function HRDashboard() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-hr'],
    queryFn: () => dashboardAPI.hr().then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};

  const hireCols = [
    { title: 'Code', dataIndex: 'employee_code', className: 'text-xs font-mono text-slate-500' },
    { title: 'Name', dataIndex: 'full_name', className: 'text-xs font-semibold text-slate-700' },
    { title: 'Department', dataIndex: ['department', 'name'], className: 'text-xs text-slate-600', render: v => v || '-' },
    { title: 'Position', dataIndex: ['position', 'name'], className: 'text-xs text-slate-600', render: v => v || '-' },
    { title: 'Hire Date', dataIndex: 'hire_date', render: v => <span className="text-xs text-slate-500">{v ? new Date(v).toLocaleDateString() : '-'}</span> },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader label="Workforce Overview" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard title="Total Employees" value={d.kpis?.totalEmployees} icon={Users} bgIconColor="bg-blue-50" iconColor="text-blue-600" link="/staff/employees" />
        <DashboardKpiCard title="Active Employees" value={d.kpis?.activeEmployees} icon={CheckSquare} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/staff/employees" />
        <DashboardKpiCard title="Departments" value={d.kpis?.totalDepartments} icon={Briefcase} bgIconColor="bg-purple-50" iconColor="text-purple-600" link="/staff/departments" />
        <DashboardKpiCard title="Positions" value={d.kpis?.totalPositions} icon={FileText} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/staff/positions" />
      </div>

      <SectionHeader label="Activity & Tickets" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardKpiCard title="New Hires (Month)" value={d.kpis?.newHiresThisMonth} icon={Users} bgIconColor="bg-cyan-50" iconColor="text-cyan-600" />
        <DashboardKpiCard title="Open Tickets" value={d.kpis?.openTickets} icon={Headphones} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
        <DashboardKpiCard title="Pending Expenses" value={d.kpis?.pendingExpenses} icon={FileText} bgIconColor="bg-amber-50" iconColor="text-amber-600" link="/finance/expenses" />
      </div>

      <div className="bg-gradient-to-r from-brand-dark to-[#0a206a] rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-white text-lg font-bold tracking-tight">Quick Actions</p>
          <p className="text-blue-200 text-xs mt-0.5">Manage staff, departments, and payroll</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button type="default" icon={<Users size={14} />} onClick={() => navigate('/staff/employees')} className="!bg-white !text-brand-dark !border-0 !text-xs !font-semibold">
            Employees
          </Button>
          <Button type="default" icon={<Briefcase size={14} />} onClick={() => navigate('/staff/departments')} className="!bg-white !text-brand-dark !border-0 !text-xs !font-semibold">
            Departments
          </Button>
          <Button type="default" icon={<Banknote size={14} />} onClick={() => navigate('/finance/payroll')} className="!bg-white !text-brand-dark !border-0 !text-xs !font-semibold">
            Payroll
          </Button>
        </div>
      </div>

      {d.recentHires?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-sm font-bold text-slate-700 mb-3">Recent Hires</p>
          <Table dataSource={d.recentHires} columns={hireCols} rowKey="id" size="small" pagination={false} />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const getRoleName = useAuthStore(s => s.getRoleName);
  const role = getRoleName();

  const titleMap = {
    'Collector': 'Dashboard',
    'Finance': 'Dashboard',
    'Director': 'Dashboard',
    'Operations Manager': 'Dashboard',
    'Cashier': 'Dashboard',
    'Sales': 'Dashboard',
    'Technician': 'Dashboard',
    'HR': 'Dashboard',
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

      {['Admin', 'General Manager', 'Operations Manager', 'Director'].includes(role) && <AdminDashboard />}
      {role === 'HR' && <HRDashboard />}
      {role === 'Collector' && <CollectorDashboard />}
      {role === 'Finance' && <FinanceDashboard />}
      {role === 'Cashier' && <CashierDashboard />}
      {role === 'Sales' && <SalesDashboard />}
      {role === 'Technician' && <TechnicianDashboard />}
      {!['Admin', 'General Manager', 'Operations Manager', 'Director', 'HR', 'Collector', 'Finance', 'Cashier', 'Sales', 'Technician'].includes(role) && <AdminDashboard />}
    </div>
  );
}
