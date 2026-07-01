import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Row, Col, Tag, Upload, App, Typography, Tooltip } from 'antd';
import { User, Mail, Phone, Lock, Building2, CreditCard, Hash, MapPin, BadgeCheck, Calendar, Briefcase, Save, Shield, KeyRound, LogIn, FileText, Trash2, Upload as UploadIcon, Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;
const { Dragger } = Upload;

export default function ProfileTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { user, updateAuthUser } = useAuthStore();
  const [form] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [originalEmail, setOriginalEmail] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [docs, setDocs] = useState([]);
  const emailChanged = currentEmail && originalEmail && currentEmail !== originalEmail;

  useEffect(() => {
    authAPI.me().then((res) => updateAuthUser(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      const vals = {
        name: user.name,
        email: user.email,
        phone: user.phone,
        account_holder_name: user.employee?.account_holder_name || '',
        bank_account: user.employee?.bank_account || '',
        bank_name: user.employee?.bank_name || '',
        bank_code: user.employee?.bank_code || '',
        bank_branch: user.employee?.bank_branch || '',
        tax_payer_id: user.employee?.tax_payer_id || '',
      };
      form.setFieldsValue(vals);
      setOriginalEmail(user.email);
      setCurrentEmail(user.email);
      setDocs(user.employee?.documents || []);
    }
  }, [user, form]);

  const profileMutation = useMutation({
    mutationFn: (d) => authAPI.updateProfile(d),
    onSuccess: (res) => {
      message.success('Profile updated');
      updateAuthUser(res.data.data);
      setOriginalEmail(res.data.data?.email || currentEmail);
      qc.invalidateQueries({ queryKey: ['auth-user'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to update profile'),
  });

  const handleSave = (values) => {
    const payload = { ...values };
    if (!emailChanged) delete payload.currentPassword;
    profileMutation.mutate(payload);
  };

  const handleChangePassword = async (values) => {
    try {
      await authAPI.changePassword(values);
      message.success('Password changed');
      pwForm.resetFields();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed');
    }
  };

  const docUploadMut = useMutation({
    mutationFn: (formData) => authAPI.uploadDocuments(formData),
    onSuccess: (res) => {
      setDocs(res.data.data || []);
      qc.invalidateQueries({ queryKey: ['auth-user'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Upload failed'),
  });

  const docDeleteMut = useMutation({
    mutationFn: (url) => authAPI.deleteDocument(url),
    onSuccess: (res) => {
      setDocs(res.data.data || []);
      qc.invalidateQueries({ queryKey: ['auth-user'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Delete failed'),
  });

  const handleUpload = (file) => {
    const formData = new FormData();
    formData.append('documents', file);
    docUploadMut.mutate(formData);
    return false;
  };

  const roleColorMap = {
    Admin: 'bg-red-100 text-red-700',
    'General Manager': 'bg-purple-100 text-purple-700',
    'Operations Manager': 'bg-blue-100 text-blue-700',
    Finance: 'bg-emerald-100 text-emerald-700',
    Supervisor: 'bg-amber-100 text-amber-700',
    Collector: 'bg-cyan-100 text-cyan-700',
    Cashier: 'bg-orange-100 text-orange-700',
    Sales: 'bg-indigo-100 text-indigo-700',
    Technician: 'bg-slate-100 text-slate-700',
    Director: 'bg-rose-100 text-rose-700',
  };

  const renderReadonlyRow = (icon, label, value) => (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 text-slate-400 shrink-0">{icon}</div>
      <div className="min-w-0">
        <Text type="secondary" className="text-xs block leading-none mb-1">{label}</Text>
        <Text strong className="text-sm text-slate-800">{value || '-'}</Text>
      </div>
    </div>
  );

  return (
    <Row gutter={24}>
      {/* ── Left Column: Editable Form ── */}
      <Col xs={24} lg={14}>
        <Card className="border border-slate-100 mb-4" styles={{ body: { padding: 0 } }}>
          <Form form={form} layout="vertical" onFinish={handleSave} className="p-6">
            {/* ── Personal Information ── */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-4">
                <User size={15} className="!text-[#021559]" />
                <Text className="text-sm font-bold text-slate-700">Personal Information</Text>
              </div>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="name" label={<span className="text-xs font-medium text-slate-600">Full Name</span>} rules={[{ required: true, message: 'Name is required' }]}>
                    <Input prefix={<User size={14} className="text-slate-400" />} placeholder="Enter your full name" className="!rounded-md" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="email" label={<span className="text-xs font-medium text-slate-600">Email</span>} rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
                    <Input prefix={<Mail size={14} className="text-slate-400" />} placeholder="email@example.com" className="!rounded-md"
                      onChange={(e) => setCurrentEmail(e.target.value)} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phone" label={<span className="text-xs font-medium text-slate-600">Phone</span>}>
                    <Input prefix={<Phone size={14} className="text-slate-400" />} placeholder="+255 XXX XXX XXX" className="!rounded-md" />
                  </Form.Item>
                </Col>
              </Row>

              {emailChanged && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <Lock size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <Text className="text-xs font-semibold text-amber-800 block">Email Change Confirmation</Text>
                      <Text className="text-xs text-amber-700 block mt-0.5">Enter your current password to confirm the email change.</Text>
                    </div>
                  </div>
                  <Form.Item name="currentPassword" className="mb-0 mt-2"
                    rules={[{ required: true, message: 'Password required to change email' }]}>
                    <Input.Password prefix={<Lock size={14} className="text-slate-400" />}
                      placeholder="Enter current password" className="!rounded-md !bg-white" />
                  </Form.Item>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 mb-5" />

            {/* ── Bank Account Details ── */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={15} className="!text-[#021559]" />
                <Text className="text-sm font-bold text-slate-700">Bank Account Details</Text>
              </div>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="account_holder_name" label={<span className="text-xs font-medium text-slate-600">Account Holder</span>}>
                    <Input prefix={<User size={14} className="text-slate-400" />} placeholder="Full name on bank account" className="!rounded-md" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="bank_account" label={<span className="text-xs font-medium text-slate-600">Account Number</span>}>
                    <Input prefix={<CreditCard size={14} className="text-slate-400" />} placeholder="Account number" className="!rounded-md" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="bank_name" label={<span className="text-xs font-medium text-slate-600">Bank Name</span>}>
                    <Input prefix={<Building2 size={14} className="text-slate-400" />} placeholder="e.g. CRDB" className="!rounded-md" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="bank_code" label={<span className="text-xs font-medium text-slate-600">Bank Code</span>}>
                    <Input prefix={<Hash size={14} className="text-slate-400" />} placeholder="e.g. 12345" className="!rounded-md" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="bank_branch" label={<span className="text-xs font-medium text-slate-600">Branch</span>}>
                    <Input prefix={<MapPin size={14} className="text-slate-400" />} placeholder="Branch location" className="!rounded-md" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tax_payer_id" label={<span className="text-xs font-medium text-slate-600">Tax Payer ID (TIN)</span>}>
                    <Input prefix={<BadgeCheck size={14} className="text-slate-400" />} placeholder="TIN number" className="!rounded-md" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div className="border-t border-slate-100 mb-5" />

            {/* ── Documents ── */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={15} className="!text-[#021559]" />
                <Text className="text-sm font-bold text-slate-700">Documents</Text>
              </div>

              {docs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {docs.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-md border border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-700 truncate">{doc.name || doc.url?.split('/').pop()}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip title="View">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-brand-dark transition-colors">
                            <Eye size={14} />
                          </a>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <button type="button" onClick={() => docDeleteMut.mutate(doc.url)}
                            className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors cursor-pointer border-0 bg-transparent">
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Dragger
                name="documents"
                multiple={false}
                showUploadList={false}
                beforeUpload={handleUpload}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                className="!rounded-md"
              >
                <div className="flex flex-col items-center gap-1 py-3">
                  <UploadIcon size={20} className="text-slate-400" />
                  <Text className="text-xs text-slate-500">Drop a file here or click to upload</Text>
                  <Text className="text-xs text-slate-400">PDF, JPG, DOC, XLS — up to 10MB</Text>
                </div>
              </Dragger>
            </div>

            {/* ── Save Button ── */}
            <Form.Item className="mb-0">
              <Button type="primary" htmlType="submit" icon={<Save size={15} />}
                loading={profileMutation.isPending}
                className="!bg-brand-dark !border-0 hover:!bg-brand-light !shadow-sm !h-10 !px-6">
                Save Profile
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>

      {/* ── Right Column: Read-only + Password ── */}
      <Col xs={24} lg={10}>
        <Card className="border border-slate-100 mb-4" styles={{ body: { padding: '16px 20px' } }}>
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={15} className="!text-[#021559]" />
            <Text className="text-sm font-bold text-slate-700">Employee Information</Text>
          </div>
          {renderReadonlyRow(<Hash size={14} />, 'Employee Code', user?.employee?.employee_code || user?.employee_id)}
          {renderReadonlyRow(<Building2 size={14} />, 'Department', user?.employee?.department?.name)}
          {renderReadonlyRow(<BadgeCheck size={14} />, 'Position', user?.employee?.position?.name)}
          {renderReadonlyRow(<Calendar size={14} />, 'Hire Date', user?.employee?.hire_date ? new Date(user.employee.hire_date).toLocaleDateString() : null)}
          {renderReadonlyRow(<User size={14} />, 'Reporting To', user?.employee?.supervisor?.full_name)}
        </Card>

        <Card className="border border-slate-100 mb-4" styles={{ body: { padding: '16px 20px' } }}>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={15} className="!text-[#021559]" />
            <Text className="text-sm font-bold text-slate-700">Account Details</Text>
          </div>
          {renderReadonlyRow(<Shield size={14} />, 'Role',
            <Tag className={`!m-0 !border-0 !text-xs !font-medium ${roleColorMap[user?.role?.name] || 'bg-slate-100 text-slate-700'}`}>
              {user?.role?.name || '-'}
            </Tag>
          )}
          {renderReadonlyRow(<Hash size={14} />, 'Employee ID', user?.employee_id)}
          {renderReadonlyRow(<LogIn size={14} />, 'Last Login', user?.last_login ? new Date(user.last_login).toLocaleString() : null)}
        </Card>

        <Card className="border border-slate-100" styles={{ body: { padding: '16px 20px' } }}>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={15} className="!text-[#021559]" />
            <Text className="text-sm font-bold text-slate-700">Change Password</Text>
          </div>
          <Form form={pwForm} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item name="currentPassword" label={<span className="text-xs font-medium text-slate-600">Current Password</span>}
              rules={[{ required: true, message: 'Current password required' }]}>
              <Input.Password prefix={<Lock size={14} className="text-slate-400" />} placeholder="Enter current password" className="!rounded-md" />
            </Form.Item>
            <Form.Item name="newPassword" label={<span className="text-xs font-medium text-slate-600">New Password</span>}
              rules={[{ required: true, min: 8, message: 'Min 8 characters' }]}>
              <Input.Password prefix={<Lock size={14} className="text-slate-400" />} placeholder="Enter new password" className="!rounded-md" />
            </Form.Item>
            <Form.Item className="mb-0">
              <Button type="primary" htmlType="submit" icon={<KeyRound size={14} />}
                className="!bg-brand-dark !border-0 hover:!bg-brand-light !h-9">
                Update Password
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}
