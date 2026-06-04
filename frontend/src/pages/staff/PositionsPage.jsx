import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tooltip, Popconfirm, App, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAPI } from '../../services/api';
import { buildDeptTreeSelect } from './staffUtils';

export default function PositionsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['positions'],
    queryFn: () => staffAPI.positions().then((r) => r.data.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => staffAPI.departments().then((r) => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (v) => (editing ? staffAPI.updatePosition(editing.id, v) : staffAPI.createPosition(v)),
    onSuccess: () => {
      message.success(editing ? 'Position updated' : 'Position added');
      qc.invalidateQueries({ queryKey: ['positions'] });
      setOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => staffAPI.deletePosition(id),
    onSuccess: () => { message.success('Position deleted'); qc.invalidateQueries({ queryKey: ['positions'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const cols = [
    { title: 'Position', dataIndex: 'name' },
    { title: 'Department', dataIndex: ['department', 'name'], render: (v) => v || '—' },
    {
      title: '',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue({ name: r.name, department_id: r.department_id }); setOpen(true); }} /></Tooltip>
          <Popconfirm title="Delete position?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {error && <Alert type="error" showIcon className="mb-3" message={error.response?.data?.message || 'Failed to load positions'} />}
      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }} className="bg-[#021559] hover:bg-[#162a75]">Add Position</Button>
      </div>
      <Table dataSource={positions || []} columns={cols} rowKey="id" loading={isLoading} size="middle" pagination={false} />

      <Modal title={editing ? 'Edit Position' : 'Add Position'} open={open} onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }} onOk={() => form.submit()} confirmLoading={saveMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} className="mt-4">
          <Form.Item name="name" label="Position name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="department_id" label="Department">
            <Select allowClear placeholder="Select department" options={buildDeptTreeSelect(departments)} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
