// src/pages/settings/SettingsPage.jsx
import { useState, useEffect } from 'react';
import { Tabs, Form, Input, InputNumber, Switch, Button, Table, Modal, Card, Row, Col, Checkbox, Tag, App, Typography, Divider, Space, Spin } from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../../services/api';

const { Title, Text } = Typography;

const MODULES = ['partners', 'shops', 'machines', 'collections', 'finance', 'inventory', 'tickets', 'staff', 'reports', 'settings', 'users'];
const ACTIONS = ['read', 'write', 'approve', 'delete'];

// ── Company Profile Tab ───────────────────────────────────────
function CompanyTab({ settings, onSave, saving }) {
  const [form] = Form.useForm();
  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);
  return (
    <Card size="small" style={{ maxWidth: 600 }}>
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Form.Item name="company_name" label="Company Name"><Input /></Form.Item>
        <Form.Item name="company_phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="company_email" label="Email"><Input /></Form.Item>
        <Form.Item name="company_address" label="Address"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="company_tax_number" label="Tax Number"><Input /></Form.Item>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} style={{ background: '#1a6b3a' }}>Save</Button>
      </Form>
    </Card>
  );
}

// ── Machine Settings Tab ──────────────────────────────────────
function MachineSettingsTab({ settings, onSave, saving }) {
  const [form] = Form.useForm();
  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);
  return (
    <Card size="small" style={{ maxWidth: 600 }}>
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Divider plain>Credit Values (TZS per credit)</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="meteora_credit_value" label="Meteora"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="novomatic_credit_value" label="Novomatic"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="egt_credit_value" label="EGT"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Divider plain>Weekly Target</Divider>
        <Form.Item name="weekly_target_tzs" label="Weekly Target per Machine (TZS)">
          <InputNumber min={0} style={{ width: '100%' }} formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
        </Form.Item>
        <Divider plain>Commission Percentages</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="office_pct" label="Office %"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} style={{ background: '#1a6b3a' }}>Save</Button>
      </Form>
    </Card>
  );
}

