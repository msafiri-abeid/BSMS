// src/pages/inventory/TokenInventoryPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Row, Col, Card, Statistic, App, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const TYPE_COLORS = { purchase: 'green', refill_out: 'red', adjustment: 'blue' };

export default function TokenInventoryPage() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['token-inventory'],
    queryFn: () => inventoryAPI.tokens().then(r => r.data.data),
  });

  const addMutation = useMutation({
    mutationFn: (d) => inventoryAPI.addTokenMovement(d),
    onSuccess: () => {
      message.success('Movement recorded');
      qc.invalidateQueries({ queryKey: ['token-inventory'] });
      setOpen(false);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const cols = [
    { title: 'Date', dataIndex: 'created_at', render: v => dayjs(v).format('DD MMM YYYY HH:mm') },
    { title: 'Type', dataIndex: 'movement_type', render: v => <Tag color={TYPE_COLORS[v]}>{v}</Tag> },
    { title: 'Qty', dataIndex: 'qty', render: (v, r) => <span style={{ color: r.movement_type === 'purchase' ? '#52c41a' : '#f5222d', fontWeight: 600 }}>{r.movement_type === 'purchase' ? '+' : '-'}{Math.abs(v)}</span> },
    { title: 'Unit Value', dataIndex: 'unit_value_tzs', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Total Value', dataIndex: 'total_value_tzs', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Note', dataIndex: 'note', ellipsis: true },
  ];

  const currentStock = data?.current || 0;
  const lowThreshold = 500;

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Token Inventory</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} style={{ background: '#1a6b3a' }}>
          Record Movement
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Current Stock (tokens)"
              value={currentStock}
              valueStyle={{ color: currentStock < lowThreshold ? '#f5222d' : '#1a6b3a', fontSize: 28 }}
            />
            {currentStock < lowThreshold && (
              <div style={{ color: '#f5222d', fontSize: 12, marginTop: 4 }}>⚠ Below threshold ({lowThreshold})</div>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Total Purchased (all time)"
              value={(data?.movements || []).filter(m => m.movement_type === 'purchase').reduce((s, m) => s + m.qty, 0)}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Total Dispatched (all time)"
              value={(data?.movements || []).filter(m => m.movement_type === 'refill_out').reduce((s, m) => s + Math.abs(m.qty), 0)}
            />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={data?.movements || []}
        columns={cols}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Record Token Movement"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={addMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => addMutation.mutate({ ...v, total_value_tzs: v.qty * v.unit_value_tzs })}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="movement_type" label="Movement Type" rules={[{ required: true }]}>
            <Select>
              <Option value="purchase">Purchase (IN)</Option>
              <Option value="refill_out">Refill Dispatch (OUT)</Option>
              <Option value="adjustment">Adjustment</Option>
            </Select>
          </Form.Item>
          <Form.Item name="qty" label="Quantity (tokens)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit_value_tzs" label="Value per Token (TZS)" rules={[{ required: true }]} initialValue={200}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
