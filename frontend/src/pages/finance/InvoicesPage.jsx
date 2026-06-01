// src/pages/finance/InvoicesPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Space, App, Typography, Divider } from 'antd';
import { PlusOutlined, FilePdfOutlined, DollarOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const STATUS_COLORS = { draft: 'default', sent: 'blue', paid: 'green', overdue: 'red', cancelled: 'default' };

export default function InvoicesPage() {
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [lineItems, setLineItems] = useState([{ description: '', qty: 1, unit_price: 0 }]);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['invoices'], queryFn: () => financeAPI.listInvoices().then(r => r.data.data) });

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

  const cols = [
    { title: 'Reference', dataIndex: 'reference_no', render: v => <strong>{v}</strong> },
    { title: 'Partner', dataIndex: ['partner', 'name'] },
    { title: 'Total', dataIndex: 'total', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Due Date', dataIndex: 'due_date' },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    {
      title: 'Actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => downloadPDF(r.id, r.reference_no)}>PDF</Button>
          {['sent', 'overdue'].includes(r.status) && (
            <Button size="small" icon={<DollarOutlined />} type="primary" style={{ background: '#52c41a', border: 'none' }} onClick={() => setPayOpen(r)}>Record Payment</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Invoices</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} style={{ background: '#1a6b3a' }}>New Invoice</Button>
      </div>
      <Table dataSource={data?.rows || []} columns={cols} rowKey="id" loading={isLoading} size="middle" />

      <Modal title="Create Invoice" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}
        confirmLoading={createMutation.isPending} width={640}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate({ ...v, line_items: lineItems })} style={{ marginTop: 16 }}>
          <Form.Item name="due_date" label="Due Date"><Input type="date" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
          <Divider plain>Line Items</Divider>
          {lineItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <Input placeholder="Description" value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} style={{ flex: 3 }} />
              <InputNumber placeholder="Qty" value={item.qty} min={1} onChange={v => updateLineItem(idx, 'qty', v)} style={{ width: 70 }} />
              <InputNumber placeholder="Unit Price" value={item.unit_price} min={0} onChange={v => updateLineItem(idx, 'unit_price', v)} style={{ width: 120 }} />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeLineItem(idx)} />
            </div>
          ))}
          <Button type="dashed" onClick={addLineItem} block style={{ marginBottom: 16 }}>+ Add Item</Button>
          <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 600 }}>Subtotal: TZS {subtotal.toLocaleString()}</div>
          <Form.Item name="tax_pct" label="Tax %" initialValue={0} style={{ maxWidth: 120, marginTop: 8 }}>
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Record Payment — ${payOpen?.reference_no}`} open={!!payOpen} onCancel={() => setPayOpen(null)}
        onOk={() => payForm.submit()} confirmLoading={payMutation.isPending}>
        <Form form={payForm} layout="vertical" onFinish={(v) => payMutation.mutate({ id: payOpen.id, ...v, paid_at: new Date().toISOString() })} style={{ marginTop: 16 }}>
          <Form.Item name="amount" label={`Amount (Invoice total: TZS ${payOpen?.total?.toLocaleString()})`} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} initialValue={payOpen?.total} />
          </Form.Item>
          <Form.Item name="method" label="Payment Method" rules={[{ required: true }]}>
            <Select><Option value="cash">Cash</Option><Option value="bank_transfer">Bank Transfer</Option><Option value="mobile_money">Mobile Money</Option><Option value="cheque">Cheque</Option></Select>
          </Form.Item>
          <Form.Item name="reference_no" label="Reference Number"><Input /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
