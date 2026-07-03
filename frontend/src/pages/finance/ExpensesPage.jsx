import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Upload, Tag, Space, App, Typography, List, Empty, Segmented, DatePicker } from 'antd';
import { Plus, CheckCircle, XCircle, Upload as UploadIcon, FileDown, Search, X, Store, Cpu, Smartphone, Wallet, Eye, Edit3, Trash2 } from 'lucide-react';
import ActionMenu from '../../components/ActionMenu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI, shopsAPI, machinesAPI } from '../../services/api';
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
  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [form] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedShop, setSelectedShop] = useState(undefined);
  const [bizTypeFilter, setBizTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canApprove = hasPermission('finance', 'approve');

  const params = {};
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;
  if (bizTypeFilter) params.business_type = bizTypeFilter;
  if (dateFilter) params.date = dateFilter;

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', params],
    queryFn: () => financeAPI.listExpenses(params).then(r => r.data.data),
  });
  const { data: pending } = useQuery({ queryKey: ['pending-expenses'], queryFn: () => financeAPI.pendingExpenses().then(r => r.data.data), enabled: canApprove });
  const { data: categories } = useQuery({ queryKey: ['expense-categories'], queryFn: () => financeAPI.listCategories().then(r => r.data.data) });
  const { data: shopsList } = useQuery({ queryKey: ['shops'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const { data: machinesByShop } = useQuery({
    queryKey: ['machines-by-shop', selectedShop],
    queryFn: () => machinesAPI.list({ shop_id: selectedShop, limit: 200 }).then(r => r.data.data),
    enabled: !!selectedShop,
  });

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
    onSuccess: () => { message.success('Expense submitted'); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['shop-expenses'] }); qc.invalidateQueries({ queryKey: ['machine-expenses'] }); setOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action, reason }) => financeAPI.approveExpense(id, { action, reason }),
    onSuccess: (_, v) => { message.success(v.action === 'approve' ? 'Approved' : 'Rejected'); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['pending-expenses'] }); qc.invalidateQueries({ queryKey: ['shop-expenses'] }); qc.invalidateQueries({ queryKey: ['machine-expenses'] }); setRejectModal(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: (fd) => financeAPI.updateExpense(editRecord.id, fd),
    onSuccess: () => { message.success('Expense updated'); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['shop-expenses'] }); qc.invalidateQueries({ queryKey: ['machine-expenses'] }); setOpen(false); setEditRecord(null); form.resetFields(); setSelectedShop(undefined); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => financeAPI.removeExpense(id),
    onSuccess: () => { message.success('Expense deleted'); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['shop-expenses'] }); qc.invalidateQueries({ queryKey: ['machine-expenses'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const confirmDelete = (r) => {
    modal.confirm({
      title: 'Delete Expense',
      content: `Are you sure you want to delete this expense (TZS ${(r.amount || 0).toLocaleString()})?`,
      okText: 'Delete', okButtonProps: { danger: true },
      onOk: () => deleteMutation.mutate(r.id),
    });
  };

  const handleAction = (key, r) => {
    if (key === 'view') setViewRecord(r);
    if (key === 'edit') { setEditRecord(r); setOpen(true); }
    if (key === 'delete') confirmDelete(r);
  };

  const actionItems = (r) => {
    const items = [
      { key: 'view', label: 'View', icon: <Eye className="w-4 h-4" /> },
    ];
    if (r.status === 'pending') {
      items.push({ key: 'edit', label: 'Edit', icon: <Edit3 className="w-4 h-4" /> });
      items.push({ key: 'delete', label: 'Delete', icon: <Trash2 className="w-4 h-4" />, danger: true });
    }
    return items;
  };

  useEffect(() => {
    if (editRecord) {
      form.setFieldsValue({
        ...editRecord,
        category_id: editRecord.category_id || editRecord.category?.id,
        shop_id: editRecord.shop_id,
        machine_id: editRecord.machine_id || undefined,
        expense_date: editRecord.expense_date ? dayjs(editRecord.expense_date) : dayjs(),
      });
      if (editRecord.shop_id) setSelectedShop(editRecord.shop_id);
    }
  }, [editRecord]);

  const onSubmit = (values) => {
    if (editRecord) {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (v === undefined) return;
        if (k === 'expense_date' && v) { fd.append(k, dayjs(v).format('YYYY-MM-DD')); return; }
        fd.append(k, v);
      });
      updateMutation.mutate(fd);
    } else {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (k === 'receipt' || v === undefined) return;
        if (k === 'expense_date' && v) { fd.append(k, dayjs(v).format('YYYY-MM-DD')); return; }
        fd.append(k, v);
      });
      if (values.receipt?.file) fd.append('receipt', values.receipt.file);
      submitMutation.mutate(fd);
    }
  };

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Date', 'Category', 'Description', 'Amount', 'Status', 'Business Type'].join(','),
      ...selected.map(r =>
        [dayjs(r.created_at).format('DD MMM YYYY'), r.category?.name, r.description, r.amount, r.status, r.business_type].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `expenses-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const cols = [
    { title: 'Date', dataIndex: 'expense_date', render: v => dayjs(v).format('DD MMM YYYY'), width: 110 },
    { title: 'Category', key: 'category', render: (_, r) => r.category?.name || '—', width: 120 },
    { title: 'Amount', dataIndex: 'amount', render: v => <span className="font-semibold">{fmt(v)}</span>, width: 120 },
    { title: 'Business', dataIndex: 'business_type', render: v => <Tag color={v === 'bentabet' ? 'purple' : 'blue'} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    { title: 'Submitted By', key: 'submitter', render: (_, r) => r.submitter?.name || r.submitted_by || '—', width: 130, responsive: ['md'] },
    { title: 'Approved By', key: 'approver', render: (_, r) => r.approver?.name || '—', width: 130, responsive: ['md'] },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    {
      title: 'Actions', width: 55, align: 'center',
      render: (_, r) => <ActionMenu record={r} actionItems={actionItems} onAction={handleAction} />,
    },
  ];

  const mobileFields = [
    { key: 'description', dataIndex: 'description' },
    { key: 'category', label: 'Category', render: (_, r) => r.category?.name || '—' },
    { key: 'amount', label: 'Amount', dataIndex: 'amount' },
  ];

  const hasFilters = search || statusFilter || bizTypeFilter || dateFilter;

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
          <Select size="small" allowClear placeholder="Business Type"
            value={bizTypeFilter || undefined}
            onChange={(v) => setBizTypeFilter(v || '')}
            className="w-36">
            <Option value="meteora">Meteora</Option>
            <Option value="bentabet">Bentabet</Option>
          </Select>
          <DatePicker size="small" className="w-36"
            value={dateFilter ? dayjs(dateFilter) : null}
            onChange={(d) => setDateFilter(d ? d.format('YYYY-MM-DD') : '')}
            placeholder="Filter date" />
          <Select size="small" allowClear placeholder="Status"
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            className="w-32">
            <Option value="pending">Pending</Option>
            <Option value="approved">Approved</Option>
            <Option value="rejected">Rejected</Option>
          </Select>
          {hasFilters && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => { setSearch(''); setStatusFilter(''); setBizTypeFilter(''); setDateFilter(''); }}
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
        <Table dataSource={rows} columns={cols} rowKey={(r) => r.id} loading={isLoading}
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

      {/* Submit / Edit Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">{editRecord ? 'Edit Expense' : 'Submit Expense'}</span>}
        open={open} onCancel={() => { setOpen(false); setEditRecord(null); form.resetFields(); setSelectedShop(undefined); }}
        onOk={() => form.submit()} confirmLoading={editRecord ? updateMutation.isPending : submitMutation.isPending}
        className="top-8">
        <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
          <Form.Item name="business_type" label={<span className="text-xs font-semibold text-slate-600">Business Type</span>} rules={[{ required: true }]} initialValue="meteora">
            <Select>
              <Option value="meteora">Meteora</Option>
              <Option value="bentabet">Bentabet</Option>
            </Select>
          </Form.Item>
          <Form.Item name="payment_source" label={<span className="text-xs font-semibold text-slate-600">Payment Source</span>} rules={[{ required: true }]} initialValue="cash">
            <Select>
              <Option value="cash">Cash (from float/collection)</Option>
              <Option value="selcom">Selcom Account</Option>
            </Select>
          </Form.Item>
          <Form.Item name="shop_id" label={<span className="text-xs font-semibold text-slate-600">Shop</span>} rules={[{ required: true }]}>
            <Select placeholder="Select shop" showSearch optionFilterProp="children"
              onChange={(v) => { setSelectedShop(v); form.setFieldValue('machine_id', undefined); }}>
              {(shopsList?.rows || shopsList || []).map(s => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="machine_id" label={<span className="text-xs font-semibold text-slate-600">Machine <span className="text-slate-400 font-normal">(optional)</span></span>}>
            <Select placeholder="Select machine (optional)" allowClear showSearch optionFilterProp="children"
              disabled={!selectedShop}>
              {(machinesByShop?.rows || machinesByShop || []).map(m => (
                <Option key={m.id} value={m.id}>{m.slot_code}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="expense_date" label={<span className="text-xs font-semibold text-slate-600">Expense Date</span>} rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker className="w-full rounded-lg h-9" disabledDate={(d) => d.isAfter(dayjs())} />
          </Form.Item>
          <Form.Item name="category_id" label={<span className="text-xs font-semibold text-slate-600">Category</span>} rules={[{ required: true }]}>
            <Select placeholder="Select category">
              {(categories || []).map(c => (
                <Option key={c.id} value={c.id}>{c.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label={<span className="text-xs font-semibold text-slate-600">Description</span>} rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="amount" label={<span className="text-xs font-semibold text-slate-600">Amount (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full"
              formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v.replace(/[^0-9]/g, ''))} />
          </Form.Item>
          {!editRecord && (
            <Form.Item name="receipt" label={<span className="text-xs font-semibold text-slate-600">Receipt</span>}>
              <Upload beforeUpload={() => false} maxCount={1}>
                <Button icon={<UploadIcon size={14} />}>Attach Receipt</Button>
              </Upload>
            </Form.Item>
          )}
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

      {/* View Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Expense Details</span>}
        open={!!viewRecord} onCancel={() => setViewRecord(null)}
        footer={viewRecord && canApprove && viewRecord.status === 'pending' ? (
          <Space>
            <Button type="primary" icon={<CheckCircle className="w-4 h-4" />}
              onClick={() => { approveMutation.mutate({ id: viewRecord.id, action: 'approve' }); setViewRecord(null); }}
              className="!bg-green-600 hover:!bg-green-700 border-none flex items-center gap-1.5">
              Approve
            </Button>
            <Button icon={<XCircle className="w-4 h-4" />}
              onClick={() => { setRejectModal(viewRecord); setViewRecord(null); }}
              className="flex items-center gap-1.5 !text-red-600 !border-red-300 hover:!bg-red-50">
              Reject
            </Button>
          </Space>
        ) : null}
        className="top-8">
        {viewRecord && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Description</span>
              <span className="text-sm font-medium text-slate-700 text-right max-w-[240px]">{viewRecord.description}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Category</span>
              <span className="text-sm font-medium text-slate-700">{viewRecord.category?.name || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Amount</span>
              <span className="text-sm font-semibold text-slate-700">{fmt(viewRecord.amount)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Date</span>
              <span className="text-sm font-medium text-slate-700">{dayjs(viewRecord.expense_date).format('DD MMM YYYY')}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Business Type</span>
              <Tag color={viewRecord.business_type === 'bentabet' ? 'purple' : 'blue'} className="!text-[10px] uppercase m-0">{viewRecord.business_type}</Tag>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Submitted By</span>
              <span className="text-sm font-medium text-slate-700">{viewRecord.submitter?.name || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Approved By</span>
              <span className="text-sm font-medium text-slate-700">{viewRecord.approver?.name || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Status</span>
              <Tag color={STATUS_COLORS[viewRecord.status]} className="!text-[10px] uppercase m-0">{viewRecord.status}</Tag>
            </div>
            {viewRecord.receipt_url && (
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500">Receipt</span>
                <a href={viewRecord.receipt_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-brand-dark hover:underline">View Receipt</a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
