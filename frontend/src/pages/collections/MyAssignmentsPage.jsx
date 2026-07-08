import { useState } from 'react';
import { Card, Button, Tag, Modal, Form, InputNumber, Upload, Alert, Spin, App, Typography, Table, Select, DatePicker, Space, List, Empty } from 'antd';
import { Camera, CheckCircle, Clock, DoorOpen, Download, FileText, Plus, Unlock, Lock, Eye, Edit3, Trash2, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsAPI, usersAPI, machinesAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import CreateAssignmentModal from './CreateAssignmentModal';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const KpiCard = ({ title, value, icon: Icon, bgColor, iconColor, formatter }) => (
  <Card size="small" className="overflow-hidden border border-slate-100 hover:shadow-md transition-shadow duration-200"
    styles={{ body: { padding: '16px' } }}>
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
        <div className="text-2xl font-bold text-slate-800 tracking-tight mt-1">
          {formatter ? formatter(value) : (value ?? 0)}
        </div>
      </div>
      <div className={`p-3 rounded-xl ${bgColor} flex items-center justify-center ml-4`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  </Card>
);

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function MyAssignmentsPage() {
  const [submitting, setSubmitting] = useState(null);
  const [meterPhoto, setMeterPhoto] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(null);
  const [assignFilters, setAssignFilters] = useState({ limit: 50, offset: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const roleName = useAuthStore((s) => s.user?.role?.name);
  const isAssigner = ['Admin', 'General Manager', 'Operations Manager'].includes(roleName);
  const canWrite = ['create', 'update', 'delete'].some(a => hasPermission('collections', a));

  // ── Collector view: my assignments ──
  const { data: assignmentsRaw, isLoading: loadingMy } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => collectionsAPI.myAssignments().then(r => r.data.data),
    refetchInterval: 60000,
    enabled: !isAssigner,
  });
  const assignments = (assignmentsRaw || []).filter(a => a.machine?.manufacturer === 'Meteora');

  // ── Management view: all assignments ──
  const { data: allAssignments, isLoading: loadingAll } = useQuery({
    queryKey: ['all-assignments', assignFilters],
    queryFn: () => collectionsAPI.listAssignments(assignFilters).then(r => r.data.data),
    enabled: isAssigner,
  });

  const { data: collectorsData } = useQuery({
    queryKey: ['collectors-list'],
    queryFn: () => usersAPI.list({ role: 'Collector' }).then(r => r.data.data),
    enabled: isAssigner,
  });
  const { data: machinesData } = useQuery({
    queryKey: ['machines-list'],
    queryFn: () => machinesAPI.list({ limit: 200 }).then(r => r.data.data),
    enabled: isAssigner,
  });
  const collectors = collectorsData?.rows || [];
  const allMachines = machinesData?.rows || [];

  const submitMutation = useMutation({
    mutationFn: (fd) => collectionsAPI.submit(fd),
    onSuccess: (res) => {
      const c = res.data.data;
      message.success(`Collection submitted — Gross: TZS ${c.gross_tzs?.toLocaleString()}`);
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      setSubmitting(null);
      setMeterPhoto(null);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Submission failed'),
  });

  const openMutation = useMutation({
    mutationFn: (id) => collectionsAPI.openMachine(id),
    onSuccess: () => { message.success('Machine marked as opened'); qc.invalidateQueries({ queryKey: ['my-assignments'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to open machine'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => collectionsAPI.updateAssignment(id, data),
    onSuccess: () => {
      message.success('Assignment updated');
      qc.invalidateQueries({ queryKey: ['all-assignments'] });
      setEditModalOpen(null);
      editForm.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => collectionsAPI.removeAssignment(id),
    onSuccess: () => { message.success('Assignment deleted'); qc.invalidateQueries({ queryKey: ['all-assignments'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Delete failed'),
  });

  const handleExportAssignments = async () => {
    const res = await collectionsAPI.exportAssignments(assignFilters);
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a'); a.href = url;
    a.download = `assignments-${dayjs().format('YYYY-MM-DD')}.xlsx`; a.click();
  };

  const handleExportSelectedAssignments = () => {
    const selected = (rows || []).filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Slot Code', 'Shop', 'Collector', 'Date', 'Status', 'Opened'].join(','),
      ...selected.map(r =>
        [r.machine?.slot_code, r.shop?.name, r.collector?.name,
         r.assigned_date, r.status, r.is_opened ? 'Yes' : 'No'].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `assignments-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const onFinish = (values) => {
    const fd = new FormData();
    fd.append('manufacturer', 'Meteora');
    fd.append('machine_id', submitting.machine_id);
    fd.append('shop_id', submitting.shop_id);
    fd.append('assignment_id', submitting.id);
    fd.append('curr_count', values.curr_count || 0);
    if (meterPhoto) fd.append('meter_image', meterPhoto);
    submitMutation.mutate(fd);
  };

  // ── Assigner table columns ──
  const mgmtCols = [
    { title: 'Slot Code', dataIndex: ['machine', 'slot_code'], render: v => v || '—', width: 120 },
    { title: 'Shop', dataIndex: ['shop', 'name'], render: v => v || '—', width: 150 },
    { title: 'Collector', dataIndex: ['collector', 'name'], render: v => v || '—', width: 140 },
    { title: 'Date', dataIndex: 'assigned_date', render: v => v || '—', width: 110 },
    {
      title: 'Status', dataIndex: 'status',
      render: v => <Tag color={v === 'done' ? 'green' : v === 'skipped' ? 'red' : 'orange'} className="uppercase !text-[10px]">{v}</Tag>,
      width: 90,
    },
    {
      title: 'Opened', dataIndex: 'is_opened',
      render: v => v ? <Unlock className="w-4 h-4 text-emerald-500" /> : <Lock className="w-4 h-4 text-slate-300" />,
      width: 70,
    },
    {
      title: 'Actions', width: 120,
      render: (_, r) => (
        <Space size={0}>
          <Button type="text" size="small" icon={<Eye className="w-4 h-4" />}
            onClick={() => {
              Modal.info({
                title: `Assignment: ${r.machine?.slot_code}`,
                content: (
                  <div className="space-y-2 mt-2">
                    <p><strong>Shop:</strong> {r.shop?.name}</p>
                    <p><strong>Collector:</strong> {r.collector?.name}</p>
                    <p><strong>Date:</strong> {r.assigned_date}</p>
                    <p><strong>Status:</strong> {r.status}</p>
                    <p><strong>Opened:</strong> {r.is_opened ? `Yes at ${r.opened_at ? dayjs(r.opened_at).format('HH:mm') : ''}` : 'No'}</p>
                  </div>
                ),
              });
            }}
            className="!text-slate-500 hover:!text-blue-600" title="View" />
          <Button type="text" size="small" icon={<Edit3 className="w-4 h-4" />}
            onClick={() => {
              editForm.setFieldsValue({
                collector_id: r.collector_id,
                machine_id: r.machine_id,
                assigned_date: r.assigned_date,
              });
              setEditModalOpen(r);
            }}
            className="!text-slate-500 hover:!text-amber-600" title="Edit" />
          <Button type="text" size="small" icon={<Trash2 className="w-4 h-4" />}
            onClick={() => {
              Modal.confirm({
                title: 'Delete Assignment',
                content: `Delete assignment for ${r.machine?.slot_code} on ${r.assigned_date}?`,
                okText: 'Delete', okType: 'danger',
                onOk: () => deleteMutation.mutate(r.id),
              });
            }}
            className="!text-slate-500 hover:!text-red-600" title="Delete" />
        </Space>
      ),
    },
  ];

  // ── Collector columns ──
  const collectorCols = [
    { title: 'Slot Code', dataIndex: ['machine', 'slot_code'], render: v => <Text strong className="text-sm">{v || '—'}</Text>, width: 110 },
    { title: 'Shop', dataIndex: ['shop', 'name'], render: v => v || '—', width: 150 },
    { title: 'Manufacturer', dataIndex: ['machine', 'manufacturer'], render: v => <Tag className="!text-[10px] !px-1.5 !py-0">{v || '—'}</Tag>, width: 110 },
    { title: 'Prev Count', dataIndex: ['machine', 'previous_count'], render: v => v?.toLocaleString() || '0', width: 100 },
    {
      title: 'Opened', dataIndex: 'is_opened',
      render: (v, r) => v
        ? <span className="text-xs text-emerald-600 font-medium"><Unlock className="w-3.5 h-3.5 inline mr-1" />{r.opened_at ? dayjs(r.opened_at).format('HH:mm') : ''}</span>
        : <span className="text-xs text-slate-400"><Lock className="w-3.5 h-3.5 inline mr-1" />Not opened</span>,
      width: 120,
    },
    {
      title: 'Status', dataIndex: 'status',
      render: v => <Tag color={v === 'done' ? 'green' : 'orange'} className="uppercase !text-[10px]">{v}</Tag>,
      width: 90,
    },
    {
      title: 'Actions', width: 200,
      render: (_, r) => r.status === 'pending' ? (
        <Space size={4}>
          {!r.is_opened && (
            <Button size="small" icon={<DoorOpen className="w-3.5 h-3.5" />}
              onClick={() => openMutation.mutate(r.id)} loading={openMutation.isPending}
              className="flex items-center gap-1 !text-xs !bg-amber-50 !border-amber-200 !text-amber-700 hover:!bg-amber-100">
              Open
            </Button>
          )}
          <Button type="primary" size="small" icon={<Camera className="w-3.5 h-3.5" />}
            onClick={() => { setSubmitting(r); form.resetFields(); setMeterPhoto(null); }}
            className="flex items-center gap-1 !bg-brand-dark hover:!bg-brand-light border-none">
            Submit
          </Button>
        </Space>
      ) : (
        <span className="text-xs text-emerald-600 font-medium"><CheckCircle className="w-3.5 h-3.5 inline mr-1" />Completed</span>
      ),
    },
  ];

  // ── RENDER: Collector table view ──
  if (!isAssigner) {
    if (loadingMy) return <Spin size="large" className="block mx-auto my-20" />;
    const pending = (assignments || []).filter(a => a.status === 'pending');
    const done = (assignments || []).filter(a => a.status === 'done');

    return (
      <div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
          <div>
            <h4 className="text-base font-bold text-slate-800 m-0">Assignments</h4>
            <span className="text-xs text-slate-500">{dayjs().format('DD MMM YYYY')}</span>
          </div>
          {canWrite && isAssigner && (
            <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateModalOpen(true)}
              className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5">
              Create Assignment
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <KpiCard title="Total" value={assignments?.length || 0} icon={FileText} bgColor="bg-slate-50" iconColor="text-slate-600" />
          <KpiCard title="Pending" value={pending.length} icon={Clock} bgColor="bg-amber-50" iconColor="text-amber-600" />
          <KpiCard title="Done" value={done.length} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        </div>

        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <Table dataSource={assignments || []} columns={collectorCols} rowKey="id" size="middle"
            pagination={false}
            locale={{ emptyText: (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <Text type="secondary">No assignments for today</Text>
              </div>
            )}} />
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {(assignments || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FileText className="w-12 h-12 text-slate-300 mb-3" />
              <Text type="secondary">No assignments for today</Text>
            </div>
          ) : (
            <List
              dataSource={assignments || []}
              renderItem={(r) => (
                <MobileCard
                  record={r}
                  fields={[
                    { key: 'machine', dataIndex: ['machine', 'slot_code'] },
                    { key: 'shop', label: 'Shop', dataIndex: ['shop', 'name'] },
                    { key: 'manufacturer', label: 'Type', dataIndex: ['machine', 'manufacturer'] },
                    { key: 'prev', label: 'Prev', dataIndex: ['machine', 'previous_count'] },
                  ]}
                  onClick={() => {
                    if (r.status === 'pending') { setSubmitting(r); form.resetFields(); setMeterPhoto(null); }
                  }}
                  statusColor={r.status === 'done' ? 'green' : 'orange'}
                />
              )}
            />
          )}
        </div>

        {/* Submit Collection Modal */}
        <Modal
          title={<span className="text-sm font-bold text-slate-700">Submit Collection — {submitting?.machine?.slot_code}</span>}
          open={!!submitting}
          onCancel={() => { setSubmitting(null); setMeterPhoto(null); form.resetFields(); }}
          onOk={() => form.submit()}
          confirmLoading={submitMutation.isPending}
          width={500}
          className="top-8"
        >
          <Form form={form} layout="vertical" onFinish={onFinish} className="mt-4">
            <Form.Item label={<span className="text-xs font-semibold text-slate-600">Meter Photo</span>}>
              <Upload.Dragger
                beforeUpload={(file) => { setMeterPhoto(file); return false; }}
                onRemove={() => setMeterPhoto(null)}
                accept="image/*"
                capture="environment"
                maxCount={1}
                fileList={meterPhoto ? [{ uid: '-1', name: meterPhoto.name, status: 'done' }] : []}
                className="rounded-lg"
              >
                <div className="flex flex-col items-center gap-1 py-2">
                  <Camera className="w-8 h-8 text-slate-400" />
                  <span className="text-xs text-slate-500">Tap to open camera or choose a photo</span>
                </div>
              </Upload.Dragger>
            </Form.Item>

            {meterPhoto && (
              <div className="mb-4 rounded-lg overflow-hidden border border-slate-200">
                <img src={URL.createObjectURL(meterPhoto)} alt="Meter preview" className="w-full max-h-48 object-contain bg-slate-50" />
              </div>
            )}

            <Form.Item name="curr_count" label={<span className="text-xs font-semibold text-slate-600">Current Counter Reading</span>} rules={[{ required: true }]}>
              <InputNumber className="w-full" size="large" />
            </Form.Item>

            {submitting && (
              <Alert
                type="info"
                message={`Previous reading: ${submitting.machine?.previous_count?.toLocaleString()} | Credit value: TZS ${submitting.machine?.credit_value_tzs}`}
                className="text-xs"
              />
            )}
          </Form>
        </Modal>

        <CreateAssignmentModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      </div>
    );
  }

  // ── RENDER: Management table view ──
  const rows = (allAssignments?.rows || []).filter(a => a.machine?.manufacturer !== 'Novomatic');
  const mgmtPending = rows.filter(a => a.status === 'pending');
  const mgmtDone = rows.filter(a => a.status === 'done');
  const mgmtSkipped = rows.filter(a => a.status === 'skipped');

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Assignments</h4>
          <span className="text-xs text-slate-500">{dayjs().format('DD MMM YYYY')}</span>
        </div>
        <Space>
          <Button icon={<Download className="w-4 h-4" />} onClick={handleExportAssignments}
            className="flex items-center gap-1.5">
            Export All
          </Button>
          <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateModalOpen(true)}
            className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5">
            Create
          </Button>
        </Space>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total" value={allAssignments?.count || 0} icon={FileText} bgColor="bg-slate-50" iconColor="text-slate-600" />
        <KpiCard title="Pending" value={mgmtPending.length} icon={Clock} bgColor="bg-amber-50" iconColor="text-amber-600" />
        <KpiCard title="Done" value={mgmtDone.length} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard title="Skipped" value={mgmtSkipped.length} icon={DoorOpen} bgColor="bg-red-50" iconColor="text-red-600" />
      </div>

      <Card size="small" className="mb-4 border border-slate-100">
        <Space wrap size={[8, 8]}>
          <DatePicker size="small"
            placeholder="Date"
            value={assignFilters.date ? dayjs(assignFilters.date) : null}
            onChange={(d) => setAssignFilters(p => ({ ...p, date: d ? d.format('YYYY-MM-DD') : undefined }))}
          />
          <Select size="small" placeholder="Collector" value={assignFilters.collector_id} onChange={(v) => setAssignFilters(p => ({ ...p, collector_id: v }))} className="w-[140px]" allowClear>
            {collectors.map(c => <Option key={c.id} value={String(c.id)}>{c.name}</Option>)}
          </Select>
          <Select size="small" placeholder="Machine" value={assignFilters.machine_id} onChange={(v) => setAssignFilters(p => ({ ...p, machine_id: v }))} className="w-[140px]" allowClear>
            {allMachines.map(m => <Option key={m.id} value={String(m.id)}>{m.slot_code}</Option>)}
          </Select>
          <Select size="small" placeholder="Status" value={assignFilters.status} onChange={(v) => setAssignFilters(p => ({ ...p, status: v }))} className="w-[110px]" allowClear>
            <Option value="pending">Pending</Option>
            <Option value="done">Done</Option>
            <Option value="skipped">Skipped</Option>
          </Select>
          {(assignFilters.date || assignFilters.collector_id || assignFilters.machine_id || assignFilters.status) && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => setAssignFilters({ limit: 50, offset: 0 })}
              className="flex items-center gap-1 !text-xs">
              Clear
            </Button>
          )}
        </Space>
      </Card>

      {/* Bulk Action Bar */}
      {selectedRowKeys.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
          <span className="text-sm font-medium text-brand-dark">{selectedRowKeys.length} selected</span>
          <Space>
            <Button size="small" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportSelectedAssignments}
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
      <div className="hidden overflow-x-auto md:block">
        <Table dataSource={rows} columns={mgmtCols} rowKey="id" loading={loadingAll}
          size="middle" rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: allAssignments?.count, pageSize: 20, showSizeChanger: false,
            onChange: (p) => setAssignFilters(f => ({ ...f, offset: (p - 1) * 20 })) }}
          summary={() => rows.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-slate-50 font-semibold">
                <Table.Summary.Cell index={0} colSpan={4}>TOTAL ({allAssignments?.count || 0} records)</Table.Summary.Cell>
                <Table.Summary.Cell index={4}>{mgmtPending.length} Pending</Table.Summary.Cell>
                <Table.Summary.Cell index={5}>{mgmtDone.length} Done</Table.Summary.Cell>
                <Table.Summary.Cell index={6} />
              </Table.Summary.Row>
            </Table.Summary>
          ) : null} />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <Empty description="No assignments found" />
        ) : (
          <List
            dataSource={rows}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={[
                  { key: 'machine', dataIndex: ['machine', 'slot_code'] },
                  { key: 'shop', label: 'Shop', dataIndex: ['shop', 'name'] },
                  { key: 'collector', label: 'Collector', dataIndex: ['collector', 'name'] },
                  { key: 'status', label: 'Status', dataIndex: 'status' },
                ]}
                onClick={() => {}}
                statusColor={r.status === 'done' ? 'green' : r.status === 'skipped' ? 'red' : 'orange'}
              />
            )}
          />
        )}
      </div>

      <CreateAssignmentModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />

      {/* Edit Assignment Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Edit Assignment</span>} open={!!editModalOpen} onCancel={() => setEditModalOpen(null)}
        onOk={() => editForm.submit()} confirmLoading={updateMutation.isPending}
        className="top-8">
        <Form form={editForm} layout="vertical" onFinish={(v) => updateMutation.mutate({ id: editModalOpen.id, data: v })} className="mt-4">
          <Form.Item name="collector_id" label="Collector" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {collectors.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="machine_id" label="Machine" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {allMachines.map(m => <Option key={m.id} value={m.id}>{m.slot_code}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="assigned_date" label="Date" rules={[{ required: true }]}>
            <DatePicker className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

