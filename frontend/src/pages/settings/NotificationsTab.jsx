import { useState, useEffect } from 'react';
import { Form, Input, Switch, Button, Card, Space, Divider, App, Typography, Tag } from 'antd';
import { Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;

export default function NotificationsTab() {
  const [form] = Form.useForm();
  const [testPhone, setTestPhone] = useState('');
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('settings', 'update');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsAPI.getAll().then(r => r.data.data),
  });

  useEffect(() => { if (settings) form.setFieldsValue(settings); }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (d) => settingsAPI.update(d),
    onSuccess: () => { message.success('Settings saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to save'),
  });

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
    <Card size="small" className="max-w-[640px] border border-slate-100"
      title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">Notifications & SMS {!canEdit && <Tag className="!text-[10px] rounded-full">Read-only</Tag>}</span>}>
      <Form form={form} layout="vertical" onFinish={canEdit ? saveMutation.mutate : undefined} className="mt-4">
        <Divider plain>Beem Africa SMS</Divider>
        <Form.Item name="beem_api_key" label="API Key"><Input.Password disabled={!canEdit} /></Form.Item>
        <Form.Item name="beem_secret" label="Secret"><Input.Password disabled={!canEdit} /></Form.Item>
        <Form.Item name="beem_sender_name" label="Sender Name"><Input disabled={!canEdit} /></Form.Item>
        <Divider plain>Alert Toggles</Divider>
        <Form.Item name="alert_weekly_target" valuePropName="checked" label={null}>
          <Switch disabled={!canEdit} /> <Text className="ml-2">Weekly target not met alert</Text>
        </Form.Item>
        <Form.Item name="alert_sla_breach" valuePropName="checked" label={null}>
          <Switch disabled={!canEdit} /> <Text className="ml-2">Ticket SLA breach alert</Text>
        </Form.Item>
        <Form.Item name="alert_low_stock" valuePropName="checked" label={null}>
          <Switch disabled={!canEdit} /> <Text className="ml-2">Low token stock alert</Text>
        </Form.Item>
        <Form.Item name="alert_pending_expenses" valuePropName="checked" label={null}>
          <Switch disabled={!canEdit} /> <Text className="ml-2">Daily pending expense reminder</Text>
        </Form.Item>
        <Divider plain>Test SMS</Divider>
        <Space>
          <Input placeholder="+255 7XX XXX XXX" value={testPhone} onChange={e => setTestPhone(e.target.value)} className="!w-[200px]" disabled={!canEdit} />
          <Button onClick={handleTest} disabled={!canEdit}>Send Test SMS</Button>
        </Space>
        {canEdit && (
          <div className="mt-4">
            <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={saveMutation.isPending} className="!bg-brand-dark !border-0 hover:!bg-brand-light">Save</Button>
          </div>
        )}
      </Form>
    </Card>
  );
}
