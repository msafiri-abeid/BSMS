import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Tag, Select, Space, Timeline, Input, Upload, App, Typography, Descriptions, Spin, Row, Col, Divider } from 'antd';
import { ArrowLeft, Send, Upload as UploadIcon, Clock, Paperclip } from 'lucide-react';
import { ticketsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;
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

  if (isLoading) return <Spin size="large" className="block mx-auto my-20" />;
  if (!ticket) return <div>Ticket not found</div>;

  const availableTransitions = TRANSITIONS[ticket.status] || [];

  const timelineItems = (ticket.activities || []).map(a => ({
    dot: <Clock className="w-3.5 h-3.5" />,
    color: a.to_status ? STATUS_COLORS[a.to_status] || 'gray' : 'gray',
    children: (
      <div className="pb-2">
        <div className="flex justify-between mb-1">
          <Text strong className="text-xs">{a.action?.replace('_', ' ')}</Text>
          <Text type="secondary" className="text-[11px]">{dayjs(a.created_at).format('DD MMM YYYY HH:mm')}</Text>
        </div>
        {a.from_status && a.to_status && (
          <div className="mb-1">
            <Tag>{a.from_status}</Tag> → <Tag color={STATUS_COLORS[a.to_status]}>{a.to_status}</Tag>
          </div>
        )}
        {a.note && <Text className="text-xs block text-slate-600">{a.note}</Text>}
        {a.attachments?.length > 0 && (
          <div className="mt-1">
            {a.attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="mr-2 text-xs text-brand-dark inline-flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> Attachment {i + 1}
              </a>
            ))}
          </div>
        )}
        <Text type="secondary" className="text-[11px]">by {a.performed_by}</Text>
      </div>
    ),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <Space>
          <Button icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/tickets')} />
          <h4 className="text-base font-bold text-slate-800 m-0">Ticket #{ticket.ticket_number}</h4>
        </Space>
        <Space>
          <Tag color={PRIORITY_COLORS[ticket.priority]} className="!text-xs !px-2.5 !py-0.5">{ticket.priority?.toUpperCase()}</Tag>
          <Tag color={STATUS_COLORS[ticket.status]} className="!text-xs !px-2.5 !py-0.5">{ticket.status?.replace('_', ' ').toUpperCase()}</Tag>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title={ticket.subject} size="small" className="mb-4">
            <Text className="text-sm leading-relaxed">{ticket.description || 'No description provided.'}</Text>
          </Card>

          <Card title="Activity History" size="small" className="mb-4">
            {timelineItems.length > 0
              ? <Timeline items={timelineItems} className="pt-4" />
              : <Text type="secondary">No activity yet</Text>
            }
          </Card>

          <Card title="Add Comment / Update" size="small">
            <TextArea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note, comment, or update..."
              className="mb-3"
            />
            <div className="flex justify-between items-center">
              <Upload beforeUpload={() => false} fileList={files} onChange={({ fileList }) => setFiles(fileList)} multiple>
                <Button icon={<UploadIcon className="w-3.5 h-3.5" />} size="small" className="flex items-center gap-1">Attach</Button>
              </Upload>
              <Button type="primary" icon={<Send className="w-3.5 h-3.5" />} onClick={handleComment} loading={activityMutation.isPending}
                className="!bg-brand-dark hover:!bg-brand-light border-none flex items-center gap-1.5">
                Post Comment
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Ticket Details" size="small" className="mb-4">
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
                  ? <span className={dayjs(ticket.sla_deadline).isBefore(dayjs()) ? 'text-red-600' : 'text-green-600'}>
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

          {availableTransitions.length > 0 && (
            <Card title="Change Status" size="small">
              <Select
                placeholder="Select new status"
                className="w-full mb-3"
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
                className="mb-3"
              />
              <Button
                type="primary"
                block
                onClick={handleStatusChange}
                loading={statusMutation.isPending}
                disabled={!newStatus}
                className="!bg-brand-dark hover:!bg-brand-light border-none"
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
