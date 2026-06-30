import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, App } from 'antd';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAPI } from '../../services/api';
import { buildDeptTreeSelect } from './staffUtils';

export default function PositionsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
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
    { title: 'Position', dataIndex: 'name', render: (v) => <span className="font-medium">{v}</span> },
    { title: 'Department', dataIndex: ['department', 'name'], render: (v) => v || <span className="text-slate-400">—</span> },
    {
      title: 'Actions',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <div className="flex justify-end gap-1">
          <Button
            type="text"
            size="small"
            icon={<Edit3 className="w-4 h-4" />}
            onClick={() => {
              setEditing(r);
              form.setFieldsValue({ name: r.name, department_id: r.department_id });
              setOpen(true);
            }}
            className="!text-slate-500 hover:!text-amber-600"
            title="Edit"
          />
          <Button
            type="text"
            size="small"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => {
              modal.confirm({
                title: 'Delete position?',
                content: `Remove "${r.name}"?`,
                okText: 'Delete',
                okType: 'danger',
                onOk: () => deleteMutation.mutate(r.id),
              });
            }}
            className="!text-slate-500 hover:!text-red-600"
            title="Delete"
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Positions</h4>
          <span className="text-xs text-slate-500">{(positions || []).length} total</span>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}
          className="!bg-brand-dark hover:!bg-brand-light hover:!text-white border-none shadow-sm flex items-center gap-1.5 text-white"
        >
          Add Position
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error.response?.data?.message || 'Failed to load positions'}
        </div>
      )}

      <Table
        dataSource={positions || []}
        columns={cols}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={false}
        locale={{ emptyText: <span className="text-slate-500 text-sm">No positions yet</span> }}
      />

      <Modal
        title={editing ? 'Edit Position' : 'Add Position'}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={480}
        className="top-8"
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} className="mt-4">
          <Form.Item name="name" label={<span className="text-xs font-semibold text-slate-600">Position name</span>} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="department_id" label={<span className="text-xs font-semibold text-slate-600">Department</span>}>
            <Select allowClear placeholder="Select department" options={buildDeptTreeSelect(departments)} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
