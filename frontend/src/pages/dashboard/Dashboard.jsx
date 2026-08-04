import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Select, DatePicker, Spin, Table, Tag, Typography, Alert } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import {
  Cpu, Wallet, Calendar, Store, Ticket, FileText, CheckSquare,
  TrendingUp, ArrowDownRight, TrendingDown, Package, CircleDollarSign,
  BadgeAlert, LogIn, ShoppingCart, DollarSign, Receipt, AlertTriangle,
  BarChart3, Plus, Euro, Handshake, Users, Briefcase, Headphones,
  Wrench, ShoppingBag, Banknote, X,
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

const useSectionDate = (initialPreset = null) => {
  const [preset, setPreset] = useState(initialPreset);
  const [customRange, setCustomRange] = useState(null);
  const { date_from, date_to } = useMemo(() => {
    if (!preset) return { date_from: null, date_to: null };
    if (preset === 'custom' && customRange) {
      return { date_from: customRange[0].format('YYYY-MM-DD'), date_to: customRange[1].format('YYYY-MM-DD') };
    }
    return getDateRange(preset);
  }, [preset, customRange]);
  const clearDate = () => { setPreset(null); setCustomRange(null); };
  return { preset, setPreset, customRange, setCustomRange, date_from, date_to, clearDate };
};

const useShops = (businessType) => {
  const { data } = useQuery({
    queryKey: ['dash-shops', businessType || 'all'],
    queryFn: () => shopsAPI.list(businessType ? { business_type: businessType } : {}).then(r => r.data.data?.rows || r.data.data || []),
  });
  return Array.isArray(data) ? data : [];
};

const DEFAULT_DATE_OPTION = { label: 'Default', value: '__default__' };

const SectionFilterBar = ({
  title, showBusiness, businessType, onBusinessChange,
  shops, shopId, setShopId, showDate = true,
  preset, setPreset, customRange, setCustomRange, datePresets = DATE_PRESETS,
  showGranularity, granularity, setGranularity,
  hasActiveFilters, onClear,
}) => (
  <div className="mb-4 flex items-center gap-2 flex-wrap">
    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 mr-1">{title}</span>
    {showBusiness && (
      <Select
        size="small" className="w-40" placeholder="All Businesses" allowClear
        value={businessType || undefined}
        onChange={(v) => onBusinessChange(v || null)}
        options={BUSINESS_TYPE_OPTIONS}
      />
    )}
    {shops !== null && shops !== undefined && (
      <Select
        size="small" className="w-48" placeholder="All Shops" allowClear showSearch optionFilterProp="label"
        value={shopId || undefined}
        onChange={(v) => setShopId(v || null)}
        options={shops.map(s => ({ value: s.id, label: s.name }))}
      />
    )}
    {showDate && (
      <>
        <Select
          size="small" className="w-36"
          value={preset || '__default__'}
          onChange={(v) => { if (v === '__default__') { setPreset(null); setCustomRange(null); } else { setPreset(v); if (v !== 'custom') setCustomRange(null); } }}
          options={[DEFAULT_DATE_OPTION, ...datePresets]}
        />
        {preset === 'custom' && (
          <RangePicker size="small" className="w-56" value={customRange} onChange={setCustomRange} />
        )}
      </>
    )}
    {showGranularity && (
      <Select size="small" className="w-28" value={granularity} onChange={setGranularity} options={GRANULARITY_OPTIONS} />
    )}
    {hasActiveFilters && (
      <Button size="small" icon={<X size={14} />} onClick={onClear}>Clear</Button>
    )}
  </div>
);

const periodLabel = (v, granularity) => {
  if (!v) return '';
  if (granularity === 'month') return dayjs(`${v}-01`).format('MMM');
  if (granularity === 'week') {
    const weekNo = v.split('-W')[1];
    return weekNo ? `W${weekNo}` : v;
  }
  return v.slice(5);
};

const PRIORITY_COLORS = { urgent: 'red', high: 'orange', medium: 'gold', low: 'default' };
const TICKET_STATUS_COLORS = { open: 'blue', in_progress: 'processing', reopened: 'magenta', pending: 'default' };

const ticketCols = [
  { title: 'Ticket', dataIndex: 'ticket_number', render: v => <span className="text-xs font-mono text-slate-500">{v}</span> },
  { title: 'Shop', render: (_, t) => <span className="text-xs text-slate-600">{t.shop?.name || '-'}</span> },
  { title: 'Machine', render: (_, t) => <span className="text-xs text-slate-500">{t.machine?.slot_code || t.slot_code || '-'}</span> },
  { title: 'Priority', dataIndex: 'priority', width: 90, render: v => <Tag className="uppercase text-[10px] font-semibold rounded-full px-2" color={PRIORITY_COLORS[v] || 'default'}>{v}</Tag> },
  { title: 'Status', dataIndex: 'status', width: 110, render: v => <Tag className="uppercase text-[10px] font-semibold rounded-full px-2" color={TICKET_STATUS_COLORS[v] || 'default'}>{v.replace('_', ' ')}</Tag> },
  { title: 'Created', dataIndex: 'created_at', width: 90, render: v => <span className="text-xs text-slate-500">{dayjs(v).format('DD MMM')}</span> },
];

const partnerCols = [
  { title: 'Partner', render: (_, r) => <span className="text-xs font-semibold text-slate-700">{r.partner_label || r.partner_name || '-'}</span> },
  { title: 'Shops', dataIndex: 'shop_count', width: 70, align: 'center', render: v => <span className="text-xs text-slate-500">{v}</span> },
  { title: 'Collections', dataIndex: 'collection_count', width: 90, align: 'center', render: v => <span className="text-xs text-slate-500">{v}</span> },
  { title: 'Gross (TZS)', dataIndex: 'gross_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-emerald-700">{fmt(Number(v))}</span> },
  { title: 'Office (TZS)', dataIndex: 'office_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-blue-700">{fmt(Number(v))}</span> },
  { title: 'Owner (TZS)', dataIndex: 'owner_tzs', align: 'right', render: v => <span className="text-xs font-semibold text-amber-700">{fmt(Number(v))}</span> },
];

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

  // Operations section filters
  const [opsBiz, setOpsBiz] = useState(null);
  const [opsShop, setOpsShop] = useState(null);
  const opsDate = useSectionDate(null);
  // Revenue & Expenses section filters
  const [revBiz, setRevBiz] = useState(null);
  const [revShop, setRevShop] = useState(null);
  const revDate = useSectionDate(null);
  // Token Management (Meteora only)
  const [tokenShop, setTokenShop] = useState(null);
  // Trends (Collections + Sales)
  const [chartBiz, setChartBiz] = useState(null);
  const [chartShop, setChartShop] = useState(null);
  const [chartGranularity, setChartGranularity] = useState('day');
  const chartDate = useSectionDate('last_30');
  // Revenue Trend
  const [trendBiz, setTrendBiz] = useState(null);
  const [trendShop, setTrendShop] = useState(null);
  const [trendGranularity, setTrendGranularity] = useState('month');
  const trendDate = useSectionDate('last_6_months');
  // Partners Earnings
  const partnerDate = useSectionDate('last_30');

  const opsShops = useShops(opsBiz);
  const revShops = useShops(revBiz);
  const tokenShops = useShops('meteora');
  const chartShops = useShops(chartBiz);
  const trendShops = useShops(trendBiz);

  const params = {};
  if (opsBiz) params.ops_business_type = opsBiz;
  if (opsShop) params.ops_shop_id = opsShop;
  if (opsDate.date_from) params.ops_date_from = opsDate.date_from;
  if (opsDate.date_to) params.ops_date_to = opsDate.date_to;
  if (revBiz) params.rev_business_type = revBiz;
  if (revShop) params.rev_shop_id = revShop;
  if (revDate.date_from) params.rev_date_from = revDate.date_from;
  if (revDate.date_to) params.rev_date_to = revDate.date_to;
  if (tokenShop) params.token_shop_id = tokenShop;
  if (chartBiz) params.chart_business_type = chartBiz;
  if (chartShop) params.chart_shop_id = chartShop;
  if (chartDate.date_from) params.chart_from = chartDate.date_from;
  if (chartDate.date_to) params.chart_to = chartDate.date_to;
  if (chartGranularity) params.chart_granularity = chartGranularity;
  if (trendBiz) params.trend_business_type = trendBiz;
  if (trendShop) params.trend_shop_id = trendShop;
  if (trendDate.date_from) params.trend_from = trendDate.date_from;
  if (trendDate.date_to) params.trend_to = trendDate.date_to;
  if (trendGranularity) params.trend_granularity = trendGranularity;
  if (partnerDate.date_from) params.partner_from = partnerDate.date_from;
  if (partnerDate.date_to) params.partner_to = partnerDate.date_to;

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-admin', params],
    queryFn: () => dashboardAPI.admin(params).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block my-20 mx-auto" />;
  const d = data || {};

  const opsFiltered = !!(opsBiz || opsShop || opsDate.preset);
  const revFiltered = !!(revBiz || revShop || revDate.preset);
  const isSlot = revBiz === 'slot';

  const machinesLink = opsBiz === 'slot' ? '/machines/novomatic' : opsBiz === 'meteora' ? '/machines/meteora' : null;
  const shopsLink = opsBiz === 'slot' ? '/shops/slot' : opsBiz === 'meteora' ? '/shops/meteora' : null;

  const allMachines = d.topMachines || [];
  const novomaticMachines = allMachines.filter(m => m.machine?.manufacturer === 'Novomatic');
  const meteoraMachines = allMachines.filter(m => m.machine?.manufacturer === 'Meteora');

  const gross = d.financialKpis?.periodGross ?? 0;
  const office = d.financialKpis?.periodOffice ?? 0;
  const owner = d.financialKpis?.periodOwner ?? 0;
  const expenses = d.financialKpis?.totalExpenses ?? 0;
  const net = d.financialKpis?.netRevenue ?? 0;

  return (
    <div className="space-y-8">
      {/* ─── Company Overview ─── */}
      <div>
        <SectionHeader label="Company Overview" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardKpiCard title="Total Employees" value={d.overview?.totalEmployees} icon={Users} bgIconColor="bg-blue-50" iconColor="text-blue-600" link="/staff/employees" />
          <DashboardKpiCard title="Active Employees" value={d.overview?.activeEmployees} icon={CheckSquare} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/staff/employees" />
          <DashboardKpiCard title="Total Partners" value={d.overview?.totalPartners} icon={Handshake} bgIconColor="bg-purple-50" iconColor="text-purple-600" link="/partners" />
          <DashboardKpiCard title="Total Shops" value={d.overview?.totalShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" />
        </div>
      </div>

      {/* ─── Partners Earnings ─── */}
      <div>
        <SectionHeader label="Partners Earnings" />
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-sm font-bold text-slate-700">Partner Performance</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                size="small" className="w-36"
                value={partnerDate.preset || '__default__'}
                onChange={(v) => { if (v === '__default__') { partnerDate.clearDate(); } else { partnerDate.setPreset(v); if (v !== 'custom') partnerDate.setCustomRange(null); } }}
                options={[DEFAULT_DATE_OPTION, ...DATE_PRESETS]}
              />
              {partnerDate.preset === 'custom' && <RangePicker size="small" className="w-56" value={partnerDate.customRange} onChange={partnerDate.setCustomRange} />}
            </div>
          </div>
          <Table dataSource={d.partnerEarnings || []} columns={partnerCols} rowKey="partner_id" size="small" pagination={false} />
        </div>
      </div>

      {/* ─── Operations ─── */}
      <div>
        <SectionHeader label="Operations" />
        <SectionFilterBar
          title="Scope"
          showBusiness businessType={opsBiz} onBusinessChange={(v) => { setOpsBiz(v); setOpsShop(null); }}
          shops={opsShops} shopId={opsShop} setShopId={setOpsShop}
          preset={opsDate.preset} setPreset={opsDate.setPreset} customRange={opsDate.customRange} setCustomRange={opsDate.setCustomRange}
          hasActiveFilters={!!(opsBiz || opsShop || opsDate.preset)}
          onClear={() => { setOpsBiz(null); setOpsShop(null); opsDate.clearDate(); }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardKpiCard title="Active Machines" value={d.kpis?.totalMachines} icon={Cpu} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link={machinesLink} />
          <DashboardKpiCard title="Active Shops" value={d.kpis?.activeShops} icon={Store} bgIconColor="bg-orange-50" iconColor="text-orange-600" link={shopsLink} />
          <DashboardKpiCard title={opsFiltered ? "Logins" : "Today's Login"} value={d.kpis?.todayLogins} icon={LogIn} bgIconColor="bg-cyan-50" iconColor="text-cyan-600" />
          <DashboardKpiCard title="Open Tickets" value={d.kpis?.openTickets} icon={Ticket} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <DashboardKpiCard title={opsFiltered ? "Collections (Period)" : "Today Collections"} value={d.kpis?.todayCollections} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" link="/collections" />
          <DashboardKpiCard title={opsFiltered ? "Week Collections" : "This Week"} value={d.kpis?.weekCollections} formatter={fmt} icon={Calendar} bgIconColor="bg-purple-50" iconColor="text-purple-600" link="/collections" />
        </div>

        <p className="text-sm font-bold text-slate-700 mt-6 mb-3">Top Machines {opsFiltered ? '(Period)' : 'This Week'}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Novomatic <span className="text-slate-300 font-normal normal-case">(all gross)</span></p>
            <Table dataSource={novomaticMachines} rowKey="machine_id" size="small" pagination={false} columns={baseCol} />
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Meteora <span className="text-slate-300 font-normal normal-case">(office + owner split)</span></p>
            <Table dataSource={meteoraMachines} rowKey="machine_id" size="small" pagination={false} columns={meteoraCols} />
          </div>
        </div>
      </div>

      {/* ─── Revenue & Expenses ─── */}
      <div>
        <SectionHeader label="Revenue &amp; Expenses" />
        <SectionFilterBar
          title="Scope"
          showBusiness businessType={revBiz} onBusinessChange={(v) => { setRevBiz(v); setRevShop(null); }}
          shops={revShops} shopId={revShop} setShopId={setRevShop}
          preset={revDate.preset} setPreset={revDate.setPreset} customRange={revDate.customRange} setCustomRange={revDate.setCustomRange}
          hasActiveFilters={!!(revBiz || revShop || revDate.preset)}
          onClear={() => { setRevBiz(null); setRevShop(null); revDate.clearDate(); }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <DashboardKpiCard title={revFiltered ? "Gross Revenue (Period)" : "Gross Revenue (Month)"} value={gross} formatter={fmt} icon={TrendingUp} bgIconColor="bg-emerald-50" iconColor="text-emerald-600" link="/collections" />
          <DashboardKpiCard title={revFiltered ? "Office Share (Period)" : "Office Share (Month)"} value={office} formatter={fmt} icon={Wallet} bgIconColor="bg-blue-50" iconColor="text-blue-600" />
          <DashboardKpiCard title={isSlot ? "Return To Player" : "Owner Payout"} value={owner} formatter={fmt} icon={Users} bgIconColor={owner <= 0 ? 'bg-rose-50' : 'bg-amber-50'} iconColor={owner <= 0 ? 'text-rose-500' : 'text-amber-600'} />
          <DashboardKpiCard title="Total Expenses" value={expenses} formatter={fmt} icon={FileText} bgIconColor="bg-orange-50" iconColor="text-orange-600" link="/finance/expenses" />
          <DashboardKpiCard title="Net Revenue" value={net} formatter={fmt} icon={DollarSign} bgIconColor={net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'} iconColor={net >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <DashboardKpiCard title="Total Sales" value={d.salesKpis?.totalSales ?? 0} formatter={fmt} icon={ShoppingCart} bgIconColor="bg-teal-50" iconColor="text-teal-600" link="/inventory/sales" />
          <DashboardKpiCard title="Total Purchase" value={d.salesKpis?.totalPurchase ?? 0} formatter={fmt} icon={ShoppingBag} bgIconColor="bg-indigo-50" iconColor="text-indigo-600" link="/inventory/stock" />
          <DashboardKpiCard title="Invoice Due" value={d.salesKpis?.invoiceDue ?? 0} formatter={fmt} icon={Receipt} bgIconColor="bg-red-50" iconColor="text-red-600" link="/finance/invoices" />
          <DashboardKpiCard title="FY Sales (YTD)" value={d.salesKpis?.fySales ?? 0} formatter={fmt} icon={BarChart3} bgIconColor="bg-brand-dark/5" iconColor="text-brand-dark" link="/inventory/sales" />
        </div>
      </div>

      {/* ─── Token Management (Meteora only) ─── */}
      <div>
        <SectionHeader label="Token Management" />
        <SectionFilterBar
          title="Scope"
          shops={tokenShops} shopId={tokenShop} setShopId={setTokenShop} showDate={false}
          preset={null} setPreset={() => {}} customRange={null} setCustomRange={() => {}}
          hasActiveFilters={!!tokenShop}
          onClear={() => setTokenShop(null)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardKpiCard title="Office Token Stock" value={d.tokenKpis?.officeStock ?? 0} icon={Package} bgIconColor="bg-indigo-50" iconColor="text-indigo-600" link="/inventory/tokens" />
          <DashboardKpiCard title="Pending Token Debts" value={d.tokenKpis?.pendingDebtCount ?? 0} icon={BadgeAlert} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/debts" />
          <DashboardKpiCard title="Outstanding Token Debt" value={d.tokenKpis?.outstandingDebtAmount ?? 0} formatter={fmt} icon={CircleDollarSign} bgIconColor="bg-amber-50" iconColor="text-amber-600" />
        </div>
      </div>

      {/* ─── Alerts & Risks (general) ─── */}
      <div>
        <SectionHeader label="Alerts &amp; Risks" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardKpiCard title="Stock Alerts" value={d.salesKpis?.stockAlertCount ?? 0} icon={AlertTriangle} bgIconColor="bg-rose-50" iconColor="text-rose-600" link="/inventory/stock" />
          <DashboardKpiCard title="Pending Expenses" value={d.kpis?.pendingExpenses ?? 0} icon={FileText} bgIconColor="bg-amber-50" iconColor="text-amber-600" link="/finance/expenses" />
          <DashboardKpiCard title="Open Tickets" value={d.kpis?.openTickets ?? 0} icon={Ticket} bgIconColor="bg-red-50" iconColor="text-red-600" link="/tickets" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 mt-4">
          <p className="text-sm font-bold text-slate-700 mb-3">Unresolved Tickets</p>
          <Table dataSource={d.unresolvedTickets || []} columns={ticketCols} rowKey="id" size="small" pagination={false} />
        </div>
      </div>

      {/* ─── Trends ─── */}
      <div>
        <SectionHeader label="Trends" />
        <SectionFilterBar
          title="Scope"
          showBusiness businessType={chartBiz} onBusinessChange={(v) => { setChartBiz(v); setChartShop(null); }}
          shops={chartShops} shopId={chartShop} setShopId={setChartShop}
          preset={chartDate.preset} setPreset={chartDate.setPreset} customRange={chartDate.customRange} setCustomRange={chartDate.setCustomRange}
          showGranularity granularity={chartGranularity} setGranularity={setChartGranularity}
          datePresets={TREND_PRESETS}
          hasActiveFilters={!!(chartBiz || chartShop || chartDate.preset !== 'last_30')}
          onClear={() => { setChartBiz(null); setChartShop(null); chartDate.clearDate(); setChartGranularity('day'); }}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">Collections</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.charts?.collections || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => periodLabel(v, chartGranularity)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => periodLabel(l, chartGranularity)} />
                <Bar dataKey="total" name="Collections" fill="#021559" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-700 mb-3">Sales</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.charts?.sales || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => periodLabel(v, chartGranularity)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => periodLabel(l, chartGranularity)} />
                <Bar dataKey="total" name="Sales" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Revenue Trend ─── */}
      <div>
        <SectionHeader label="Revenue Trend" />
        <SectionFilterBar
          title="Scope"
          showBusiness businessType={trendBiz} onBusinessChange={(v) => { setTrendBiz(v); setTrendShop(null); }}
          shops={trendShops} shopId={trendShop} setShopId={setTrendShop}
          preset={trendDate.preset} setPreset={trendDate.setPreset} customRange={trendDate.customRange} setCustomRange={trendDate.setCustomRange}
          showGranularity granularity={trendGranularity} setGranularity={setTrendGranularity}
          datePresets={TREND_PRESETS}
          hasActiveFilters={!!(trendBiz || trendShop || trendDate.preset !== 'last_6_months')}
          onClear={() => { setTrendBiz(null); setTrendShop(null); trendDate.clearDate(); setTrendGranularity('month'); }}
        />
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={d.trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => periodLabel(v, trendGranularity)} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => periodLabel(l, trendGranularity)} />
              <Line type="monotone" dataKey="total" name="Revenue" stroke="#021559" strokeWidth={2.5} dot={{ fill: '#021559', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
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
