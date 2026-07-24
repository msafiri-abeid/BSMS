import { useState, useEffect } from 'react';
import { Tabs, Form, Input, InputNumber, Switch, Button, Table, Modal, Card, Row, Col, Checkbox, Tag, App, Typography, Divider, Space, Spin, Select } from 'antd';
import { Plus, Save, Pencil, Trash2, Building2, Shield } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI, authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const MODULES = ['partners', 'shops', 'machines', 'collections', 'finance', 'inventory', 'tickets', 'staff', 'reports', 'settings', 'users'];
const ACTIONS = ['read', 'write', 'approve', 'delete'];

// ── My Profile Tab ────────────────────────────────────────────
function ProfileTab() {
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
        <Card size="small" title="Employee Info" className="border border-slate-100 mt-4">
          <div className="mb-3">
            <Text type="secondary" className="text-xs">Employee Code</Text>
            <div><Text strong>{user?.employee?.employee_code || user?.employee_id || '-'}</Text></div>
          </div>
          <div className="mb-3">
            <Text type="secondary" className="text-xs">Department</Text>
            <div><Text strong>{user?.employee?.department?.name || '-'}</Text></div>
          </div>
          <div className="mb-3">
            <Text type="secondary" className="text-xs">Position</Text>
            <div><Text strong>{user?.employee?.position?.name || '-'}</Text></div>
          </div>
          <div className="mb-3">
            <Text type="secondary" className="text-xs">Hire Date</Text>
            <div><Text strong>{user?.employee?.hire_date ? new Date(user.employee.hire_date).toLocaleDateString() : '-'}</Text></div>
          </div>
          <div>
            <Text type="secondary" className="text-xs">Reporting To</Text>
            <div><Text strong>{user?.employee?.supervisor?.full_name || '-'}</Text></div>
          </div>
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

// ── Company Profile Tab ───────────────────────────────────────
function CompanyTab({ settings, onSave, saving }) {
  const [form] = Form.useForm();
  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);
  return (
    <Card size="small" className="max-w-[600px] border border-slate-100">
      <Form form={form} layout="vertical" onFinish={onSave} className="mt-4">
        <Form.Item name="company_name" label="Company Name"><Input /></Form.Item>
        <Form.Item name="company_phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="company_email" label="Email"><Input /></Form.Item>
        <Form.Item name="company_address" label="Address"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="company_tax_number" label="Tax Number"><Input /></Form.Item>
        <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={saving} className="!bg-brand-dark !border-0 hover:!bg-brand-light">Save</Button>
      </Form>
    </Card>
  );
}

// ── Machine Settings Tab ──────────────────────────────────────
function MachineSettingsTab({ settings, onSave, saving }) {
  const [form] = Form.useForm();
  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);
  return (
    <Card size="small" className="max-w-[600px] border border-slate-100">
      <Form form={form} layout="vertical" onFinish={onSave} className="mt-4">
        <Divider plain>Credit Values (TZS per credit)</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="meteora_credit_value" label="Meteora"><InputNumber min={1} className="!w-full" /></Form.Item></Col>
          <Col span={8}><Form.Item name="novomatic_credit_value" label="Novomatic"><InputNumber min={1} className="!w-full" /></Form.Item></Col>
          <Col span={8}><Form.Item name="egt_credit_value" label="EGT"><InputNumber min={1} className="!w-full" /></Form.Item></Col>
        </Row>
        <Divider plain>Weekly Target</Divider>
        <Form.Item name="weekly_target_tzs" label="Weekly Target per Machine (TZS)">
          <InputNumber min={0} className="!w-full" formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
        </Form.Item>
        <Divider plain>Commission Percentages</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="office_pct" label="Office %"><InputNumber min={0} max={100} className="!w-full" /></Form.Item></Col>
        </Row>
        <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={saving} className="!bg-brand-dark !border-0 hover:!bg-brand-light">Save</Button>
      </Form>
    </Card>
  );
}

