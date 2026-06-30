import { useEffect } from 'react';
import { Form, Input, Button, Card, App, Tag } from 'antd';
import { Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function CompanyTab() {
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
      title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">Company Profile {!canEdit && <Tag className="!text-[10px] rounded-full">Read-only</Tag>}</span>}>
      <Form form={form} layout="vertical" onFinish={canEdit ? saveMutation.mutate : undefined} className="mt-4">
        <Form.Item name="company_name" label="Company Name"><Input disabled={!canEdit} /></Form.Item>
        <Form.Item name="company_phone" label="Phone"><Input disabled={!canEdit} /></Form.Item>
        <Form.Item name="company_email" label="Email"><Input disabled={!canEdit} /></Form.Item>
        <Form.Item name="company_address" label="Address"><Input.TextArea rows={2} disabled={!canEdit} /></Form.Item>
        <Form.Item name="company_tax_number" label="Tax Number"><Input disabled={!canEdit} /></Form.Item>
        {canEdit && (
          <Button type="primary" htmlType="submit" icon={<Save size={14} />} loading={saveMutation.isPending} className="!bg-brand-dark !border-0 hover:!bg-brand-light">Save</Button>
        )}
      </Form>
    </Card>
  );
}
