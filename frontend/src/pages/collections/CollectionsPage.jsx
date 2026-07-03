import { useState, useMemo, useEffect } from 'react';
import { Table, Tag, Button, Space, DatePicker, Select, Input, InputNumber, Typography, Empty, Modal, App, Image, List, Segmented, Upload } from 'antd';
import { Download, Plus, Eye, Edit3, Trash2, Camera, Search, X, CheckCircle, XCircle, FileDown, TrendingUp, ShieldCheck, ClipboardList, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsAPI, financeAPI, shopsAPI, usersAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import KpiCard from '../../components/KpiCard';
import ActionMenu from '../../components/ActionMenu';
import MobileCard from '../../components/MobileCard';
import CreateAssignmentModal from './CreateAssignmentModal';
import RecordCollectionModal from './RecordCollectionModal';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function CollectionsPage() {
  const [filters, setFilters] = useState({ limit: 50, offset: 0, manufacturer: 'Novomatic' });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const { hasPermission } = useAuthStore();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const canWrite = ['create', 'update', 'delete'].some(a => hasPermission('collections', a));
  const roleName = useAuthStore((s) => s.user?.role?.name);
  const canAssign = canWrite && ['Admin', 'General Manager', 'Operations Manager'].includes(roleName);
  const canApprove = ['Admin', 'General Manager', 'Operations Manager', 'Supervisor'].includes(roleName);
  const userId = useAuthStore((s) => s.user?.id);

  // Edit modal local state
  const [editStatus, setEditStatus] = useState('pending');
  const [editDate, setEditDate] = useState(null);
  const [editOpening, setEditOpening] = useState(0);
  const [editClosing, setEditClosing] = useState(0);
  const [editGross, setEditGross] = useState(0);
  const [editOffice, setEditOffice] = useState(0);
  const [editOwner, setEditOwner] = useState(0);
  const [editCreditValue, setEditCreditValue] = useState(10);
  const [editFileList, setEditFileList] = useState([]);
  const [editRemoveImage, setEditRemoveImage] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['collections', filters],
    queryFn: () => collectionsAPI.list(filters).then(r => r.data.data),
  });

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const { data: collectorsData } = useQuery({ queryKey: ['collectors-list'], queryFn: () => usersAPI.list({ role: 'Collector' }).then(r => r.data.data) });
  const { data: cashiersData } = useQuery({ queryKey: ['cashiers-list'], queryFn: () => usersAPI.list({ role: 'Cashier' }).then(r => r.data.data) });
  const shops = shopsData?.rows || shopsData || [];
  const collectors = collectorsData?.rows || collectorsData || [];
  const cashiers = cashiersData?.rows || cashiersData || [];

  const rows = data?.rows || [];
  const isNovomaticFilter = filters.manufacturer === 'Novomatic';

  useEffect(() => {
    if (roleName === 'Cashier') {
      setFilters(f => ({ ...f, manufacturer: 'Novomatic', date: dayjs().subtract(1, 'day').format('YYYY-MM-DD') }));
    }
  }, [roleName]);
  useEffect(() => {
    if (isNovomaticFilter && !filters.date) {
      setFilters(f => ({ ...f, date: dayjs().subtract(1, 'day').format('YYYY-MM-DD') }));
    }
  }, [isNovomaticFilter]);
  const approvedRows = rows.filter(c => c.status === 'approved');
  const totals = rows.reduce((acc, c) => ({
    gross: acc.gross + (c.status === 'approved' ? (c.gross_tzs || 0) : 0),
    office: acc.office + (c.status === 'approved' ? (c.office_tzs || 0) : 0),
    owner: acc.owner + (c.status === 'approved' ? (c.owner_tzs || 0) : 0),
  }), { gross: 0, office: 0, owner: 0 });

  // Initialize edit form when opening a record for editing
  useEffect(() => {
    if (editRecord) {
      const nr = editRecord.novomaticReading || {};
      const cv = editRecord.credit_value_tzs || editRecord.machine?.credit_value_tzs || 10;
      setEditStatus(editRecord.status);
      setEditDate(editRecord.collection_date || null);
      setEditOpening(nr.opening_credits ?? editRecord.prev_count ?? 0);
      setEditClosing(nr.closing_credits ?? editRecord.curr_count ?? 0);
      setEditGross(editRecord.gross_tzs || 0);
      setEditOffice(editRecord.office_tzs || 0);
      setEditOwner(editRecord.owner_tzs || 0);
      setEditCreditValue(cv);
      setEditFileList([]);
      setEditRemoveImage(false);
    }
  }, [editRecord]);

  // Auto-recalculate gross when meter readings change (Novomatic, read-only display)
  useEffect(() => {
    if (editRecord?.machine?.manufacturer === 'Novomatic') {
      setEditGross(Math.max(0, (editClosing - editOpening) * editCreditValue));
    }
  }, [editClosing, editOpening, editCreditValue, editRecord]);

  const handleEditClose = () => {
    setEditRecord(null);
    setEditStatus('pending');
    setEditDate(null);
    setEditOpening(0);
    setEditClosing(0);
    setEditGross(0);
    setEditOffice(0);
    setEditOwner(0);
    setEditCreditValue(10);
    setEditFileList([]);
    setEditRemoveImage(false);
  };

  const handleEditSave = async () => {
    if (!editRecord) return;
    try {
      const isNovomatic = editRecord.machine?.manufacturer === 'Novomatic';
      const hasNewImage = editFileList[0]?.originFileObj;

      const payload = {
        status: editStatus,
        gross_tzs: editGross,
      };
      if (editDate) payload.collection_date = editDate;

      if (isNovomatic) {
        payload.novomatic_data = JSON.stringify({
          opening_credits: editOpening,
          closing_credits: editClosing,
        });
      } else {
        payload.office_tzs = editOffice;
        payload.owner_tzs = editOwner;
      }

      if (editRemoveImage && !hasNewImage) {
        payload.meter_image_url = '';
      }

      if (hasNewImage) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
        fd.append('meter_image', editFileList[0].originFileObj);
        await collectionsAPI.update(editRecord.id, fd);
      } else {
        await collectionsAPI.update(editRecord.id, payload);
      }

      message.success('Collection updated');
      handleEditClose();
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['machine-stats'] });
    } catch (e) {
      message.error(e.response?.data?.message || 'Update failed');
    }
  };

  const removeMutation = useMutation({
    mutationFn: (id) => collectionsAPI.remove(id),
    onSuccess: () => {
      message.success('Collection deleted');
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['machine-stats'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Delete failed'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }) => collectionsAPI.update(id, { status }),
    onSuccess: () => {
      message.success('Collection reviewed');
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['machine-stats'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Review failed'),
  });

  const handleExport = async () => {
    const res = await financeAPI.exportCollections();
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a'); a.href = url;
    a.download = `collections-${dayjs().format('YYYY-MM-DD')}.xlsx`; a.click();
  };

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const headers = isNovomaticFilter
      ? ['Date', 'Slot Code', 'Manufacturer', 'Shop', 'Cashier', 'Opening', 'Closing', 'Total Credits', 'Gross TZS', 'Status']
      : ['Date', 'Slot Code', 'Manufacturer', 'Gross', 'Office', 'Owner', 'Status'];
    const csv = [
      headers.join(','),
      ...selected.map(r => {
        const date = r.collection_date || dayjs(r.collected_at).format('YYYY-MM-DD');
        return isNovomaticFilter
          ? [date, r.machine?.slot_code, r.machine?.manufacturer,
             r.shop?.name || '', r.collector?.name || '',
             r.novomaticReading?.opening_credits || 0, r.novomaticReading?.closing_credits || 0,
             r.novomaticReading?.total_credits || 0,
             r.gross_tzs, r.status].join(',')
          : [date, r.machine?.slot_code, r.machine?.manufacturer,
             r.gross_tzs, r.office_tzs, r.owner_tzs, r.status].join(',');
      }),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `collections-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const handleAction = (key, r) => {
    if (key === 'view') setViewRecord(r);
    if (key === 'edit') setEditRecord(r);
    if (key === 'delete') {
      Modal.confirm({
        title: 'Delete Collection',
        content: `Delete collection for ${r.machine?.slot_code}?`,
        okText: 'Delete', okType: 'danger',
        onOk: () => removeMutation.mutate(r.id),
      });
    }
  };

  const actionItems = (r) => {
    const items = [
      { key: 'view', icon: <Eye className="w-4 h-4" />, label: 'View' },
    ];
    const isOwnPending = r.collector_id === userId && r.status === 'pending';
    const canEditRow = canWrite || (roleName === 'Cashier' && isOwnPending);
    const canDeleteRow = (canWrite && ['Admin', 'General Manager', 'Operations Manager'].includes(roleName)) || (roleName === 'Cashier' && isOwnPending);
    if (canEditRow) items.push({ key: 'edit', icon: <Edit3 className="w-4 h-4" />, label: 'Edit' });
    if (canDeleteRow) {
      items.push({ type: 'divider' });
      items.push({ key: 'delete', icon: <Trash2 className="w-4 h-4" />, label: 'Delete', danger: true });
    }
    return items;
  };

  const cols = useMemo(() => {
    if (isNovomaticFilter) {
      return [
        {
          title: 'Date', key: 'collection_date', width: 100,
          render: (_, r) => <span className="text-xs">{r.collection_date ? dayjs(r.collection_date).format('DD MMM') : dayjs(r.collected_at).format('DD MMM')}</span>,
        },
        {
          title: 'Slot Code', dataIndex: ['machine', 'slot_code'],
          render: (v, r) => (
            <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => setViewRecord(r)}>
              {v || '—'}
            </Button>
          ),
          width: 120,
        },
        { title: 'Manufacturer', dataIndex: ['machine', 'manufacturer'], render: v => <Tag className="!text-[10px] !px-2">{v || '—'}</Tag>, width: 100 },
        { title: 'Shop', key: 'shop', render: (_, r) => <span className="text-xs">{r.shop?.name || '—'}</span>, width: 150 },
        {
          title: 'Cashier', key: 'cashier', width: 140,
          render: (_, r) => <span className="text-xs">{r.collector?.name || '—'}</span>,
        },
        {
          title: 'Opening Meter', key: 'opening_credits', width: 110,
          render: (_, r) => <span className="font-mono text-xs">{r.novomaticReading?.opening_credits?.toLocaleString() || '0'}</span>,
        },
        {
          title: 'Closing Meter', key: 'closing_credits', width: 110,
          render: (_, r) => <span className="font-mono text-xs font-semibold">{r.novomaticReading?.closing_credits?.toLocaleString() || '0'}</span>,
        },
        {
          title: 'Total Credits', key: 'total_credits', width: 100,
          render: (_, r) => <span className="font-semibold text-slate-700">{(r.novomaticReading?.total_credits || r.difference || 0).toLocaleString()}</span>,
        },
        { title: 'Amount', dataIndex: 'gross_tzs', render: v => <span className="font-semibold text-slate-700">{fmt(v)}</span>, width: 110 },
        {
          title: 'Status', dataIndex: 'status',
          render: v => <Tag color={v === 'approved' ? 'green' : v === 'disputed' ? 'red' : 'orange'} className="!text-[10px] !px-2 uppercase">{v}</Tag>,
          width: 90,
        },
        { title: 'Approved By', dataIndex: ['approver', 'name'], render: v => v || '—', width: 130 },
        {
          title: 'Actions', key: 'actions', width: 55, align: 'center',
          render: (_, r) => <ActionMenu record={r} actionItems={actionItems} onAction={handleAction} />,
        },
      ];
    }
    return [
      {
        title: 'Slot Code', dataIndex: ['machine', 'slot_code'],
        render: (v, r) => (
          <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => setViewRecord(r)}>
            {v || '—'}
          </Button>
        ),
        width: 120,
      },
      { title: 'Manufacturer', dataIndex: ['machine', 'manufacturer'], render: v => <Tag className="!text-[10px] !px-2">{v || '—'}</Tag>, responsive: ['md'], width: 110 },
      { title: 'Gross', dataIndex: 'gross_tzs', render: v => <span className="font-semibold text-slate-700">{fmt(v)}</span>, responsive: ['sm'], width: 110 },
      { title: 'Office', dataIndex: 'office_tzs', render: v => <span className="font-semibold text-brand-dark">{fmt(v)}</span>, responsive: ['md'], width: 110 },
      { title: 'Owner', dataIndex: 'owner_tzs', render: v => <span className="font-semibold text-purple-700">{fmt(v)}</span>, responsive: ['lg'], width: 110 },
      { title: 'Debt', dataIndex: 'debt_outstanding_tzs', render: v => v > 0
        ? <span className="font-semibold text-red-600">{fmt(v)}</span>
        : <span className="text-xs text-slate-300">—</span>, width: 100 },
      {
        title: 'Status', dataIndex: 'status',
        render: v => <Tag color={v === 'approved' ? 'green' : v === 'disputed' ? 'red' : 'orange'} className="!text-[10px] !px-2 uppercase">{v}</Tag>,
        width: 90,
      },
      { title: 'Approved By', dataIndex: ['approver', 'name'], render: v => v || '—', width: 130 },
      {
        title: 'Actions', key: 'actions', width: 55, align: 'center',
        render: (_, r) => <ActionMenu record={r} actionItems={actionItems} onAction={handleAction} />,
      },
    ];
  }, [isNovomaticFilter, actionItems, handleAction]);

  const mobileFields = isNovomaticFilter
    ? [
        { key: 'date', label: 'Date', render: (_, r) => r.collection_date ? dayjs(r.collection_date).format('DD MMM') : dayjs(r.collected_at).format('DD MMM') },
        { key: 'slot_code', dataIndex: 'machine.slot_code' },
        { key: 'shop', label: 'Shop', render: (_, r) => r.shop?.name || '—' },
        { key: 'cashier', label: 'Cashier', render: (_, r) => r.collector?.name || '—' },
        { key: 'credits', label: 'Credits', render: (_, r) => (r.novomaticReading?.total_credits || 0).toLocaleString() },
        { key: 'amount', label: 'Gross', render: (_, r) => fmt(r.gross_tzs) },
      ]
    : [
        { key: 'slot_code', dataIndex: 'machine.slot_code' },
        { key: 'gross', label: 'Gross', render: (_, r) => fmt(r.gross_tzs) },
        { key: 'office', label: 'Office', render: (_, r) => fmt(r.office_tzs) },
      ];

  return (
    <div>
      {/* Mode Toggle */}
      <div className="mb-4 flex items-center gap-2">
        {roleName === 'Cashier' ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Novomatic</span>
            <span className="text-slate-400">— Cashier restricted</span>
          </div>
        ) : (
          <Segmented
            value={filters.manufacturer}
            onChange={(v) => {
              setFilters(f => ({
                ...f,
                manufacturer: v,
                date: v === 'Novomatic' ? dayjs().format('YYYY-MM-DD') : undefined,
                offset: 0,
              }));
            }}
            options={['Novomatic', 'Meteora']}
            size="small"
          />
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">{filters.manufacturer} Collections</h4>
          <span className="text-xs text-slate-500">{data?.count || 0} total</span>
        </div>
        <Space>
          {isNovomaticFilter && (
            <Button icon={<ClipboardList className="w-4 h-4" />} onClick={() => setRecordModalOpen(true)}
              className="!bg-brand-dark hover:!bg-brand-light hover:!text-white border-none shadow-sm flex items-center gap-1.5 text-white">
              Record Collection
            </Button>
          )}
          {canAssign && !isNovomaticFilter && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateModalOpen(true)}
              className="!bg-brand-dark hover:!bg-brand-light hover:!text-white border-none shadow-sm flex items-center gap-1.5 text-white">
              Create Assignment
            </Button>
          )}
        </Space>
      </div>

      {isNovomaticFilter && filters.date && (
        <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-dark" />
          <span className="font-semibold text-brand-dark text-sm">{dayjs(filters.date).format('dddd, DD MMM YYYY')}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 gap-4 mb-6 ${isNovomaticFilter ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {isNovomaticFilter ? (
          <>
            <KpiCard title="Total Collections" value={approvedRows.length} icon={ClipboardList} bgColor="bg-slate-50" iconColor="text-slate-600" />
            <KpiCard title="Total Amount" value={totals.gross} icon={Download} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
          </>
        ) : (
          <>
            <KpiCard title="Total Gross" value={totals.gross} icon={Download} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
            <KpiCard title="Office Share" value={totals.office} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
            <KpiCard title="Owner Share" value={totals.owner} icon={TrendingUp} bgColor="bg-purple-50" iconColor="text-purple-600" formatter={fmt} />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <DatePicker size="small" className="w-36"
            value={filters.date ? dayjs(filters.date) : null}
            onChange={(d) => {
              if (d) {
                setFilters(f => ({ ...f, date: d.format('YYYY-MM-DD') }));
              } else {
                const { date, ...rest } = filters;
                setFilters(rest);
              }
            }} />
          
          <Select size="small" placeholder="Shop" allowClear className="w-40"
            onChange={(v) => setFilters(f => ({ ...f, shop_id: v, offset: 0 }))}>
            {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
          </Select>
          {isNovomaticFilter ? (
            <Select size="small" placeholder="Cashier" allowClear className="w-40"
              onChange={(v) => setFilters(f => ({ ...f, collector_id: v, offset: 0 }))}>
              {cashiers.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          ) : (
            <Select size="small" placeholder="Collector" allowClear className="w-40"
              onChange={(v) => setFilters(f => ({ ...f, collector_id: v, offset: 0 }))}>
              {collectors.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          )}
          <Select size="small" placeholder="Status" allowClear className="w-32"
            onChange={(v) => setFilters(f => ({ ...f, status: v, offset: 0 }))}>
            {['pending', 'approved', 'disputed'].map(s => <Option key={s} value={s}>{s}</Option>)}
          </Select>
          <Input.Search size="small" placeholder="Search slot code" allowClear className="w-44"
            onSearch={(v) => setFilters(f => ({ ...f, search: v || undefined, offset: 0 }))} />
          {(filters.shop_id || filters.collector_id || filters.status || filters.search || filters.date) && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => setFilters(f => ({ limit: 50, offset: 0, manufacturer: f.manufacturer }))}
              className="flex items-center gap-1 !text-xs hover:!border-brand-dark hover:!text-brand-dark">
              Clear
            </Button>
          )}
          <Button size="small" icon={<FileDown className="w-4 h-4" />} onClick={handleExport}
            className="group flex items-center gap-1.5 hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
            Export
          </Button>
        </Space>
      </div>

      {/* Bulk Action Bar */}
      {selectedRowKeys.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
          <span className="text-sm font-medium text-brand-dark">{selectedRowKeys.length} selected</span>
          <Space>
            <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />}
              onClick={handleExportSelected}
              className="group flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
              Export Selected
            </Button>
            <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setSelectedRowKeys([])}
              className="flex items-center gap-1 !text-xs">
              Deselect
            </Button>
          </Space>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table
          dataSource={rows}
          columns={cols}
          rowKey="id"
          loading={isLoading}
          size="middle"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          locale={{ emptyText: error ? <span className="text-red-500">Failed to load collections: {error?.message}</span> : <Empty description="No collections found" /> }}
          pagination={{
            total: data?.count,
            pageSize: 50,
            showSizeChanger: false,
            onChange: (p) => setFilters(f => ({ ...f, offset: (p - 1) * 50 })),
          }}
          summary={() => rows.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-slate-50 font-semibold">
                {isNovomaticFilter ? (
                  <>
                    <Table.Summary.Cell index={0} colSpan={8}>TOTAL ({data?.count || 0} records)</Table.Summary.Cell>
                    <Table.Summary.Cell index={8}>{fmt(totals.gross)}</Table.Summary.Cell>
                  </>
                ) : (
                  <>
                    <Table.Summary.Cell index={0} colSpan={2}>TOTAL ({data?.count || 0} records)</Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>{fmt(totals.gross)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>{fmt(totals.office)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>{fmt(totals.owner)}</Table.Summary.Cell>
                  </>
                )}
              </Table.Summary.Row>
            </Table.Summary>
          ) : null}
        />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <Empty description="No collections found" />
        ) : (
          <List
            dataSource={rows}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={mobileFields}
                onClick={() => setViewRecord(r)}
                statusColor={r.status === 'approved' ? 'green' : r.status === 'disputed' ? 'red' : 'orange'}
              />
            )}
          />
        )}
      </div>

      {/* View Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Collection Details — {viewRecord?.machine?.slot_code}</span>}
        open={!!viewRecord}
        onCancel={() => setViewRecord(null)}
        footer={
          viewRecord ? (
            <Space>
              {canApprove && viewRecord.status === 'pending' && (
                <>
                  <Button icon={<CheckCircle className="w-4 h-4" />}
                    onClick={() => {
                      reviewMutation.mutate({ id: viewRecord.id, status: 'approved' });
                      setViewRecord(null);
                    }}
                    className="flex items-center gap-1.5 !bg-green-600 hover:!bg-green-700 border-none text-white">
                    Approve
                  </Button>
                  <Button icon={<XCircle className="w-4 h-4" />}
                    onClick={() => {
                      reviewMutation.mutate({ id: viewRecord.id, status: 'disputed' });
                      setViewRecord(null);
                    }}
                    className="flex items-center gap-1.5 !bg-red-600 hover:!bg-red-700 border-none text-white">
                    Dispute
                  </Button>
                </>
              )}
              <Button onClick={() => setViewRecord(null)}>Close</Button>
            </Space>
          ) : null
        }
        width={640}
        className="top-8"
      >
        {viewRecord && (
          <div className="space-y-5 mt-4">
            {viewRecord.meter_image_url ? (
              <div>
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Meter Image</Text>
                <Image src={viewRecord.meter_image_url} className="rounded-lg max-h-64 object-contain border border-slate-200" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 bg-slate-50 rounded-lg text-slate-400 border border-slate-200">
                <Camera className="w-10 h-10 mb-1" />
                <span className="text-xs">No meter image</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><span className="text-xs font-semibold text-slate-500 block">Collection Date</span><span>{viewRecord.collection_date ? dayjs(viewRecord.collection_date).format('DD MMM YYYY') : dayjs(viewRecord.collected_at).format('DD MMM YYYY')}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Slot Code</span><span className="font-medium">{viewRecord.machine?.slot_code}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Manufacturer</span><Tag className="!text-[10px]">{viewRecord.machine?.manufacturer}</Tag></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Credit Value</span><span>TZS {viewRecord.machine?.credit_value_tzs?.toLocaleString()}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">{viewRecord.machine?.manufacturer === 'Novomatic' ? 'Cashier' : 'Collector'}</span><span>{viewRecord.collector?.name || '—'}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Shop</span><span>{viewRecord.shop?.name || '—'}</span></div>
              {viewRecord.machine?.manufacturer === 'Novomatic' && viewRecord.novomaticReading ? (
                <>
                  <div><span className="text-xs font-semibold text-slate-500 block">Opening Meter (credits)</span><span className="font-mono">{viewRecord.novomaticReading.opening_credits?.toLocaleString()}</span></div>
                  <div><span className="text-xs font-semibold text-slate-500 block">Closing Meter (credits)</span><span className="font-mono font-bold">{viewRecord.novomaticReading.closing_credits?.toLocaleString()}</span></div>
                  <div><span className="text-xs font-semibold text-slate-500 block">Total Credits</span><span className="font-mono font-bold">{viewRecord.novomaticReading.total_credits?.toLocaleString()}</span></div>
                </>
              ) : (
                <>
                  <div><span className="text-xs font-semibold text-slate-500 block">Previous Count</span><span className="font-mono">{viewRecord.prev_count?.toLocaleString()}</span></div>
                  <div><span className="text-xs font-semibold text-slate-500 block">Current Count</span><span className="font-mono font-bold">{viewRecord.curr_count?.toLocaleString()}</span></div>
                  <div><span className="text-xs font-semibold text-slate-500 block">Difference</span><span className="font-mono">{viewRecord.difference?.toLocaleString()}</span></div>
                </>
              )}
              <div><span className="text-xs font-semibold text-slate-500 block">Status</span><Tag color={viewRecord.status === 'approved' ? 'green' : 'orange'}>{viewRecord.status}</Tag></div>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Financial Breakdown</Text>
              {isNovomaticFilter ? (
                <div className="grid gap-4 grid-cols-1">
                  <KpiCard title="Gross" value={viewRecord.gross_tzs} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-3">
                  <KpiCard title="Gross" value={viewRecord.gross_tzs} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
                  <KpiCard title="Office" value={viewRecord.office_tzs} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
                  <KpiCard title="Owner" value={viewRecord.owner_tzs} bgColor="bg-purple-50" iconColor="text-purple-600" formatter={fmt} />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Edit Collection — {editRecord?.machine?.slot_code}</span>}
        open={!!editRecord}
        onCancel={handleEditClose}
        onOk={handleEditSave}
        okText="Save"
        width={520}
        className="top-8"
        okButtonProps={{ className: '!bg-brand-dark rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }}
      >
        {editRecord && (
          <div className="space-y-4 mt-4">
            {/* Status */}
            {canApprove ? (
              <div>
                <Text className="text-xs font-semibold text-slate-500 block mb-1">Status</Text>
                <Select value={editStatus} className="w-full" onChange={setEditStatus}>
                  <Option value="pending">Pending</Option>
                  <Option value="approved">Approved</Option>
                  <Option value="disputed">Disputed</Option>
                </Select>
              </div>
            ) : (
              <div>
                <Text className="text-xs font-semibold text-slate-500 block mb-1">Status</Text>
                <Tag color={editStatus === 'approved' ? 'green' : editStatus === 'disputed' ? 'red' : 'orange'} className="!text-[10px] uppercase">{editStatus}</Tag>
              </div>
            )}

            {/* Collection Date — editable by Admin/GM/Ops only */}
            {['Admin', 'General Manager', 'Operations Manager'].includes(roleName) && (
              <div>
                <Text className="text-xs font-semibold text-slate-500 block mb-1">Collection Date</Text>
                <DatePicker value={editDate ? dayjs(editDate) : null} className="w-full"
                  onChange={(d) => setEditDate(d ? d.format('YYYY-MM-DD') : null)} />
              </div>
            )}

            {editRecord.machine?.manufacturer === 'Novomatic' ? (
              <>
                {/* Credit Value (read-only) */}
                <div>
                  <Text className="text-xs font-semibold text-slate-500 block mb-1">Credit Value</Text>
                  <span className="font-semibold text-slate-700">TZS {editCreditValue.toLocaleString()}</span>
                </div>

                {/* Opening Meter */}
                <div>
                  <Text className="text-xs font-semibold text-slate-500 block mb-1">Opening Meter (credits)</Text>
                  <InputNumber value={editOpening} className="w-full rounded-lg h-9 font-mono" disabled />
                </div>

                {/* Closing Meter */}
                <div>
                  <Text className="text-xs font-semibold text-slate-500 block mb-1">Closing Meter (TOTAL IN-OUT)</Text>
                  <InputNumber value={editClosing} className="w-full rounded-lg h-9 font-mono"
                    onChange={setEditClosing} />
                </div>

                {/* Gross Amount (read-only) */}
                <div>
                  <Text className="text-xs font-semibold text-slate-500 block mb-1">Gross Amount (TZS)</Text>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-700">TZS {(editGross || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    ({Number(editClosing - editOpening).toLocaleString()} credits &times; TZS {editCreditValue.toLocaleString()}) = TZS {((editClosing - editOpening) * editCreditValue).toLocaleString()}
                  </div>
                </div>

                {/* Meter Photo */}
                <div>
                  <Text className="text-xs font-semibold text-slate-500 block mb-1">Meter Photo</Text>
                  {editRecord.meter_image_url && !editRemoveImage ? (
                    <div className="flex items-center gap-2 mb-2">
                      <Image src={editRecord.meter_image_url} className="max-h-16 rounded border border-slate-200" preview={{ mask: 'View' }} />
                      <Button size="small" icon={<Trash2 className="w-3 h-3" />}
                        onClick={() => setEditRemoveImage(true)}
                        className="flex items-center gap-1 !text-xs text-red-500 hover:!border-red-400">
                        Remove
                      </Button>
                    </div>
                  ) : editRecord.meter_image_url && editRemoveImage ? (
                    <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                      <Camera className="w-4 h-4" /> Current image will be removed. Upload a new one below if needed.
                    </div>
                  ) : null}
                  <Upload.Dragger
                    fileList={editFileList}
                    beforeUpload={(file) => { setEditFileList([file]); return false; }}
                    onRemove={() => setEditFileList([])}
                    accept="image/*"
                    maxCount={1}
                    className="rounded-lg"
                  >
                    <div className="flex flex-col items-center gap-1 py-2">
                      <Camera className="w-6 h-6 text-slate-400" />
                      <Text className="text-xs text-slate-500">Tap to replace meter photo</Text>
                    </div>
                  </Upload.Dragger>
                </div>
              </>
            ) : (
              <>
                {/* Gross, Office, Owner for Meteora */}
                <div>
                  <Text className="text-xs font-semibold text-slate-500 block mb-1">Gross (TZS)</Text>
                  <InputNumber value={editGross} className="w-full rounded-lg h-9"
                    onChange={setEditGross} />
                </div>
                <div>
                  <Text className="text-xs font-semibold text-slate-500 block mb-1">Office Share (TZS)</Text>
                  <InputNumber value={editOffice} className="w-full rounded-lg h-9"
                    onChange={setEditOffice} />
                </div>
                <div>
                  <Text className="text-xs font-semibold text-slate-500 block mb-1">Owner Share (TZS)</Text>
                  <InputNumber value={editOwner} className="w-full rounded-lg h-9"
                    onChange={setEditOwner} />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <CreateAssignmentModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      <RecordCollectionModal open={recordModalOpen} onClose={() => setRecordModalOpen(false)} />
    </div>
  );
}
