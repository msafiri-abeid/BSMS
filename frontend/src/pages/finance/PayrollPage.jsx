// src/pages/finance/PayrollPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Tag, App, Typography, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function PayrollPage() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['payroll'], queryFn: () => financeAPI.listPayroll().then(r => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (d) => financeAPI.createPayroll(d),
    onSuccess: () => { message.success('Payroll run created'); qc.invalidateQueries({ queryKey: ['payroll'] }); setOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const cols = [
    { title: 'Employee', dataIndex: 'employee_id', render: v => `EMP-${v}` },
    { title: 'Period', render: (_, r) => `${r.period_start} — ${r.period_end}` },
    { title: 'Basic', dataIndex: 'basic_salary', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Allowances', dataIndex: 'allowances', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Deductions', dataIndex: 'deductions', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Net Pay', dataIndex: 'net_pay', render: v => <strong>TZS {v?.toLocaleString()}</strong> },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'paid' ? 'green' : v === 'approved' ? 'blue' : 'orange'}>{v}</Tag> },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Payroll</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} style={{ background: '#1a6b3a' }}>New Payroll Run</Button>
      </div>
      <Table dataSource={data?.rows || []} columns={cols} rowKey="id" loading={isLoading} size="middle" />

      <Modal title="Create Payroll Run" open={open} onCancel={() => setOpen(false)}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="period_start" label="Period Start" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="period_end" label="Period End" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
