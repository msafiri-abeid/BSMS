import { useState } from 'react';
import { Table, Tag, Button, Space, DatePicker, Select, Input, Typography, Empty, Modal, App, Image, List } from 'antd';
import { Download, Plus, Eye, Edit3, Trash2, Camera, Search, X, CheckCircle, XCircle, FileDown, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsAPI, financeAPI, shopsAPI, usersAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import KpiCard from '../../components/KpiCard';
import ActionMenu from '../../components/ActionMenu';
import MobileCard from '../../components/MobileCard';
import CreateAssignmentModal from './CreateAssignmentModal';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function CollectionsPage() {
  const [filters, setFilters] = useState({ limit: 50, offset: 0 });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const { hasPermission } = useAuthStore();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const canWrite = ['create', 'update', 'delete'].some(a => hasPermission('collections', a));
  const roleName = useAuthStore((s) => s.user?.role?.name);
  const canAssign = canWrite && ['Admin', 'General Manager', 'Operations Manager'].includes(roleName);

  const { data, isLoading, error } = useQuery({
    queryKey: ['collections', filters],
    queryFn: () => collectionsAPI.list(filters).then(r => r.data.data),
  });

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const { data: collectorsData } = useQuery({ queryKey: ['collectors-list'], queryFn: () => usersAPI.list({ role: 'Collector' }).then(r => r.data.data) });
  const shops = shopsData?.rows || shopsData || [];
  const collectors = collectorsData?.rows || collectorsData || [];

  const rows = data?.rows || [];
  const totals = rows.reduce((acc, c) => ({
    gross: acc.gross + (c.gross_tzs || 0),
    office: acc.office + (c.office_tzs || 0),
    owner: acc.owner + (c.owner_tzs || 0),
  }), { gross: 0, office: 0, owner: 0 });

  const removeMutation = useMutation({
    mutationFn: (id) => collectionsAPI.remove(id),
    onSuccess: () => {
      message.success('Collection deleted');
      qc.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Delete failed'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }) => collectionsAPI.update(id, { status }),
    onSuccess: () => {
      message.success('Collection reviewed');
      qc.invalidateQueries({ queryKey: ['collections'] });
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
    const csv = [
      ['Slot Code', 'Manufacturer', 'Gross', 'Office', 'Owner', 'Status', 'Date'].join(','),
      ...selected.map(r =>
        [r.machine?.slot_code, r.machine?.manufacturer,
         r.gross_tzs, r.office_tzs, r.owner_tzs, r.status,
         dayjs(r.collected_at).format('YYYY-MM-DD HH:mm')].join(',')
      ),
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

  const actionItems = (r) => [
    { key: 'view', icon: <Eye className="w-4 h-4" />, label: 'View' },
    ...(canWrite ? [
      { key: 'edit', icon: <Edit3 className="w-4 h-4" />, label: 'Edit' },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 className="w-4 h-4" />, label: 'Delete', danger: true },
    ] : []),
  ];

  const cols = [
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

  const mobileFields = [
    { key: 'slot_code', dataIndex: 'machine.slot_code' },
    { key: 'gross', label: 'Gross', render: (_, r) => fmt(r.gross_tzs) },
    { key: 'office', label: 'Office', render: (_, r) => fmt(r.office_tzs) },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">All Collections</h4>
          <span className="text-xs text-slate-500">{data?.count || 0} total</span>
        </div>
        {canAssign && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateModalOpen(true)}
            className="!bg-brand-dark hover:!bg-brand-light hover:!text-white border-none shadow-sm flex items-center gap-1.5 text-white">
            Create Assignment
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Gross" value={totals.gross} icon={Download} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
        <KpiCard title="Office Share" value={totals.office} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
        <KpiCard title="Owner Share" value={totals.owner} icon={TrendingUp} bgColor="bg-purple-50" iconColor="text-purple-600" formatter={fmt} />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <RangePicker size="small" className="w-52"
            onChange={(d) => {
              if (d && d[0] && d[1]) {
                setFilters(f => ({ ...f, date_from: d[0].toISOString(), date_to: d[1].toISOString() }));
              } else {
                const { date_from, date_to, ...rest } = filters;
                setFilters(rest);
              }
            }} />
          <Select size="small" placeholder="Shop" allowClear className="w-40"
            onChange={(v) => setFilters(f => ({ ...f, shop_id: v, offset: 0 }))}>
            {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
          </Select>
          <Select size="small" placeholder="Collector" allowClear className="w-40"
            onChange={(v) => setFilters(f => ({ ...f, collector_id: v, offset: 0 }))}>
            {collectors.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select size="small" placeholder="Status" allowClear className="w-32"
            onChange={(v) => setFilters(f => ({ ...f, status: v, offset: 0 }))}>
            {['pending', 'approved', 'disputed'].map(s => <Option key={s} value={s}>{s}</Option>)}
          </Select>
          <Input.Search size="small" placeholder="Search slot code" allowClear className="w-44"
            onSearch={(v) => setFilters(f => ({ ...f, search: v || undefined, offset: 0 }))} />
          {(filters.shop_id || filters.collector_id || filters.status || filters.search || filters.date_from) && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => setFilters({ limit: 50, offset: 0 })}
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
                <Table.Summary.Cell index={0} colSpan={2}>TOTAL ({data?.count || 0} records)</Table.Summary.Cell>
                <Table.Summary.Cell index={2}>{fmt(totals.gross)}</Table.Summary.Cell>
                <Table.Summary.Cell index={3}>{fmt(totals.office)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4}>{fmt(totals.owner)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} />
                <Table.Summary.Cell index={6} />
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
              {canWrite && ['Admin', 'General Manager', 'Operations Manager'].includes(roleName) && viewRecord.status === 'pending' && (
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
              <div><span className="text-xs font-semibold text-slate-500 block">Date</span><span>{dayjs(viewRecord.collected_at).format('DD MMM YYYY HH:mm')}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Slot Code</span><span className="font-medium">{viewRecord.machine?.slot_code}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Manufacturer</span><Tag className="!text-[10px]">{viewRecord.machine?.manufacturer}</Tag></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Credit Value</span><span>TZS {viewRecord.machine?.credit_value_tzs?.toLocaleString()}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Collector</span><span>{viewRecord.collector?.name || '—'}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Partner</span><span>{viewRecord.shop?.partner?.name || '—'}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Shop</span><span>{viewRecord.shop?.name || '—'}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Location</span><span>{viewRecord.shop?.address?.street ? `${viewRecord.shop.address.street}, ${viewRecord.shop.address.ward}` : '—'}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Previous Count</span><span>{viewRecord.prev_count?.toLocaleString()}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Current Count</span><span className="font-bold">{viewRecord.curr_count?.toLocaleString()}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Difference</span><span>{viewRecord.difference?.toLocaleString()}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Status</span><Tag color={viewRecord.status === 'approved' ? 'green' : 'orange'}>{viewRecord.status}</Tag></div>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Financial Breakdown</Text>
              <div className="grid grid-cols-3 gap-4">
                <KpiCard title="Gross" value={viewRecord.gross_tzs} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
                <KpiCard title="Office" value={viewRecord.office_tzs} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
                <KpiCard title="Owner" value={viewRecord.owner_tzs} bgColor="bg-purple-50" iconColor="text-purple-600" formatter={fmt} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Edit Collection — {editRecord?.machine?.slot_code}</span>}
        open={!!editRecord}
        onCancel={() => setEditRecord(null)}
        onOk={() => {
          if (!editRecord) return;
          collectionsAPI.update(editRecord.id, editRecord).then(() => {
            message.success('Collection updated');
            setEditRecord(null);
            qc.invalidateQueries({ queryKey: ['collections'] });
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
              <Select value={editRecord.status} className="w-full"
                onChange={(v) => setEditRecord({ ...editRecord, status: v })}>
                <Option value="pending">Pending</Option>
                <Option value="approved">Approved</Option>
                <Option value="disputed">Disputed</Option>
              </Select>
            </div>
            <div>
              <Text className="text-xs font-semibold text-slate-500 block mb-1">Gross (TZS)</Text>
              <Input type="number" value={editRecord.gross_tzs}
                onChange={(e) => setEditRecord({ ...editRecord, gross_tzs: Number(e.target.value) })}
                className="w-full" />
            </div>
            <div>
              <Text className="text-xs font-semibold text-slate-500 block mb-1">Office Share (TZS)</Text>
              <Input type="number" value={editRecord.office_tzs}
                onChange={(e) => setEditRecord({ ...editRecord, office_tzs: Number(e.target.value) })}
                className="w-full" />
            </div>
            <div>
              <Text className="text-xs font-semibold text-slate-500 block mb-1">Owner Share (TZS)</Text>
              <Input type="number" value={editRecord.owner_tzs}
                onChange={(e) => setEditRecord({ ...editRecord, owner_tzs: Number(e.target.value) })}
                className="w-full" />
            </div>
          </div>
        )}
      </Modal>

      <CreateAssignmentModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  );
}
