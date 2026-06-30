import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, InputNumber, App, Typography, Dropdown, Card, Checkbox, List, Empty } from 'antd';
import { FileText, Clock, Building2, TrendingUp, Download, Plus, UserPlus, Eye, Edit, Trash2, MoreHorizontal, Search, X, FileDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { machinesAPI, shopsAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import KpiCard from '../../components/KpiCard';
import ActionMenu from '../../components/ActionMenu';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const STATUS_COLORS = { active: 'green', inactive: 'default', maintenance: 'orange', transferred: 'blue' };
const MANUFACTURERS = ['Meteora', 'Novomatic', 'EGT'];
const DEFAULT_CV = { Meteora: 200, Novomatic: 10, EGT: 100 };

export default function MachinesPage() {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(null);
  const [deployOpen, setDeployOpen] = useState(null);
  const [exchangeOpen, setExchangeOpen] = useState(null);
  const [refillOpen, setRefillOpen] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [deployForm] = Form.useForm();
  const [exchangeForm] = Form.useForm();
  const [refillForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [slotCodeSearch, setSlotCodeSearch] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState();
  const [locationFilter, setLocationFilter] = useState();
  const [statusFilter, setStatusFilter] = useState();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const params = {};
  if (slotCodeSearch) params.search = slotCodeSearch;
  if (manufacturerFilter) params.manufacturer = manufacturerFilter;
  if (locationFilter) params.shop_id = locationFilter;
  if (statusFilter) params.status = statusFilter;

  const { data: machines, isLoading } = useQuery({
    queryKey: ['machines', params],
    queryFn: () => machinesAPI.list(params).then(r => r.data.data),
  });

  const rows = machines?.rows || [];

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = shopsData?.rows || [];

  const createMutation = useMutation({
    mutationFn: (d) => machinesAPI.create(d),
    onSuccess: () => { message.success('Machine registered'); qc.invalidateQueries({ queryKey: ['machines'] }); setRegisterOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }) => machinesAPI.update(id, d),
    onSuccess: () => { message.success('Machine updated'); qc.invalidateQueries({ queryKey: ['machines'] }); setEditOpen(null); editForm.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => machinesAPI.remove(id),
    onSuccess: () => { message.success('Machine deleted'); qc.invalidateQueries({ queryKey: ['machines'] }); setDeleteOpen(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deployMutation = useMutation({
    mutationFn: ({ id, ...d }) => machinesAPI.deploy(id, d),
    onSuccess: () => { message.success('Machine deployed'); qc.invalidateQueries({ queryKey: ['machines'] }); setDeployOpen(null); deployForm.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const exchangeMutation = useMutation({
    mutationFn: ({ id, ...d }) => machinesAPI.exchange(id, d),
    onSuccess: () => { message.success('Machine exchanged'); qc.invalidateQueries({ queryKey: ['machines'] }); setExchangeOpen(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const refillMutation = useMutation({
    mutationFn: ({ id, ...d }) => machinesAPI.refill(id, d),
    onSuccess: () => { message.success('Refill recorded'); qc.invalidateQueries({ queryKey: ['machines'] }); setRefillOpen(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const activeCount = rows.filter(r => r.status === 'active').length;
  const inactiveCount = rows.filter(r => r.status === 'inactive').length;
  const hasFilters = slotCodeSearch || manufacturerFilter || locationFilter || statusFilter;

  const handleExport = async () => {
    try {
      const res = await machinesAPI.export();
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'machines_' + dayjs().format('YYYY-MM-DD') + '.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error('Export failed');
    }
  };

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Slot Code', 'Manufacturer', 'Location', 'Weekly Target', 'Debt', 'Status'].join(','),
      ...selected.map(r =>
        [r.slot_code, r.manufacturer, r.currentShop?.name || 'Office',
         r.effective_target_tzs || '', r.outstanding_debt_tzs || 0, r.status].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `machines-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const handleAction = (key, r) => {
    if (key === 'view') navigate('/machines/' + r.id);
    if (key === 'edit') {
      editForm.setFieldsValue({
        slot_code: r.slot_code, serial_number: r.serial_number, sticker_no: r.sticker_no,
        manufacturer: r.manufacturer, credit_value_tzs: r.credit_value_tzs,
        weekly_target_tzs: r.weekly_target_tzs,
      });
      setEditOpen(r);
    }
    if (key === 'delete') setDeleteOpen(r);
    if (key === 'deploy') { setDeployOpen(r); deployForm.resetFields(); }
    if (key === 'exchange') { setExchangeOpen(r); exchangeForm.resetFields(); }
    if (key === 'refill') { setRefillOpen(r); refillForm.resetFields(); }
  };

  const actionItems = (r) => {
    const items = [
      { key: 'view', icon: <Eye size={14} />, label: 'View Details' },
      { key: 'edit', icon: <Edit size={14} />, label: 'Edit' },
    ];
    if (r.status !== 'active') {
      items.push({ key: 'deploy', icon: <UserPlus size={14} />, label: 'Deploy' });
    }
    if (r.status === 'active') {
      items.push({ key: 'exchange', icon: <Building2 size={14} />, label: 'Exchange' });
    }
    if (r.manufacturer !== 'Novomatic' && r.status === 'active') {
      items.push({ key: 'refill', icon: <Plus size={14} />, label: 'Refill Tokens' });
    }
    items.push({ type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', danger: true },
    );
    return items;
  };

  const cols = [
    { title: 'Slot Code', dataIndex: 'slot_code', sorter: (a, b) => a.slot_code.localeCompare(b.slot_code), width: 120 },
    { title: 'Manufacturer', dataIndex: 'manufacturer', render: v => <Tag color={v === 'Meteora' ? 'blue' : v === 'Novomatic' ? 'purple' : 'orange'} className="!text-[10px]">{v}</Tag>, width: 110 },
    { title: 'Location', dataIndex: ['currentShop', 'name'], render: v => v || <Tag>Office</Tag>, width: 130 },
    {
      title: 'Weekly Target', dataIndex: 'effective_target_tzs', render: v =>
        v ? 'TZS ' + v.toLocaleString() : <Text type="secondary">—</Text>, width: 120,
    },
    {
      title: 'Debt', dataIndex: 'outstanding_debt_tzs', render: v =>
        v > 0 ? <span className="font-semibold text-red-600">TZS {v.toLocaleString()}</span> : <Text type="secondary">—</Text>, width: 110,
    },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    {
      title: 'Actions', key: 'actions', width: 55, align: 'center',
      render: (_, r) => <ActionMenu record={r} actionItems={actionItems} onAction={handleAction} />,
    },
  ];

  const mobileFields = [
    { key: 'slot_code', dataIndex: 'slot_code' },
    { key: 'manufacturer', label: 'Mfr', render: (_, r) => r.manufacturer },
    { key: 'location', label: 'Location', dataIndex: 'currentShop.name' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Machines</h4>
          <span className="text-xs text-slate-500">{machines?.count || 0} total</span>
        </div>
        <Space>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setRegisterOpen(true)}
            className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
            Register Machine
          </Button>
        </Space>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total" value={machines?.count || 0} icon={FileText} bgColor="bg-slate-50" iconColor="text-slate-600" />
        <KpiCard title="Active" value={activeCount} icon={Building2} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard title="Inactive" value={inactiveCount} icon={Clock} bgColor="bg-amber-50" iconColor="text-amber-600" />
        <KpiCard title="Targets Met (This Week)" value={machines?.targetsMet ?? 0} icon={TrendingUp} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Input.Search size="small" allowClear placeholder="Search slot code"
            defaultValue={slotCodeSearch}
            onSearch={(v) => setSlotCodeSearch(v)}
            className="w-full sm:w-44" />
          <Select size="small" allowClear placeholder="Manufacturer" value={manufacturerFilter} onChange={(v) => setManufacturerFilter(v)} className="w-36">
            {MANUFACTURERS.map(m => <Option key={m} value={m}>{m}</Option>)}
          </Select>
          <Select size="small" allowClear placeholder="Shop" value={locationFilter} onChange={(v) => setLocationFilter(v)} className="w-36">
            {shops.map(s => <Option key={s.id} value={String(s.id)}>{s.name}</Option>)}
          </Select>
          <Select size="small" allowClear placeholder="Status" value={statusFilter} onChange={(v) => setStatusFilter(v)} className="w-32">
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
            <Option value="maintenance">Maintenance</Option>
            <Option value="transferred">Transferred</Option>
          </Select>
          {hasFilters && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => { setSlotCodeSearch(''); setManufacturerFilter(); setLocationFilter(); setStatusFilter(); }}
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
            <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} onClick={handleExportSelected}
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
        <Table dataSource={rows} columns={cols} rowKey="id" loading={isLoading} size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: machines?.count, pageSize: 20 }} />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <Empty description="No machines found" />
        ) : (
          <List
            dataSource={rows}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={mobileFields}
                onClick={() => navigate('/machines/' + r.id)}
                statusColor={STATUS_COLORS[r.status]}
              />
            )}
          />
        )}
      </div>

      {/* Register Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Register Machine</span>}
        open={registerOpen} onCancel={() => setRegisterOpen(false)}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending}
        className="top-8">
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} className="mt-4">
          <Form.Item name="slot_code" label={<span className="text-xs font-semibold text-slate-600">Slot Code</span>} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="serial_number" label={<span className="text-xs font-semibold text-slate-600">Serial Number</span>}><Input /></Form.Item>
          <Form.Item name="sticker_no" label={<span className="text-xs font-semibold text-slate-600">Sticker Number</span>}><Input /></Form.Item>
          <Form.Item name="manufacturer" label={<span className="text-xs font-semibold text-slate-600">Manufacturer</span>} rules={[{ required: true }]}>
            <Select onChange={(v) => form.setFieldValue('credit_value_tzs', DEFAULT_CV[v])}>
              {MANUFACTURERS.map(m => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="credit_value_tzs" label={<span className="text-xs font-semibold text-slate-600">Credit Value (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="weekly_target_tzs" label={<span className="text-xs font-semibold text-slate-600">Weekly Target (TZS)</span>} help="Leave empty to use system default">
            <InputNumber min={0} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Edit: {editOpen?.slot_code}</span>}
        open={!!editOpen} onCancel={() => setEditOpen(null)}
        onOk={() => editForm.submit()} confirmLoading={updateMutation.isPending}
        className="top-8">
        <Form form={editForm} layout="vertical" onFinish={(v) => updateMutation.mutate({ id: editOpen.id, ...v })} className="mt-4">
          <Form.Item name="slot_code" label={<span className="text-xs font-semibold text-slate-600">Slot Code</span>} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="serial_number" label={<span className="text-xs font-semibold text-slate-600">Serial Number</span>}><Input /></Form.Item>
          <Form.Item name="sticker_no" label={<span className="text-xs font-semibold text-slate-600">Sticker Number</span>}><Input /></Form.Item>
          <Form.Item name="manufacturer" label={<span className="text-xs font-semibold text-slate-600">Manufacturer</span>} rules={[{ required: true }]}>
            <Select onChange={(v) => editForm.setFieldValue('credit_value_tzs', DEFAULT_CV[v])}>
              {MANUFACTURERS.map(m => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="credit_value_tzs" label={<span className="text-xs font-semibold text-slate-600">Credit Value (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="weekly_target_tzs" label={<span className="text-xs font-semibold text-slate-600">Weekly Target (TZS)</span>} help="Leave empty to use system default">
            <InputNumber min={0} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Delete Machine</span>}
        open={!!deleteOpen} onCancel={() => setDeleteOpen(null)}
        onOk={() => deleteMutation.mutate(deleteOpen.id)} confirmLoading={deleteMutation.isPending}
        className="top-8">
        <p className="mt-4">Are you sure you want to delete machine <strong>{deleteOpen?.slot_code}</strong>? This action cannot be undone.</p>
      </Modal>

      {/* Deploy Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Deploy: {deployOpen?.slot_code}</span>}
        open={!!deployOpen} onCancel={() => setDeployOpen(null)}
        onOk={() => deployForm.submit()} confirmLoading={deployMutation.isPending}
        className="top-8">
        <Form form={deployForm} layout="vertical" onFinish={(v) => deployMutation.mutate({ id: deployOpen.id, ...v })} className="mt-4">
          <Form.Item name="shop_id" label={<span className="text-xs font-semibold text-slate-600">Deploy to Shop</span>} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="opening_count" label={<span className="text-xs font-semibold text-slate-600">Opening Counter Reading</span>} initialValue={0}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <div className="text-xs text-slate-500 mb-2">Token deployment (90k total = 30k machine load + 60k player tray)</div>
          <Form.Item name="machine_load_tzs" label={<span className="text-xs font-semibold text-slate-600">Machine Load (TZS)</span>} initialValue={30000}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="tray_tzs" label={<span className="text-xs font-semibold text-slate-600">Player Tray (TZS)</span>} initialValue={60000}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="tokens_paid" valuePropName="checked" initialValue={true}>
            <Checkbox>Tokens paid upfront (uncheck to create token debt)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Exchange Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Exchange: {exchangeOpen?.slot_code}</span>}
        open={!!exchangeOpen} onCancel={() => setExchangeOpen(null)}
        onOk={() => exchangeForm.submit()} confirmLoading={exchangeMutation.isPending}
        className="top-8">
        <Form form={exchangeForm} layout="vertical" onFinish={(v) => exchangeMutation.mutate({ id: exchangeOpen.id, ...v })} className="mt-4">
          <Form.Item name="to_shop_id" label={<span className="text-xs font-semibold text-slate-600">Transfer to Shop</span>} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {shops.filter(s => s.id !== exchangeOpen?.current_shop_id).map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label={<span className="text-xs font-semibold text-slate-600">Reason</span>}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="reset_cycle" valuePropName="checked">
            <Checkbox>Reset 7-day collection cycle</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Refill Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Token Refill: {refillOpen?.slot_code}</span>}
        open={!!refillOpen} onCancel={() => setRefillOpen(null)}
        onOk={() => refillForm.submit()} confirmLoading={refillMutation.isPending}
        className="top-8">
        <Form form={refillForm} layout="vertical" onFinish={(v) => refillMutation.mutate({ id: refillOpen.id, ...v })} className="mt-4">
          <Form.Item name="token_qty" label={<span className="text-xs font-semibold text-slate-600">Token Quantity</span>} rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="token_value_tzs" label={<span className="text-xs font-semibold text-slate-600">Value per Token (TZS)</span>} rules={[{ required: true }]} initialValue={refillOpen?.credit_value_tzs}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="notes" label={<span className="text-xs font-semibold text-slate-600">Notes</span>}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
