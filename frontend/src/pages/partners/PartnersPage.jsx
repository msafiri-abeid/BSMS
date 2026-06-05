import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, Upload, App, Typography, Dropdown, Popconfirm } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, MoreOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnersAPI } from '../../services/api';

const { Title } = Typography;
const { Option } = Select;

export default function PartnersPage() {
  const navigate = useNavigate();
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

  const deleteMutation = useMutation({
    mutationFn: (id) => partnersAPI.delete(id),
    onSuccess: () => {
      message.success('Partner deleted');
      qc.invalidateQueries({ queryKey: ['partners'] });
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
    { title: 'Label', dataIndex: 'label', render: v => <Tag color={v === 'Bentabet' || v === 'Dante' ? 'green' : 'blue'}>{v}</Tag> },
    { title: 'Phone', dataIndex: 'phone' },
    { title: 'Shops', dataIndex: 'shops', render: shops => shops?.length || 0 },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag> },
    {
      title: 'Actions',
      width: 80,
      render: (_, r) => {
        const items = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: 'View Details',
          },
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Edit Partner',
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: 'Delete',
            danger: true,
          },
        ];

        return (
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items,
              onClick: ({ key }) => {
                if (key === 'view') {
                  navigate(`/partners/${r.id}`);
                } else if (key === 'edit') {
                  setEditing(r);
                  form.setFieldsValue(r);
                  setOpen(true);
                } else if (key === 'delete') {
                  Modal.confirm({
                    title: 'Delete Partner',
                    content: `Are you sure you want to delete "${r.name}"?`,
                    okText: 'Delete',
                    okType: 'danger',
                    onOk: () => deleteMutation.mutate(r.id),
                  });
                }
              },
            }}
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              className="flex items-center justify-center"
            />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!m-0">Partners</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}
          className="bg-[#021559] hover:bg-[#162a75]">
          Add Partner
        </Button>
      </div>

      <Table dataSource={data?.rows || []} columns={cols} rowKey="id" loading={isLoading}
        pagination={{ total: data?.count, pageSize: 20 }} size="middle" />

      <Modal title={editing ? 'Edit Partner' : 'New Partner'} open={open} onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={saveMutation.isPending} width={520}>
        <Form form={form} layout="vertical" onFinish={onFinish} className="mt-4">
          <Form.Item name="name" label="Partner Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Select>
              <Option value="Bentabet">Bentabet</Option>
              <Option value="Meteora">Meteora</Option>
              <Option value="Dante">Dante</Option>
              <Option value="Other">Other</Option>
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
