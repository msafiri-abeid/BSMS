import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag, Space, App, List, Empty } from 'antd';
import { Plus, CheckCircle, DollarSign, FileDown, X, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

const PAYMENT_STATUS_COLORS = { pending: 'orange', paid: 'green' };
const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function PayrollPage() {
  const [open, setOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const params = {};
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({ queryKey: ['payroll', params], queryFn: () => financeAPI.listPayroll(params).then(r => r.data.data) });

  const rows = data?.rows || [];
  const totals = { total: 0, paid: 0, pending: 0, count: 0 };
  rows.forEach(r => {
    const net = (r.basic_salary || 0) - (r.deductions || 0) + (r.bonus || 0);
    totals.total += net;
    totals.count++;
    if (r.payment_status === 'paid') totals.paid += net;
    if (r.payment_status === 'pending') totals.pending += net;
  });

  const createMutation = useMutation({
    mutationFn: (d) => financeAPI.createPayroll(d),
    onSuccess: () => { message.success('Payroll entry created'); qc.invalidateQueries({ queryKey: ['payroll'] }); setOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const payMutation = useMutation({
    mutationFn: (id) => financeAPI.payPayroll(id),
    onSuccess: () => { message.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['payroll'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Employee', 'Basic Salary', 'Bonus', 'Deductions', 'Net', 'Period', 'Status'].join(','),
      ...selected.map(r =>
        [r.employee?.name, r.basic_salary, r.bonus || 0, r.deductions || 0,
          (r.basic_salary - (r.deductions || 0) + (r.bonus || 0)),
          r.period, r.payment_status].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `payroll-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const cols = [
    { title: 'Employee', dataIndex: ['employee', 'name'], width: 160 },
    { title: 'Period', dataIndex: 'period', width: 100 },
    { title: 'Basic', dataIndex: 'basic_salary', render: v => fmt(v), width: 110 },
    { title: 'Bonus', dataIndex: 'bonus', render: v => fmt(v || 0), width: 100, responsive: ['md'] },
    { title: 'Deductions', dataIndex: 'deductions', render: v => fmt(v || 0), width: 110, responsive: ['md'] },
    { title: 'Net', key: 'net', render: (_, r) => fmt((r.basic_salary || 0) - (r.deductions || 0) + (r.bonus || 0)), width: 110 },
    { title: 'Status', dataIndex: 'payment_status', render: v => <Tag color={PAYMENT_STATUS_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    {
      title: 'Actions', width: 100,
      render: (_, r) => r.payment_status === 'pending' ? (
        <Button size="small" icon={<DollarSign className="w-3.5 h-3.5" />}
          onClick={() => payMutation.mutate(r.id)}
          className="flex items-center gap-1 !text-xs !bg-green-600 hover:!bg-green-700 border-none text-white">
          Pay
        </Button>
      ) : <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Paid</span>,
    },
  ];

  const mobileFields = [
    { key: 'employee', dataIndex: ['employee', 'name'] },
    { key: 'period', label: 'Period', dataIndex: 'period' },
    { key: 'net', label: 'Net', render: (_, r) => fmt((r.basic_salary || 0) - (r.deductions || 0) + (r.bonus || 0)) },
  ];

  const hasFilters = search || statusFilter;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Payroll</h4>
          <span className="text-xs text-slate-500">{data?.count || 0} entries</span>
        </div>
        <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}
          className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
          Add Entry
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Payroll" value={totals.total} icon={DollarSign} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
        <KpiCard title="Paid" value={totals.paid} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
        <KpiCard title="Pending" value={totals.pending} icon={FileDown} bgColor="bg-amber-50" iconColor="text-amber-600" formatter={fmt} />
        <KpiCard title="Employees" value={totals.count} icon={Search} bgColor="bg-purple-50" iconColor="text-purple-600" formatter={false} />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Input.Search size="small" placeholder="Search employee..." allowClear
            defaultValue={search}
            onSearch={(v) => setSearch(v || '')}
            className="w-full sm:w-56" />
          <Select size="small" allowClear placeholder="Status"
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            className="w-32">
            <Option value="pending">Pending</Option>
            <Option value="paid">Paid</Option>
          </Select>
          {hasFilters && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => { setSearch(''); setStatusFilter(''); }}
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
        <Table dataSource={rows} columns={cols} rowKey="id" loading={isLoading}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: data?.count, pageSize: 20 }} />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <Empty description="No payroll entries found" />
        ) : (
          <List
            dataSource={rows}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={mobileFields}
                onClick={() => {}}
                statusColor={PAYMENT_STATUS_COLORS[r.payment_status]}
              />
            )}
          />
        )}
      </div>

      {/* Add Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Add Payroll Entry</span>}
        open={open} onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending}
        className="top-8">
        <Form form={form} layout="vertical" onFinish={createMutation.mutate} className="mt-4">
          <Form.Item name="employee_id" label={<span className="text-xs font-semibold text-slate-600">Employee</span>} rules={[{ required: true }]}>
            <Select showSearch placeholder="Select employee" filterOption={(i, o) => o.children.toLowerCase().includes(i.toLowerCase())}>
              {rows.map(r => r.employee?.id && (
                <Option key={r.employee.id} value={r.employee.id}>{r.employee.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="period" label={<span className="text-xs font-semibold text-slate-600">Period</span>} rules={[{ required: true }]}>
            <Input placeholder="e.g. June 2026" />
          </Form.Item>
          <Form.Item name="basic_salary" label={<span className="text-xs font-semibold text-slate-600">Basic Salary (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={0} className="w-full" formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
          <Form.Item name="bonus" label={<span className="text-xs font-semibold text-slate-600">Bonus (TZS)</span>}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="deductions" label={<span className="text-xs font-semibold text-slate-600">Deductions (TZS)</span>}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
