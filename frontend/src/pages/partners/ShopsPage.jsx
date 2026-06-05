import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, App, Typography, Dropdown } from 'antd';
import { PlusOutlined, EditOutlined, MoreOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopsAPI, partnersAPI } from '../../services/api';

const { Title } = Typography;
const { Option } = Select;

const SHOP_TYPES = { slot_only: 'Slot Only', bar: 'Bar + Slot', grocery: 'Grocery + Slot', mixed: 'Mixed' };
const TYPE_COLORS = { slot_only: 'blue', bar: 'purple', grocery: 'green', mixed: 'orange' };

export default function ShopsPage() {
  const navigate = useNavigate();
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

  const deleteMutation = useMutation({
    mutationFn: (id) => shopsAPI.delete(id),
    onSuccess: () => {
      message.success('Shop deleted');
      qc.invalidateQueries({ queryKey: ['shops'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });

  const cols = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Partner', dataIndex: ['partner', 'name'] },
    { title: 'Type', dataIndex: 'type', render: v => <Tag color={TYPE_COLORS[v]}>{SHOP_TYPES[v]}</Tag> },
    { title: 'Address', dataIndex: 'address', ellipsis: true },
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
            label: 'Edit Shop',
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
                  navigate(`/shops/${r.id}`);
                } else if (key === 'edit') {
                  setEditing(r);
                  form.setFieldsValue({
                    ...r,
                    partner_id: r.partner_id,
                  });
                  setOpen(true);
                } else if (key === 'delete') {
                  Modal.confirm({
                    title: 'Delete Shop',
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
        <Title level={4} className="!m-0">Shops</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }} className="bg-[#021559] hover:bg-[#162a75]">
          Add Shop
        </Button>
      </div>
      <Table dataSource={data?.rows || []} columns={cols} rowKey="id" loading={isLoading} size="middle" />

      <Modal title={editing ? 'Edit Shop' : 'New Shop'} open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={saveMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} className="mt-4">
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
