import { useEffect } from 'react';
import { Form, Input, InputNumber, Button, Card, Row, Col, Divider, App, Tag } from 'antd';
import { Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function FinanceSettingsTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
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

  return (
    <Card size="small" className="max-w-[600px] border border-slate-100"
      title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">Finance & SLA {!canEdit && <Tag className="!text-[10px] rounded-full">Read-only</Tag>}</span>}>
      <Form form={form} layout="vertical" onFinish={canEdit ? saveMutation.mutate : undefined} className="mt-4">
        <Divider plain>Reference Number Prefixes</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="invoice_prefix" label="Invoice Prefix"><Input placeholder="INV-" disabled={!canEdit} /></Form.Item></Col>
          <Col span={8}><Form.Item name="ticket_prefix" label="Ticket Prefix"><Input placeholder="TKT-" disabled={!canEdit} /></Form.Item></Col>
          <Col span={8}><Form.Item name="slot_code_prefix" label="Slot Code Prefix"><Input placeholder="SLT-" disabled={!canEdit} /></Form.Item></Col>
        </Row>
        <Divider plain>SLA Hours</Divider>
        <Row gutter={12}>
          <Col span={6}><Form.Item name="sla_urgent_hours" label="Urgent"><InputNumber min={1} className="!w-full" disabled={!canEdit} /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_high_hours" label="High"><InputNumber min={1} className="!w-full" disabled={!canEdit} /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_medium_hours" label="Medium"><InputNumber min={1} className="!w-full" disabled={!canEdit} /></Form.Item></Col>
          <Col span={6}><Form.Item name="sla_low_hours" label="Low"><InputNumber min={1} className="!w-full" disabled={!canEdit} /></Form.Item></Col>
        </Row>
        {canEdit && (
          <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={saveMutation.isPending} className="!bg-brand-dark !border-0 hover:!bg-brand-light">Save</Button>
        )}
      </Form>
    </Card>
  );
}
