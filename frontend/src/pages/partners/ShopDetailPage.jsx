import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Tag, Button, Spin, Space, DatePicker, InputNumber, Input, Modal, App, Image, Radio, Upload, Select } from 'antd';
import { ArrowLeft, Store, Cpu, TrendingUp, DollarSign, PiggyBank, MapPin, FileText, BarChart3, History, ExternalLink, Receipt, Smartphone, Wallet, Landmark, Plus, Eye, Camera, CheckCircle, XCircle, Upload as UploadIcon, Download, ArrowLeftRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { shopsAPI, financeAPI, collectionsAPI, accountsAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Option } = Select;
const STATUS_COLORS = { active: 'green', inactive: 'red', suspended: 'orange' };
const MFG_COLORS = { Meteora: 'blue', Novomatic: 'purple' };
const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;
const DISP_STATUS_COLORS = { pending: 'orange', approved: 'green', rejected: 'red' };


export default function ShopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [cashDispOpen, setCashDispOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'));
  const [cashDispForm, setCashDispForm] = useState({
    selcom_tzs: 0, cash_allocation: 'float', bank_deposit_amount: 0, bank_charges: 0,
    selcom_receipt: null, bank_deposit_receipt: null, notes: '',
  });
  const [viewDetail, setViewDetail] = useState(null);
  const [rejectDispModal, setRejectDispModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [floatTransferOpen, setFloatTransferOpen] = useState(false);
  const [floatTransferForm, setFloatTransferForm] = useState({
    type: 'float_out', from_shop_id: null, to_shop_id: null, amount: 0, charges: 0, description: '', receipt: null,
  });
  const [rejectTransferModal, setRejectTransferModal] = useState(null);
  const [rejectTransferReason, setRejectTransferReason] = useState('');

  const roleName = useAuthStore((s) => s.user?.role?.name);
  const user = useAuthStore((s) => s.user);
  const { hasPermission } = useAuthStore();
  const canApprove = hasPermission('finance', 'approve');
  const canManageCash = ['Admin', 'General Manager', 'Operations Manager', 'Supervisor'].includes(roleName) || roleName === 'Cashier';

  const { data: shop, isLoading } = useQuery({
    queryKey: ['shop', id],
    queryFn: () => shopsAPI.get(id).then((r) => r.data.data),
  });

  const shopType = shop?.business_type;
  const isSlot = shopType === 'slot';

  const machines = shop?.machines || [];
  const novomaticMachines = machines.filter(m => m.manufacturer === 'Novomatic');
  const meteoraMachines = machines.filter(m => m.manufacturer === 'Meteora');
  const displayMachines = isSlot ? novomaticMachines : meteoraMachines;

  const perfSummary = useMemo(() => {
    if (machines.length === 0) return null;
    return machines.reduce((acc, m) => {
      (m.performance || []).forEach((r) => {
        if (!r.collected_at) return;
        const dayKey = dayjs(r.collected_at).format('YYYY-MM-DD');
        if (dayKey !== selectedDay) return;
        acc.gross += r.gross_tzs || 0;
        acc.net += r.net_tzs || 0;
        acc.office += r.office_tzs || 0;
        acc.owner += r.owner_tzs || 0;
      });
      return acc;
    }, { gross: 0, net: 0, office: 0, owner: 0 });
  }, [machines, selectedDay]);

  const dailyMap = {};
  machines.forEach(m => {
    (m.performance || []).forEach(p => {
      if (!p.collected_at) return;
      const dayKey = dayjs(p.collected_at).format('YYYY-MM-DD');
      if (!dailyMap[dayKey]) dailyMap[dayKey] = 0;
      dailyMap[dayKey] += p.gross_tzs || 0;
    });
  });
  const chartData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([day, gross]) => ({
      day: dayjs(day).format('DD MMM'),
      gross,
      isSelected: day === selectedDay,
    }));

  const latestPerf = (m) => (m.performance && m.performance[0]) || null;
  const backPath = location.pathname.startsWith('/shops/slot/') ? '/shops/slot' : '/shops/meteora';

  const { data: expenses } = useQuery({
    queryKey: ['shop-expenses', id, selectedDay],
    queryFn: () => financeAPI.listExpenses({ shop_id: id, limit: 50, date: selectedDay, status: 'approved' }).then(r => r.data.data),
    enabled: isSlot,
  });
  const expensesList = expenses?.rows || [];
  const totalExpenses = isSlot && expensesList.length > 0 ? expensesList.reduce((s, e) => s + (e.amount || 0), 0) : 0;

  const { data: collectionsData } = useQuery({
    queryKey: ['shop-novomatic-collections', id, selectedDay],
    queryFn: () => collectionsAPI.list({ shop_id: id, manufacturer: 'Novomatic', date: selectedDay, limit: 100 }).then(r => r.data.data),
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

  const { data: cashDispositions } = useQuery({
    queryKey: ['shop-cash-dispositions', id, selectedDay],
    queryFn: () => financeAPI.listShopCash({ shop_id: id, date: selectedDay }).then(r => r.data.data),
  });
  const currentDisp = Array.isArray(cashDispositions) ? cashDispositions[0] : null;

  const { data: floatAccount } = useQuery({
    queryKey: ['shop-float-account', id],
    queryFn: () => accountsAPI.list({ shop_id: id, account_type: 'cash' }).then(r => {
      const accounts = r.data.data?.rows || r.data.data || [];
      return accounts.find(a => a.business_type === 'bentabet') || accounts[0] || null;
    }),
    enabled: isSlot,
  });
  const floatBalance = floatAccount?.current_balance || 0;
  const floatMinimum = floatAccount?.float_minimum || 400000;
  const floatHealthy = floatBalance >= floatMinimum;

  const { data: allShops } = useQuery({
    queryKey: ['shops-list-for-transfer'],
    queryFn: () => shopsAPI.list({ business_type: 'slot', status: 'active', limit: 200 }).then(r => r.data.data?.rows || r.data.data || []),
    enabled: floatTransferOpen,
  });

  const { data: accountTxns } = useQuery({
    queryKey: ['shop-account-txns', id, floatAccount?.id],
    queryFn: () => accountsAPI.transactions(floatAccount.id, { limit: 50 }).then(r => r.data.data),
    enabled: isSlot && !!floatAccount?.id,
  });
  const txnRows = accountTxns?.rows || [];

  const cashDispMutation = useMutation({
    mutationFn: (data) => financeAPI.submitShopCash(data),
    onSuccess: () => {
      message.success('Cash disposition saved');
      qc.invalidateQueries({ queryKey: ['shop-cash-dispositions', id] });
      qc.invalidateQueries({ queryKey: ['shop-account-txns', id] });
      setCashDispOpen(false);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to save'),
  });

  const approveDispMutation = useMutation({
    mutationFn: (data) => financeAPI.approveShopCash(currentDisp.id, data),
    onSuccess: () => {
      message.success('Cash disposition approved');
      qc.invalidateQueries({ queryKey: ['shop-cash-dispositions', id] });
      qc.invalidateQueries({ queryKey: ['shop-float-account', id] });
      qc.invalidateQueries({ queryKey: ['shop-account-txns', id] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to approve'),
  });

  const rejectDispMutation = useMutation({
    mutationFn: (data) => financeAPI.approveShopCash(currentDisp.id, data),
    onSuccess: () => {
      message.success('Cash disposition rejected');
      qc.invalidateQueries({ queryKey: ['shop-cash-dispositions', id] });
      setRejectDispModal(null);
      setRejectReason('');
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to reject'),
  });

  const floatTransferMutation = useMutation({
    mutationFn: (data) => financeAPI.submitFloatTransfer(data),
    onSuccess: () => {
      message.success('Float transfer submitted for approval');
      qc.invalidateQueries({ queryKey: ['shop-account-txns', id] });
      setFloatTransferOpen(false);
      setFloatTransferForm({ type: 'float_out', from_shop_id: null, to_shop_id: null, amount: 0, charges: 0, description: '', receipt: null });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to submit'),
  });

  const approveTransferMutation = useMutation({
    mutationFn: ({ id: transferId, ...data }) => financeAPI.approveFloatTransfer(transferId, data),
    onSuccess: () => {
      message.success('Transfer processed');
      qc.invalidateQueries({ queryKey: ['shop-float-account', id] });
      qc.invalidateQueries({ queryKey: ['shop-account-txns', id] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to process'),
  });

  const handleSubmitCashDisp = () => {
    const fd = new FormData();
    fd.append('shop_id', id);
    fd.append('date', selectedDay);
    fd.append('selcom_tzs', cashDispForm.selcom_tzs || 0);
    fd.append('cash_allocation', cashDispForm.cash_allocation || 'float');
    if (cashDispForm.cash_allocation === 'deposit') {
      fd.append('bank_deposit_amount', cashDispForm.bank_deposit_amount || 0);
      fd.append('bank_charges', cashDispForm.bank_charges || 0);
      if (cashDispForm.bank_deposit_receipt?.originFileObj) {
        fd.append('bank_deposit_receipt', cashDispForm.bank_deposit_receipt.originFileObj);
      }
    }
    if (cashDispForm.selcom_receipt?.originFileObj) {
      fd.append('selcom_receipt', cashDispForm.selcom_receipt.originFileObj);
    }
    fd.append('notes', cashDispForm.notes || '');
    cashDispMutation.mutate(fd);
  };

  const handleSubmitFloatTransfer = () => {
    const fd = new FormData();
    const f = floatTransferForm;
    fd.append('type', f.type);
    fd.append('amount', f.amount || 0);
    fd.append('charges', f.charges || 0);
    fd.append('description', f.description || '');
    if (f.type === 'float_out' || f.type === 'deposit_to_bank') {
      fd.append('from_shop_id', id);
      fd.append('from_account_id', floatAccount?.id || '');
    }
    if (f.type === 'float_in') {
      fd.append('to_shop_id', id);
      fd.append('to_account_id', floatAccount?.id || '');
      fd.append('from_shop_id', f.from_shop_id || '');
      const fromShop = (allShops || []).find(s => s.id === f.from_shop_id);
      if (fromShop) {
        fd.append('from_account_id', fromShop.cash_account_id || '');
      }
    }
    if (f.type === 'float_out') {
      fd.append('to_shop_id', f.to_shop_id || '');
      const toShop = (allShops || []).find(s => s.id === f.to_shop_id);
      if (toShop) {
        fd.append('to_account_id', toShop.cash_account_id || '');
      }
    }
    if (f.type === 'deposit_to_bank') {
      const bankAccQuery = qc.getQueryData(['accounts', { account_type: 'bank', business_type: 'bentabet' }]);
      fd.append('to_account_id', '');
    }
    if (f.receipt?.originFileObj) {
      fd.append('receipt', f.receipt.originFileObj);
    }
    floatTransferMutation.mutate(fd);
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
  const cashAtHandPreview = grossFromCollections - (cashDispForm.selcom_tzs || 0);

  return (
    <div>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => navigate(backPath)}
            className="!text-slate-500 hover:!text-brand-dark flex items-center justify-center" />
          <h4 className="text-base font-bold text-slate-800 m-0">{shop.name}</h4>
          <Tag color={STATUS_COLORS[shop.status]} className="!text-[10px] uppercase !m-0">{shop.status}</Tag>
          <Tag color={isSlot ? 'purple' : 'blue'} className="!text-[10px] !m-0">{isSlot ? 'Slot Shop' : 'Meteora Shop'}</Tag>
        </div>
        <DatePicker size="small" className="w-full sm:w-36" value={dayjs(selectedDay)}
          onChange={(d) => setSelectedDay(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
          disabledDate={(d) => d.isAfter(dayjs())} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <KpiCard title="Total Machines" value={displayMachines.length} icon={Cpu} bgColor="bg-indigo-50" iconColor="text-indigo-600" />
        <KpiCard title="Gross Revenue" value={isSlot ? grossFromCollections : (perfSummary?.gross || 0)} formatter={fmt} icon={TrendingUp} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard title="Net Revenue" value={isSlot ? grossFromCollections - totalExpenses : (perfSummary?.net || 0)} formatter={fmt} icon={DollarSign} bgColor="bg-blue-50" iconColor="text-blue-600" />
        {isSlot ? (
          <KpiCard title="Total Expenses" value={totalExpenses} formatter={fmt} icon={Receipt} bgColor="bg-rose-50" iconColor="text-rose-600" />
        ) : (
          <KpiCard title="Office Share" value={perfSummary?.office || 0} formatter={fmt} icon={PiggyBank} bgColor="bg-amber-50" iconColor="text-amber-600" />
        )}
        {isSlot && (
          <KpiCard title="Float Available" value={floatBalance} formatter={fmt} icon={Wallet}
            bgColor={floatHealthy ? 'bg-emerald-50' : 'bg-rose-50'}
            iconColor={floatHealthy ? 'text-emerald-600' : 'text-rose-600'} />
        )}
      </div>

      {/* Shop Transactions — unified section (Cash Disposition + Float Transfers + Account Ledger) */}
      {isSlot && (
        <div className="rounded-lg border border-slate-100 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 m-0">
              <Wallet size={14} className="text-brand-dark" /> Shop Transactions
            </h5>
            <Space>
              {canManageCash && (!currentDisp || currentDisp.status === 'rejected') && (
                <Button size="small" icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setCashDispForm({
                      selcom_tzs: currentDisp?.selcom_tzs || 0,
                      cash_allocation: currentDisp?.cash_allocation || 'float',
                      bank_deposit_amount: currentDisp?.bank_deposit_amount || 0,
                      bank_charges: currentDisp?.bank_charges || 0,
                      selcom_receipt: null, bank_deposit_receipt: null, notes: currentDisp?.notes || '',
                    });
                    setCashDispOpen(true);
                  }}
                  className="!bg-brand-dark hover:!bg-brand-light hover:!text-white text-white border-none flex items-center gap-1">
                  {currentDisp ? 'Edit Disposition' : 'Record Disposition'}
                </Button>
              )}
              {currentDisp && canApprove && currentDisp.status === 'pending' && (
                <>
                  <Button size="small" icon={<CheckCircle className="w-3.5 h-3.5" />}
                    onClick={() => approveDispMutation.mutate({ action: 'approve' })}
                    loading={approveDispMutation.isPending}
                    className="!bg-green-600 hover:!bg-green-700 hover:!text-white text-white border-none flex items-center gap-1">
                    Approve Disposition
                  </Button>
                  <Button size="small" icon={<XCircle className="w-3.5 h-3.5" />}
                    onClick={() => setRejectDispModal(true)}
                    className="!text-red-600 !border-red-300 hover:!bg-red-50 flex items-center gap-1">
                    Reject
                  </Button>
                </>
              )}
              {canManageCash && (
                <Button size="small" icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
                  onClick={() => setFloatTransferOpen(true)}
                  className="!bg-brand-dark hover:!bg-brand-light hover:!text-white text-white border-none flex items-center gap-1">
                  New Transfer
                </Button>
              )}
            </Space>
          </div>

          {/* Daily Cash Disposition Card */}
          {currentDisp ? (
            <div className="p-4 bg-white border-b border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Landmark size={13} className="text-brand-dark" />
                <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 m-0">
                  Cash Disposition — {dayjs(selectedDay).format('DD MMM YYYY')}
                </h6>
                <Tag color={DISP_STATUS_COLORS[currentDisp.status]} className="!text-[10px] uppercase !ml-auto">{currentDisp.status}</Tag>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Gross</span>
                  <p className="text-sm font-bold text-slate-800 m-0">{fmt(currentDisp.total_gross_tzs)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-100">
                  <span className="text-[10px] uppercase tracking-wider text-blue-600">Selcom</span>
                  <p className="text-sm font-bold text-blue-700 m-0">{fmt(currentDisp.selcom_tzs)}</p>
                  {currentDisp.selcom_receipt_url && (
                    <a href={currentDisp.selcom_receipt_url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 mt-0.5">
                      <Download size={10} /> Receipt
                    </a>
                  )}
                </div>
                <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-100">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-600">Cash at Hand</span>
                  <p className="text-sm font-bold text-emerald-700 m-0">{fmt(currentDisp.cash_at_hand_tzs)}</p>
                  <span className="text-[10px] text-emerald-500">{currentDisp.cash_allocation === 'deposit' ? '→ Bank' : '→ Float'}</span>
                </div>
                {currentDisp.cash_allocation === 'deposit' && currentDisp.bank_deposit_amount > 0 && (
                  <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-100">
                    <span className="text-[10px] uppercase tracking-wider text-amber-600">Bank Deposit</span>
                    <p className="text-sm font-bold text-amber-700 m-0">{fmt(currentDisp.bank_deposit_amount)}</p>
                    {currentDisp.bank_charges > 0 && <span className="text-[10px] text-amber-500">Charges: {fmt(currentDisp.bank_charges)}</span>}
                    {currentDisp.bank_deposit_receipt_url && (
                      <a href={currentDisp.bank_deposit_receipt_url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 mt-0.5">
                        <Download size={10} /> Slip
                      </a>
                    )}
                  </div>
                )}
              </div>
              {currentDisp.approver && (
                <div className="mt-2 text-[10px] text-slate-400">Approved by {currentDisp.approver.name}</div>
              )}
              {currentDisp.notes && (
                <div className="mt-2 text-[10px] text-slate-500"><span className="font-semibold">Notes:</span> {currentDisp.notes}</div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center bg-white border-b border-slate-100">
              <Landmark className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
              <p className="text-xs text-slate-400 m-0">No cash disposition for {dayjs(selectedDay).format('DD MMM YYYY')}</p>
              {canManageCash && (
                <Button size="small" icon={<Plus className="w-3 h-3" />}
                  onClick={() => setCashDispOpen(true)}
                  className="!text-brand-dark hover:!text-brand-light border-brand-dark/30 mt-2 text-xs">
                  Record Disposition
                </Button>
              )}
            </div>
          )}

          {/* Transaction History Ledger */}
          <div className="p-4 bg-white">
            <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 m-0">
              <BarChart3 size={12} className="text-brand-dark" /> Transaction History
              {floatAccount && <span className="font-normal normal-case text-slate-400">— {floatAccount.name} ({fmt(floatBalance)})</span>}
            </h6>
            {txnRows.length > 0 ? (
              <Table dataSource={txnRows} rowKey="id" size="small" pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
                columns={[
                  { title: 'Date', dataIndex: 'transaction_date', render: (v) => dayjs(v).format('DD MMM'), width: 80 },
                  { title: 'Type', dataIndex: 'type', render: (v) => (
                    <Tag color={v === 'in' ? 'green' : 'red'} className="!text-[10px] uppercase">{v === 'in' ? 'IN' : 'OUT'}</Tag>
                  ), width: 60 },
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

      {/* Daily Revenue Trend */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-slate-100 p-4 bg-white mb-6">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-brand-dark" /> Daily Revenue Trend — {dayjs(selectedDay).format('DD MMM YYYY')}
          </h5>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.ceil(chartData.length / 15)} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <RechartsTooltip formatter={(v) => [`${(v || 0).toLocaleString()} TZS`, 'Gross']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="gross" fill="#021559" radius={[2, 2, 0, 0]} maxBarSize={24}
                  shape={(props) => {
                    const { fill, x, y, width, height } = props;
                    const isSelected = chartData[props.index]?.isSelected;
                    return <rect x={x} y={y} width={width} height={height} fill={isSelected ? '#e11d48' : fill} rx={2} />;
                  }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="rounded-lg border border-slate-100 p-6 bg-white mb-6 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">No collection data yet for revenue trend</p>
        </div>
      )}

      {/* Slot-only sections */}
      {isSlot && (
        <>
          {/* Collection History */}
          <div className="rounded-lg border border-slate-100 p-4 bg-white mb-6">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 m-0">
                <History size={14} className="text-brand-dark" /> Collection History — {dayjs(selectedDay).format('DD MMM YYYY')}
              </h5>
            </div>
            {collectionRows.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Total Gross</span>
                  <p className="font-bold text-slate-800 m-0">{fmt(grossFromCollections)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Collections</span>
                  <p className="font-bold text-slate-800 m-0">{collectionRows.length}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Cash at Hand</span>
                  <p className="font-bold text-emerald-600 m-0">
                    {currentDisp ? fmt(currentDisp.cash_at_hand_tzs) : '—'}
                  </p>
                </div>
              </div>
            )}
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
                <Cpu size={14} className="text-brand-dark" /> Machine Leaderboard — {dayjs(selectedDay).format('DD MMM YYYY')}
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
              </h5>
            </div>
            {expensesList.length > 0 ? (
              <Table dataSource={expensesList} columns={[
                { title: 'Date', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY'), width: 120 },
                { title: 'Category', key: 'category', render: (_, r) => r.category?.name || '—', width: 120 },
                { title: 'Amount', dataIndex: 'amount', render: (v) => <span className="font-semibold">{fmt(v)}</span>, width: 130 },
                { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'approved' ? 'green' : v === 'rejected' ? 'red' : 'orange'} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
                { title: 'Approved By', key: 'approver', render: (_, r) => r.approver?.name || '—', width: 120 },
                { title: 'Description', dataIndex: 'description', render: (v) => <span className="text-xs text-slate-600 line-clamp-1">{v}</span> },
              ]} rowKey="id" size="middle" pagination={{ pageSize: 5, showSizeChanger: false }} />
            ) : (
              <div className="p-8 text-center bg-white">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">No expenses recorded for {dayjs(selectedDay).format('DD MMM YYYY')}</p>
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

      {/* Record Cash Disposition Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Record Cash Disposition — {dayjs(selectedDay).format('DD MMM YYYY')}</span>}
        open={cashDispOpen}
        onCancel={() => setCashDispOpen(false)}
        onOk={handleSubmitCashDisp}
        confirmLoading={cashDispMutation.isPending}
        okText="Save"
        okButtonProps={{ className: '!bg-brand-dark rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }}
        width={520}
        className="top-8"
        destroyOnClose
      >
        <div className="space-y-3 mt-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-600">Total Gross (from collections)</span>
              <span className="font-bold text-slate-800">{fmt(grossFromCollections)}</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              <Smartphone size={12} className="inline mr-1" />Selcom Payments (customer payments via Selcom)
            </span>
            <InputNumber min={0} className="w-full rounded-lg h-9" value={cashDispForm.selcom_tzs}
              onChange={(v) => setCashDispForm(f => ({ ...f, selcom_tzs: v || 0 }))} />
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Selcom Receipt <span className="text-slate-400 font-normal">(verification)</span></span>
            <Upload beforeUpload={() => false} maxCount={1} accept="image/*,application/pdf"
              fileList={cashDispForm.selcom_receipt ? [cashDispForm.selcom_receipt] : []}
              onChange={(info) => setCashDispForm(f => ({ ...f, selcom_receipt: info.fileList?.[0] || null }))}>
              <Button icon={<UploadIcon size={14} />}>Attach Receipt</Button>
            </Upload>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-emerald-700">Cash at Hand (Gross − Selcom)</span>
              <span className="font-bold text-emerald-800">{fmt(cashAtHandPreview)}</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Cash Allocation</span>
            <Radio.Group value={cashDispForm.cash_allocation}
              onChange={(e) => setCashDispForm(f => ({ ...f, cash_allocation: e.target.value }))}
              className="w-full">
              <Radio.Button value="float" className="!rounded-l-lg">Keep as Shop Float</Radio.Button>
              <Radio.Button value="deposit" className="!rounded-r-lg">Deposit to Bank</Radio.Button>
            </Radio.Group>
          </div>

          {cashDispForm.cash_allocation === 'deposit' && (
            <>
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-1">
                  <Landmark size={12} className="inline mr-1" />Deposit Amount
                </span>
                <InputNumber min={0} max={cashAtHandPreview} className="w-full rounded-lg h-9"
                  value={cashDispForm.bank_deposit_amount}
                  onChange={(v) => setCashDispForm(f => ({ ...f, bank_deposit_amount: v || 0 }))} />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-1">
                  <Receipt size={12} className="inline mr-1" />Bank Charges (TZS)
                </span>
                <InputNumber min={0} max={cashAtHandPreview} className="w-full rounded-lg h-9"
                  value={cashDispForm.bank_charges}
                  onChange={(v) => setCashDispForm(f => ({ ...f, bank_charges: v || 0 }))} />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-1">Bank Deposit Slip</span>
                <Upload beforeUpload={() => false} maxCount={1} accept="image/*,application/pdf"
                  fileList={cashDispForm.bank_deposit_receipt ? [cashDispForm.bank_deposit_receipt] : []}
                  onChange={(info) => setCashDispForm(f => ({ ...f, bank_deposit_receipt: info.fileList?.[0] || null }))}>
                  <Button icon={<UploadIcon size={14} />}>Attach Deposit Slip</Button>
                </Upload>
              </div>
            </>
          )}

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Notes</span>
            <Input.TextArea rows={2} className="rounded-lg" value={cashDispForm.notes}
              onChange={(e) => setCashDispForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Reject Disposition Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Reject Cash Disposition</span>}
        open={!!rejectDispModal}
        onCancel={() => { setRejectDispModal(null); setRejectReason(''); }}
        onOk={() => rejectDispMutation.mutate({ action: 'reject', reason: rejectReason })}
        confirmLoading={rejectDispMutation.isPending}
        className="top-8"
      >
        <div className="mt-4">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Reason for Rejection</span>
          <Input.TextArea rows={3} className="rounded-lg" value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)} />
        </div>
      </Modal>

      {/* Float Transfer Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">New Float Transfer</span>}
        open={floatTransferOpen}
        onCancel={() => { setFloatTransferOpen(false); setFloatTransferForm({ type: 'float_out', from_shop_id: null, to_shop_id: null, amount: 0, charges: 0, description: '', receipt: null }); }}
        onOk={handleSubmitFloatTransfer}
        confirmLoading={floatTransferMutation.isPending}
        okText="Submit"
        okButtonProps={{ className: '!bg-brand-dark rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }}
        width={520}
        className="top-8"
        destroyOnClose
      >
        <div className="space-y-3 mt-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Transfer Type</span>
            <Radio.Group value={floatTransferForm.type}
              onChange={(e) => setFloatTransferForm(f => ({ ...f, type: e.target.value }))}>
              <Radio.Button value="float_out">Float Out (Send)</Radio.Button>
              <Radio.Button value="float_in">Float In (Receive)</Radio.Button>
              <Radio.Button value="deposit_to_bank">Deposit to Bank</Radio.Button>
            </Radio.Group>
          </div>

          {floatTransferForm.type === 'float_out' && (
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Send To Shop</span>
              <Select placeholder="Select destination shop" className="w-full" showSearch optionFilterProp="children"
                value={floatTransferForm.to_shop_id}
                onChange={(v) => setFloatTransferForm(f => ({ ...f, to_shop_id: v }))}>
                {(allShops || []).filter(s => s.id !== Number(id)).map(s => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </div>
          )}

          {floatTransferForm.type === 'float_in' && (
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Receive From Shop</span>
              <Select placeholder="Select source shop" className="w-full" showSearch optionFilterProp="children"
                value={floatTransferForm.from_shop_id}
                onChange={(v) => setFloatTransferForm(f => ({ ...f, from_shop_id: v }))}>
                {(allShops || []).filter(s => s.id !== Number(id)).map(s => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Amount (TZS)</span>
            <InputNumber min={1} className="w-full rounded-lg h-9"
              formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v.replace(/[^0-9]/g, ''))}
              value={floatTransferForm.amount}
              onChange={(v) => setFloatTransferForm(f => ({ ...f, amount: v || 0 }))} />
          </div>

          {floatTransferForm.type === 'deposit_to_bank' && (
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Bank Charges (TZS)</span>
              <InputNumber min={0} className="w-full rounded-lg h-9"
                value={floatTransferForm.charges}
                onChange={(v) => setFloatTransferForm(f => ({ ...f, charges: v || 0 }))} />
            </div>
          )}

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Receipt</span>
            <Upload beforeUpload={() => false} maxCount={1} accept="image/*,application/pdf"
              fileList={floatTransferForm.receipt ? [floatTransferForm.receipt] : []}
              onChange={(info) => setFloatTransferForm(f => ({ ...f, receipt: info.fileList?.[0] || null }))}>
              <Button icon={<UploadIcon size={14} />}>Attach Receipt</Button>
            </Upload>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Description</span>
            <Input.TextArea rows={2} className="rounded-lg" value={floatTransferForm.description}
              onChange={(e) => setFloatTransferForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Reject Transfer Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Reject Float Transfer</span>}
        open={!!rejectTransferModal}
        onCancel={() => { setRejectTransferModal(null); setRejectTransferReason(''); }}
        onOk={() => {
          if (rejectTransferModal) {
            approveTransferMutation.mutate({ id: rejectTransferModal.id, action: 'reject', reason: rejectTransferReason });
            setRejectTransferModal(null);
            setRejectTransferReason('');
          }
        }}
        confirmLoading={approveTransferMutation.isPending}
        className="top-8"
      >
        <div className="mt-4">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Reason for Rejection</span>
          <Input.TextArea rows={3} className="rounded-lg" value={rejectTransferReason}
            onChange={(e) => setRejectTransferReason(e.target.value)} />
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
