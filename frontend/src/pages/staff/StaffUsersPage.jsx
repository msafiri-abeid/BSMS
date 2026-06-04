import { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, App, Space, Tooltip, Typography, Alert,
} from 'antd';
import { PlusOutlined, CopyOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAPI, staffAPI } from '../../services/api';

const { Option } = Select;
const { Text, Paragraph } = Typography;

export default function StaffUsersPage() {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.list().then((r) => r.data.data),
  });

  const { data: roles } = useQuery({
    queryKey: ['staff-roles'],
    queryFn: () => staffAPI.roles().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d) => usersAPI.create(d),
    onSuccess: (res) => {
      setCredentials(res.data?.data?.credentials || null);
      message.success('User created');
      qc.invalidateQueries({ queryKey: ['users'] });
      form.resetFields();
      setOpen(false);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const copyCredentials = () => {
    if (!credentials) return;
    const text = `Email: ${credentials.email}\nPassword: ${credentials.password}`;
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const cols = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
    { title: 'Role', dataIndex: ['role', 'name'] },
    { title: 'Status', dataIndex: 'is_active', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
  ];

  return (
    <div>
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="Create Bentabet login accounts"
        description="Assign a role and temporary password. Share credentials securely with the user. Phone is required for SMS notifications."
      />
      {error && <Alert type="error" showIcon className="mb-3" message={error.response?.data?.message || 'Cannot load users — users:read permission required'} />}

      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} className="bg-[#021559] hover:bg-[#162a75]">Create User</Button>
      </div>

      <Table dataSource={users || []} columns={cols} rowKey="id" loading={isLoading} pagination={{ pageSize: 20 }} />

      <Modal title="Create system user" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} className="mt-4">
          <Form.Item name="name" label="Full name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Required for SMS' }]}><Input placeholder="+255..." /></Form.Item>
          <Form.Item name="role_id" label="Role" rules={[{ required: true }]}>
            <Select placeholder="Select role">
              {(roles || []).map((r) => <Option key={r.id} value={r.id}>{r.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Login credentials"
        open={!!credentials}
        onCancel={() => setCredentials(null)}
        footer={[
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={copyCredentials} className="bg-[#021559]">Copy</Button>,
          <Button key="close" onClick={() => setCredentials(null)}>Close</Button>,
        ]}
      >
        <Paragraph>Share these credentials with the user:</Paragraph>
        <Space direction="vertical">
          <Text><strong>Email:</strong> {credentials?.email}</Text>
          <Text><strong>Password:</strong> {credentials?.password}</Text>
        </Space>
      </Modal>
    </div>
  );
}
