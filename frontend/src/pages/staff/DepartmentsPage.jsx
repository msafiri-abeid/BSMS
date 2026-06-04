import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, Tooltip, Popconfirm, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { staffAPI } from '../../services/api';
import { buildDeptTreeSelect } from './staffUtils';

export default function DepartmentsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => staffAPI.departments().then((r) => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (v) => (editing ? staffAPI.updateDepartment(editing.id, v) : staffAPI.createDepartment(v)),
    onSuccess: () => {
      message.success(editing ? 'Department updated' : 'Department added');
      qc.invalidateQueries({ queryKey: ['departments'] });
      qc.invalidateQueries({ queryKey: ['organization'] });
      setOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => staffAPI.deleteDepartment(id),
    onSuccess: () => {
      message.success('Department deleted');
      qc.invalidateQueries({ queryKey: ['departments'] });
      qc.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const parentOptions = buildDeptTreeSelect(
    (departments || []).filter((d) => !editing || d.id !== editing.id),
  );

  const cols = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Parent', render: (_, r) => r.parent?.name || '—' },
    { title: 'Order', dataIndex: 'sort_order', width: 80 },
    { title: 'Created', dataIndex: 'created_at', width: 130, render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
    {
      title: '',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue({ name: r.name, parent_id: r.parent_id, sort_order: r.sort_order }); setOpen(true); }} /></Tooltip>
          <Popconfirm title="Delete department?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }} className="bg-[#021559] hover:bg-[#162a75]">Add Department</Button>
      </div>
      <Table dataSource={departments || []} columns={cols} rowKey="id" loading={isLoading} size="middle" pagination={false} />

      <Modal title={editing ? 'Edit Department' : 'Add Department'} open={open} onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }} onOk={() => form.submit()} confirmLoading={saveMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} className="mt-4" initialValues={{ sort_order: 0 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="parent_id" label="Parent department">
            <Select allowClear placeholder="Top level" options={parentOptions} />
          </Form.Item>
          <Form.Item name="sort_order" label="Sort order"><InputNumber min={0} className="w-full" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
