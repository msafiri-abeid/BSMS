// src/pages/collections/MyAssignmentsPage.jsx
import { useState } from 'react';
import { Card, Button, Tag, Modal, Form, Input, InputNumber, Upload, Alert, Spin, Row, Col, Statistic, App, Typography, Divider } from 'antd';
import { CameraOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function MyAssignmentsPage() {
  const [submitting, setSubmitting] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => collectionsAPI.myAssignments().then(r => r.data.data),
    refetchInterval: 60000,
  });

  const submitMutation = useMutation({
    mutationFn: (fd) => collectionsAPI.submit(fd),
    onSuccess: (res) => {
      const c = res.data.data;
      message.success(`Collection submitted — Gross: TZS ${c.gross_tzs?.toLocaleString()}`);
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      setSubmitting(null);
      setOcrResult(null);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Submission failed'),
  });

  const handleOCR = async ({ file }) => {
    if (!submitting) return;
    setOcrLoading(true);
    setOcrResult(null);
    const fd = new FormData();
    fd.append('meter_image', file);
    fd.append('machine_id', submitting.machine_id);
    try {
      const res = await collectionsAPI.ocr(fd);
      const result = res.data.data;
      setOcrResult(result);
      if (result.success && result.extractedValues) {
        const v = result.extractedValues;
        if (v.credit_count !== null) form.setFieldValue('curr_count', v.credit_count);
        if (v.total_in !== null) form.setFieldValue('total_in', v.total_in);
        if (v.total_out !== null) form.setFieldValue('total_out', v.total_out);
      }
    } catch {
      message.error('OCR failed — enter values manually');
    } finally {
      setOcrLoading(false);
    }
  };

  const onFinish = (values) => {
    const fd = new FormData();
    fd.append('machine_id', submitting.machine_id);
    fd.append('shop_id', submitting.shop_id);
    fd.append('assignment_id', submitting.id);
    fd.append('curr_count', values.curr_count || 0);
    if (values.meter_image?.file) fd.append('meter_image', values.meter_image.file);
    if (submitting.machine?.manufacturer === 'Novomatic') {
      fd.append('novomatic_data', JSON.stringify({
        total_in_tzs: values.total_in,
        total_out_tzs: values.total_out,
        coins_in_tzs: values.coins_in || 0,
      }));
    }
    submitMutation.mutate(fd);
  };

  const isNovomatic = submitting?.machine?.manufacturer === 'Novomatic';

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  const pending = (assignments || []).filter(a => a.status === 'pending');
  const done = (assignments || []).filter(a => a.status === 'done');

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>My Assignments — {dayjs().format('DD MMM YYYY')}</Title>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title="Total" value={assignments?.length || 0} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Pending" value={pending.length} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Done" value={done.length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      {pending.length === 0 && done.length === 0 && (
        <Card><div className="empty-state"><div className="icon">📋</div><Text type="secondary">No assignments for today</Text></div></Card>
      )}

      <Row gutter={[12, 12]}>
        {(assignments || []).map(a => (
          <Col xs={24} sm={12} md={8} key={a.id}>
            <Card
              size="small"
              style={{ borderLeft: `3px solid ${a.status === 'done' ? '#52c41a' : '#faad14'}` }}
              extra={<Tag color={a.status === 'done' ? 'green' : 'orange'}>{a.status}</Tag>}
              title={<Text strong>{a.machine?.slot_code}</Text>}
            >
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Shop:</Text> <Text style={{ fontSize: 13 }}>{a.shop?.name}</Text></div>
              <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Manufacturer:</Text> <Tag style={{ fontSize: 11 }}>{a.machine?.manufacturer}</Tag></div>
              <div style={{ marginBottom: 12 }}><Text type="secondary" style={{ fontSize: 12 }}>Prev. Count:</Text> <Text strong>{a.machine?.previous_count?.toLocaleString()}</Text></div>
              {a.status === 'pending' && (
                <Button type="primary" size="small" block onClick={() => { setSubmitting(a); form.resetFields(); setOcrResult(null); }}
                  style={{ background: '#1a6b3a' }}>
                  Submit Collection
                </Button>
              )}
              {a.status === 'done' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title={`Submit Collection — ${submitting?.machine?.slot_code}`}
        open={!!submitting}
        onCancel={() => { setSubmitting(null); setOcrResult(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={submitMutation.isPending}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item label="Meter Photo (Optional — OCR will auto-fill)" name="meter_image">
            <Upload beforeUpload={() => false} onChange={handleOCR} maxCount={1} accept="image/*">
              <Button icon={ocrLoading ? <LoadingOutlined /> : <CameraOutlined />} disabled={ocrLoading}>
                {ocrLoading ? 'Reading...' : 'Upload Photo'}
              </Button>
            </Upload>
          </Form.Item>

          {ocrResult && (
            <Alert
              type={ocrResult.success ? (ocrResult.needsConfirmation ? 'warning' : 'success') : 'error'}
              message={ocrResult.success ? (ocrResult.needsConfirmation ? 'OCR: Low confidence — please verify values' : 'OCR: Values auto-filled') : 'OCR failed — enter manually'}
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          {!isNovomatic && (
            <Form.Item name="curr_count" label="Current Counter Reading" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} size="large" />
            </Form.Item>
          )}

          {isNovomatic && (
            <>
              <Divider plain>Novomatic Master Accounting Screen</Divider>
              <Form.Item name="total_in" label="TOTAL IN (credits)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="total_out" label="TOTAL OUT (credits)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="coins_in" label="Coins IN (credits)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}

          {submitting && (
            <Alert
              type="info"
              message={`Previous reading: ${submitting.machine?.previous_count?.toLocaleString()} | Credit value: TZS ${submitting.machine?.credit_value_tzs}`}
              style={{ marginBottom: 0 }}
            />
          )}
        </Form>
      </Modal>
    </div>
  );
}
