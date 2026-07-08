import { useState } from 'react';
import { Table, Tag, Button, Space, Select, Input, InputNumber, Typography, Modal, Form, Upload, App, Card, Dropdown, List, Empty } from 'antd';
import { Plus, Wallet, CheckCircle, XCircle, Upload as UploadIcon, FileText, Download, X, MoreHorizontal, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debtsAPI, machinesAPI, shopsAPI } from '../../services/api';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const STATUS_COLORS = { pending: 'orange', partial: 'blue', paid: 'green', written_off: 'default' };
const TYPE_COLORS = { token: 'red', commission: 'purple', advance: 'orange', shortage: 'red', other: 'default' };
const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

const KpiCard = ({ title, value, icon: Icon, bgColor, iconColor, formatter }) => (
  <div className="rounded-lg border border-slate-100 p-4 bg-white hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-800 tracking-tight mt-1">
          {formatter ? formatter(value) : (value ?? 0)}
        </p>
      </div>
      <div className={`p-3 rounded-xl ${bgColor} flex items-center justify-center ml-4`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
    </div>
  </div>
);

export default function DebtsPage() {
  const [filters, setFilters] = useState({ limit: 50, offset: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['debts', filters],
    queryFn: () => debtsAPI.list(filters).then(r => r.data.data),
  });

  const { data: machinesData } = useQuery({ queryKey: ['machines-list'], queryFn: () => machinesAPI.list({ limit: 200 }).then(r => r.data.data) });
  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });

  const machines = machinesData?.rows || [];
  const shops = shopsData?.rows || [];

  const debts = data?.rows || [];
  const summary = debts.reduce((acc, d) => ({
    total: acc.total + d.amount,
    paid: acc.paid + d.paid_amount,
    outstanding: acc.outstanding + (d.amount - d.paid_amount),
  }), { total: 0, paid: 0, outstanding: 0 });

  const createMutation = useMutation({
    mutationFn: (d) => debtsAPI.create(d),
    onSuccess: () => { message.success('Debt recorded'); qc.invalidateQueries({ queryKey: ['debts'] }); setCreateOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, formData }) => debtsAPI.recordPayment(id, formData),
    onSuccess: () => { message.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['debts'] }); setPayOpen(null); payForm.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const writeOffMutation = useMutation({
    mutationFn: ({ id, reason }) => debtsAPI.writeOff(id, { reason }),
    onSuccess: () => { message.success('Debt written off'); qc.invalidateQueries({ queryKey: ['debts'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const handleExport = async () => {
    const res = await debtsAPI.exportDebts(filters);
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a'); a.href = url;
    a.download = `debts-${dayjs().format('YYYY-MM-DD')}.xlsx`; a.click();
  };

  const handleExportSelected = () => {
    const selected = debts.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Machine', 'Shop', 'Type', 'Amount', 'Paid', 'Outstanding', 'Status', 'Date'].join(','),
      ...selected.map(r =>
        [r.machine?.slot_code, r.shop?.name, r.type, r.amount, r.paid_amount,
         r.amount - r.paid_amount, r.status,
         dayjs(r.createdAt).format('DD MMM YYYY')].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `debts-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const cols = [
    { title: 'Machine', dataIndex: ['machine', 'slot_code'], render: v => v || '—', width: 120 },
    { title: 'Shop', dataIndex: ['shop', 'name'], render: v => v || '—', width: 150 },
    { title: 'Amount', dataIndex: 'amount', render: v => <span className="font-semibold text-slate-700">{fmt(v)}</span>, width: 110 },
    { title: 'Paid', dataIndex: 'paid_amount', render: v => <span className="text-emerald-600 font-semibold">{fmt(v)}</span>, width: 100 },
    {
      title: 'Outstanding', render: (_, r) => {
        const out = r.amount - r.paid_amount;
        return <span className={`font-semibold ${out > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(out)}</span>;
      }, width: 120,
    },
    {
      title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 100,
    },
    {
      title: 'Receipt', dataIndex: 'receipt_url', width: 80,
      render: (v) => v ? <Tag color="green" className="!text-[10px]">Attached</Tag> : <span className="text-xs text-slate-300">No</span>,
    },
    {
      title: 'Actions', width: 60,
      render: (_, r) => {
        const out = r.amount - r.paid_amount;
        const items = [
          { key: 'view', icon: <Eye className="w-4 h-4" />, label: 'View', onClick: () => setViewRecord(r) },
        ];
        if (r.status !== 'paid' && r.status !== 'written_off') {
          items.push(
            { key: 'pay', icon: <Wallet className="w-4 h-4" />, label: 'Pay', onClick: () => { setPayOpen(r); payForm.resetFields(); } },
            { key: 'writeoff', icon: <XCircle className="w-4 h-4" />, label: 'Write Off', onClick: () => {
              Modal.confirm({
                title: 'Write off this debt?',
                content: `Outstanding: ${fmt(out)}`,
                onOk: () => writeOffMutation.mutate({ id: r.id, reason: 'Written off' }),
              });
            }},
          );
        }
        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreHorizontal className="w-4 h-4" />} className="!text-slate-500 hover:!text-brand-dark" />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Machine Debts</h4>
          <span className="text-xs text-slate-500">{data?.count || 0} total records</span>
        </div>
        <Space>
          <Button icon={<Download className="w-4 h-4" />} onClick={handleExport}
            className="flex items-center gap-1.5">
            Export
          </Button>
          <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => { form.resetFields(); setCreateOpen(true); }}
            className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5">
            Record Debt
          </Button>
        </Space>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Debts" value={summary.total} icon={Wallet} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
        <KpiCard title="Total Paid" value={summary.paid} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
        <KpiCard title="Outstanding" value={summary.outstanding} icon={XCircle} bgColor="bg-red-50" iconColor="text-red-600" formatter={fmt} />
      </div>

      <Card size="small" className="mb-4 border border-slate-100">
        <Space wrap size={[8, 8]}>
          <Select size="small" placeholder="Machine" value={filters.machine_id} onChange={(v) => setFilters(p => ({ ...p, machine_id: v }))} className="w-full sm:w-[140px]" allowClear>
            {machines.map(m => <Option key={m.id} value={String(m.id)}>{m.slot_code}</Option>)}
          </Select>
          <Select size="small" placeholder="Shop" value={filters.shop_id} onChange={(v) => setFilters(p => ({ ...p, shop_id: v }))} className="w-full sm:w-[140px]" allowClear>
            {shops.map(s => <Option key={s.id} value={String(s.id)}>{s.name}</Option>)}
          </Select>
          <Select size="small" placeholder="Status" value={filters.status} onChange={(v) => setFilters(p => ({ ...p, status: v }))} className="w-full sm:w-[120px]" allowClear>
            <Option value="pending">Pending</Option>
            <Option value="partial">Partial</Option>
            <Option value="paid">Paid</Option>
            <Option value="written_off">Written Off</Option>
          </Select>
          <Select size="small" placeholder="Type" value={filters.type} onChange={(v) => setFilters(p => ({ ...p, type: v }))} className="w-full sm:w-[120px]" allowClear>
            <Option value="token">Token</Option>
            <Option value="commission">Commission</Option>
            <Option value="advance">Advance</Option>
            <Option value="shortage">Shortage</Option>
            <Option value="other">Other</Option>
          </Select>
          {(filters.machine_id || filters.shop_id || filters.status || filters.type) && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => setFilters({ limit: 50, offset: 0 })}
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
            <Button size="small" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportSelected}
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
        <Table dataSource={debts} columns={cols} rowKey="id" loading={isLoading} size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: data?.count, pageSize: 20, showSizeChanger: false,
            onChange: (p) => setFilters(f => ({ ...f, offset: (p - 1) * 20 })) }}
          summary={() => debts.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-slate-50 font-semibold">
                <Table.Summary.Cell index={0} colSpan={2}>TOTAL ({data?.count || 0} records)</Table.Summary.Cell>
                <Table.Summary.Cell index={2}>{fmt(summary.total)}</Table.Summary.Cell>
                <Table.Summary.Cell index={3}>{fmt(summary.paid)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4}>{fmt(summary.outstanding)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} />
                <Table.Summary.Cell index={6} />
                <Table.Summary.Cell index={7} />
              </Table.Summary.Row>
            </Table.Summary>
          ) : null} />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {debts.length === 0 ? (
          <Empty description="No debts found" />
        ) : (
          <List
            dataSource={debts}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={[
                  { key: 'machine', dataIndex: ['machine', 'slot_code'] },
                  { key: 'shop', label: 'Shop', dataIndex: ['shop', 'name'] },
                  { key: 'outstanding', label: 'Outstanding', render: (_, r2) => fmt(r2.amount - r2.paid_amount) },
                ]}
                onClick={() => setViewRecord(r)}
                statusColor={STATUS_COLORS[r.status]}
                actions={[
                  { key: 'view', label: 'View', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setViewRecord(r) },
                  ...(r.status !== 'paid' && r.status !== 'written_off' ? [
                    { key: 'pay', label: 'Pay', type: 'primary', icon: <Wallet className="w-3.5 h-3.5" />, onClick: () => { setPayOpen(r); payForm.resetFields(); } },
                  ] : []),
                ]}
              />
            )}
          />
        )}
      </div>

      {/* View Debt Detail Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Debt Details — {viewRecord?.machine?.slot_code}</span>}
        open={!!viewRecord} onCancel={() => setViewRecord(null)}
        footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}
        width={520} className="top-8">
        {viewRecord && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><span className="text-xs font-semibold text-slate-500 block">Machine</span><span className="font-medium">{viewRecord.machine?.slot_code || '—'}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Shop</span><span>{viewRecord.shop?.name || '—'}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Type</span><Tag color={TYPE_COLORS[viewRecord.type]} className="!text-[10px]">{viewRecord.type}</Tag></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Status</span><Tag color={STATUS_COLORS[viewRecord.status]} className="!text-[10px] uppercase">{viewRecord.status}</Tag></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Amount</span><span className="font-bold">{fmt(viewRecord.amount)}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Paid</span><span className="font-semibold text-emerald-600">{fmt(viewRecord.paid_amount)}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Outstanding</span><span className={`font-semibold ${(viewRecord.amount - viewRecord.paid_amount) > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(viewRecord.amount - viewRecord.paid_amount)}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Date</span><span>{dayjs(viewRecord.createdAt).format('DD MMM YYYY')}</span></div>
              <div><span className="text-xs font-semibold text-slate-500 block">Receipt</span>{viewRecord.receipt_url ? <a href={viewRecord.receipt_url} target="_blank" rel="noopener noreferrer" className="text-brand-dark underline">View Receipt</a> : <span className="text-slate-400">None</span>}</div>
            </div>
            {viewRecord.reason && (
              <div className="border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-500 block mb-1">Reason</span>
                <p className="text-sm text-slate-700">{viewRecord.reason}</p>
              </div>
            )}
            <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-4">
              <Card size="small" className="text-center border border-slate-100"><span className="text-xs font-semibold text-slate-500 block">Amount</span><span className="text-lg font-bold text-slate-800">{fmt(viewRecord.amount)}</span></Card>
              <Card size="small" className="text-center border border-slate-100"><span className="text-xs font-semibold text-slate-500 block">Paid</span><span className="text-lg font-bold text-emerald-600">{fmt(viewRecord.paid_amount)}</span></Card>
              <Card size="small" className="text-center border border-slate-100"><span className="text-xs font-semibold text-slate-500 block">Outstanding</span><span className={`text-lg font-bold ${(viewRecord.amount - viewRecord.paid_amount) > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(viewRecord.amount - viewRecord.paid_amount)}</span></Card>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Debt Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Record Machine Debt</span>}
        open={createOpen} onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending}
        className="top-8">
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} className="mt-4">
          <Form.Item name="machine_id" label={<span className="text-xs font-semibold text-slate-600">Machine</span>} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {machines.map(m => <Option key={m.id} value={m.id}>{m.slot_code}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="shop_id" label={<span className="text-xs font-semibold text-slate-600">Shop</span>} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="type" label={<span className="text-xs font-semibold text-slate-600">Type</span>} initialValue="token">
            <Select>
              <Option value="token">Token</Option>
              <Option value="commission">Commission (auto)</Option>
              <Option value="advance">Advance</Option>
              <Option value="shortage">Shortage</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item name="amount" label={<span className="text-xs font-semibold text-slate-600">Amount (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="reason" label={<span className="text-xs font-semibold text-slate-600">Reason</span>}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Record Payment</span>}
        open={!!payOpen} onCancel={() => setPayOpen(null)}
        onOk={() => payForm.submit()} confirmLoading={payMutation.isPending}
        className="top-8">
        <p className="mb-4 text-sm">Outstanding: <strong className="text-red-600">{fmt((payOpen?.amount || 0) - (payOpen?.paid_amount || 0))}</strong></p>
        <Form form={payForm} layout="vertical" onFinish={(v) => {
          const fd = new FormData();
          fd.append('amount', String(v.amount));
          if (v.receipt?.fileList?.length) {
            fd.append('receipt', v.receipt.fileList[0].originFileObj);
          }
          payMutation.mutate({ id: payOpen.id, formData: fd });
        }} className="mt-4">
          <Form.Item name="amount" label={<span className="text-xs font-semibold text-slate-600">Payment Amount (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={1} max={(payOpen?.amount || 0) - (payOpen?.paid_amount || 0)} className="w-full" />
          </Form.Item>
          <Form.Item name="receipt" label={<span className="text-xs font-semibold text-slate-600">Payment Receipt</span>}>
            <Upload beforeUpload={() => false} accept="image/*,application/pdf" maxCount={1}>
              <Button icon={<UploadIcon size={14} />}>Upload Receipt</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
