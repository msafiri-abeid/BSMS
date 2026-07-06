import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Tag, Table, Button, Typography, Space, Modal, Form, Input, InputNumber, Select, Checkbox, DatePicker, App, Empty, Image, Tooltip } from 'antd';
import { ArrowLeft, Download, Plus, Pencil, Trash2, Eye, Edit3, X, CheckCircle, XCircle, Cpu, DollarSign, MapPin, Target, Receipt, BarChart3, History } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { machinesAPI, collectionsAPI, financeAPI, shopsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import KpiCard from '../../components/KpiCard';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const STATUS_COLORS = { active: 'success', inactive: 'default', maintenance: 'warning', transferred: 'processing' };
const MANUFACTURERS = ['Meteora', 'Novomatic'];
const DEFAULT_CV = { Meteora: 200, Novomatic: 10 };

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

const filterActive = (f) => f.date_from || f.date_to;


export default function MachineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { hasPermission, user } = useAuthStore();
  const canWrite = ['update', 'delete'].some(a => hasPermission('machines', a));
  const canWriteCollections = ['create', 'update', 'delete'].some(a => hasPermission('collections', a));
  const roleName = user?.role?.name;
  const isManager = ['Admin', 'General Manager', 'Operations Manager'].includes(roleName);

  const [filters, setFilters] = useState({ limit: 50, offset: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [deployForm] = Form.useForm();

  const { data: machine, isLoading, isError, error } = useQuery({
    queryKey: ['machine', id],
    queryFn: () => machinesAPI.get(id).then(r => r.data.data),
  });

  const isNovomatic = machine?.manufacturer === 'Novomatic' || location.pathname.startsWith('/machines/novomatic/');
  const backPath = isNovomatic ? '/machines/novomatic' : '/machines/meteora';

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = shopsData?.rows || [];

  const statsParams = useMemo(() => {
    const p = {};
    if (filters.date_from) p.date_from = filters.date_from;
    if (filters.date_to) p.date_to = filters.date_to;
    return p;
  }, [filters.date_from, filters.date_to]);

  const { data: statsData } = useQuery({
    queryKey: ['machine-stats', id, statsParams],
    queryFn: () => machinesAPI.stats(id, statsParams).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: collData, isLoading: collLoading } = useQuery({
    queryKey: ['machine-collections', id, filters],
    queryFn: () => collectionsAPI.list({ machine_id: id, ...filters }).then(r => r.data.data),
    enabled: !!id,
  });
  const collections = collData?.rows || [];

  const { data: expensesData, isLoading: expLoading } = useQuery({
    queryKey: ['machine-expenses', id],
    queryFn: () => financeAPI.listExpenses({ machine_id: id }).then(r => r.data.data || []),
    enabled: !!id && isNovomatic,
  });
  const expenses = expensesData?.rows || [];

  const totals = useMemo(() => collections.reduce((acc, c) => ({
    gross: acc.gross + (c.gross_tzs || 0),
    office: acc.office + (c.office_tzs || 0),
    owner: acc.owner + (c.owner_tzs || 0),
  }), { gross: 0, office: 0, owner: 0 }), [collections]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => machinesAPI.update(id, data),
    onSuccess: () => {
      message.success('Machine updated');
      queryClient.invalidateQueries({ queryKey: ['machine', id] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['machine-stats', id] });
      setEditOpen(false);
      editForm.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error updating machine'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => machinesAPI.remove(id),
    onSuccess: () => { message.success('Machine deleted'); navigate(backPath); },
    onError: (e) => message.error(e.response?.data?.message || 'Error deleting machine'),
  });

  const deployMutation = useMutation({
    mutationFn: ({ id, ...d }) => machinesAPI.deploy(id, d),
    onSuccess: () => {
      message.success('Machine deployed');
      queryClient.invalidateQueries({ queryKey: ['machine', id] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['machine-stats', id] });
      setDeployOpen(false);
      deployForm.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error deploying machine'),
  });

  const removeCollMutation = useMutation({
    mutationFn: (collId) => collectionsAPI.remove(collId),
    onSuccess: () => {
      message.success('Collection deleted');
      queryClient.invalidateQueries({ queryKey: ['machine-collections', id] });
      queryClient.invalidateQueries({ queryKey: ['machine-stats', id] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Delete failed'),
  });

  const reviewCollMutation = useMutation({
    mutationFn: ({ collId, status }) => collectionsAPI.update(collId, { status }),
    onSuccess: () => {
      message.success('Collection reviewed');
      queryClient.invalidateQueries({ queryKey: ['machine-collections', id] });
      queryClient.invalidateQueries({ queryKey: ['machine-stats', id] });
      setViewRecord(null);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Review failed'),
  });

  const locations = useMemo(() => {
    const items = [];
    (machine?.deployments || []).forEach(d => {
      items.push({
        key: `dep-${d.id}`,
        type: 'Deployment',
        typeColor: 'blue',
        location: d.shop?.name || '—',
        openingCount: d.opening_count || 0,
        details: isNovomatic ? '—' : `Load: TZS ${(d.initial_load_tzs || 0).toLocaleString()}`,
        date: d.deployed_at,
        status: d.withdrawn_at ? 'Withdrawn' : 'Active',
      });
    });
    (machine?.exchanges || []).forEach(e => {
      items.push({
        key: `exc-${e.id}`,
        type: 'Transfer',
        typeColor: 'orange',
        location: `${e.fromShop?.name || 'Office'} → ${e.toShop?.name || 'Office'}`,
        details: e.reason || 'Shop relocation',
        date: e.exchanged_at,
        status: 'Completed',
      });
    });
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return items.slice(0, 10);
  }, [machine]);

  const handleExportPDF = () => {
    machinesAPI.exportPDF(id).then(res => {
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `machine-${machine?.slot_code || id}-report.pdf`; a.click();
      URL.revokeObjectURL(url);
    }).catch(e => message.error(e.response?.data?.message || 'PDF export failed'));
  };

  const handleExportExcel = () => {
    financeAPI.exportCollections({ machine_id: id, ...(filters.date_from ? { date_from: filters.date_from } : {}), ...(filters.date_to ? { date_to: filters.date_to } : {}) }).then(res => {
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `collections-${machine?.slot_code || id}-${dayjs().format('YYYY-MM-DD')}.xlsx`; a.click();
    }).catch(e => message.error(e.response?.data?.message || 'Excel export failed'));
  };

  const chartData = useMemo(() => {
    return (statsData?.monthlyRevenue || []).map(m => ({
      month: dayjs(m.month + '-01').format('MMM YYYY'),
      revenue: m.revenue,
    }));
  }, [statsData]);

  const CollChartTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
          <Text className="text-xs text-slate-500 block">{label}</Text>
          <Text className="text-sm font-bold text-brand-dark">{fmt(payload[0].value)}</Text>
        </div>
      );
    }
    return null;
  };

  if (isLoading) return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="animate-pulse space-y-6">
        <div className="h-12 bg-slate-100 rounded-lg w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-64 bg-slate-100 rounded-xl col-span-2" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    </div>
  );

  if (isError || !machine) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)} className="flex items-center gap-1.5 mb-6">Back</Button>
        <Card className="text-center py-12 border-dashed border-2 border-slate-200">
          <Text type={isError ? 'danger' : 'secondary'} className="text-lg font-medium block mb-2">
            {isError ? (error?.response?.data?.message || error?.message || 'Machine not found') : 'Machine not found'}
          </Text>
          <Text type="secondary" className="text-sm">Please check the identifier or view the entire machine catalog.</Text>
        </Card>
      </div>
    );
  }

  const locationCols = [
    {
      title: 'Event', dataIndex: 'type', width: 110,
      render: (v, r) => {
        const colors = { Deployment: 'blue', Transfer: 'orange', Withdrawal: 'red' };
        return <Tag color={colors[r.type] || 'default'} className="!text-[10px] !px-2 !rounded-full border-0 uppercase font-semibold">{v || r.type}</Tag>;
      },
    },
    { title: 'Location / Shop', dataIndex: 'location', width: 300, ellipsis: true, render: v => <span className="font-medium text-slate-700">{v}</span> },
    { title: 'Initial Reading', dataIndex: 'openingCount', width: 120, render: v => v != null ? <span className="font-mono text-sm font-semibold text-slate-700">{v.toLocaleString()}</span> : <span className="text-slate-300">—</span> },
    { title: 'Date', dataIndex: 'date', width: 170, render: v => <span className="text-slate-600 text-sm">{dayjs(v).format('DD MMM YYYY, HH:mm')}</span> },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: v => <Tag color={v === 'Active' ? 'success' : v === 'Withdrawn' ? 'default' : 'processing'} className="!text-[10px] !rounded-full border-0">{v}</Tag>,
    },
  ];

  const collCols = [
    {
      title: 'Date', dataIndex: 'collected_at', width: 110,
      render: v => <span className="font-medium text-slate-600 text-sm">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    { title: 'Prev Count', dataIndex: 'prev_count', width: 90, render: v => <span className="font-mono text-xs">{v?.toLocaleString() || '0'}</span> },
    { title: 'Curr Count', dataIndex: 'curr_count', width: 90, render: v => <span className="font-mono text-xs font-semibold">{v?.toLocaleString() || '0'}</span> },
    { title: 'Diff', dataIndex: 'difference', width: 80, render: v => <span className="font-semibold text-slate-700 text-sm">{v?.toLocaleString() || '0'}</span> },
    { title: 'Gross', dataIndex: 'gross_tzs', width: 100, render: v => <span className="font-semibold text-slate-700">{fmt(v)}</span> },
    { title: 'Office', dataIndex: 'office_tzs', width: 100, render: v => <span className="font-semibold text-brand-dark">{fmt(v)}</span> },
    { title: 'Owner', dataIndex: 'owner_tzs', width: 100, render: v => <span className="font-semibold text-purple-700">{fmt(v)}</span> },
    { title: 'Debt', dataIndex: 'debt_outstanding_tzs', width: 100, render: v => v > 0
      ? <span className="font-semibold text-red-600">{fmt(v)}</span>
      : <span className="text-xs text-slate-300">—</span> },
    {
      title: 'Status', dataIndex: 'status', width: 90,
      render: v => <Tag color={v === 'approved' ? 'green' : v === 'disputed' ? 'red' : 'orange'} className="!text-[10px] !px-2 uppercase">{v}</Tag>,
    },
    { title: 'Approved By', dataIndex: ['approver', 'name'], render: v => v || '—', width: 130 },
    {
      title: 'Actions', key: 'actions', width: 55, align: 'center',
      render: (_, r) => (
        <Button type="text" size="small" icon={<Eye className="w-4 h-4" />} onClick={() => setViewRecord(r)}
          className="!text-slate-500 hover:!text-blue-600" title="View" />
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Top Bar ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <Button type="text" icon={<ArrowLeft size={18} className="text-slate-600" />}
            onClick={() => navigate(backPath)}
            className="hover:bg-slate-100 p-2 h-auto flex items-center justify-center rounded-lg" />
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">{machine.slot_code}</span>
              <Tag color={STATUS_COLORS[machine.status]} className="font-medium px-2.5 py-0.5 rounded-full text-xs uppercase border-0">{machine.status}</Tag>
            </div>
            <Text type="secondary" className="text-xs tracking-wide uppercase font-semibold text-slate-400">Machine Performance Dashboard</Text>
          </div>
        </div>
        <Space size="middle" className="self-end sm:self-auto">
          <Button icon={<Download size={16} />} onClick={handleExportPDF}
            className="h-10 px-4 border-slate-200 rounded-lg flex items-center gap-1.5 font-medium text-slate-600">
            Export PDF
          </Button>
          {machine.status !== 'active' && canWrite && (
            <Button type="primary" icon={<Plus size={16} />}
              onClick={() => { setDeployOpen(true); deployForm.resetFields(); }}
              className="!bg-brand-dark hover:!bg-brand-light border-0 h-10 px-4 rounded-lg flex items-center gap-1.5 font-medium shadow-sm">
              Deploy
            </Button>
          )}
          {canWrite && (
            <Button icon={<Pencil size={16} className="text-slate-600" />}
              onClick={() => {
                editForm.setFieldsValue({
                  slot_code: machine.slot_code, serial_number: machine.serial_number,
                  sticker_no: machine.sticker_no, manufacturer: machine.manufacturer,
                  credit_value_tzs: machine.credit_value_tzs, weekly_target_tzs: machine.weekly_target_tzs,
                });
                setEditOpen(true);
              }}
              className="h-10 px-4 border-slate-200 rounded-lg flex items-center gap-1.5 font-medium text-slate-600">
              Edit
            </Button>
          )}
          {canWrite && (
            <Button danger icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}
              className="h-10 px-4 border-red-100 bg-red-50/50 hover:bg-red-50 rounded-lg flex items-center gap-1.5 font-medium">
              Delete
            </Button>
          )}
        </Space>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────── */}
      {isNovomatic ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="Total Gross" value={statsData?.kpis?.totalGross} formatter={fmt} bgColor="bg-slate-50" iconColor="text-slate-600" />
          <KpiCard title="Net Revenue" value={statsData?.kpis?.netRevenue} formatter={fmt} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
          <KpiCard title="Expenses" value={statsData?.kpis?.totalExpenses} formatter={fmt} bgColor="bg-red-50" iconColor="text-red-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard title="Total Gross" value={statsData?.kpis?.totalGross} formatter={fmt} bgColor="bg-slate-50" iconColor="text-slate-600" />
          <KpiCard title="Net Revenue" value={statsData?.kpis?.netRevenue} formatter={fmt} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
          <KpiCard title="Office Share" value={statsData?.kpis?.totalOffice} formatter={fmt} bgColor="bg-blue-50" iconColor="text-blue-600" />
          <KpiCard title="Expenses" value={statsData?.kpis?.totalExpenses} formatter={fmt} bgColor="bg-red-50" iconColor="text-red-600" />
          <KpiCard
            title={filterActive(filters) ? 'Target Attainment (filtered)' : 'Target Attainment'}
            value={statsData?.targetAttainment ? `${statsData.targetAttainment.rate}%` : '—'}
            bgColor="bg-amber-50"
            iconColor="text-amber-600"
          />
        </div>
      )}
      {filterActive(filters) && (
        <div className="text-xs text-slate-400 italic -mt-3">KPIs scoped to selected date range</div>
      )}

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-100 p-4 bg-white flex flex-wrap items-center gap-3">
        <RangePicker size="small" className="w-56"
          value={filters.date_from && filters.date_to ? [dayjs(filters.date_from), dayjs(filters.date_to)] : null}
          onChange={(d) => {
            if (d && d[0] && d[1]) {
              setFilters(f => ({ ...f, date_from: d[0].toISOString(), date_to: d[1].toISOString(), offset: 0 }));
            } else {
              const { date_from, date_to, ...rest } = filters;
              setFilters({ ...rest, offset: 0 });
            }
          }} />
        {filterActive(filters) && (
          <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => {
            const { date_from, date_to, ...rest } = filters;
            setFilters({ ...rest, offset: 0 });
          }}
            className="flex items-center gap-1 !text-xs hover:!border-brand-dark hover:!text-brand-dark">Clear</Button>
        )}
        <div className="flex-1" />
        <Button size="small" icon={<Download className="w-4 h-4" />} onClick={handleExportExcel}
          className="flex items-center gap-1.5 text-xs">
          Export Excel
        </Button>
      </div>

      {/* ── Chart + Machine Info (2-col) ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-100 rounded-xl" size="small"
          title={<div className="flex items-center gap-2 font-semibold text-slate-700"><BarChart3 size={16} className="text-brand-dark" /> Revenue Trend</div>}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <RechartsTooltip content={<CollChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="revenue" fill="#021559" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <Text type="secondary" className="text-sm">No revenue data available</Text>
              </div>
            </div>
          )}
        </Card>

        <Card className="shadow-sm border-slate-100 rounded-xl" size="small"
          title={<div className="flex items-center gap-2 font-semibold text-slate-700"><Cpu size={16} className="text-blue-500" /> Machine Details</div>}>
          <div className="space-y-3 divide-y divide-slate-50">
            <div className="flex justify-between items-center text-sm pt-1">
              <span className="text-slate-400">Manufacturer</span>
              <Tag color={machine.manufacturer === 'Meteora' ? 'blue' : 'purple'}
                className="m-0 border-0 font-medium rounded-md">{machine.manufacturer}</Tag>
            </div>
            <div className="flex justify-between items-center text-sm py-2.5">
              <span className="text-slate-400">Serial Number</span>
              <span className="font-semibold text-slate-700 font-mono text-xs">{machine.serial_number || '—'}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2.5">
              <span className="text-slate-400">Credit Value</span>
              <span className="font-bold text-slate-700">{machine.credit_value_tzs?.toLocaleString()} TZS</span>
            </div>
            {!isNovomatic && (
              <div className="flex justify-between items-center text-sm py-2.5">
                <span className="text-slate-400">Weekly Target</span>
                <span className="font-bold text-slate-700">TZS {(machine.weekly_target_tzs || 120000).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm py-2.5">
              <span className="text-slate-400">Location</span>
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <MapPin size={14} className="text-slate-400" />
                {machine.currentShop?.name || <Tag className="m-0 border-dashed text-slate-400">In Office</Tag>}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm py-2.5">
              <span className="text-slate-400">Collections</span>
              <span className="font-bold text-slate-700">{statsData?.kpis?.collectionCount || 0}</span>
            </div>
            {!isNovomatic && (
              <div className="flex justify-between items-center text-sm pb-1 pt-2.5">
                <span className="text-slate-400">Debt</span>
                <span className="font-bold text-red-600">{fmt(statsData?.kpis?.outstandingDebt)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Weekly Targets (Meteora only) ────────────────────── */}
      {!isNovomatic && statsData?.weeklyTargets?.length > 0 && (
        <Card className="shadow-sm border-slate-100 rounded-xl" size="small"
          title={<div className="flex items-center gap-2 font-semibold text-slate-700"><Target size={16} className="text-amber-500" /> Weekly Target Performance</div>}
          extra={
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-600 font-semibold">{statsData.targetAttainment.metWeeks}/{statsData.targetAttainment.totalWeeks} weeks met</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-slate-700">{statsData.targetAttainment.rate}% attainment</span>
            </div>
          }>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {statsData.weeklyTargets.map((w, i) => {
              const collected = Number(w.collected_tzs) || 0;
              const target = Number(w.target_tzs) || 120000;
              const pct = target > 0 ? Math.min(Math.round((collected / target) * 100), 200) : 0;
              const met = collected >= target;
              const barColor = met ? 'bg-green-500' : 'bg-red-400';
              return (
                <div key={w.id || i} className="flex items-center gap-3 text-xs">
                  <span className="w-28 text-slate-500 font-medium shrink-0">
                    {dayjs(w.week_start).format('DD MMM')} — {dayjs(w.week_end).format('DD MMM')}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <Tooltip title={`Target: ${fmt(target)} · Collected: ${fmt(collected)}`}>
                    <span className={`w-16 text-right font-semibold shrink-0 ${met ? 'text-green-600' : 'text-red-500'}`}>
                      {pct}%
                    </span>
                  </Tooltip>
                  <span className="w-4 shrink-0">{met ? '✓' : '✗'}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Collections Table (Meteora only) ──────────────────── */}
      {!isNovomatic && (
      <Card className="shadow-sm border-slate-100 rounded-xl" size="small"
        title={<div className="flex items-center gap-2 font-semibold text-slate-700"><DollarSign size={16} className="text-emerald-500" /> Collection History</div>}>
        <Table
          dataSource={collections}
          columns={collCols}
          rowKey="id"
          loading={collLoading}
          size="small"
          className="border border-slate-50 rounded-lg overflow-hidden"
          rowSelection={canWriteCollections ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
          locale={{ emptyText: <Empty description="No collections recorded for this machine." /> }}
          pagination={{
            total: collData?.count,
            pageSize: 50,
            showSizeChanger: false,
            onChange: (p) => setFilters(f => ({ ...f, offset: (p - 1) * 50 })),
          }}
          summary={() => collections.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-slate-50 font-semibold">
                <Table.Summary.Cell index={0} colSpan={4}>TOTAL ({collData?.count || 0} records)</Table.Summary.Cell>
                <Table.Summary.Cell index={4}>{fmt(totals.gross)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5}>{fmt(totals.office)}</Table.Summary.Cell>
                <Table.Summary.Cell index={6}>{fmt(totals.owner)}</Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          ) : null}
        />
      </Card>
      )}

      {/* ── Bottom: Location + Debt/Expenses ─────────────────── */}
      <div className="space-y-6">
        <Card className="shadow-sm border-slate-100 rounded-xl" size="small"
          title={<div className="flex items-center gap-2 font-semibold text-slate-700"><History size={16} className="text-blue-500" /> Location History</div>}>
          {locations.length > 0 ? (
            <Table
              dataSource={locations}
              columns={locationCols}
              rowKey="key"
              size="small"
              pagination={false}
              className="border border-slate-50 rounded-lg overflow-hidden"
              locale={{ emptyText: <Empty description="No location history." /> }}
            />
          ) : (
            <div className="text-center py-6 text-slate-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <Text type="secondary" className="text-sm">No location history recorded</Text>
            </div>
          )}
        </Card>

        {isNovomatic ? (
          <Card className="shadow-sm border-slate-100 rounded-xl" size="small"
            title={<div className="flex items-center gap-2 font-semibold text-slate-700"><Receipt size={16} className="text-red-500" /> Expenses Summary</div>}>
            <div className="text-xs text-slate-400 mb-3">Total: {fmt(statsData?.kpis?.totalExpenses)} | {statsData?.kpis?.expenseCount || 0} record(s)</div>
            <Table
              dataSource={expenses}
              columns={[
                { title: 'Date', dataIndex: 'created_at', width: 100, render: v => dayjs(v).format('DD MMM YYYY') },
                { title: 'Category', key: 'category', width: 110, render: (_, r) => r.category?.name || '—' },
                { title: 'Amount', dataIndex: 'amount', width: 110, render: v => <span className="font-semibold">{fmt(v)}</span> },
                { title: 'Status', dataIndex: 'status', width: 90, render: v => <Tag color={v === 'approved' ? 'green' : v === 'rejected' ? 'red' : 'orange'} className="!text-[10px] uppercase">{v}</Tag> },
                { title: 'Description', dataIndex: 'description', width: 220, ellipsis: true },
                { title: 'Approved By', key: 'approver', width: 120, render: (_, r) => r.approver?.name || (r.status === 'pending' ? <span className="text-slate-300">—</span> : '—') },
              ]}
              rowKey="id"
              size="small"
              pagination={false}
              loading={expLoading}
              locale={{ emptyText: 'No expenses recorded for this machine.' }}
              className="border border-slate-50 rounded-lg overflow-hidden"
            />
          </Card>
        ) : (
          <Card className="shadow-sm border-slate-100 rounded-xl" size="small"
            title={<div className="flex items-center gap-2 font-semibold text-slate-700"><Receipt size={16} className="text-red-500" /> Debt & Expenses</div>}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50/50 border border-red-100 rounded-lg p-4 text-center">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Outstanding Debt</Text>
                  <Text className="text-xl font-bold text-red-600">{fmt(statsData?.kpis?.outstandingDebt)}</Text>
                  <Text className="text-xs text-slate-400 block mt-1">{statsData?.kpis?.debtCount || 0} pending debt(s)</Text>
                </div>
                <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-4 text-center">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Total Expenses</Text>
                  <Text className="text-xl font-bold text-orange-600">{fmt(statsData?.kpis?.totalExpenses)}</Text>
                  <Text className="text-xs text-slate-400 block mt-1">{statsData?.kpis?.expenseCount || 0} expense(s)</Text>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Owner Share</Text>
                    <Text className="text-lg font-bold text-purple-700">{fmt(statsData?.kpis?.totalOwner)}</Text>
                  </div>
                  <div className="text-right">
                    <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Collection Count</Text>
                    <Text className="text-lg font-bold text-slate-700">{statsData?.kpis?.collectionCount || 0}</Text>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-500 shrink-0" />
                  <Text className="text-xs text-amber-700">
                    <strong>{statsData?.targetAttainment?.metWeeks || 0}</strong> of <strong>{statsData?.targetAttainment?.totalWeeks || 0}</strong> weekly targets met ({statsData?.targetAttainment?.rate || 0}% attainment)
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ── View Collection Modal ────────────────────────────── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Collection Details — {viewRecord?.machine?.slot_code}</span>}
        open={!!viewRecord}
        onCancel={() => setViewRecord(null)}
        footer={
          viewRecord ? (
            <Space>
              {canWriteCollections && isManager && viewRecord.status === 'pending' && (
                <>
                  <Button icon={<CheckCircle className="w-4 h-4" />}
                    onClick={() => reviewCollMutation.mutate({ collId: viewRecord.id, status: 'approved' })}
                    className="flex items-center gap-1.5 !bg-green-600 hover:!bg-green-700 border-none text-white">
                    Approve
                  </Button>
                  <Button icon={<XCircle className="w-4 h-4" />}
                    onClick={() => reviewCollMutation.mutate({ collId: viewRecord.id, status: 'disputed' })}
                    className="flex items-center gap-1.5 !bg-red-600 hover:!bg-red-700 border-none text-white">
                    Dispute
                  </Button>
                </>
              )}
              <Button onClick={() => setViewRecord(null)}>Close</Button>
            </Space>
          ) : null
        }
        width={600}
        className="top-8"
      >
        {viewRecord && (
          <div className="space-y-4">
            {viewRecord.meter_image_url ? (
              <div>
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Meter Image</Text>
                <Image src={viewRecord.meter_image_url} className="rounded-lg max-h-60 object-contain border border-slate-200" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 bg-slate-50 rounded-lg text-slate-400 border border-slate-200">
                <Eye className="w-8 h-8 mb-1" />
                <span className="text-xs">No meter image</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              <div><Text className="text-xs font-semibold text-slate-500 block">Date</Text><span>{dayjs(viewRecord.collected_at).format('DD MMM YYYY HH:mm')}</span></div>
              <div><Text className="text-xs font-semibold text-slate-500 block">Collector</Text><span>{viewRecord.collector?.name || 'Manual Entry'}</span></div>
              <div><Text className="text-xs font-semibold text-slate-500 block">Shop</Text><span>{viewRecord.shop?.name || '—'}</span></div>
              <div><Text className="text-xs font-semibold text-slate-500 block">Credit Value</Text><span>TZS {viewRecord.machine?.credit_value_tzs?.toLocaleString() || viewRecord.credit_value_tzs?.toLocaleString()}</span></div>
              <div><Text className="text-xs font-semibold text-slate-500 block">Previous Count</Text><span className="font-mono">{viewRecord.prev_count?.toLocaleString()}</span></div>
              <div><Text className="text-xs font-semibold text-slate-500 block">Current Count</Text><span className="font-mono font-bold">{viewRecord.curr_count?.toLocaleString()}</span></div>
              <div><Text className="text-xs font-semibold text-slate-500 block">Difference</Text><span>{viewRecord.difference?.toLocaleString()}</span></div>
              <div><Text className="text-xs font-semibold text-slate-500 block">Status</Text><Tag color={viewRecord.status === 'approved' ? 'green' : viewRecord.status === 'disputed' ? 'red' : 'orange'} className="!text-[10px]">{viewRecord.status}</Tag></div>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Financial Breakdown</Text>
              <div className="grid grid-cols-3 gap-3">
                <Card size="small" className="text-center border border-slate-100 bg-slate-50"><Text className="text-xs text-slate-500 block">Gross</Text><Text className="text-base font-bold text-slate-800">{fmt(viewRecord.gross_tzs)}</Text></Card>
                <Card size="small" className="text-center border border-slate-100 bg-blue-50/40"><Text className="text-xs text-slate-500 block">Office</Text><Text className="text-base font-bold text-brand-dark">{fmt(viewRecord.office_tzs)}</Text></Card>
                <Card size="small" className="text-center border border-slate-100 bg-purple-50/40"><Text className="text-xs text-slate-500 block">Owner</Text><Text className="text-base font-bold text-purple-700">{fmt(viewRecord.owner_tzs)}</Text></Card>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit Collection Modal ────────────────────────────── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Edit Collection — {editRecord?.machine?.slot_code || machine.slot_code}</span>}
        open={!!editRecord}
        onCancel={() => setEditRecord(null)}
        onOk={() => {
          if (!editRecord) return;
          collectionsAPI.update(editRecord.id, {
            gross_tzs: editRecord.gross_tzs,
            office_tzs: editRecord.office_tzs,
            owner_tzs: editRecord.owner_tzs,
            status: editRecord.status,
          }).then(() => {
            message.success('Collection updated');
            setEditRecord(null);
            queryClient.invalidateQueries({ queryKey: ['machine-collections', id] });
            queryClient.invalidateQueries({ queryKey: ['machine-stats', id] });
          }).catch(e => message.error(e.response?.data?.message || 'Update failed'));
        }}
        okText="Save"
        width={480}
        className="top-8"
      >
        {editRecord && (
          <div className="space-y-3 mt-4">
            <div>
              <Text className="text-xs font-semibold text-slate-500 block mb-1">Status</Text>
              <Select value={editRecord.status} className="w-full" onChange={(v) => setEditRecord({ ...editRecord, status: v })}>
                <Option value="pending">Pending</Option>
                <Option value="approved">Approved</Option>
                <Option value="disputed">Disputed</Option>
              </Select>
            </div>
            <div>
              <Text className="text-xs font-semibold text-slate-500 block mb-1">Gross (TZS)</Text>
              <Input type="number" value={editRecord.gross_tzs} onChange={(e) => setEditRecord({ ...editRecord, gross_tzs: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <Text className="text-xs font-semibold text-slate-500 block mb-1">Office Share (TZS)</Text>
              <Input type="number" value={editRecord.office_tzs} onChange={(e) => setEditRecord({ ...editRecord, office_tzs: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <Text className="text-xs font-semibold text-slate-500 block mb-1">Owner Share (TZS)</Text>
              <Input type="number" value={editRecord.owner_tzs} onChange={(e) => setEditRecord({ ...editRecord, owner_tzs: Number(e.target.value) })} className="w-full" />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit Specs Modal ─────────────────────────────────── */}
      <Modal
        title={<div className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">Modify Machine Specifications</div>}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save Changes"
        okButtonProps={{ className: "!bg-brand-dark rounded-lg" }}
        cancelButtonProps={{ className: "rounded-lg" }}
        centered
      >
        <Form form={editForm} layout="vertical" onFinish={(v) => updateMutation.mutate({ id: machine.id, data: v })} className="mt-4 space-y-1">
          <Form.Item name="slot_code" label={<span className="text-slate-600 font-medium text-xs">Slot Identifier Code</span>} rules={[{ required: true, message: 'Please enter a valid code' }]}><Input className="h-9 rounded-lg" /></Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="serial_number" label={<span className="text-slate-600 font-medium text-xs">Serial Number</span>}><Input className="h-9 rounded-lg font-mono" /></Form.Item>
            <Form.Item name="sticker_no" label={<span className="text-slate-600 font-medium text-xs">Sticker Reference</span>}><Input className="h-9 rounded-lg font-mono" /></Form.Item>
          </div>
          <Form.Item name="manufacturer" label={<span className="text-slate-600 font-medium text-xs">Manufacturer</span>} rules={[{ required: true }]}>
            <Select className="h-9" popupClassName="rounded-lg" onChange={(v) => editForm.setFieldValue('credit_value_tzs', DEFAULT_CV[v])}>
              {MANUFACTURERS.map(m => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="credit_value_tzs" label={<span className="text-slate-600 font-medium text-xs">Credit Value (TZS)</span>} rules={[{ required: true }]}>
              <InputNumber min={1} className="w-full rounded-lg h-9" />
            </Form.Item>
            {!isNovomatic && (
              <Form.Item name="weekly_target_tzs" label={<span className="text-slate-600 font-medium text-xs">Weekly Target (TZS)</span>} tooltip="Defaults to 120,000 TZS">
                <InputNumber min={0} placeholder="120,000" className="w-full rounded-lg h-9" />
              </Form.Item>
            )}
          </div>
        </Form>
      </Modal>

      {/* ── Delete Confirmation Modal ────────────────────────── */}
      <Modal
        title={<span className="text-base font-bold text-red-600">Delete Permanently</span>}
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={() => deleteMutation.mutate(machine.id)}
        confirmLoading={deleteMutation.isPending}
        okText="Confirm Delete"
        okButtonProps={{ danger: true, className: "rounded-lg" }}
        cancelButtonProps={{ className: "rounded-lg" }}
        centered
      >
        <p className="text-slate-600 text-sm mt-3 leading-relaxed">
          Are you sure you want to discard machine entry <strong className="text-slate-800">{machine.slot_code}</strong>? All historical collections associated with this profile will become decoupled. This action is irreversible.
        </p>
      </Modal>

      {/* ── Deploy Modal ─────────────────────────────────────── */}
      <Modal
        title={<div className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">Deploy Machine: {machine.slot_code}</div>}
        open={deployOpen}
        onCancel={() => setDeployOpen(false)}
        onOk={() => deployForm.submit()}
        confirmLoading={deployMutation.isPending}
        okText="Initialize Deployment"
        okButtonProps={{ className: "!bg-brand-dark rounded-lg" }}
        cancelButtonProps={{ className: "rounded-lg" }}
        centered
      >
        <Form form={deployForm} layout="vertical" onFinish={(v) => deployMutation.mutate({ id: machine.id, ...v })} className="mt-4 space-y-1">
          <Form.Item name="shop_id" label={<span className="text-slate-600 font-medium text-xs">Assign Target Shop Location</span>} rules={[{ required: true, message: 'Please select a deployment shop destination' }]}>
            <Select showSearch optionFilterProp="children" className="h-9" popupClassName="rounded-lg">
              {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="opening_count" label={<span className="text-slate-600 font-medium text-xs">Opening {isNovomatic ? 'Credits' : 'Counter'} Reading</span>} rules={[{ required: true, message: 'Please enter the initial meter reading' }]}>
            <InputNumber className="w-full rounded-lg h-9 font-mono" />
          </Form.Item>
          {!isNovomatic && (
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 my-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-2">Token Initial Liquidity Allocation</span>
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="machine_load_tzs" label={<span className="text-slate-500 text-xs">Internal Hopper (TZS)</span>} initialValue={30000} className="!mb-0">
                  <InputNumber min={0} className="w-full rounded-lg h-9" />
                </Form.Item>
                <Form.Item name="tray_tzs" label={<span className="text-slate-500 text-xs">Player Tray (TZS)</span>} initialValue={60000} className="!mb-0">
                  <InputNumber min={0} className="w-full rounded-lg h-9" />
                </Form.Item>
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5 mb-0 italic">Standard aggregate initial provision: 90,000 TZS total.</p>
            </div>
          )}
          {!isNovomatic && (
            <Form.Item name="tokens_paid" valuePropName="checked" initialValue={true}>
              <Checkbox>Tokens paid upfront (uncheck to create token debt)</Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
