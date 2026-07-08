import { useState } from 'react';
import { Form, Input, Button, Table, Modal, Card, Tag, App, Typography, Space, Select } from 'antd';
import { Pencil, Building2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function BusinessManagementTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editBiz, setEditBiz] = useState(null);
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('settings', 'update');

  const { data: businesses, isLoading } = useQuery({
    queryKey: ['settings-businesses'],
    queryFn: () => settingsAPI.getBusinesses().then(r => r.data.data || []),
  });

  const updateBizMutation = useMutation({
    mutationFn: ({ id, data }) => settingsAPI.updateBusiness(id, data),
    onSuccess: () => { message.success('Business updated'); qc.invalidateQueries({ queryKey: ['settings-businesses'] }); setEditBiz(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const bizColumns = [
    { title: 'Label', dataIndex: 'label', render: (v) => <span className="font-semibold text-sm">{v || '-'}</span> },
    { title: 'Business Name', dataIndex: 'name', className: 'text-sm' },
    { title: 'Phone', dataIndex: 'phone', className: 'text-sm' },
    { title: 'Type', dataIndex: 'type', render: (v) => <Tag color={v === 'own' ? 'blue' : 'default'} className="rounded-full text-[10px] uppercase">{v}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'active' ? 'success' : 'default'} className="rounded-full text-[10px] uppercase">{v}</Tag> },
    ...(canEdit ? [{
      title: 'Actions', render: (_, r) => (
        <Button type="text" size="small" icon={<Pencil size={14} />} onClick={() => setEditBiz({ ...r })} />
      ),
    }] : []),
  ];

  return (
    <>
      <Card size="small" title={<span className="flex items-center gap-2"><Building2 size={14} />Own Businesses {!canEdit && <Tag className="!text-[10px] rounded-full">Read-only</Tag>}</span>} className="border border-slate-100">
        <Table dataSource={businesses || []} columns={bizColumns} rowKey="id" size="middle" pagination={false} loading={isLoading} />
      </Card>

      {canEdit && (
        <Modal title="Edit Business" open={!!editBiz} onCancel={() => setEditBiz(null)} footer={null} className="top-8" destroyOnClose>
          {editBiz && (
            <Form
              layout="vertical"
              initialValues={{ label: editBiz.label, name: editBiz.name, phone: editBiz.phone, type: editBiz.type, status: editBiz.status }}
              onFinish={(values) => updateBizMutation.mutate({ id: editBiz.id, data: values })}
              className="mt-4"
            >
              <Form.Item name="label" label="Label" rules={[{ required: true }]}>
                <Input placeholder="e.g. Bentabet, Meteora, Dante" />
              </Form.Item>
              <Form.Item name="name" label="Business Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="phone" label="Phone">
                <Input />
              </Form.Item>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="own">Own Business</Select.Option>
                  <Select.Option value="partner">External Partner</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="status" label="Status">
                <Select>
                  <Select.Option value="active">Active</Select.Option>
                  <Select.Option value="inactive">Inactive</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item className="mb-0">
                <Space>
                  <Button onClick={() => setEditBiz(null)}>Cancel</Button>
                  <Button type="primary" htmlType="submit" loading={updateBizMutation.isPending} className="!bg-brand-dark !border-0">Save</Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
