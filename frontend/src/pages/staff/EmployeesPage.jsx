import { useState, useCallback } from 'react';
import { Table, Button, Tag, Dropdown, Input, Select, Space, Form, App, List, Typography, Modal } from 'antd';
import {
  Plus, FileDown, Eye, Edit3, Trash2, X, Users, CheckCircle, StopCircle, LogIn,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { staffAPI } from '../../services/api';
import { STATUS_COLORS, empName, buildEmployeeFormData } from './staffUtils';
import EmployeeFormModal from './components/EmployeeFormModal';

const { Text } = Typography;
const { Option } = Select;

const KpiCard = ({ title, value, icon: Icon, bgColor, iconColor }) => (
  <div className="rounded-lg border border-slate-100 p-4 bg-white hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
        <div className="text-2xl font-bold text-slate-800 tracking-tight mt-1">{value ?? 0}</div>
      </div>
      <div className={`p-3 rounded-xl ${bgColor} flex items-center justify-center ml-4`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  </div>
);

function ActionMenu({ record, actionItems, onAction }) {
  return (
    <Dropdown
      menu={{
        items: actionItems(record),
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          onAction(key, record);
        },
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text"
        size="small"
        icon={<span className="text-slate-500">...</span>}
        aria-label="Actions"
        onClick={(e) => e.stopPropagation()}
      />
    </Dropdown>
  );
}

function MobileCard({ record, actionItems, onAction, onOpen }) {
  return (
    <div
      className="rounded-lg border border-slate-100 p-3 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onOpen(record)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Text strong className="block truncate">{empName(record)}</Text>
          <Text type="secondary" className="text-xs">{record.employee_code}</Text>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tag color={STATUS_COLORS[record.status]} className="!m-0 capitalize">{record.status}</Tag>
          <ActionMenu record={record} actionItems={actionItems} onAction={onAction} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-slate-500 text-xs">Phone</dt>
          <dd>{record.phone || record.user?.phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs">Role</dt>
          <dd>{record.user?.role?.name || '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkStatus, setBulkStatus] = useState(false);
  const [form] = Form.useForm();

  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const department_id = searchParams.get('department_id') || '';
  const has_user = searchParams.get('has_user') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const sort_by = searchParams.get('sort_by') || '';
  const sort_order = searchParams.get('sort_order') || '';

  const queryParams = { page, limit };
  if (search) queryParams.search = search;
  if (status) queryParams.status = status;
  if (department_id) queryParams.department_id = department_id;
  if (has_user) queryParams.has_user = has_user;
  if (sort_by) queryParams.sort_by = sort_by;
  if (sort_order) queryParams.sort_order = sort_order;

  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.set('page', '1');
      return next;
    });
  }, [setSearchParams]);

  const { data: employeesRes, isLoading } = useQuery({
    queryKey: ['employees', queryParams],
    queryFn: () => staffAPI.employees(queryParams).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const employees = employeesRes?.data || [];
  const total = employeesRes?.total || 0;

  const { data: allEmployees } = useQuery({
    queryKey: ['employees', { limit: 200 }],
    queryFn: () => staffAPI.employees({ limit: 200 }).then((r) => r.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => staffAPI.departments().then((r) => r.data.data),
  });

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => staffAPI.positions().then((r) => r.data.data),
  });

  const { data: roles } = useQuery({
    queryKey: ['staff-roles'],
    queryFn: () => staffAPI.roles().then((r) => r.data.data),
  });

  const active = (employees || []).filter((e) => e.status === 'active').length;
  const todayLogins = employeesRes?.todayLogins || 0;

  const saveMutation = useMutation({
    mutationFn: ({ id, fd }) => (id
      ? staffAPI.updateEmployee(id, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      : staffAPI.createEmployee(fd, { headers: { 'Content-Type': 'multipart/form-data' } })),
    onSuccess: async (res, vars) => {
      const employee = res.data?.data;
      message.success(vars.id ? 'Employee updated' : `Employee added (${employee?.employee_code || ''})`);
      qc.invalidateQueries({ queryKey: ['employees'] });
      closeModal();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => staffAPI.deleteEmployee(id),
    onSuccess: () => { message.success('Employee removed'); qc.invalidateQueries({ queryKey: ['employees'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const closeModal = () => { setOpen(false); setEditing(null); form.resetFields(); };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active', basic_salary: 0 });
    setOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      full_name: r.full_name || r.user?.name,
      email: r.email || r.user?.email,
      phone: r.phone || r.user?.phone,
      department_id: r.department_id,
      position_id: r.position_id,
      reports_to: r.reports_to,
      hire_date: r.hire_date,
      basic_salary: r.basic_salary,
      national_id: r.national_id,
      bank_account: r.bank_account,
      status: r.status,
      user_role_id: r.user?.role_id,
      user_is_active: r.user?.is_active !== false,
    });
    setOpen(true);
  };

  const actionItems = (r) => {
    const items = [
      { key: 'view', label: 'View', icon: <Eye className="w-4 h-4" /> },
      { key: 'edit', label: 'Edit', icon: <Edit3 className="w-4 h-4" /> },
    ];
    items.push({ type: 'divider' }, { key: 'delete', label: 'Delete', icon: <Trash2 className="w-4 h-4" />, danger: true });
    return items;
  };

  const onAction = (key, r) => {
    if (key === 'view') navigate(`/staff/employees/${r.id}`);
    else if (key === 'edit') openEdit(r);
    else if (key === 'delete') {
      modal.confirm({
        title: 'Delete this employee?',
        content: `Remove ${empName(r)}? Their user account (if any) will remain.`,
        okText: 'Delete',
        okType: 'danger',
        onOk: () => deleteMutation.mutateAsync(r.id),
      });
    }
  };

  const handleExport = async () => {
    try {
      const res = await staffAPI.exportEmployees();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('Employees exported');
    } catch (e) {
      message.error(e.response?.data?.message || 'Export failed');
    }
  };

  const handleExportSelected = () => {
    if (selectedRowKeys.length === 0) return;
    const selected = employees.filter((r) => selectedRowKeys.includes(r.id));
    const csv = [
      ['Employee ID', 'Name', 'Email', 'Phone', 'Status', 'Role'].join(','),
      ...selected.map((r) =>
        [r.employee_code, empName(r), r.email || r.user?.email || '', r.phone || r.user?.phone || '', r.status, r.user?.role?.name || ''].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-selected-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`${selected.length} employees exported`);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) return;
    modal.confirm({
      title: `Delete ${selectedRowKeys.length} employees?`,
      content: `Remove ${selectedRowKeys.length} selected employees? Their user accounts (if any) will remain.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        for (const id of selectedRowKeys) {
          try { await deleteMutation.mutateAsync(id); } catch { /* skip */ }
        }
        setSelectedRowKeys([]);
        message.success('Selected employees removed');
      },
    });
  };

  const handleBulkStatus = async (newStatus) => {
    if (selectedRowKeys.length === 0) return;
    for (const id of selectedRowKeys) {
      try {
        const fd = new FormData();
        fd.append('status', newStatus);
        await staffAPI.updateEmployee(id, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } catch { /* skip */ }
    }
    qc.invalidateQueries({ queryKey: ['employees'] });
    setSelectedRowKeys([]);
    setBulkStatus(false);
    message.success(`Status updated for ${selectedRowKeys.length} employees`);
  };

  const handleTableChange = useCallback((_pagination, _filters, sorter) => {
    if (sorter.order) {
      setParam('sort_by', sorter.field);
      setParam('sort_order', sorter.order === 'ascend' ? 'asc' : 'desc');
    } else {
      setParam('sort_by', '');
      setParam('sort_order', '');
    }
  }, [setParam]);

  const cols = [
    { title: 'ID', dataIndex: 'employee_code', width: 85, sorter: true, sortOrder: sort_by === 'employee_code' ? (sort_order === 'asc' ? 'ascend' : 'descend') : null },
    {
      title: 'Name', width: 150,
      ellipsis: true,
      render: (_, r) => (
        <a onClick={() => navigate(`/staff/employees/${r.id}`)} className="!text-brand-dark hover:underline font-medium">
          {empName(r)}
        </a>
      ),
    },
    {
      title: 'Email', width: 140, responsive: ['lg'],
      render: (_, r) => r.email || r.user?.email || <span className="text-slate-300">—</span>,
      ellipsis: true,
    },
    { title: 'Phone', width: 110, render: (_, r) => r.phone || r.user?.phone || '—' },
    {
      title: 'Status', width: 70, render: (_, r) => (
        <Tag color={STATUS_COLORS[r.status]} className="capitalize !text-[10px] !px-2">{r.status}</Tag>
      ),
    },
    {
      title: 'Role', width: 80, responsive: ['md'], render: (_, r) => {
        if (!r.user) return <Text type="secondary" className="text-xs">—</Text>;
        return <Tag color="blue" className="!text-[10px] !px-2">{r.user.role?.name || 'User'}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 55,
      align: 'center',
      render: (_, r) => (
        <ActionMenu record={r} actionItems={actionItems} onAction={onAction} />
      ),
    },
  ];

  const openEmployee = (r) => navigate(`/staff/employees/${r.id}`);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Employees</h4>
          <span className="text-xs text-slate-500">{total} total</span>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={openCreate}
          className="!bg-brand-dark hover:!bg-brand-light hover:!text-white border-none shadow-sm flex items-center gap-1.5 text-white"
        >
          Add Employee
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Staff" value={total} icon={Users} bgColor="bg-slate-50" iconColor="text-slate-600" />
        <KpiCard title="Active" value={active} icon={CheckCircle} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard title="Today's Login" value={todayLogins} icon={LogIn} bgColor="bg-cyan-50" iconColor="text-cyan-600" />
        <KpiCard title="Terminated" value={employees.filter((e) => e.status === 'terminated').length} icon={StopCircle} bgColor="bg-red-50" iconColor="text-red-600" />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Input.Search
            placeholder="Search name, code, email, phone..."
            allowClear
            defaultValue={search}
            onSearch={(v) => setParam('search', v)}
            className="w-full sm:w-60 [&_.ant-input-search-button]:transition-colors [&_.ant-input-search-button]:hover:!bg-brand-dark [&_.ant-input-search-button]:hover:!text-white [&_.ant-input-search-button]:hover:!border-brand-dark"
          />
          <Select
            placeholder="Status"
            allowClear
            value={status || undefined}
            onChange={(v) => setParam('status', v || '')}
            className="w-full sm:w-28"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'terminated', label: 'Terminated' },
            ]}
          />
          <Select
            placeholder="Department"
            allowClear
            value={department_id || undefined}
            onChange={(v) => setParam('department_id', v || '')}
            className="w-full sm:w-44"
            options={(departments || []).map((d) => ({ value: d.id, label: d.name }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            placeholder="Account"
            allowClear
            value={has_user || undefined}
            onChange={(v) => setParam('has_user', v || '')}
            className="w-full sm:w-36"
            options={[
              { value: 'true', label: 'Has account' },
              { value: 'false', label: 'No account' },
            ]}
          />
          {(search || status || department_id || has_user) && (
            <Button
              size="small"
              icon={<X className="w-3 h-3" />}
              onClick={() => setSearchParams({})}
              className="flex items-center gap-1 !text-xs hover:!border-brand-dark hover:!text-brand-dark"
            >
              Clear
            </Button>
          )}
          <Button
            icon={<FileDown className="w-4 h-4 group-hover:!text-white transition-colors" />}
            onClick={handleExport}
            className="group flex items-center gap-1.5 hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark"
          >
            Export
          </Button>
        </Space>
      </div>

      {/* Bulk action bar */}
      {selectedRowKeys.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
          <span className="text-sm font-medium text-brand-dark">{selectedRowKeys.length} selected</span>
          <Space>
            <Button size="small" icon={<FileDown className="w-3.5 h-3.5 group-hover:!text-white transition-colors" />} onClick={handleExportSelected}
              className="group flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
              Export Selected
            </Button>
            <Button size="small" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleBulkDelete}
              className="flex items-center gap-1 !text-xs !text-red-600 !border-red-300 hover:!bg-red-50 hover:!border-red-400">
              Delete Selected
            </Button>
            <Button size="small" icon={<CheckCircle className="w-3.5 h-3.5" />} onClick={() => setBulkStatus(true)}
              className="flex items-center gap-1 !text-xs hover:!border-brand-dark hover:!text-brand-dark">
              Change Status
            </Button>
            <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setSelectedRowKeys([])}
              className="flex items-center gap-1 !text-xs">
              Deselect
            </Button>
          </Space>
        </div>
      )}

      {/* Mobile List */}
      <div className="md:hidden">
        <List
          loading={isLoading}
          dataSource={employees}
          rowKey="id"
          className="[&_.ant-list-item]:!px-0 [&_.ant-list-item]:!border-none"
          pagination={{
            current: page,
            pageSize: limit,
            total,
            size: 'small',
            hideOnSinglePage: true,
            showTotal: (t) => `${t} employees`,
            onChange: (p, s) => {
              setParam('page', String(p));
              if (s !== limit) setParam('limit', String(s));
            },
          }}
          renderItem={(r) => (
            <List.Item>
              <MobileCard record={r} actionItems={actionItems} onAction={onAction} onOpen={openEmployee} />
            </List.Item>
          )}
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden overflow-x-auto md:block">
        <Table
          dataSource={employees}
          columns={cols}
          rowKey="id"
          loading={isLoading}
          size="middle"
          tableLayout="fixed"
          onChange={handleTableChange}
          rowClassName={() => "hover:bg-brand-dark/[0.03] cursor-pointer transition-colors"}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} employees`,
            onChange: (p, s) => {
              setParam('page', String(p));
              if (s !== limit) setParam('limit', String(s));
            },
          }}
          onRow={(r) => ({ onDoubleClick: () => openEmployee(r) })}
        />
      </div>

      {/* Bulk Status Modal */}
      <Modal
        title="Change Status"
        open={bulkStatus}
        onCancel={() => setBulkStatus(false)}
        onOk={() => form.submit()}
        okText="Apply"
        width={400}
        className="top-8"
      >
        <Form form={form} layout="vertical" onFinish={(v) => handleBulkStatus(v.bulk_status)} className="mt-4">
          <Form.Item name="bulk_status" label={`New status for ${selectedRowKeys.length} employees`} rules={[{ required: true }]}>
            <Select placeholder="Select status">
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
              <Option value="terminated">Terminated</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <EmployeeFormModal
        open={open}
        editing={editing}
        form={form}
        departments={departments}
        positions={positions}
        roles={roles}
        employeeList={allEmployees?.data || []}
        loading={saveMutation.isPending}
        onCancel={closeModal}
        onSubmit={(v) => saveMutation.mutate({ id: editing?.id, fd: buildEmployeeFormData(v) })}
      />

    </div>
  );
}
