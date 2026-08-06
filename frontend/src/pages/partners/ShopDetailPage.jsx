import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Tag, Button, Spin, Space, DatePicker, InputNumber, Input, Modal, App, Image, Radio, Upload, Select } from 'antd';
import { ArrowLeft, Store, Cpu, TrendingUp, DollarSign, PiggyBank, MapPin, FileText, BarChart3, History, ExternalLink, Receipt, Wallet, Landmark, Plus, Eye, Camera, Upload as UploadIcon, Download, Building2, CalendarDays, FilterX } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Brush } from 'recharts';
import { shopsAPI, financeAPI, collectionsAPI, accountsAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const STATUS_COLORS = { active: 'green', inactive: 'red', suspended: 'orange' };
const MFG_COLORS = { Meteora: 'blue', Novomatic: 'purple' };
const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

const getDateRange = (preset) => {
  const today = dayjs().endOf('day');
  switch (preset) {
    case 'yesterday':
      return { date_from: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), date_to: dayjs().subtract(1, 'day').format('YYYY-MM-DD') };
    case 'this_week':
      return { date_from: dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'this_month':
      return { date_from: dayjs().startOf('month').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_month':
      return { date_from: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), date_to: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD') };
    case 'last_7':
      return { date_from: dayjs().subtract(7, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_30':
      return { date_from: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_60':
      return { date_from: dayjs().subtract(60, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_90':
      return { date_from: dayjs().subtract(90, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    case 'last_year':
      return { date_from: dayjs().subtract(1, 'year').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
    default:
      return { date_from: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), date_to: today.format('YYYY-MM-DD') };
  }
};


const fmtSigned = (v) => {
  const n = Number(v) || 0;
  return `${n < 0 ? '−' : ''}TZS ${Math.abs(n).toLocaleString()}`;
};

const RevenueTrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload || {};
  const hasExpenses = (d.expenses || 0) > 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-lg px-3 py-2.5 min-w-[190px]">
      <div className="text-[11px] font-semibold text-slate-700 mb-1.5 pb-1.5 border-b border-slate-100">
        {dayjs(label).format('DD MMM YYYY')}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <span className="text-slate-400">Gross</span>
        <span className={`font-semibold text-right ${(d.gross || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtSigned(d.gross)}</span>
        <span className="text-slate-400">Office</span>
        <span className="font-semibold text-right text-slate-700">{fmtSigned(d.office)}</span>
        <span className="text-slate-400">Owner</span>
        <span className="font-semibold text-right text-slate-700">{fmtSigned(d.owner)}</span>
        {hasExpenses && (
          <>
            <span className="text-slate-400">Expenses</span>
            <span className="font-semibold text-right text-rose-600">{fmtSigned(-(d.expenses || 0))}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default function ShopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [preset, setPreset] = useState('yesterday');
  const [customRange, setCustomRange] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositForm, setDepositForm] = useState({
    account_id: null, amount: 0, charges: 0, receipt: null, notes: '', deposit_date: dayjs().format('YYYY-MM-DD'),
  });

  const roleName = useAuthStore((s) => s.user?.role?.name);
  const canManageCash = ['Admin', 'General Manager', 'Operations Manager', 'Supervisor'].includes(roleName) || roleName === 'Cashier';

  const presetOptions = useMemo(() => [
    { label: dayjs().subtract(1, 'day').format('DD MMM YYYY'), value: 'yesterday' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'Last 7 Days', value: 'last_7' },
    { label: 'Last 30 Days', value: 'last_30' },
    { label: 'Last 60 Days', value: 'last_60' },
    { label: 'Last 90 Days', value: 'last_90' },
    { label: 'Last Year', value: 'last_year' },
    { label: 'Custom Range', value: 'custom' },
  ], []);

  const { date_from, date_to } = useMemo(() => {
    if (preset === 'custom' && customRange) {
      return { date_from: customRange[0].format('YYYY-MM-DD'), date_to: customRange[1].format('YYYY-MM-DD') };
    }
    return getDateRange(preset);
  }, [preset, customRange]);

  const { data: shop, isLoading } = useQuery({
    queryKey: ['shop', id],
    queryFn: () => shopsAPI.get(id).then((r) => r.data.data),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['shop-stats', id, date_from, date_to],
    queryFn: () => shopsAPI.stats(id, { date_from, date_to }).then((r) => r.data.data),
    enabled: !!shop,
  });

  const shopType = shop?.business_type;
  const isSlot = shopType === 'slot';

  const machines = shop?.machines || [];
  const novomaticMachines = machines.filter(m => m.manufacturer === 'Novomatic');
  const meteoraMachines = machines.filter(m => m.manufacturer === 'Meteora');
  const displayMachines = isSlot ? novomaticMachines : meteoraMachines;

  const kpis = statsData?.kpis || {};
  const chartData = statsData?.chartData || [];

  const latestPerf = (m) => (m.performance && m.performance[0]) || null;
  const backPath = location.pathname.startsWith('/shops/slot/') ? '/shops/slot' : '/shops/meteora';

  const { data: expensesData } = useQuery({
    queryKey: ['shop-expenses', id, date_from, date_to],
    queryFn: () => financeAPI.listExpenses({ shop_id: id, limit: 500, date_from, date_to, status: 'approved' }).then(r => r.data.data),
    enabled: isSlot,
  });
  const expensesList = expensesData?.rows || [];
  const totalExpenses = isSlot && expensesList.length > 0 ? expensesList.reduce((s, e) => s + (e.amount || 0), 0) : 0;

  const dailyExpense = useMemo(() => {
    const m = {};
    expensesList.forEach(e => {
      const k = e.expense_date;
      if (k) m[k] = (m[k] || 0) + (e.amount || 0);
    });
    return m;
  }, [expensesList]);

  const revenueData = useMemo(() => chartData.map(d => {
    const gross = Number(d.gross) || 0;
    return {
      ...d,
      expenses: dailyExpense[d.date] || 0,
      grossPos: Math.max(0, gross),
      grossNeg: Math.min(0, gross),
    };
  }), [chartData, dailyExpense]);

  const { data: collectionsData } = useQuery({
    queryKey: ['shop-novomatic-collections', id, date_from, date_to],
    queryFn: () => collectionsAPI.list({ shop_id: id, manufacturer: 'Novomatic', date_from, date_to, status: 'approved', limit: 100 }).then(r => r.data.data),
    enabled: isSlot,
  });
  const collectionRows = (collectionsData?.rows || []).map(c => ({
    ...c,
    _slotCode: c.machine?.slot_code || '—',
    _manufacturer: c.machine?.manufacturer || '—',
    _cashier: c.collector?.name || 'Unassigned',
    _opening: c.novomaticReading?.opening_credits,
    _closing: c.novomaticReading?.closing_credits,
    _totalCredits: c.novomaticReading?.total_credits,
  }));

  const grossFromCollections = collectionRows.reduce((s, r) => s + (r.gross_tzs || 0), 0);

  const { data: floatAccount } = useQuery({
    queryKey: ['shop-float-account', id],
    queryFn: () => accountsAPI.list({ shop_id: id, account_type: 'cash' }).then(r => {
      const accounts = r.data.data?.rows || r.data.data || [];
      return accounts.find(a => a.business_type === 'bentabet') || accounts[0] || null;
    }),
    enabled: isSlot,
  });
  const floatMinimum = floatAccount?.float_minimum || 400000;

  const { data: floatTxns } = useQuery({
    queryKey: ['shop-float-txns', floatAccount?.id, date_to],
    queryFn: () => accountsAPI.transactions(floatAccount.id, { limit: 1, date_to }).then(r => r.data.data),
    enabled: isSlot && !!floatAccount?.id,
  });
  const floatBalanceAtDate = floatTxns?.rows?.length ? floatTxns.rows[0].balance_after : 0;

  const { data: bankAccounts } = useQuery({
    queryKey: ['shop-bank-accounts', id],
    queryFn: () => accountsAPI.list({ account_type: 'bank', is_active: 'true', business_type: 'bentabet', limit: 100 }).then(r => {
      const rows = r.data.data?.rows || r.data.data || [];
      return rows;
    }),
    enabled: isSlot && depositOpen,
  });

  const depositAccountOptions = useMemo(() => {
    const opts = [];
    if (floatAccount) opts.push({ ...floatAccount, _label: `Float — ${floatAccount.name}` });
    (bankAccounts || []).forEach(a => {
      if (!opts.find(o => o.id === a.id)) opts.push({ ...a, _label: `${a.name}${a.bank_name ? ` (${a.bank_name})` : ''}` });
    });
    return opts;
  }, [floatAccount, bankAccounts]);

  const { data: shopTxns } = useQuery({
    queryKey: ['shop-transactions', id, date_from, date_to],
    queryFn: () => accountsAPI.shopTransactions({ shop_id: id, limit: 200, date_from, date_to }).then(r => r.data.data),
    enabled: isSlot,
  });
  const txnRows = shopTxns?.rows || [];

  const depositMutation = useMutation({
    mutationFn: (data) => accountsAPI.deposit(depositForm.account_id, data),
    onSuccess: () => {
      message.success('Deposit recorded');
      qc.invalidateQueries({ queryKey: ['shop-transactions', id] });
      qc.invalidateQueries({ queryKey: ['shop-float-txns', floatAccount?.id] });
      qc.invalidateQueries({ queryKey: ['shop-float-account', id] });
      qc.invalidateQueries({ queryKey: ['shop-bank-accounts', id] });
      setDepositOpen(false);
      setDepositForm({ account_id: null, amount: 0, charges: 0, receipt: null, notes: '', deposit_date: dayjs().format('YYYY-MM-DD') });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to record deposit'),
  });

  const handleSubmitDeposit = () => {
    const fd = new FormData();
    fd.append('amount', depositForm.amount || 0);
    fd.append('charges', depositForm.charges || 0);
    fd.append('transaction_date', depositForm.deposit_date);
    fd.append('description', depositForm.notes || `Deposit to ${depositAccountOptions.find(a => a.id === depositForm.account_id)?.name || 'account'} — ${dayjs(depositForm.deposit_date).format('DD MMM YYYY')}`);
    if (depositForm.receipt?.originFileObj) {
      fd.append('receipt', depositForm.receipt.originFileObj);
    }
    depositMutation.mutate(fd);
  };

  const machineCols = [
    { title: 'Slot Code', dataIndex: 'slot_code', sorter: (a, b) => a.slot_code.localeCompare(b.slot_code), width: 140,
      render: (v, r) => (
        <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => navigate(`/machines/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    { title: 'Manufacturer', dataIndex: 'manufacturer', render: (v) => <Tag color={MFG_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 110 },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={STATUS_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    { title: 'Gross', key: 'gross', render: (_, r) => { const p = latestPerf(r); return p ? <span className="font-semibold">{fmt(p.gross_tzs)}</span> : <span className="text-xs text-slate-300">—</span>; }, width: 130 },
    { title: 'Net', key: 'net', render: (_, r) => { const p = latestPerf(r); return p ? <span className="font-semibold">{fmt(p.net_tzs)}</span> : <span className="text-xs text-slate-300">—</span>; }, width: 130 },
    { title: 'Office', key: 'office', render: (_, r) => { const p = latestPerf(r); return p ? <span className="font-semibold">{fmt(p.office_tzs)}</span> : <span className="text-xs text-slate-300">—</span>; }, width: 120 },
    { title: 'Owner', key: 'owner', render: (_, r) => { const p = latestPerf(r); return p ? <span className="font-semibold">{fmt(p.owner_tzs)}</span> : <span className="text-xs text-slate-300">—</span>; }, width: 120 },
  ];

  const novomaticCols = [
    { title: 'Slot Code', key: '_slotCode', render: (_, r) => (
      <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => navigate(`/machines/${r.machine_id}`)}>
        {r._slotCode}
      </Button>
    ), width: 120 },
    { title: 'Manufacturer', key: '_manufacturer', render: (_, r) => <Tag color="purple" className="!text-[10px] uppercase">{r._manufacturer}</Tag>, width: 100 },
    { title: 'Cashier', key: '_cashier', render: (_, r) => <span className="text-xs">{r._cashier}</span>, width: 120 },
    { title: 'Opening', key: '_opening', render: (_, r) => <span className="font-semibold">{r._opening?.toLocaleString() ?? '—'}</span>, width: 110 },
    { title: 'Closing', key: '_closing', render: (_, r) => <span className="font-semibold">{r._closing?.toLocaleString() ?? '—'}</span>, width: 110 },
    { title: 'Credits', key: '_totalCredits', render: (_, r) => <span className="font-semibold">{r._totalCredits?.toLocaleString() ?? '—'}</span>, width: 100 },
    { title: 'Amount', key: 'gross_tzs', render: (_, r) => <span className="font-semibold">{fmt(r.gross_tzs)}</span>, width: 120 },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'approved' ? 'green' : v === 'supervisor_approved' ? 'blue' : v === 'disputed' ? 'red' : 'orange'} className="!text-[10px] uppercase">{v === 'supervisor_approved' ? 'Sup. Approved' : v}</Tag>, width: 110 },
    { title: '', key: 'detail', width: 50, render: (_, r) => (
      <Button type="text" size="small" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => setViewDetail(r)}
        className="!text-brand-dark hover:!text-brand-light" />
    )},
  ];

  const periodLabel = useMemo(() => {
    const presetLabel = presetOptions.find(p => p.value === preset)?.label;
    if (presetLabel === 'Custom Range' && customRange) {
      return `${customRange[0].format('DD MMM')} - ${customRange[1].format('DD MMM YYYY')}`;
    }
    return presetLabel || `${date_from} to ${date_to}`;
  }, [preset, customRange, date_from, date_to]);

  if (isLoading) return <Spin size="large" className="block mx-auto mt-20" />;
  if (!shop) {
    return (
      <div>
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(backPath)}>Back</Button>
        <p className="mt-4">Shop not found.</p>
      </div>
    );
  }

  const addr = shop.address || {};

  return (
    <div>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/60 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => navigate(backPath)}
            className="!text-slate-500 hover:!text-brand-dark flex items-center justify-center" />
          <h4 className="text-base font-bold text-slate-800 m-0">{shop.name}</h4>
          <Tag color={STATUS_COLORS[shop.status]} className="!text-[10px] uppercase !m-0">{shop.status}</Tag>
          <Tag color={isSlot ? 'purple' : 'blue'} className="!text-[10px] !m-0">{isSlot ? 'Slot Shop' : 'Meteora Shop'}</Tag>
        </div>
        <div className="flex items-center gap-2">
          <Select size="small" className="w-36" value={preset} onChange={(v) => { setPreset(v); if (v !== 'custom') setCustomRange(null); }}
            options={presetOptions} />
          {preset === 'custom' && (
            <RangePicker size="small" className="w-52" value={customRange}
              onChange={(dates) => setCustomRange(dates)}
              disabledDate={(d) => d.isAfter(dayjs())} />
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <KpiCard title="Total Machines" value={displayMachines.length} icon={Cpu} bgColor="bg-indigo-50" iconColor="text-indigo-600" />
        <KpiCard title="Gross Revenue" value={kpis.totalGross || 0} formatter={fmt} icon={TrendingUp}
          bgColor="bg-emerald-50" iconColor="text-emerald-600" subtitle={periodLabel} />
        <KpiCard title="Net Revenue" value={isSlot ? (kpis.totalGross || 0) - totalExpenses : (kpis.totalNet || 0)} formatter={fmt} icon={DollarSign}
          bgColor="bg-blue-50" iconColor="text-blue-600" subtitle={periodLabel} />
        {isSlot ? (
          <KpiCard title="Total Expenses" value={totalExpenses} formatter={fmt} icon={Receipt}
            bgColor="bg-rose-50" iconColor="text-rose-600" subtitle={periodLabel} />
        ) : (
          <KpiCard title="Office Share" value={kpis.totalOffice || 0} formatter={fmt} icon={PiggyBank}
            bgColor="bg-amber-50" iconColor="text-amber-600" subtitle={periodLabel} />
        )}
        {isSlot && floatAccount && (
          <KpiCard title="Float Available" value={floatBalanceAtDate} formatter={fmt} icon={Wallet}
            bgColor={floatBalanceAtDate >= floatMinimum ? 'bg-emerald-50' : 'bg-rose-50'}
            iconColor={floatBalanceAtDate >= floatMinimum ? 'text-emerald-600' : 'text-rose-600'} />
        )}
        {!isSlot && (
          <KpiCard title="Owner Share" value={kpis.totalOwner || 0} formatter={fmt} icon={PiggyBank}
            bgColor="bg-amber-50" iconColor="text-amber-600" subtitle={periodLabel} />
        )}
      </div>

      {/* KPI subtitles row — only visible when KPIs exist */}
      {kpis.collectionCount > 0 && (
        <div className="text-[10px] text-slate-400 mb-4 -mt-3 flex items-center gap-4">
          <span>{kpis.collectionCount} collection{kpis.collectionCount !== 1 ? 's' : ''}</span>
          {kpis.expenseCount > 0 && <span>{kpis.expenseCount} expense{kpis.expenseCount !== 1 ? 's' : ''}</span>}
          {kpis.netRevenue !== undefined && kpis.totalExpenses > 0 && (
            <span>Expenses: {fmt(kpis.totalExpenses)}</span>
          )}
        </div>
      )}

      {/* Shop Transactions — unified (Deposit + Account Ledger) */}
      {isSlot && (
        <div className="rounded-lg border border-slate-100 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 m-0">
              <Wallet size={14} className="text-brand-dark" /> Shop Transactions
            </h5>
            {canManageCash && (
              <Button size="small" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setDepositForm({ account_id: floatAccount?.id || null, amount: 0, charges: 0, receipt: null, notes: '', deposit_date: dayjs().format('YYYY-MM-DD') });
                  setDepositOpen(true);
                }}
                className="!bg-brand-dark hover:!bg-brand-light hover:!text-white text-white border-none flex items-center gap-1">
                Record Deposit
              </Button>
            )}
          </div>

          {/* Transaction History Ledger */}
          <div className="p-4 bg-white">
            <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 m-0">
              <BarChart3 size={12} className="text-brand-dark" /> Transaction History — All Accounts
            </h6>
            {txnRows.length > 0 ? (
              <Table dataSource={txnRows} rowKey="id" size="small" pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
                columns={[
                  { title: 'Date', dataIndex: 'transaction_date', render: (v) => dayjs(v).format('DD MMM'), width: 80 },
                  { title: 'Type', dataIndex: 'type', render: (v) => (
                    <Tag color={v === 'in' ? 'green' : 'red'} className="!text-[10px] uppercase">{v === 'in' ? 'IN' : 'OUT'}</Tag>
                  ), width: 60 },
                  { title: 'Account', key: 'account', render: (_, r) => (
                    <span className="text-[10px] text-slate-600">{r.account?.name || r.account?.account_type || '—'}</span>
                  ), width: 120 },
                  { title: 'Reference', dataIndex: 'reference_type', render: (v) => (
                    <span className="text-[10px] text-slate-500 capitalize">{v?.replace(/_/g, ' ') || '—'}</span>
                  ), width: 110 },
                  { title: 'Description', dataIndex: 'description', render: (v) => (
                    <span className="text-xs text-slate-600 line-clamp-1">{v || '—'}</span>
                  ) },
                  { title: 'Amount', dataIndex: 'amount', render: (v, r) => (
                    <span className={`font-semibold text-xs ${r.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {r.type === 'in' ? '+' : '−'}{fmt(v)}
                    </span>
                  ), width: 130 },
                  { title: 'Balance', dataIndex: 'balance_after', render: (v) => (
                    <span className="font-semibold text-xs text-slate-700">{fmt(v)}</span>
                  ), width: 130 },
                ]} />
            ) : (
              <div className="py-6 text-center">
                <BarChart3 className="w-6 h-6 mx-auto mb-1 text-slate-200" />
                <p className="text-[11px] text-slate-400 m-0">No transactions yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Shop Details Card */}
        <div className="rounded-lg border border-slate-100 p-4 bg-white">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <Store size={14} className="text-brand-dark" /> Shop Details
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-slate-400 text-xs">Name</span>
              <p className="font-semibold text-slate-700">{shop.name}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">{isSlot ? 'Supervisor' : 'Partner'}</span>
              <p className="font-semibold text-slate-700">
                {isSlot
                  ? (shop.supervisor
                    ? <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold !text-sm" onClick={() => navigate(`/staff/employees/${shop.supervisor.id}`)}>{shop.supervisor.full_name}</Button>
                    : <span className="text-slate-300">—</span>)
                  : (shop.partner?.name || <span className="text-slate-300">—</span>)}
              </p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Phone</span>
              <p className="font-semibold text-slate-700">{isSlot ? (shop.supervisor?.phone || <span className="text-slate-300">—</span>) : (shop.phone || <span className="text-slate-300">—</span>)}</p>
            </div>
            {isSlot && (
              <div>
                <span className="text-slate-400 text-xs">Shop Type</span>
                <p><Tag color="purple" className="!text-[10px]">Slot Shop</Tag></p>
              </div>
            )}
            <div>
              <span className="text-slate-400 text-xs">Documents</span>
              <p>
                {(shop.documents || []).length > 0
                  ? shop.documents.map((d, i) => (
                      <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs mb-0.5">
                        <FileText size={12} /> {d.name || `Doc ${i + 1}`}
                      </a>
                    ))
                  : <span className="text-slate-300">—</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Address Card */}
        <div className="rounded-lg border border-slate-100 p-4 bg-white">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <MapPin size={14} className="text-brand-dark" /> Address
          </h5>
          {addr.id ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-slate-400 text-xs">Street</span>
                <p className="font-semibold text-slate-700">{addr.streetData?.name || addr.street || <span className="text-slate-300">—</span>}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Ward</span>
                <p className="font-semibold text-slate-700">{addr.wardData?.name || addr.ward || <span className="text-slate-300">—</span>}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">District</span>
                <p className="font-semibold text-slate-700">{addr.districtData?.name || <span className="text-slate-300">—</span>}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Region</span>
                <p className="font-semibold text-slate-700">{addr.region?.name || <span className="text-slate-300">—</span>}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Country</span>
                <p className="font-semibold text-slate-700">{addr.country || 'Tanzania'}</p>
              </div>
              {(shop.lat || shop.lng) && (
                <div>
                  <span className="text-slate-400 text-xs">GPS</span>
                  <p className="font-semibold text-slate-700">
                    <a href={`https://www.google.com/maps?q=${shop.lat},${shop.lng}`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs">
                      <ExternalLink size={12} /> {Number(shop.lat).toFixed(4)}, {Number(shop.lng).toFixed(4)}
                    </a>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No address recorded</p>
          )}
        </div>
      </div>

      {/* Revenue Trend Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-slate-100 p-4 bg-white mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 m-0 flex items-center gap-2">
              <BarChart3 size={14} className="text-brand-dark" /> Revenue Trend — {periodLabel}
            </h5>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-[#021559]" /> Gross
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-[#f43f5e]" /> Negative
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueData} margin={{ top: 12, right: 12, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="revGradPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#021559" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#021559" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="revGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.02} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal vertical={false} strokeDasharray="3 6" stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => dayjs(v).format('DD MMM')}
                  interval={Math.ceil(revenueData.length / 15)} minTickGap={16} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52}
                  tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
                <RechartsTooltip content={<RevenueTrendTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="grossPos" stroke="none" fill="url(#revGradPos)" baseValue={0} />
                <Area type="monotone" dataKey="grossNeg" stroke="none" fill="url(#revGradNeg)" baseValue={0} />
                <Line type="monotone" dataKey="gross" stroke="#021559" strokeWidth={2} dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#021559' }} />
                {revenueData.length > 15 && (
                  <Brush dataKey="date" height={22} stroke="#cbd5e1" fill="#f8fafc" travellerWidth={8}
                    tickFormatter={(v) => dayjs(v).format('DD MMM')} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="rounded-lg border border-slate-100 p-6 bg-white mb-6 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">No collection data for {periodLabel}</p>
        </div>
      )}

      {/* Slot-only sections */}
      {isSlot && (
        <>
          {/* Collection History */}
          <div className="rounded-lg border border-slate-100 p-4 bg-white mb-6">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 m-0">
                <History size={14} className="text-brand-dark" /> Collection History — {periodLabel}
              </h5>
            </div>
            <Table dataSource={collectionRows} columns={novomaticCols} rowKey="id" size="middle" pagination={{ pageSize: 10, showSizeChanger: false }}
              summary={() => {
                return collectionRows.length > 0 ? (
                  <Table.Summary fixed>
                    <Table.Summary.Row className="bg-slate-50">
                      <Table.Summary.Cell index={0} colSpan={6}>
                        <span className="font-semibold text-xs text-slate-600">TOTAL ({collectionRows.length} collections)</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={6}>
                        <span className="font-semibold">{fmt(grossFromCollections)}</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} />
                      <Table.Summary.Cell index={8} />
                    </Table.Summary.Row>
                  </Table.Summary>
                ) : null;
              }} />
          </div>

          {/* Machine Leaderboard */}
          {collectionRows.length > 0 && (
            <div className="rounded-lg border border-slate-100 p-4 bg-white mb-6">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                <Cpu size={14} className="text-brand-dark" /> Machine Leaderboard — {periodLabel}
              </h5>
              <Table dataSource={(() => {
                const map = {};
                collectionRows.forEach(r => {
                  const mid = r.machine_id;
                  if (!map[mid]) map[mid] = { machine_id: mid, slot_code: r._slotCode, total_gross: 0, opening: r._opening, closing: r._closing, credits: r._totalCredits };
                  map[mid].total_gross += r.gross_tzs || 0;
                  if (r._opening != null) map[mid].opening = r._opening;
                  if (r._closing != null) map[mid].closing = r._closing;
                  if (r._totalCredits != null) map[mid].credits = r._totalCredits;
                });
                return Object.values(map).sort((a, b) => b.total_gross - a.total_gross).map((m, i) => ({ ...m, rank: i + 1 }));
              })()} rowKey="machine_id" size="middle" pagination={false}
                columns={[
                  { title: '#', dataIndex: 'rank', width: 40, render: (v) => <span className="text-xs font-bold text-slate-400">{v}</span> },
                  { title: 'Slot Code', dataIndex: 'slot_code', render: (v, r) => (
                    <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => navigate(`/machines/${r.machine_id}`)}>{v}</Button>
                  )},
                  { title: 'Opening', dataIndex: 'opening', render: (v) => <span className="font-semibold">{v?.toLocaleString() ?? '—'}</span> },
                  { title: 'Closing', dataIndex: 'closing', render: (v) => <span className="font-semibold">{v?.toLocaleString() ?? '—'}</span> },
                  { title: 'Credits', dataIndex: 'credits', render: (v) => <span className="font-semibold">{v?.toLocaleString() ?? '—'}</span> },
                  { title: 'Gross TZS', dataIndex: 'total_gross', render: (v) => <span className="font-semibold text-brand-dark">{fmt(v)}</span> },
                ]} />
            </div>
          )}

          {/* Expenses Section */}
          <div className="rounded-lg border border-slate-100 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 m-0">
                <Receipt size={14} className="text-brand-dark" /> Expenses ({expensesList.length})
                <span className="font-normal normal-case text-slate-400">| Total {fmt(totalExpenses)}</span>
                <span className="font-normal normal-case text-slate-400 text-[10px]">— {periodLabel}</span>
              </h5>
            </div>
            {expensesList.length > 0 ? (
              <Table dataSource={expensesList} columns={[
                { title: 'Date', dataIndex: 'expense_date', render: (v) => dayjs(v).format('DD MMM YYYY'), width: 120 },
                { title: 'Category', key: 'category', render: (_, r) => r.category?.name || '—', width: 120 },
                { title: 'Amount', dataIndex: 'amount', render: (v) => <span className="font-semibold">{fmt(v)}</span>, width: 130 },
                { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'approved' ? 'green' : v === 'rejected' ? 'red' : 'orange'} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
                { title: 'Approved By', key: 'approver', render: (_, r) => (r.status === 'approved' ? (r.approver?.name || '—') : '—'), width: 120 },
                { title: 'Description', dataIndex: 'description', render: (v) => <span className="text-xs text-slate-600 line-clamp-1">{v}</span> },
              ]} rowKey="id" size="middle" pagination={{ pageSize: 5, showSizeChanger: false }} />
            ) : (
              <div className="p-8 text-center bg-white">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">No expenses recorded for {periodLabel}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Meteora Machines */}
      {!isSlot && (
        <div className="rounded-lg border border-slate-100 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 m-0">
              <History size={14} className="text-brand-dark" /> Meteora Machines ({displayMachines.length})
            </h5>
          </div>
          {displayMachines.length > 0 ? (
            <Table dataSource={displayMachines} columns={machineCols} rowKey="id" size="middle" pagination={{ pageSize: 10, showSizeChanger: false }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row className="bg-slate-50">
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <span className="font-semibold text-xs text-slate-600">TOTAL ({displayMachines.length} machines)</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
                    <Table.Summary.Cell index={3}>
                      <span className="font-semibold">{fmt(displayMachines.reduce((s, m) => s + (latestPerf(m)?.gross_tzs || 0), 0))}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <span className="font-semibold">{fmt(displayMachines.reduce((s, m) => s + (latestPerf(m)?.net_tzs || 0), 0))}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>
                      <span className="font-semibold">{fmt(displayMachines.reduce((s, m) => s + (latestPerf(m)?.office_tzs || 0), 0))}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6}>
                      <span className="font-semibold">{fmt(displayMachines.reduce((s, m) => s + (latestPerf(m)?.owner_tzs || 0), 0))}</span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )} />
          ) : (
            <div className="p-10 text-center bg-white">
              <Cpu className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">No Meteora machines assigned</p>
            </div>
          )}
        </div>
      )}

      {/* Record Deposit Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Record Deposit — {dayjs(depositForm.deposit_date).format('DD MMM YYYY')}</span>}
        open={depositOpen}
        onCancel={() => { setDepositOpen(false); setDepositForm({ account_id: null, amount: 0, charges: 0, receipt: null, notes: '', deposit_date: dayjs().format('YYYY-MM-DD') }); }}
        onOk={handleSubmitDeposit}
        confirmLoading={depositMutation.isPending}
        okText="Record Deposit"
        okButtonProps={{ className: '!bg-brand-dark rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }}
        width={520}
        className="top-8"
        destroyOnClose
      >
        <div className="space-y-3 mt-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              <CalendarDays size={12} className="inline mr-1" />Deposit Date
            </span>
            <DatePicker size="small" className="w-full" value={dayjs(depositForm.deposit_date)}
              onChange={(d) => setDepositForm(f => ({ ...f, deposit_date: d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD') }))}
              disabledDate={(d) => d.isAfter(dayjs())} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              <Building2 size={12} className="inline mr-1" />Deposit To
            </span>
            <Select placeholder="Select account" className="w-full" showSearch optionFilterProp="children"
              value={depositForm.account_id}
              onChange={(v) => setDepositForm(f => ({ ...f, account_id: v }))}>
              {depositAccountOptions.map(a => (
                <Option key={a.id} value={a.id}>{a._label}</Option>
              ))}
            </Select>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              <Wallet size={12} className="inline mr-1" />Deposit Amount (TZS)
            </span>
            <InputNumber min={0} className="w-full rounded-lg h-9"
              formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v.replace(/[^0-9]/g, ''))}
              value={depositForm.amount}
              onChange={(v) => setDepositForm(f => ({ ...f, amount: v || 0 }))} />
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              <Receipt size={12} className="inline mr-1" />Bank Charges (TZS)
              <span className="text-slate-400 font-normal"> — deducted from deposit</span>
            </span>
            <InputNumber min={0} max={depositForm.amount} className="w-full rounded-lg h-9"
              value={depositForm.charges}
              onChange={(v) => setDepositForm(f => ({ ...f, charges: v || 0 }))} />
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-emerald-700">Net Deposit (Amount − Charges)</span>
              <span className="font-bold text-emerald-800">{fmt(Math.max(0, (depositForm.amount || 0) - (depositForm.charges || 0)))}</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Deposit Slip</span>
            <Upload beforeUpload={() => false} maxCount={1} accept="image/*,application/pdf"
              fileList={depositForm.receipt ? [depositForm.receipt] : []}
              onChange={(info) => setDepositForm(f => ({ ...f, receipt: info.fileList?.[0] || null }))}>
              <Button icon={<UploadIcon size={14} />}>Attach Slip</Button>
            </Upload>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Notes</span>
            <Input.TextArea rows={2} className="rounded-lg" value={depositForm.notes}
              onChange={(e) => setDepositForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Collection Detail Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Collection Details — {viewDetail?.machine?.slot_code || viewDetail?._slotCode}</span>}
        open={!!viewDetail}
        onCancel={() => setViewDetail(null)}
        footer={viewDetail ? (<Space><Button onClick={() => setViewDetail(null)}>Close</Button></Space>) : null}
        width={600}
        className="top-8"
      >
        {viewDetail && (
          <div className="space-y-5 mt-4">
            {viewDetail.meter_image_url ? (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Meter Image</span>
                <Image src={viewDetail.meter_image_url} className="rounded-lg max-h-64 object-contain border border-slate-200" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 bg-slate-50 rounded-lg text-slate-400 border border-slate-200">
                <Camera className="w-10 h-10 mb-1" />
                <span className="text-xs">No meter image</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><span className="text-xs font-semibold text-slate-500 block">Collection Date</span><span>{viewDetail.collection_date ? dayjs(viewDetail.collection_date).format('DD MMM YYYY') : dayjs(viewDetail.collected_at).format('DD MMM YYYY')}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Slot Code</span><span className="font-medium">{viewDetail.machine?.slot_code || viewDetail._slotCode}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Manufacturer</span><Tag className="!text-[10px]">{viewDetail.machine?.manufacturer || viewDetail._manufacturer}</Tag></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Cashier</span><span>{viewDetail.collector?.name || viewDetail._cashier}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Status</span><Tag color={viewDetail.status === 'approved' ? 'green' : viewDetail.status === 'disputed' ? 'red' : 'orange'}>{viewDetail.status}</Tag></div>
              {viewDetail.novomaticReading || (viewDetail._opening != null) ? (
                <>
                  <div><span className="text-xs font-semibold text-slate-500 block">Opening</span><span className="font-mono">{viewDetail.novomaticReading?.opening_credits?.toLocaleString() ?? viewDetail._opening?.toLocaleString()}</span></div>
                  <div><span className="text-xs font-semibold text-slate-500 block">Closing</span><span className="font-mono font-bold">{viewDetail.novomaticReading?.closing_credits?.toLocaleString() ?? viewDetail._closing?.toLocaleString()}</span></div>
                  <div><span className="text-xs font-semibold text-slate-500 block">Total Credits</span><span className="font-mono font-bold">{viewDetail.novomaticReading?.total_credits?.toLocaleString() ?? viewDetail._totalCredits?.toLocaleString()}</span></div>
                </>
              ) : (
                <>
                  <div><span className="text-xs font-semibold text-slate-500 block">Previous Count</span><span className="font-mono">{viewDetail.prev_count?.toLocaleString()}</span></div>
                  <div><span className="text-xs font-semibold text-slate-500 block">Current Count</span><span className="font-mono font-bold">{viewDetail.curr_count?.toLocaleString()}</span></div>
                  <div><span className="text-xs font-semibold text-slate-500 block">Difference</span><span className="font-mono">{viewDetail.difference?.toLocaleString()}</span></div>
                </>
              )}
            </div>
            <div className="border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Financial Breakdown</span>
              <div className="grid gap-4 grid-cols-1">
                <KpiCard title="Gross" value={viewDetail.gross_tzs} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
