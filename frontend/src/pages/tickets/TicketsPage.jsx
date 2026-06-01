// src/pages/tickets/TicketsPage.jsx
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, Row, Col, Card, Statistic, Upload, DatePicker, App, Typography, Badge, notification } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ticketsAPI } from '../../services/api';
import socket, { connectSocket } from '../../socket';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const PRIORITY_COLORS = { urgent: 'red', high: 'orange', medium: 'blue', low: 'default' };
const STATUS_COLORS = { open: 'blue', pending: 'orange', in_progress: 'processing', resolved: 'green', closed: 'default', reopened: 'volcano' };

export default function TicketsPage() {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState({ limit: 50, offset: 0 });
  const [liveCounts, setLiveCounts] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => ticketsAPI.list(filters).then(r => r.data.data),
  });

  const { data: counts } = useQuery({
    queryKey: ['ticket-counts'],
    queryFn: () => ticketsAPI.counts().then(r => r.data.data),
  });

  const { data: groups } = useQuery({
    queryKey: ['ticket-groups'],
    queryFn: () => ticketsAPI.groups().then(r => r.data.data),
  });

  // Socket.io live updates
  useEffect(() => {
    connectSocket();
    socket.emit('join:tickets');

    socket.on('ticket:update', (payload) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket-counts'] });
      if (payload.type === 'new') {
        const t = payload.ticket;
        notification.open({
          message: '🎫 New Ticket',
          description: `[${t.priority?.toUpperCase()}] ${t.subject}`,
          duration: t.priority === 'urgent' ? 0 : 5,
        });
      }
    });

    socket.on('ticket:counts', (c) => setLiveCounts(c));

    return () => {
      socket.off('ticket:update');
      socket.off('ticket:counts');
    };
  }, [qc]);

  const createMutation = useMutation({
    mutationFn: (fd) => ticketsAPI.create(fd),
    onSuccess: () => {
      message.success('Ticket created');
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setOpen(false);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const onCreateFinish = (values) => {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => { if (k !== 'attachments' && v !== undefined) fd.append(k, v); });
    if (values.attachments?.fileList) {
      values.attachments.fileList.forEach(f => { if (f.originFileObj) fd.append('attachments', f.originFileObj); });
    }
    createMutation.mutate(fd);
  };

  const displayCounts = liveCounts || counts;

  const statusBadges = [
    { key: 'total', label: 'Total', color: '#1a1a1a' },
    { key: 'open', label: 'Open', color: '#1890ff' },
    { key: 'pending', label: 'Pending', color: '#fa8c16' },
    { key: 'in_progress', label: 'In Progress', color: '#722ed1' },
    { key: 'resolved', label: 'Resolved', color: '#52c41a' },
    { key: 'closed', label: 'Closed', color: '#8c8c8c' },
    { key: 'reopened', label: 'Reopened', color: '#f5222d' },
  ];

  const cols = [
    { title: '#', dataIndex: 'ticket_number', render: v => <strong>{v}</strong>, width: 100 },
    { title: 'Subject', dataIndex: 'subject', ellipsis: true, render: (v, r) => <a onClick={() => navigate(`/tickets/${r.id}`)}>{v}</a> },
    { title: 'Priority', dataIndex: 'priority', render: v => <Tag color={PRIORITY_COLORS[v]}>{v?.toUpperCase()}</Tag>, width: 90 },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]}>{v?.replace('_', ' ')}</Tag>, width: 110 },
    { title: 'Machine', dataIndex: ['machine', 'slot_code'], width: 110 },
    { title: 'Shop', dataIndex: ['shop', 'name'], width: 130 },
    { title: 'Group', dataIndex: ['group', 'name'], width: 120 },
    {
      title: 'SLA',
      dataIndex: 'sla_deadline',
      width: 130,
      render: (v, r) => {
        if (!v || ['resolved', 'closed'].includes(r.status)) return '—';
        const overdue = dayjs(v).isBefore(dayjs());
        return <Tag color={overdue ? 'red' : 'green'}>{overdue ? '⚠ BREACHED' : dayjs(v).fromNow()}</Tag>;
      },
    },
    { title: 'Created', dataIndex: 'created_at', render: v => dayjs(v).format('DD MMM HH:mm'), width: 120 },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Ticket Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} style={{ background: '#1a6b3a' }}>
          New Ticket
        </Button>
      </div>

      {/* Live count badges */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {statusBadges.map(({ key, label, color }) => (
          <Col key={key} xs={12} sm={8} md={24 / statusBadges.length}>
            <Card size="small" style={{ cursor: 'pointer', borderTop: `3px solid ${color}` }}
              onClick={() => key !== 'total' && setFilters(f => ({ ...f, status: f.status === key ? undefined : key }))}>
              <Statistic title={label} value={displayCounts?.[key] ?? '—'} valueStyle={{ color, fontSize: 24 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="Ticket number"
            allowClear
            style={{ width: 160 }}
            onSearch={v => setFilters(f => ({ ...f, ticket_number: v || undefined }))}
          />
          <Input.Search
            placeholder="Slot code"
            allowClear
            style={{ width: 140 }}
            onSearch={v => setFilters(f => ({ ...f, slot_code: v || undefined }))}
          />
          <Select allowClear placeholder="Status" style={{ width: 130 }} onChange={v => setFilters(f => ({ ...f, status: v }))}>
            {['open', 'pending', 'in_progress', 'resolved', 'closed', 'reopened'].map(s => <Option key={s} value={s}>{s.replace('_', ' ')}</Option>)}
          </Select>
          <Select allowClear placeholder="Priority" style={{ width: 120 }} onChange={v => setFilters(f => ({ ...f, priority: v }))}>
            {['urgent', 'high', 'medium', 'low'].map(p => <Option key={p} value={p}>{p}</Option>)}
          </Select>
          <Select allowClear placeholder="Group" style={{ width: 140 }} onChange={v => setFilters(f => ({ ...f, group_id: v }))}>
            {(groups || []).map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
          </Select>
          <RangePicker
            size="small"
            onChange={(d) => setFilters(f => ({ ...f, date_from: d?.[0]?.toISOString(), date_to: d?.[1]?.toISOString() }))}
          />
        </Space>
      </Card>

      <Table
        dataSource={data?.rows || []}
        columns={cols}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 1000 }}
        rowClassName={(r) => {
          if (r.priority === 'urgent') return 'ant-table-row-urgent';
          if (r.sla_deadline && dayjs(r.sla_deadline).isBefore(dayjs()) && !['resolved', 'closed'].includes(r.status)) return 'ant-table-row-warning';
          return '';
        }}
        pagination={{
          total: data?.count,
          pageSize: 50,
          onChange: (p) => setFilters(f => ({ ...f, offset: (p - 1) * 50 })),
        }}
      />

      {/* Create Modal */}
      <Modal title="Create New Ticket" open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} width={600}>
        <Form form={form} layout="vertical" onFinish={onCreateFinish} style={{ marginTop: 16 }}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ticket_type" label="Type" rules={[{ required: true }]}>
                <Select>
                  {['technical', 'financial', 'operational', 'complaint', 'other'].map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" initialValue="medium" rules={[{ required: true }]}>
                <Select>
                  {['urgent', 'high', 'medium', 'low'].map(p => <Option key={p} value={p}><Tag color={PRIORITY_COLORS[p]}>{p}</Tag></Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="slot_code" label="Slot Code (optional)"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assigned_group_id" label="Assign to Group">
                <Select allowClear>
                  {(groups || []).map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="attachments" label="Attachments (images/PDFs)">
            <Upload beforeUpload={() => false} multiple accept="image/*,.pdf" listType="text">
              <Button icon={<UploadOutlined />}>Attach Files</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