// ── Finance Settings Tab ──────────────────────────────────────
function FinanceSettingsTab({ settings, onSave, saving }) {
  const [form] = Form.useForm();
  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);
  return (
    <Card size="small" className="max-w-[600px] border border-slate-100">
      <Form form={form} layout="vertical" onFinish={onSave} className="mt-4">
        <Divider plain>Reference Number Prefixes</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="invoice_prefix" label="Invoice Prefix"><Input placeholder="INV-" /></Form.Item></Col>
          <Col span={8}><Form.Item name="ticket_prefix" label="Ticket Prefix"><Input placeholder="TKT-" /></Form.Item></Col>
          <Col span={8}><Form.Item name="slot_code_prefix" label="Slot Code Prefix"><Input placeholder="SLT-" /></Form.Item></Col>
        </Row>
        <Divider plain>SLA Hours</Divider>
        <Row gutter={12}>
          <Col span={6}><Form.Item name="sla_urgent_hours" label="Urgent"><InputNumber min={1} className="!w-full" /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_high_hours" label="High"><InputNumber min={1} className="!w-full" /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_medium_hours" label="Medium"><InputNumber min={1} className="!w-full" /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_low_hours" label="Low"><InputNumber min={1} className="!w-full" /></Form.Item></Col>
        </Row>
        <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={saving} className="!bg-brand-dark !border-0 hover:!bg-brand-light">Save</Button>
      </Form>
    </Card>
  );
}

// ── Notifications Tab ─────────────────────────────────────────
function NotificationsTab({ settings, onSave, saving }) {
  const [form] = Form.useForm();
  const [testPhone, setTestPhone] = useState('');
  const { message } = App.useApp();
  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);

  const handleTest = async () => {
    if (!testPhone) return message.warning('Enter phone number');
    try {
      await settingsAPI.testSMS({ to: testPhone });
      message.success('Test SMS sent!');
    } catch {
      message.error('SMS test failed — check Beem Africa config');
    }
  };

  return (
    <Card size="small" className="max-w-[640px] border border-slate-100">
      <Form form={form} layout="vertical" onFinish={onSave} className="mt-4">
        <Divider plain>Beem Africa SMS</Divider>
        <Form.Item name="beem_api_key" label="API Key"><Input.Password /></Form.Item>
        <Form.Item name="beem_secret" label="Secret"><Input.Password /></Form.Item>
        <Form.Item name="beem_sender_name" label="Sender Name"><Input /></Form.Item>
        <Divider plain>Alert Toggles</Divider>
        <Form.Item name="alert_weekly_target" valuePropName="checked" label={null}>
          <Switch /> <Text className="ml-2">Weekly target not met alert</Text>
        </Form.Item>
        <Form.Item name="alert_sla_breach" valuePropName="checked" label={null}>
          <Switch /> <Text className="ml-2">Ticket SLA breach alert</Text>
        </Form.Item>
        <Form.Item name="alert_low_stock" valuePropName="checked" label={null}>
          <Switch /> <Text className="ml-2">Low token stock alert</Text>
        </Form.Item>
        <Form.Item name="alert_pending_expenses" valuePropName="checked" label={null}>
          <Switch /> <Text className="ml-2">Daily pending expense reminder</Text>
        </Form.Item>
        <Divider plain>Test SMS</Divider>
        <Space>
          <Input placeholder="+255 7XX XXX XXX" value={testPhone} onChange={e => setTestPhone(e.target.value)} className="!w-[200px]" />
          <Button onClick={handleTest}>Send Test SMS</Button>
        </Space>
        <div className="mt-4">
          <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={saving} className="!bg-brand-dark !border-0 hover:!bg-brand-light">Save</Button>
        </div>
      </Form>
    </Card>
  );
}

