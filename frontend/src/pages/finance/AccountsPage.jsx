import { useState } from 'react';
import { Table, Tag, Button, Space, Input, Typography, Modal, App, Form, Select, InputNumber } from 'antd';
import { Plus, Search, X, Landmark, Building2, Landmark as Banknote, Smartphone, Smartphone as SelcomIcon, Pencil, Trash2, FileDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsAPI, shopsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import KpiCard from '../../components/KpiCard';
import ActionMenu from '../../components/ActionMenu';
import MobileCard from '../../components/MobileCard';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;
const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

const TYPE_ICONS = { cash: Landmark, bank: Banknote, mobile_money: Smartphone, selcom: SelcomIcon };
const TYPE_COLORS = { cash: 'text-emerald-600', bank: 'text-blue-600', mobile_money: 'text-purple-600', selcom: 'text-cyan-600' };

export default function AccountsPage() {
  const [filters, setFilters] = useState({ limit: 50, offset: 0 });
  const [modalOpen, setModalOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const { hasPermission, getRoleName } = useAuthStore();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canWrite = ['create', 'update', 'delete'].some(a => hasPermission('accounts', a));
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', filters],
    queryFn: () => accountsAPI.list(filters).then(r => r.data.data),
  });

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data), enabled: !!modalOpen });
  const shops = shopsData?.rows || shopsData || [];

  const rows = data?.rows || [];

  const totals = {
    all: rows.length,
    cash: rows.filter(r => r.account_type === 'cash').reduce((s, r) => s + (r.current_balance || 0), 0),
    bank: rows.filter(r => r.account_type === 'bank').reduce((s, r) => s + (r.current_balance || 0), 0),
    mobile: rows.filter(r => r.account_type === 'mobile_money').reduce((s, r) => s + (r.current_balance || 0), 0),
    selcom: rows.filter(r => r.account_type === 'selcom').reduce((s, r) => s + (r.current_balance || 0), 0),
  };

  const createMutation = useMutation({
    mutationFn: (d) => accountsAPI.create(d),
    onSuccess: () => { message.success('Account created'); qc.invalidateQueries({ queryKey: ['accounts'] }); setModalOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => accountsAPI.update(id, d),
    onSuccess: () => { message.success('Account updated'); qc.invalidateQueries({ queryKey: ['accounts'] }); setModalOpen(false); setEditing(null); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => accountsAPI.delete(id),
    onSuccess: () => { message.success('Account deleted'); qc.invalidateQueries({ queryKey: ['accounts'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Delete failed'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete Account',
      content: `Delete "${record.name}"?`,
      okText: 'Delete', okType: 'danger',
      onOk: () => deleteMutation.mutate(record.id),
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      updateMutation.mutate({ id: editing.id, d: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const headers = ['Name', 'Type', 'Shop', 'Opening Balance', 'Current Balance', 'Status'];
    const csv = [
      headers.join(','),
      ...selected.map(r => [r.name, r.account_type, r.shop?.name || '', r.opening_balance, r.current_balance, r.is_active ? 'Active' : 'Inactive'].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'accounts-selected.csv'; a.click();
  };

  const cols = [
    { title: 'Name', dataIndex: 'name', render: (v, r) => (
      <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => navigate(`/finance/accounts/${r.id}`)}>
        {v}
      </Button>
    ), width: 180 },
    { title: 'Type', dataIndex: 'account_type', render: (v) => {
      const Icon = TYPE_ICONS[v] || Landmark;
      return <span className={`flex items-center gap-1 text-xs capitalize ${TYPE_COLORS[v] || ''}`}><Icon size={13} />{v.replace('_', ' ')}</span>;
    }, width: 120 },
    { title: 'Shop', key: 'shop', render: (_, r) => <span className="text-xs">{r.shop?.name || <span className="text-slate-300">—</span>}</span>, width: 150 },
    { title: 'Opening Balance', dataIndex: 'opening_balance', render: v => <span className="font-semibold text-xs">{fmt(v)}</span>, width: 130 },
    { title: 'Current Balance', dataIndex: 'current_balance', render: v => <span className="font-semibold">{fmt(v)}</span>, width: 140 },
    { title: 'Status', dataIndex: 'is_active', render: v => v ? <Tag className="!text-[10px] !px-2">Active</Tag> : <Tag className="!text-[10px] !px-2" color="default">Inactive</Tag>, width: 80 },
    { title: 'Actions', key: 'actions', width: 55, align: 'center', render: (_, r) => (
      <ActionMenu
        record={r}
        actionItems={() => [
          ...(canWrite ? [
            { key: 'edit', icon: <Pencil className="w-4 h-4" />, label: 'Edit' },
            { type: 'divider' },
            { key: 'delete', icon: <Trash2 className="w-4 h-4" />, label: 'Delete', danger: true },
          ] : []),
        ]}
        onAction={(key, rec) => {
          if (key === 'edit') openEdit(rec);
          if (key === 'delete') handleDelete(rec);
        }}
      />
    )},
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Payment Accounts</h4>
          <span className="text-xs text-slate-500">{data?.count || 0} accounts</span>
        </div>
        <Space>
          {canWrite && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}
              className="!bg-brand-dark hover:!bg-brand-light hover:!text-white border-none shadow-sm flex items-center gap-1.5 text-white">
              Add Account
            </Button>
          )}
        </Space>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <KpiCard title="Total Accounts" value={totals.all} icon={Landmark} bgColor="bg-slate-50" iconColor="text-slate-600" />
        <KpiCard title="Cash Balance" value={totals.cash} icon={Landmark} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
        <KpiCard title="Bank Balance" value={totals.bank} icon={Banknote} bgColor="bg-blue-50" iconColor="text-blue-600" formatter={fmt} />
        <KpiCard title="Mobile Money" value={totals.mobile} icon={Smartphone} bgColor="bg-purple-50" iconColor="text-purple-600" formatter={fmt} />
        <KpiCard title="Selcom" value={totals.selcom} icon={SelcomIcon} bgColor="bg-cyan-50" iconColor="text-cyan-600" formatter={fmt} />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Select size="small" placeholder="Account Type" allowClear className="w-full sm:w-40"
            onChange={(v) => setFilters(f => ({ ...f, account_type: v, offset: 0 }))}>
            <Option value="cash">Cash</Option>
            <Option value="bank">Bank</Option>
            <Option value="mobile_money">Mobile Money</Option>
            <Option value="selcom">Selcom</Option>
          </Select>
          <Select size="small" placeholder="Status" allowClear className="w-full sm:w-32"
            onChange={(v) => setFilters(f => ({ ...f, is_active: v, offset: 0 }))}>
            <Option value="true">Active</Option>
            <Option value="false">Inactive</Option>
          </Select>
          <Input.Search size="small" placeholder="Search name" allowClear className="w-full sm:w-44"
            onSearch={(v) => setFilters(f => ({ ...f, search: v || undefined, offset: 0 }))} />
          {(filters.account_type || filters.is_active || filters.search) && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => setFilters({ limit: 50, offset: 0 })}
              className="flex items-center gap-1 !text-xs hover:!border-brand-dark hover:!text-brand-dark">
              Clear
            </Button>
          )}
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
      <div className="hidden overflow-x-auto md:block">
        <Table
          dataSource={rows}
          columns={cols}
          rowKey="id"
          loading={isLoading}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ pageSize: 50, total: data?.count || 0, showSizeChanger: false,
            onChange: (p) => setFilters(f => ({ ...f, offset: (p - 1) * 50 })) }}
        />
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {rows.map(r => (
          <MobileCard
            key={r.id}
            record={r}
            onClick={() => navigate(`/finance/accounts/${r.id}`)}
            fields={[
              { key: 'name', render: (_, rec) => <span className="font-semibold">{rec.name}</span> },
              { key: 'type', label: 'Type', render: (_, rec) => rec.account_type?.replace('_', ' ') },
              { key: 'balance', label: 'Balance', render: (_, rec) => fmt(rec.current_balance) },
            ]}
          />
        ))}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">{editing ? 'Edit Account' : 'Add Account'}</span>}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editing ? 'Update' : 'Create'}
        okButtonProps={{ className: '!bg-brand-dark rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }}
        className="top-8"
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item name="name" label="Account Name" rules={[{ required: true, message: 'Account name is required' }]}>
            <Input placeholder="e.g. Shop 5 Cash" />
          </Form.Item>
          <Form.Item name="account_type" label="Account Type" rules={[{ required: true }]}>
            <Select placeholder="Select type">
              <Option value="cash">Cash</Option>
              <Option value="bank">Bank</Option>
              <Option value="mobile_money">Mobile Money</Option>
              <Option value="selcom">Selcom</Option>
            </Select>
          </Form.Item>
          <Form.Item name="shop_id" label="Shop (optional)">
            <Select placeholder="Link to shop (optional)" allowClear>
              {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="opening_balance" label="Opening Balance (TZS)">
            <InputNumber className="w-full" min={0} placeholder="0" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