// ── Finance Settings Tab ──────────────────────────────────────
function FinanceSettingsTab({ settings, onSave, saving }) {
  const [form] = Form.useForm();
  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);
  return (
    <Card size="small" style={{ maxWidth: 600 }}>
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Divider plain>Reference Number Prefixes</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="invoice_prefix" label="Invoice Prefix"><Input placeholder="INV-" /></Form.Item></Col>
          <Col span={8}><Form.Item name="ticket_prefix" label="Ticket Prefix"><Input placeholder="TKT-" /></Form.Item></Col>
          <Col span={8}><Form.Item name="slot_code_prefix" label="Slot Code Prefix"><Input placeholder="SLT-" /></Form.Item></Col>
        </Row>
        <Divider plain>SLA Hours</Divider>
        <Row gutter={12}>
          <Col span={6}><Form.Item name="sla_urgent_hours" label="Urgent"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_high_hours" label="High"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_medium_hours" label="Medium"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_low_hours" label="Low"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} style={{ background: '#1a6b3a' }}>Save</Button>
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
    <Card size="small" style={{ maxWidth: 640 }}>
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Divider plain>Beem Africa SMS</Divider>
        <Form.Item name="beem_api_key" label="API Key"><Input.Password /></Form.Item>
        <Form.Item name="beem_secret" label="Secret"><Input.Password /></Form.Item>
        <Form.Item name="beem_sender_name" label="Sender Name"><Input /></Form.Item>
        <Divider plain>Alert Toggles</Divider>
        <Form.Item name="alert_weekly_target" valuePropName="checked" label={null}>
          <Switch /> <Text style={{ marginLeft: 8 }}>Weekly target not met alert</Text>
        </Form.Item>
        <Form.Item name="alert_sla_breach" valuePropName="checked" label={null}>
          <Switch /> <Text style={{ marginLeft: 8 }}>Ticket SLA breach alert</Text>
        </Form.Item>
        <Form.Item name="alert_low_stock" valuePropName="checked" label={null}>
          <Switch /> <Text style={{ marginLeft: 8 }}>Low token stock alert</Text>
        </Form.Item>
        <Form.Item name="alert_pending_expenses" valuePropName="checked" label={null}>
          <Switch /> <Text style={{ marginLeft: 8 }}>Daily pending expense reminder</Text>
        </Form.Item>
        <Divider plain>Test SMS</Divider>
        <Space>
          <Input placeholder="+255 7XX XXX XXX" value={testPhone} onChange={e => setTestPhone(e.target.value)} style={{ width: 200 }} />
          <Button onClick={handleTest}>Send Test SMS</Button>
        </Space>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} style={{ background: '#1a6b3a' }}>Save</Button>
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
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: () => settingsAPI.getRoles().then(r => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (d) => settingsAPI.createRole(d),
    onSuccess: () => { message.success('Role created'); qc.invalidateQueries({ queryKey: ['roles'] }); setNewRoleName(''); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const permMutation = useMutation({
    mutationFn: ({ roleId, permissions }) => settingsAPI.updatePermissions(roleId, { permissions }),
    onSuccess: () => { message.success('Permissions saved'); qc.invalidateQueries({ queryKey: ['roles'] }); },
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

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card size="small" title="Roles" extra={
          <Space>
            <Input size="small" placeholder="New role name" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} style={{ width: 130 }} />
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => newRoleName && createMutation.mutate({ name: newRoleName })} style={{ background: '#1a6b3a' }}>Add</Button>
          </Space>
        }>
          {isLoading ? <Spin /> : (roles || []).map(role => (
            <div key={role.id}
              onClick={() => selectRole(role)}
              style={{
                padding: '8px 12px', cursor: 'pointer', borderRadius: 6, marginBottom: 4,
                background: selected?.id === role.id ? '#e6f7e6' : '#fafafa',
                border: selected?.id === role.id ? '1px solid #1a6b3a' : '1px solid #f0f0f0',
              }}>
              <Text strong>{role.name}</Text>
              {role.is_system && <Tag style={{ marginLeft: 8, fontSize: 10 }}>System</Tag>}
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{role.permissions?.length || 0} permissions</Text>
            </div>
          ))}
        </Card>
      </Col>

      <Col span={16}>
        {selected ? (
          <Card size="small" title={`Permissions: ${selected.name}`}
            extra={<Button type="primary" size="small" onClick={savePermissions} loading={permMutation.isPending} style={{ background: '#1a6b3a' }}>Save Permissions</Button>}>
            {selected.is_system ? (
              <Text type="secondary">System roles cannot be modified via the role builder.</Text>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>Module</th>
                    {ACTIONS.map(a => <th key={a} style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #f0f0f0', textTransform: 'capitalize' }}>{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => (
                    <tr key={mod} style={{ borderBottom: '1px solid #fafafa' }}>
                      <td style={{ padding: '6px 8px', fontSize: 13, textTransform: 'capitalize' }}>{mod}</td>
                      {ACTIONS.map(act => (
                        <td key={act} style={{ textAlign: 'center', padding: '6px 8px' }}>
                          <Checkbox
                            checked={permMatrix[mod]?.[act] || false}
                            onChange={() => toggle(mod, act)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ) : (
          <Card size="small">
            <div className="empty-state">
              <div className="icon">🔐</div>
              <Text type="secondary">Select a role to manage its permissions</Text>
            </div>
          </Card>
        )}
      </Col>
    </Row>
  );
}

// ── System Tab ────────────────────────────────────────────────
function SystemTab() {
  const [cpForm] = Form.useForm();
  const { message } = App.useApp();

  const handleChangePassword = async (values) => {
    try {
      const api = (await import('../../services/api')).default;
      await api.put('/auth/password', values);
      message.success('Password changed successfully');
      cpForm.resetFields();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed');
    }
  };

  return (
    <Row gutter={16}>
      <Col span={12}>
        <Card size="small" title="Change Password">
          <Form form={cpForm} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item name="currentPassword" label="Current Password" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="newPassword" label="New Password" rules={[{ required: true, min: 8 }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" style={{ background: '#1a6b3a' }}>Update Password</Button>
          </Form>
        </Card>
      </Col>
      <Col span={12}>
        <Card size="small" title="System Info">
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">App Version</Text>
            <div><Text strong>1.0.0</Text></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">Environment</Text>
            <div><Tag color="green">Production</Tag></div>
          </div>
          <div>
            <Text type="secondary">Company</Text>
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

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  const tabItems = [
    { key: 'company', label: 'Company Profile', children: <CompanyTab settings={settings} onSave={saveMutation.mutate} saving={saveMutation.isPending} /> },
    { key: 'machines', label: 'Machine Settings', children: <MachineSettingsTab settings={settings} onSave={saveMutation.mutate} saving={saveMutation.isPending} /> },
    { key: 'finance', label: 'Finance & SLA', children: <FinanceSettingsTab settings={settings} onSave={saveMutation.mutate} saving={saveMutation.isPending} /> },
    { key: 'notifications', label: 'Notifications & SMS', children: <NotificationsTab settings={settings} onSave={saveMutation.mutate} saving={saveMutation.isPending} /> },
    { key: 'roles', label: 'Role Builder', children: <RoleBuilderTab /> },
    { key: 'system', label: 'System', children: <SystemTab /> },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Settings</Title>
      </div>
      <Tabs items={tabItems} />
    </div>
  );
}
