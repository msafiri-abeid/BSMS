import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Space, App, Divider, List, Empty } from 'antd';
import { Plus, FileText, DollarSign, Trash2, FileDown, X, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

const STATUS_COLORS = { draft: 'default', sent: 'blue', paid: 'green', overdue: 'red', cancelled: 'default' };
const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function InvoicesPage() {
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [lineItems, setLineItems] = useState([{ description: '', qty: 1, unit_price: 0 }]);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { message } = App.useApp();
  const qc = useQueryClient();

  const params = {};
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({ queryKey: ['invoices', params], queryFn: () => financeAPI.listInvoices(params).then(r => r.data.data) });

  const rows = data?.rows || [];
  const totals = { total: 0, paid: 0, overdue: 0, sent: 0 };
  rows.forEach(r => {
    totals.total += r.total || 0;
    if (r.status === 'paid') totals.paid += r.total || 0;
    if (r.status === 'overdue') totals.overdue += r.total || 0;
    if (r.status === 'sent') totals.sent += r.total || 0;
  });

  const createMutation = useMutation({
    mutationFn: (d) => financeAPI.createInvoice(d),
    onSuccess: () => { message.success('Invoice created'); qc.invalidateQueries({ queryKey: ['invoices'] }); setOpen(false); form.resetFields(); setLineItems([{ description: '', qty: 1, unit_price: 0 }]); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, ...d }) => financeAPI.recordPayment(id, d),
    onSuccess: () => { message.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['invoices'] }); setPayOpen(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const downloadPDF = async (id, refNo) => {
    const res = await fetch(`/api/finance/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('bentabet-auth'))?.state?.accessToken}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${refNo}.pdf`; a.click();
  };

  const subtotal = lineItems.reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0);

  const addLineItem = () => setLineItems(prev => [...prev, { description: '', qty: 1, unit_price: 0 }]);
  const removeLineItem = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx));
  const updateLineItem = (idx, field, value) => setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Reference', 'Partner', 'Total', 'Due Date', 'Status'].join(','),
      ...selected.map(r => [r.reference_no, r.partner?.name, r.total, r.due_date, r.status].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `invoices-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const cols = [
    { title: 'Reference', dataIndex: 'reference_no', render: v => <span className="font-semibold">{v}</span>, width: 140 },
    { title: 'Partner', dataIndex: ['partner', 'name'], width: 150, responsive: ['md'] },
    { title: 'Total', dataIndex: 'total', render: v => fmt(v), width: 120 },
    { title: 'Due Date', dataIndex: 'due_date', width: 110 },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    {
      title: 'Actions', width: 160,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<FileText className="w-3.5 h-3.5" />} onClick={() => downloadPDF(r.id, r.reference_no)}
            className="flex items-center gap-1 !text-xs">
            PDF
          </Button>
          {['sent', 'overdue'].includes(r.status) && (
            <Button size="small" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => setPayOpen(r)}
              className="flex items-center gap-1 !text-xs !bg-green-600 hover:!bg-green-700 border-none text-white">
              Record Payment
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const mobileFields = [
    { key: 'reference', dataIndex: 'reference_no' },
    { key: 'partner', label: 'Partner', render: (_, r) => r.partner?.name || '—' },
    { key: 'total', label: 'Total', dataIndex: 'total' },
  ];

  const hasFilters = search || statusFilter;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Invoices</h4>
          <span className="text-xs text-slate-500">{data?.count || 0} total</span>
        </div>
        <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}
          className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
          New Invoice
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Amount" value={totals.total} icon={FileText} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
        <KpiCard title="Paid" value={totals.paid} icon={DollarSign} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
        <KpiCard title="Outstanding" value={totals.sent + totals.overdue} icon={FileText} bgColor="bg-amber-50" iconColor="text-amber-600" formatter={fmt} />
        <KpiCard title="Overdue" value={totals.overdue} icon={X} bgColor="bg-red-50" iconColor="text-red-600" formatter={fmt} />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Input.Search size="small" placeholder="Search reference..." allowClear
            defaultValue={search}
            onSearch={(v) => setSearch(v || '')}
            className="w-full sm:w-56" />
          <Select size="small" allowClear placeholder="Status"
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            className="w-full sm:w-32">
            <Option value="draft">Draft</Option>
            <Option value="sent">Sent</Option>
            <Option value="paid">Paid</Option>
            <Option value="overdue">Overdue</Option>
            <Option value="cancelled">Cancelled</Option>
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
      <div className="hidden overflow-x-auto md:block">
        <Table dataSource={rows} columns={cols} rowKey="id" loading={isLoading}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: data?.count, pageSize: 20 }} />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <Empty description="No invoices found" />
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

      {/* Create Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Create Invoice</span>}
        open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}
        confirmLoading={createMutation.isPending} width={640}
        className="top-8">
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate({ ...v, line_items: lineItems })} className="mt-4">
          <Form.Item name="due_date" label={<span className="text-xs font-semibold text-slate-600">Due Date</span>}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="notes" label={<span className="text-xs font-semibold text-slate-600">Notes</span>}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Divider plain className="!text-xs !text-slate-400">Line Items</Divider>
          {lineItems.map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <Input placeholder="Description" value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} className="flex-[3]" />
              <InputNumber placeholder="Qty" value={item.qty} min={1} onChange={v => updateLineItem(idx, 'qty', v)} className="w-[70px]" />
              <InputNumber placeholder="Unit Price" value={item.unit_price} min={0} onChange={v => updateLineItem(idx, 'unit_price', v)} className="w-[120px]" />
              <Button size="small" danger icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => removeLineItem(idx)} />
            </div>
          ))}
          <Button type="dashed" onClick={addLineItem} block className="mb-4">+ Add Item</Button>
          <div className="text-right text-base font-semibold mb-2">Subtotal: TZS {subtotal.toLocaleString()}</div>
          <Form.Item name="tax_pct" label={<span className="text-xs font-semibold text-slate-600">Tax %</span>} initialValue={0} className="max-w-[120px]">
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Payment Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Record Payment — {payOpen?.reference_no}</span>}
        open={!!payOpen} onCancel={() => setPayOpen(null)}
        onOk={() => payForm.submit()} confirmLoading={payMutation.isPending}
        className="top-8">
        <p className="mb-4 mt-4 text-sm">Invoice total: <strong className="font-semibold">TZS {payOpen?.total?.toLocaleString()}</strong></p>
        <Form form={payForm} layout="vertical" onFinish={(v) => payMutation.mutate({ id: payOpen.id, ...v, paid_at: new Date().toISOString() })} className="mt-4">
          <Form.Item name="amount" label={<span className="text-xs font-semibold text-slate-600">Amount (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="method" label={<span className="text-xs font-semibold text-slate-600">Payment Method</span>} rules={[{ required: true }]}>
            <Select><Option value="cash">Cash</Option><Option value="bank_transfer">Bank Transfer</Option><Option value="mobile_money">Mobile Money</Option><Option value="cheque">Cheque</Option></Select>
          </Form.Item>
          <Form.Item name="reference_no" label={<span className="text-xs font-semibold text-slate-600">Reference Number</span>}>
            <Input />
          </Form.Item>
          <Form.Item name="notes" label={<span className="text-xs font-semibold text-slate-600">Notes</span>}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
