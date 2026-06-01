// src/pages/finance/ExpensesPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Upload, Tag, Space, Tabs, App, Typography, Popconfirm } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const STATUS_COLORS = { pending: 'orange', approved: 'green', rejected: 'red' };

export default function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [form] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canApprove = hasPermission('finance', 'approve');

  const { data: expenses, isLoading } = useQuery({ queryKey: ['expenses'], queryFn: () => financeAPI.listExpenses().then(r => r.data.data) });
  const { data: pending } = useQuery({ queryKey: ['pending-expenses'], queryFn: () => financeAPI.pendingExpenses().then(r => r.data.data), enabled: canApprove });

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

  const cols = [
    { title: 'Date', dataIndex: 'created_at', render: v => dayjs(v).format('DD MMM YYYY') },
    { title: 'Category', dataIndex: ['category', 'name'] },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'Amount', dataIndex: 'amount', render: v => <strong>TZS {v?.toLocaleString()}</strong> },
    { title: 'Submitted By', dataIndex: ['submitter', 'name'] },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    ...(canApprove ? [{
      title: 'Actions',
      render: (_, r) => r.status === 'pending' ? (
        <Space>
          <Popconfirm title="Approve this expense?" onConfirm={() => approveMutation.mutate({ id: r.id, action: 'approve' })}>
            <Button size="small" type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a', border: 'none' }}>Approve</Button>
          </Popconfirm>
          <Button size="small" danger icon={<CloseOutlined />} onClick={() => setRejectModal(r)}>Reject</Button>
        </Space>
      ) : null,
    }] : []),
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Expenses</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} style={{ background: '#1a6b3a' }}>
          Submit Expense
        </Button>
      </div>

      <Tabs items={[
        {
          key: 'all', label: `All (${expenses?.count || 0})`,
          children: <Table dataSource={expenses?.rows || []} columns={cols} rowKey="id" loading={isLoading} size="small" />,
        },
        ...(canApprove ? [{
          key: 'pending', label: <span style={{ color: '#faad14' }}>Pending ({pending?.count || 0})</span>,
          children: <Table dataSource={pending?.rows || []} columns={cols} rowKey="id" size="small" />,
        }] : []),
      ]} />

      <Modal title="Submit Expense" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={submitMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={onSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="category_id" label="Category" rules={[{ required: true }]}>
            <Select placeholder="Select category">
              <Option value={1}>Fuel</Option><Option value={2}>Maintenance</Option>
              <Option value={3}>Office Supplies</Option><Option value={4}>Utilities</Option>
              <Option value={5}>Other</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="amount" label="Amount (TZS)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
          <Form.Item name="receipt" label="Receipt">
            <Upload beforeUpload={() => false} maxCount={1}><Button icon={<UploadOutlined />}>Attach Receipt</Button></Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Reject Expense" open={!!rejectModal} onCancel={() => setRejectModal(null)}
        onOk={() => rejectForm.validateFields().then(v => { approveMutation.mutate({ id: rejectModal.id, action: 'reject', reason: v.reason }); rejectForm.resetFields(); })}>
        <Form form={rejectForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="reason" label="Rejection Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
