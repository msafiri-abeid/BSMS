// src/pages/partners/PartnersPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, Upload, App, Typography } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnersAPI } from '../../services/api';

const { Title } = Typography;
const { Option } = Select;

export default function PartnersPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => partnersAPI.list().then(r => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (formData) => editing
      ? partnersAPI.update(editing.id, formData)
      : partnersAPI.create(formData),
    onSuccess: () => {
      message.success(editing ? 'Partner updated' : 'Partner created');
      qc.invalidateQueries({ queryKey: ['partners'] });
      setOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });

  const onFinish = (values) => {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => { if (v !== undefined && k !== 'contract') fd.append(k, v); });
    if (values.contract?.file) fd.append('contract', values.contract.file);
    saveMutation.mutate(fd);
  };

  const cols = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Label', dataIndex: 'label' },
    { title: 'Type', dataIndex: 'type', render: v => <Tag color={v === 'own' ? 'green' : 'blue'}>{v}</Tag> },
    { title: 'Phone', dataIndex: 'phone' },
    { title: 'Shops', dataIndex: 'shops', render: shops => shops?.length || 0 },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag> },
    {
      title: 'Actions', render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => {
          setEditing(r);
          form.setFieldsValue(r);
          setOpen(true);
        }}>Edit</Button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Partners</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}
          style={{ background: '#1a6b3a' }}>
          Add Partner
        </Button>
      </div>

      <Table dataSource={data?.rows || []} columns={cols} rowKey="id" loading={isLoading}
        pagination={{ total: data?.count, pageSize: 20 }} size="middle" />

      <Modal title={editing ? 'Edit Partner' : 'New Partner'} open={open} onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={saveMutation.isPending} width={520}>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Partner Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="label" label="Label / Brand">
            <Input placeholder="e.g. Bentabet, Dante" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select>
              <Option value="own">Own (Bentabet)</Option>
              <Option value="partner">External Partner</Option>
            </Select>
          </Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="status" label="Status" initialValue="active">
            <Select><Option value="active">Active</Option><Option value="inactive">Inactive</Option></Select>
          </Form.Item>
          <Form.Item name="contract" label="Contract Document">
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.jpg,.jpeg,.png">
              <Button icon={<UploadOutlined />}>Upload Contract</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
