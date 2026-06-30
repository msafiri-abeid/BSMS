import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, Upload, DatePicker, App, Typography, notification, List, Empty } from 'antd';
import { Plus, Ticket, AlertTriangle, CheckCircle, SlidersHorizontal, Search, X, Eye, Edit3, Trash2, FileDown, Clock, Download } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ticketsAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import ActionMenu from '../../components/ActionMenu';
import MobileCard from '../../components/MobileCard';
import socket, { connectSocket } from '../../socket';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Option } = Select;
const { RangePicker } = DatePicker;

const PRIORITY_COLORS = { urgent: 'red', high: 'orange', medium: 'blue', low: 'default' };
const STATUS_COLORS = { open: 'blue', pending: 'orange', in_progress: 'processing', resolved: 'green', closed: 'default', reopened: 'volcano' };

export default function TicketsPage() {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState({ limit: 50, offset: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
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

  useEffect(() => {
    connectSocket();
    socket.emit('join:tickets');

    socket.on('ticket:update', (payload) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket-counts'] });
      if (payload.type === 'new') {
        const t = payload.ticket;
        notification.open({
          message: 'New Ticket',
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
      message.success('Ticket created successfully');
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setOpen(false);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error occurred'),
  });

  const onCreateFinish = (values) => {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => { if (k !== 'attachments' && v !== undefined) fd.append(k, v); });
    if (values.attachments?.fileList) {
      values.attachments.fileList.forEach(f => { if (f.originFileObj) fd.append('attachments', f.originFileObj); });
    }
    createMutation.mutate(fd);
  };

  const rows = data?.rows || [];
  const displayCounts = liveCounts || counts || {};

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['#', 'Subject', 'Priority', 'Status', 'Machine', 'Shop', 'Created'].join(','),
      ...selected.map(r =>
        [r.ticket_number, r.subject, r.priority, r.status,
         r.machine?.slot_code || '', r.shop?.name || '',
         dayjs(r.created_at).format('DD MMM YYYY')].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `tickets-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const handleAction = (key, r) => {
    if (key === 'view') navigate(`/tickets/${r.id}`);
    if (key === 'edit') navigate(`/tickets/${r.id}`);
    if (key === 'delete') {
      Modal.confirm({
        title: 'Delete Ticket',
        content: `Delete ticket ${r.ticket_number}?`,
        okText: 'Delete', okType: 'danger',
        onOk: () => ticketsAPI.remove(r.id).then(() => {
          message.success('Ticket deleted');
          qc.invalidateQueries({ queryKey: ['tickets'] });
        }).catch(e => message.error(e.response?.data?.message || 'Delete failed')),
      });
    }
  };

  const actionItems = (r) => [
    { key: 'view', icon: <Eye className="w-4 h-4" />, label: 'View' },
    { key: 'edit', icon: <Edit3 className="w-4 h-4" />, label: 'Edit' },
    { type: 'divider' },
    { key: 'delete', icon: <Trash2 className="w-4 h-4" />, label: 'Delete', danger: true },
  ];

  const cols = [
    { title: '#', dataIndex: 'ticket_number', render: v => <span className="font-bold text-slate-700">{v}</span>, width: 100 },
    {
      title: 'Subject', dataIndex: 'subject', ellipsis: true,
      render: (v, r) => <a className="font-semibold text-brand-dark hover:underline" onClick={() => navigate(`/tickets/${r.id}`)}>{v}</a>,
      width: 200,
    },
    {
      title: 'Priority', dataIndex: 'priority',
      render: v => <Tag className="!text-[10px] uppercase" color={PRIORITY_COLORS[v]}>{v}</Tag>,
      width: 80, responsive: ['md'],
    },
    {
      title: 'Status', dataIndex: 'status',
      render: v => <Tag className="!text-[10px] uppercase" color={STATUS_COLORS[v]}>{v?.replace('_', ' ')}</Tag>,
      width: 100,
    },
    { title: 'Machine', dataIndex: ['machine', 'slot_code'], width: 100, responsive: ['lg'] },
    { title: 'Shop', dataIndex: ['shop', 'name'], width: 120, responsive: ['lg'] },
    {
      title: 'SLA', dataIndex: 'sla_deadline', width: 120, responsive: ['md'],
      render: (v, r) => {
        if (!v || ['resolved', 'closed'].includes(r.status)) return <span className="text-slate-400">—</span>;
        const overdue = dayjs(v).isBefore(dayjs());
        return (
          <Tag className="!text-[10px]" color={overdue ? 'red' : 'green'}>
            {overdue ? 'BREACHED' : dayjs(v).fromNow()}
          </Tag>
        );
      },
    },
    {
      title: 'Created', dataIndex: 'created_at',
      render: v => <span className="text-slate-500 text-xs">{dayjs(v).format('DD MMM HH:mm')}</span>,
      width: 110,
    },
    {
      title: 'Actions', key: 'actions', width: 55, align: 'center',
      render: (_, r) => <ActionMenu record={r} actionItems={actionItems} onAction={handleAction} />,
    },
  ];

  const mobileFields = [
    { key: 'ticket', dataIndex: 'ticket_number' },
    { key: 'subject', label: 'Subject', dataIndex: 'subject' },
    { key: 'priority', label: 'Priority', render: (_, r) => r.priority },
  ];

  const hasFilters = filters.status || filters.priority || filters.group_id || filters.ticket_number || filters.slot_code || filters.date_from;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Ticket Management</h4>
          <span className="text-xs text-slate-500">{displayCounts.total || 0} total</span>
        </div>
        <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}
          className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
          New Ticket
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Open" value={displayCounts.open || 0} icon={Ticket} bgColor="bg-slate-50" iconColor="text-slate-600" />
        <KpiCard title="In Progress" value={displayCounts.in_progress || 0} icon={Clock} bgColor="bg-amber-50" iconColor="text-amber-600" />
        <KpiCard title="Resolved" value={displayCounts.resolved || 0} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard title="Urgent" value={displayCounts.urgent || 0} icon={AlertTriangle} bgColor="bg-red-50" iconColor="text-red-600" />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Input.Search size="small" placeholder="Search Ticket #" allowClear
            className="w-40"
            onChange={e => setFilters(f => ({ ...f, ticket_number: e.target.value || undefined }))} />
          <Input.Search size="small" placeholder="Search Slot Code" allowClear
            className="w-36"
            onChange={e => setFilters(f => ({ ...f, slot_code: e.target.value || undefined }))} />
          <Select size="small" allowClear placeholder="Status"
            className="w-36"
            onChange={v => setFilters(f => ({ ...f, status: v }))}
            value={filters.status}>
            {['open', 'pending', 'in_progress', 'resolved', 'closed', 'reopened'].map(s => (
              <Option key={s} value={s}><span className="capitalize">{s.replace('_', ' ')}</span></Option>
            ))}
          </Select>
          <Select size="small" allowClear placeholder="Priority"
            className="w-28"
            onChange={v => setFilters(f => ({ ...f, priority: v }))}>
            {['urgent', 'high', 'medium', 'low'].map(p => (
              <Option key={p} value={p}><span className="capitalize">{p}</span></Option>
            ))}
          </Select>
          <Select size="small" allowClear placeholder="Group"
            className="w-40"
            onChange={v => setFilters(f => ({ ...f, group_id: v }))}>
            {(groups || []).map(g => (
              <Option key={g.id} value={g.id}>{g.name}</Option>
            ))}
          </Select>
          <RangePicker size="small" className="w-52"
            onChange={(d) => setFilters(f => ({ ...f, date_from: d?.[0]?.toISOString(), date_to: d?.[1]?.toISOString() }))} />
          {hasFilters && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => setFilters({ limit: 50, offset: 0 })}
              className="flex items-center gap-1 !text-xs hover:!border-brand-dark hover:!text-brand-dark">
              Clear
            </Button>
          )}
        </Space>
      </div>

      {/* Bulk Action Bar */}
      {selectedRowKeys.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
          <span className="text-sm font-medium text-brand-dark">{selectedRowKeys.length} selected</span>
          <Space>
            <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} onClick={handleExportSelected}
              className="group flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
              Export Selected
            </Button>
            <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setSelectedRowKeys([])}
              className="flex items-center gap-1 !text-xs">
              Deselect
            </Button>
          </Space>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table
          dataSource={rows}
          columns={cols}
          rowKey="id"
          loading={isLoading}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          rowClassName={(r) => {
            if (r.priority === 'urgent') return 'bg-rose-50/40';
            if (r.sla_deadline && dayjs(r.sla_deadline).isBefore(dayjs()) && !['resolved', 'closed'].includes(r.status)) return 'bg-amber-50/40';
            return '';
          }}
          pagination={{
            total: data?.count,
            pageSize: 50,
            showSizeChanger: false,
            onChange: (p) => setFilters(f => ({ ...f, offset: (p - 1) * 50 })),
          }}
        />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <Empty description="No tickets found" />
        ) : (
          <List
            dataSource={rows}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={mobileFields}
                onClick={() => navigate(`/tickets/${r.id}`)}
                statusColor={STATUS_COLORS[r.status]}
              />
            )}
          />
        )}
      </div>

      {/* Create Modal */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Create New Ticket</span>}
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        width={620}
        className="top-8"
      >
        <Form form={form} layout="vertical" onFinish={onCreateFinish} className="mt-4">
          <Form.Item name="subject" label={<span className="text-xs font-semibold text-slate-600">Subject / Issue</span>} rules={[{ required: true, message: 'Please enter a ticket subject' }]}>
            <Input placeholder="Briefly summarize the issue" />
          </Form.Item>
          <Form.Item name="description" label={<span className="text-xs font-semibold text-slate-600">Detailed Description</span>}>
            <Input.TextArea rows={4} placeholder="Describe the issue..." />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="ticket_type" label={<span className="text-xs font-semibold text-slate-600">Incident Category</span>} rules={[{ required: true, message: 'Category is required' }]}>
              <Select placeholder="Choose Type">
                {['technical', 'financial', 'operational', 'complaint', 'other'].map(t => <Option key={t} value={t}><span className="capitalize">{t}</span></Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label={<span className="text-xs font-semibold text-slate-600">Severity</span>} initialValue="medium" rules={[{ required: true }]}>
              <Select>
                {['urgent', 'high', 'medium', 'low'].map(p => (
                  <Option key={p} value={p}>
                    <Tag className="!text-[10px] uppercase" color={PRIORITY_COLORS[p]}>{p}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="slot_code" label={<span className="text-xs font-semibold text-slate-600">Machine Slot Code</span>}>
              <Input placeholder="e.g. TZ-SLOT-089" />
            </Form.Item>
            <Form.Item name="assigned_group_id" label={<span className="text-xs font-semibold text-slate-600">Assign to Group</span>}>
              <Select allowClear placeholder="Select group">
                {(groups || []).map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="attachments" label={<span className="text-xs font-semibold text-slate-600">Attachments (Images/PDFs)</span>}>
            <Upload beforeUpload={() => false} multiple accept="image/*,.pdf" listType="text">
              <Button icon={<Download className="w-4 h-4" />} className="flex items-center gap-1.5">Click or Drop Files</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
