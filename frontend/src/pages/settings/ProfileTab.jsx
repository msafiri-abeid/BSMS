import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Row, Col, App, Typography } from 'antd';
import { Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;

export default function ProfileTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { user, updateAuthUser } = useAuthStore();
  const [profileForm] = Form.useForm();
  const [pwForm] = Form.useForm();

  useEffect(() => {
    if (user) profileForm.setFieldsValue({
      name: user.name,
      email: user.email,
      phone: user.phone,
      account_holder_name: user.employee?.account_holder_name,
      bank_account: user.employee?.bank_account,
      bank_name: user.employee?.bank_name,
      bank_code: user.employee?.bank_code,
      bank_branch: user.employee?.bank_branch,
      tax_payer_id: user.employee?.tax_payer_id,
    });
  }, [user, profileForm]);

  const profileMutation = useMutation({
    mutationFn: (d) => authAPI.updateProfile(d),
    onSuccess: (res) => {
      message.success('Profile updated');
      updateAuthUser(res.data.data);
      qc.invalidateQueries({ queryKey: ['auth-user'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to update profile'),
  });

  const handleChangePassword = async (values) => {
    try {
      await authAPI.changePassword(values);
      message.success('Password changed');
      pwForm.resetFields();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed');
    }
  };

  return (
    <Row gutter={16}>
      <Col xs={24} lg={12}>
        <Card size="small" title="Personal Information" className="border border-slate-100">
          <Form form={profileForm} layout="vertical" onFinish={profileMutation.mutate} className="mt-4">
            <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={profileMutation.isPending} className="!bg-brand-dark !border-0 hover:!bg-brand-light">
                Save Profile
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card size="small" title="Bank Account Details" className="border border-slate-100">
          <Form form={profileForm} layout="vertical" className="mt-4">
            <Form.Item name="account_holder_name" label="Account Holder's Name">
              <Input />
            </Form.Item>
            <Form.Item name="bank_account" label="Account No">
              <Input />
            </Form.Item>
            <Form.Item name="bank_name" label="Bank Name">
              <Input />
            </Form.Item>
            <Form.Item name="bank_code" label="Bank Identifier Code">
              <Input />
            </Form.Item>
            <Form.Item name="bank_branch" label="Branch">
              <Input />
            </Form.Item>
            <Form.Item name="tax_payer_id" label="Tax Payer ID">
              <Input />
            </Form.Item>
          </Form>
        </Card>
        <Card size="small" title="Change Password" className="border border-slate-100 mt-4">
          <Form form={pwForm} layout="vertical" onFinish={handleChangePassword} className="mt-4">
            <Form.Item name="currentPassword" label="Current Password" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="newPassword" label="New Password" rules={[{ required: true, min: 8 }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" className="!bg-brand-dark !border-0 hover:!bg-brand-light">Update Password</Button>
            </Form.Item>
          </Form>
        </Card>
        <Card size="small" title="Account Info" className="border border-slate-100 mt-4">
          <div className="mb-3">
            <Text type="secondary" className="text-xs">Role</Text>
            <div><Text strong>{user?.role?.name || '-'}</Text></div>
          </div>
          <div className="mb-3">
            <Text type="secondary" className="text-xs">Employee ID</Text>
            <div><Text strong>{user?.employee_id || '-'}</Text></div>
          </div>
          <div>
            <Text type="secondary" className="text-xs">Last Login</Text>
            <div><Text strong>{user?.last_login ? new Date(user.last_login).toLocaleString() : '-'}</Text></div>
          </div>
        </Card>
      </Col>
    </Row>
  );
}
