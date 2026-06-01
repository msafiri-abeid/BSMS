// src/pages/tickets/TicketDetailPage.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Tag, Select, Space, Timeline, Input, Upload, App, Typography, Descriptions, Spin, Row, Col, Divider } from 'antd';
import { ArrowLeftOutlined, SendOutlined, UploadOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { ticketsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PRIORITY_COLORS = { urgent: 'red', high: 'orange', medium: 'blue', low: 'default' };
const STATUS_COLORS = { open: 'blue', pending: 'orange', in_progress: 'processing', resolved: 'green', closed: 'default', reopened: 'volcano' };
const TRANSITIONS = {
  open: ['in_progress', 'pending', 'closed'],
  pending: ['in_progress', 'closed'],
  in_progress: ['resolved', 'pending'],
  resolved: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['in_progress', 'closed'],
};

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketsAPI.get(id).then(r => r.data.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, note }) => ticketsAPI.updateStatus(id, { status, note }),
    onSuccess: () => { message.success('Status updated'); qc.invalidateQueries({ queryKey: ['ticket', id] }); setNewStatus(''); setNote(''); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const activityMutation = useMutation({
    mutationFn: (fd) => ticketsAPI.addActivity(id, fd),
    onSuccess: () => { message.success('Comment added'); qc.invalidateQueries({ queryKey: ['ticket', id] }); setNote(''); setFiles([]); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const handleStatusChange = () => {
    if (!newStatus) return message.warning('Select a status');
    statusMutation.mutate({ status: newStatus, note });
  };

  const handleComment = () => {
    if (!note.trim() && files.length === 0) return message.warning('Add a comment or attachment');
    const fd = new FormData();
    fd.append('action', 'comment');
    fd.append('note', note);
    files.forEach(f => fd.append('attachments', f.originFileObj));
    activityMutation.mutate(fd);
  };

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (!ticket) return <div>Ticket not found</div>;

  const availableTransitions = TRANSITIONS[ticket.status] || [];

  const timelineItems = (ticket.activities || []).map(a => ({
    dot: <ClockCircleOutlined style={{ fontSize: 14 }} />,
    color: a.to_status ? STATUS_COLORS[a.to_status] || 'gray' : 'gray',
    children: (
      <div style={{ paddingBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text strong style={{ fontSize: 13 }}>{a.action?.replace('_', ' ')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(a.created_at).format('DD MMM YYYY HH:mm')}</Text>
        </div>
        {a.from_status && a.to_status && (
          <div style={{ marginBottom: 4 }}>
            <Tag>{a.from_status}</Tag> → <Tag color={STATUS_COLORS[a.to_status]}>{a.to_status}</Tag>
          </div>
        )}
        {a.note && <Text style={{ fontSize: 13, display: 'block', color: '#444' }}>{a.note}</Text>}
        {a.attachments?.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {a.attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" style={{ marginRight: 8, fontSize: 12 }}>📎 Attachment {i + 1}</a>
            ))}
          </div>
        )}
        <Text type="secondary" style={{ fontSize: 11 }}>by {a.performed_by}</Text>
      </div>
    ),
  }));

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tickets')} />
          <Title level={4} style={{ margin: 0 }}>Ticket #{ticket.ticket_number}</Title>
        </Space>
        <Space>
          <Tag color={PRIORITY_COLORS[ticket.priority]} style={{ fontSize: 13, padding: '3px 10px' }}>{ticket.priority?.toUpperCase()}</Tag>
          <Tag color={STATUS_COLORS[ticket.status]} style={{ fontSize: 13, padding: '3px 10px' }}>{ticket.status?.replace('_', ' ').toUpperCase()}</Tag>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title={ticket.subject} size="small" style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{ticket.description || 'No description provided.'}</Text>
          </Card>

          {/* Activity Timeline */}
          <Card title="Activity History" size="small" style={{ marginBottom: 16 }}>
            {timelineItems.length > 0
              ? <Timeline items={timelineItems} style={{ paddingTop: 16 }} />
              : <Text type="secondary">No activity yet</Text>
            }
          </Card>

          {/* Add Comment */}
          <Card title="Add Comment / Update" size="small">
            <TextArea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note, comment, or update..."
              style={{ marginBottom: 12 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Upload beforeUpload={() => false} fileList={files} onChange={({ fileList }) => setFiles(fileList)} multiple>
                <Button icon={<UploadOutlined />} size="small">Attach</Button>
              </Upload>
              <Button type="primary" icon={<SendOutlined />} onClick={handleComment} loading={activityMutation.isPending} style={{ background: '#1a6b3a' }}>
                Post Comment
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* Ticket Info */}
          <Card title="Ticket Details" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Type">{ticket.ticket_type}</Descriptions.Item>
              <Descriptions.Item label="Channel"><Tag>{ticket.channel}</Tag></Descriptions.Item>
              <Descriptions.Item label="Machine">{ticket.machine?.slot_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="Shop">{ticket.shop?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Slot Code">{ticket.slot_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="Group">{ticket.group?.name || 'Unassigned'}</Descriptions.Item>
              <Descriptions.Item label="Assigned To">{ticket.assignee?.name || 'Unassigned'}</Descriptions.Item>
              <Descriptions.Item label="Created">{dayjs(ticket.created_at).format('DD MMM YYYY HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="SLA Deadline">
                {ticket.sla_deadline
                  ? <span style={{ color: dayjs(ticket.sla_deadline).isBefore(dayjs()) ? '#f5222d' : '#52c41a' }}>
                      {dayjs(ticket.sla_deadline).format('DD MMM YYYY HH:mm')}
                    </span>
                  : '—'
                }
              </Descriptions.Item>
              {ticket.resolved_at && (
                <Descriptions.Item label="Resolved">{dayjs(ticket.resolved_at).format('DD MMM YYYY HH:mm')}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Status Change */}
          {availableTransitions.length > 0 && (
            <Card title="Change Status" size="small">
              <Select
                placeholder="Select new status"
                style={{ width: '100%', marginBottom: 12 }}
                value={newStatus || undefined}
                onChange={setNewStatus}
              >
                {availableTransitions.map(s => (
                  <Option key={s} value={s}><Tag color={STATUS_COLORS[s]}>{s.replace('_', ' ')}</Tag></Option>
                ))}
              </Select>
              <TextArea
                rows={2}
                placeholder="Optional note for this status change"
                value={newStatus ? note : ''}
                onChange={e => setNote(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <Button
                type="primary"
                block
                onClick={handleStatusChange}
                loading={statusMutation.isPending}
                disabled={!newStatus}
                style={{ background: '#1a6b3a' }}
              >
                Update Status
              </Button>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