// ── Role Builder Tab ──────────────────────────────────────────
function RoleBuilderTab() {
  const [newRoleName, setNewRoleName] = useState('');
  const [selected, setSelected] = useState(null);
  const [permMatrix, setPermMatrix] = useState({});
  const [editModal, setEditModal] = useState(null);
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: () => settingsAPI.getRoles().then(r => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (d) => settingsAPI.createRole(d),
    onSuccess: () => { message.success('Role created'); qc.invalidateQueries({ queryKey: ['roles'] }); qc.invalidateQueries({ queryKey: ['staff-roles'] }); setNewRoleName(''); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }) => settingsAPI.updateRole(id, data),
    onSuccess: () => { message.success('Role updated'); qc.invalidateQueries({ queryKey: ['roles'] }); qc.invalidateQueries({ queryKey: ['staff-roles'] }); setEditModal(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => settingsAPI.deleteRole(id),
    onSuccess: () => { message.success('Role deleted'); qc.invalidateQueries({ queryKey: ['roles'] }); qc.invalidateQueries({ queryKey: ['staff-roles'] }); if (selected?.id === editModal?.id) setSelected(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const permMutation = useMutation({
    mutationFn: ({ roleId, permissions }) => settingsAPI.updatePermissions(roleId, { permissions }),
    onSuccess: () => { message.success('Permissions saved'); qc.invalidateQueries({ queryKey: ['roles'] }); qc.invalidateQueries({ queryKey: ['staff-roles'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const selectRole = (role) => {
    setSelected(role);
    const matrix = {};
    MODULES.forEach(mod => {
      matrix[mod] = {};
      ACTIONS.forEach(act => {
        matrix[mod][act] = role.permissions?.some(p => p.module === mod && p.action === act) || false;
      });
    });
    setPermMatrix(matrix);
  };

  const toggle = (mod, act) => {
    setPermMatrix(prev => ({ ...prev, [mod]: { ...prev[mod], [act]: !prev[mod][act] } }));
  };

  const savePermissions = () => {
    if (!selected) return;
    const permissions = MODULES.map(mod => ({
      module: mod,
      actions: ACTIONS.filter(act => permMatrix[mod]?.[act]),
    })).filter(p => p.actions.length > 0);
    permMutation.mutate({ roleId: selected.id, permissions });
  };

  const roleColumns = [
    { title: 'Name', dataIndex: 'name', render: (v, r) => <span className="font-semibold text-sm">{v} {r.is_system && <Tag className="ml-1 text-[10px]">System</Tag>}</span> },
    { title: 'Permissions', dataIndex: 'permissions', render: (v) => <span className="text-xs text-slate-500">{v?.length || 0} permissions</span> },
    { title: 'Type', render: (_, r) => r.is_system ? <Tag className="rounded-full text-[10px]" color="default">System</Tag> : <Tag className="rounded-full text-[10px]" color="blue">Custom</Tag> },
    {
      title: 'Actions', render: (_, r) => (
        <Space>
          <Button type="text" size="small" icon={<Pencil size={14} />} disabled={r.is_system}
            onClick={(e) => { e.stopPropagation(); setEditModal({ id: r.id, name: r.name }); }} />
          <Button type="text" size="small" icon={<Trash2 size={14} className="text-red-500" />} disabled={r.is_system}
            onClick={(e) => { e.stopPropagation(); Modal.confirm({ title: 'Delete role?', content: `Delete "${r.name}"? This cannot be undone.`, okText: 'Delete', okType: 'danger', onOk: () => deleteRoleMutation.mutate(r.id) }); }} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card size="small" title={<span className="flex items-center gap-2"><Shield size={14} />Roles</span>} className="border border-slate-100"
            extra={
              <Space>
                <Input size="small" placeholder="New role name" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="!w-[130px]" />
                <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => newRoleName && createMutation.mutate({ name: newRoleName })} className="!bg-brand-dark !border-0">Add</Button>
              </Space>
            }>
            <Table dataSource={roles || []} columns={roleColumns} rowKey="id" size="small" pagination={false}
              onRow={(record) => ({ onClick: () => selectRole(record), className: selected?.id === record.id ? 'bg-blue-50' : '' })}
              showHeader={false} />
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          {selected ? (
            <Card size="small" title={`Permissions: ${selected.name}`}
              className="border border-slate-100"
              extra={
                !selected.is_system && (
                  <Button type="primary" size="small" onClick={savePermissions} loading={permMutation.isPending} className="!bg-brand-dark !border-0">
                    Save Permissions
                  </Button>
                )
              }>
              {selected.is_system ? (
                <Text type="secondary" className="text-sm">System roles cannot be modified via the role builder.</Text>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-1.5 text-xs border-b border-slate-100">Module</th>
                        {ACTIONS.map(a => <th key={a} className="text-center p-1.5 text-xs border-b border-slate-100 capitalize">{a}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(mod => (
                        <tr key={mod} className="border-b border-slate-50">
                          <td className="p-1.5 text-sm capitalize">{mod}</td>
                          {ACTIONS.map(act => (
                            <td key={act} className="text-center p-1.5">
                              <Checkbox checked={permMatrix[mod]?.[act] || false} onChange={() => toggle(mod, act)} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : (
            <Card size="small" className="border border-slate-100">
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Shield size={32} className="mb-2 text-slate-300" />
                <Text type="secondary">Select a role to manage its permissions</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="Edit Role"
        open={!!editModal}
        onCancel={() => setEditModal(null)}
        footer={null}
        className="top-8" destroyOnClose
      >
        <Form
          layout="vertical"
          initialValues={{ name: editModal?.name }}
          onFinish={(values) => updateRoleMutation.mutate({ id: editModal.id, data: values })}
          className="mt-4"
        >
          <Form.Item name="name" label="Role Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space>
              <Button onClick={() => setEditModal(null)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updateRoleMutation.isPending} className="!bg-brand-dark !border-0">Save</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Business Management Tab ───────────────────────────────────
function BusinessManagementTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editBiz, setEditBiz] = useState(null);

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
    {
      title: 'Actions', render: (_, r) => (
        <Button type="text" size="small" icon={<Pencil size={14} />} onClick={() => setEditBiz({ ...r })} />
      ),
    },
  ];

  return (
    <>
      <Card size="small" title={<span className="flex items-center gap-2"><Building2 size={14} />Own Businesses</span>} className="border border-slate-100">
        <Table dataSource={businesses || []} columns={bizColumns} rowKey="id" size="middle" pagination={false} loading={isLoading} />
      </Card>

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
    </>
  );
}

// ── System Tab ────────────────────────────────────────────────
function SystemTab() {
  return (
    <Row gutter={16}>
      <Col xs={24}>
        <Card size="small" title="System Info" className="border border-slate-100">
          <div className="mb-3">
            <Text type="secondary" className="text-xs">App Version</Text>
            <div><Text strong>1.0.0</Text></div>
          </div>
          <div className="mb-3">
            <Text type="secondary" className="text-xs">Environment</Text>
            <div><Tag color="green" className="rounded-full">Production</Tag></div>
          </div>
          <div>
            <Text type="secondary" className="text-xs">Company</Text>
            <div><Text>Bentabet Ltd · Dar es Salaam, Tanzania</Text></div>
          </div>
        </Card>
      </Col>
    </Row>
  );
}

// ── Main Settings Page ────────────────────────────────────────
export default function SettingsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsAPI.getAll().then(r => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d) => settingsAPI.update(d),
    onSuccess: () => { message.success('Settings saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to save'),
  });

  if (isLoading) return <Spin size="large" className="block mx-auto my-20" />;

  const tabItems = [
    { key: 'profile', label: 'My Profile', children: <ProfileTab /> },
    { key: 'company', label: 'Company Profile', children: <CompanyTab settings={settings} onSave={saveMutation.mutate} saving={saveMutation.isPending} /> },
    { key: 'machines', label: 'Machine Settings', children: <MachineSettingsTab settings={settings} onSave={saveMutation.mutate} saving={saveMutation.isPending} /> },
    { key: 'finance', label: 'Finance & SLA', children: <FinanceSettingsTab settings={settings} onSave={saveMutation.mutate} saving={saveMutation.isPending} /> },
    { key: 'notifications', label: 'Notifications & SMS', children: <NotificationsTab settings={settings} onSave={saveMutation.mutate} saving={saveMutation.isPending} /> },
    { key: 'roles', label: 'Role Builder', children: <RoleBuilderTab /> },
    { key: 'businesses', label: 'Business Management', children: <BusinessManagementTab /> },
    { key: 'system', label: 'System', children: <SystemTab /> },
  ];

  return (
    <div>
      <div className="mb-6 pb-4 border-b border-slate-200/60">
        <Title level={4} className="!m-0 !text-slate-800 !font-extrabold !tracking-tight">Settings</Title>
      </div>
      <Tabs items={tabItems} />
    </div>
  );
}
