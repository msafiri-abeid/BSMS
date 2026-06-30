import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Upload, Tag, Space, Tabs, App, Typography, List, Empty } from 'antd';
import { Plus, CheckCircle, XCircle, Upload as UploadIcon, FileDown, Search, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

const STATUS_COLORS = { pending: 'orange', approved: 'green', rejected: 'red' };
const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [form] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canApprove = hasPermission('finance', 'approve');

  const params = {};
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data: expenses, isLoading } = useQuery({ queryKey: ['expenses', params], queryFn: () => financeAPI.listExpenses(params).then(r => r.data.data) });
  const { data: pending } = useQuery({ queryKey: ['pending-expenses'], queryFn: () => financeAPI.pendingExpenses().then(r => r.data.data), enabled: canApprove });

  const rows = expenses?.rows || [];
  const totals = { total: 0, approved: 0, pending: 0, rejected: 0 };
  rows.forEach(r => {
    totals.total += r.amount || 0;
    if (r.status === 'approved') totals.approved += r.amount || 0;
    if (r.status === 'pending') totals.pending += r.amount || 0;
    if (r.status === 'rejected') totals.rejected += r.amount || 0;
  });

  const submitMutation = useMutation({
    mutationFn: (fd) => financeAPI.submitExpense(fd),
    onSuccess: () => { message.success('Expense submitted'); qc.invalidateQueries({ queryKey: ['expenses'] }); setOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action, reason }) => financeAPI.approveExpense(id, { action, reason }),
    onSuccess: (_, v) => { message.success(v.action === 'approve' ? 'Approved' : 'Rejected'); qc.invalidateQueries({ queryKey: ['expenses', 'pending-expenses'] }); setRejectModal(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const onSubmit = (values) => {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => { if (k !== 'receipt' && v !== undefined) fd.append(k, v); });
    if (values.receipt?.file) fd.append('receipt', values.receipt.file);
    submitMutation.mutate(fd);
  };

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Date', 'Category', 'Description', 'Amount', 'Status'].join(','),
      ...selected.map(r =>
        [dayjs(r.created_at).format('DD MMM YYYY'), r.category?.name, r.description, r.amount, r.status].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `expenses-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const cols = [
    { title: 'Date', dataIndex: 'created_at', render: v => dayjs(v).format('DD MMM YYYY'), width: 110 },
    { title: 'Category', dataIndex: ['category', 'name'], width: 120 },
    { title: 'Description', dataIndex: 'description', ellipsis: true, width: 200 },
    { title: 'Amount', dataIndex: 'amount', render: v => <span className="font-semibold">{fmt(v)}</span>, width: 120 },
    { title: 'Submitted By', dataIndex: ['submitter', 'name'], width: 130, responsive: ['md'] },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    ...(canApprove ? [{
      title: 'Actions', width: 160,
      render: (_, r) => r.status === 'pending' ? (
        <Space size={4}>
          <Button size="small" icon={<CheckCircle className="w-3.5 h-3.5" />}
            onClick={() => approveMutation.mutate({ id: r.id, action: 'approve' })}
            className="flex items-center gap-1 !text-xs !bg-green-600 hover:!bg-green-700 border-none text-white">
            Approve
          </Button>
          <Button size="small" icon={<XCircle className="w-3.5 h-3.5" />}
            onClick={() => setRejectModal(r)}
            className="flex items-center gap-1 !text-xs !text-red-600 !border-red-300 hover:!bg-red-50">
            Reject
          </Button>
        </Space>
      ) : null,
    }] : []),
  ];

  const mobileFields = [
    { key: 'description', dataIndex: 'description' },
    { key: 'category', label: 'Category', render: (_, r) => r.category?.name || '—' },
    { key: 'amount', label: 'Amount', dataIndex: 'amount' },
  ];

  const hasFilters = search || statusFilter;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Expenses</h4>
          <span className="text-xs text-slate-500">{expenses?.count || 0} total</span>
        </div>
        <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}
          className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
          Submit Expense
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Amount" value={totals.total} icon={FileDown} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
        <KpiCard title="Approved" value={totals.approved} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
        <KpiCard title="Pending" value={totals.pending} icon={XCircle} bgColor="bg-amber-50" iconColor="text-amber-600" formatter={fmt} />
        <KpiCard title="Rejected" value={totals.rejected} icon={X} bgColor="bg-red-50" iconColor="text-red-600" formatter={fmt} />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Input.Search size="small" placeholder="Search description..." allowClear
            defaultValue={search}
            onSearch={(v) => setSearch(v || '')}
            className="w-full sm:w-56" />
          <Select size="small" allowClear placeholder="Status"
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            className="w-32">
            <Option value="pending">Pending</Option>
            <Option value="approved">Approved</Option>
            <Option value="rejected">Rejected</Option>
          </Select>
          {hasFilters && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => { setSearch(''); setStatusFilter(''); }}
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
      <div className="hidden md:block">
        <Table dataSource={rows} columns={cols} rowKey="id" loading={isLoading}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: expenses?.count, pageSize: 20 }} />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <Empty description="No expenses found" />
        ) : (
          <List
            dataSource={rows}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={mobileFields}
                onClick={() => {}}
                statusColor={STATUS_COLORS[r.status]}
              />
            )}
          />
        )}
      </div>

      <Tabs items={canApprove ? [
        {
          key: 'all', label: `All (${expenses?.count || 0})`,
          children: null,
        },
        {
          key: 'pending', label: <span className="text-amber-500">Pending ({pending?.count || 0})</span>,
          children: null,
        },
      ] : []} className="!hidden" />

      {/* Submit Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Submit Expense</span>}
        open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={submitMutation.isPending}
        className="top-8">
        <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
          <Form.Item name="category_id" label={<span className="text-xs font-semibold text-slate-600">Category</span>} rules={[{ required: true }]}>
            <Select placeholder="Select category">
              <Option value={1}>Fuel</Option><Option value={2}>Maintenance</Option>
              <Option value={3}>Office Supplies</Option><Option value={4}>Utilities</Option>
              <Option value={5}>Other</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label={<span className="text-xs font-semibold text-slate-600">Description</span>} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="amount" label={<span className="text-xs font-semibold text-slate-600">Amount (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full" formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
          <Form.Item name="receipt" label={<span className="text-xs font-semibold text-slate-600">Receipt</span>}>
            <Upload beforeUpload={() => false} maxCount={1}>
              <Button icon={<UploadIcon size={14} />}>Attach Receipt</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Reject Expense</span>}
        open={!!rejectModal} onCancel={() => setRejectModal(null)}
        onOk={() => rejectForm.validateFields().then(v => { approveMutation.mutate({ id: rejectModal.id, action: 'reject', reason: v.reason }); rejectForm.resetFields(); })}
        className="top-8">
        <Form form={rejectForm} layout="vertical" className="mt-4">
          <Form.Item name="reason" label={<span className="text-xs font-semibold text-slate-600">Rejection Reason</span>} rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
