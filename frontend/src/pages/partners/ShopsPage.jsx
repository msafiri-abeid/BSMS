// src/pages/partners/ShopsPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, App, Typography } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopsAPI, partnersAPI } from '../../services/api';

const { Title } = Typography;
const { Option } = Select;

const SHOP_TYPES = { slot_only: 'Slot Only', bar: 'Bar + Slot', grocery: 'Grocery + Slot', mixed: 'Mixed' };
const TYPE_COLORS = { slot_only: 'blue', bar: 'purple', grocery: 'green', mixed: 'orange' };

export default function ShopsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['shops'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const { data: partnersData } = useQuery({ queryKey: ['partners-list'], queryFn: () => partnersAPI.list().then(r => r.data.data) });

  const saveMutation = useMutation({
    mutationFn: (fd) => editing ? shopsAPI.update(editing.id, fd) : shopsAPI.create(fd),
    onSuccess: () => {
      message.success('Saved');
      qc.invalidateQueries({ queryKey: ['shops'] });
      setOpen(false); form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const cols = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Partner', dataIndex: ['partner', 'name'] },
    { title: 'Type', dataIndex: 'type', render: v => <Tag color={TYPE_COLORS[v]}>{SHOP_TYPES[v]}</Tag> },
    { title: 'Address', dataIndex: 'address', ellipsis: true },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag> },
    {
      title: '', render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue({ ...r, partner_id: r.partner_id }); setOpen(true); }} />
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Shops</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }} style={{ background: '#1a6b3a' }}>
          Add Shop
        </Button>
      </div>
      <Table dataSource={data?.rows || []} columns={cols} rowKey="id" loading={isLoading} size="middle" />

      <Modal title={editing ? 'Edit Shop' : 'New Shop'} open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={saveMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="partner_id" label="Partner" rules={[{ required: true }]}>
            <Select placeholder="Select partner" showSearch optionFilterProp="children">
              {(partnersData?.rows || []).map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Shop Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="Shop Type" rules={[{ required: true }]}>
            <Select>
              {Object.entries(SHOP_TYPES).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="status" label="Status" initialValue="active">
            <Select><Option value="active">Active</Option><Option value="inactive">Inactive</Option><Option value="suspended">Suspended</Option></Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
