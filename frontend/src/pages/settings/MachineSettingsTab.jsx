import { useEffect } from 'react';
import { Form, InputNumber, Button, Card, Row, Col, Divider, App, Tag } from 'antd';
import { Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function MachineSettingsTab() {
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
      title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">Machine Settings {!canEdit && <Tag className="!text-[10px] rounded-full">Read-only</Tag>}</span>}>
      <Form form={form} layout="vertical" onFinish={canEdit ? saveMutation.mutate : undefined} className="mt-4">
        <Divider plain>Credit Values (TZS per credit)</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="meteora_credit_value" label="Meteora"><InputNumber min={1} className="!w-full" disabled={!canEdit} /></Form.Item></Col>
          <Col span={8}><Form.Item name="novomatic_credit_value" label="Novomatic"><InputNumber min={1} className="!w-full" disabled={!canEdit} /></Form.Item></Col>
          <Col span={8}><Form.Item name="egt_credit_value" label="EGT"><InputNumber min={1} className="!w-full" disabled={!canEdit} /></Form.Item></Col>
        </Row>
        <Divider plain>Weekly Target</Divider>
        <Form.Item name="weekly_target_tzs" label="Weekly Target per Machine (TZS)">
          <InputNumber min={0} className="!w-full" disabled={!canEdit}
            formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
        </Form.Item>
        <Divider plain>Commission Percentages</Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="office_pct" label="Office %"><InputNumber min={0} max={100} className="!w-full" disabled={!canEdit} /></Form.Item></Col>
        </Row>
        {canEdit && (
          <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={saveMutation.isPending} className="!bg-brand-dark !border-0 hover:!bg-brand-light">Save</Button>
        )}
      </Form>
    </Card>
  );
}
