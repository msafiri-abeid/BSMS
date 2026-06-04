import { useState } from 'react';
import {
  Table, Button, Tag, Row, Col, Card, Statistic, Dropdown, Form, App, List, Typography,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, FileOutlined,
  TeamOutlined, CheckCircleOutlined, MoreOutlined,
} from '@ant-design/icons';

const { Text } = Typography;
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { staffAPI } from '../../services/api';
import { STATUS_COLORS, empName, buildEmployeeFormData } from './staffUtils';
import EmployeeFormModal from './components/EmployeeFormModal';
import DocumentPreview from './components/DocumentPreview';

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
        icon={<MoreOutlined />}
        aria-label="Actions"
        onClick={(e) => e.stopPropagation()}
      />
    </Dropdown>
  );
}

function MobileEmployeeCard({ record, empEmail, empPhone, actionItems, onAction, onOpen }) {
  return (
    <Card
      size="small"
      className="w-full shadow-sm"
      styles={{ body: { padding: 12 } }}
      onClick={() => onOpen(record)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Text strong className="block truncate">{empName(record)}</Text>
          <Text type="secondary" className="text-xs">{record.employee_code}</Text>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tag color={STATUS_COLORS[record.status]} className="!m-0 capitalize">
            {record.status}
          </Tag>
          <ActionMenu record={record} actionItems={actionItems} onAction={onAction} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500 text-xs">Email</dt>
          <dd className="truncate">{empEmail(record)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs">Phone</dt>
          <dd>{empPhone(record)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs">Position</dt>
          <dd className="truncate">{record.position?.name || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs">Department</dt>
          <dd className="truncate">{record.department?.name || '—'}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [docEmployee, setDocEmployee] = useState(null);
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => staffAPI.employees().then((r) => r.data.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => staffAPI.departments().then((r) => r.data.data),
  });

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => staffAPI.positions().then((r) => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, fd }) => (id
      ? staffAPI.updateEmployee(id, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      : staffAPI.createEmployee(fd, { headers: { 'Content-Type': 'multipart/form-data' } })),
    onSuccess: (res, vars) => {
      message.success(vars.id ? 'Employee updated' : `Employee added (${res.data?.data?.employee_code || ''})`);
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
      hire_date: r.hire_date,
      basic_salary: r.basic_salary,
      national_id: r.national_id,
      bank_account: r.bank_account,
      status: r.status,
    });
    setOpen(true);
  };

  const active = (employees || []).filter((e) => e.status === 'active').length;

  const empEmail = (r) => r.email || r.user?.email || '—';
  const empPhone = (r) => r.phone || r.user?.phone || '—';

  const actionItems = (r) => {
    const items = [
      { key: 'view', label: 'View', icon: <EyeOutlined /> },
      { key: 'edit', label: 'Edit', icon: <EditOutlined /> },
    ];
    if (r.documents?.length > 0) {
      items.push({ key: 'documents', label: 'Documents', icon: <FileOutlined /> });
    }
    items.push({ type: 'divider' }, { key: 'delete', label: 'Delete', icon: <DeleteOutlined />, danger: true });
    return items;
  };

  const onAction = (key, r) => {
    if (key === 'view') navigate(`/staff/employees/${r.id}`);
    else if (key === 'edit') openEdit(r);
    else if (key === 'documents') setDocEmployee(r);
    else if (key === 'delete') {
      modal.confirm({
        title: 'Delete this employee?',
        okText: 'Delete',
        okType: 'danger',
        onOk: () => deleteMutation.mutateAsync(r.id),
      });
    }
  };

  const cols = [
    { title: 'Employee ID', dataIndex: 'employee_code', width: 120 },
    { title: 'Name', render: (_, r) => empName(r) },
    { title: 'Email', ellipsis: true, render: (_, r) => empEmail(r) },
    { title: 'Phone', width: 140, render: (_, r) => empPhone(r) },
    { title: 'Position', ellipsis: true, render: (_, r) => r.position?.name || '—' },
    { title: 'Department', ellipsis: true, render: (_, r) => r.department?.name || '—' },
    { title: 'Status', dataIndex: 'status', width: 100, render: (v) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    {
      title: '',
      key: 'actions',
      width: 56,
      fixed: 'right',
      align: 'center',
      render: (_, r) => (
        <ActionMenu record={r} actionItems={actionItems} onAction={onAction} />
      ),
    },
  ];

  const openEmployee = (r) => navigate(`/staff/employees/${r.id}`);

  return (
    <div>
      <Row gutter={16} className="mb-4">
        <Col xs={12} sm={8}>
          <Card size="small"><Statistic title="Total Staff" value={employees?.length || 0} prefix={<TeamOutlined className="text-[#021559]" />} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small"><Statistic title="Active" value={active} prefix={<CheckCircleOutlined className="text-green-600" />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <div className="mb-3 flex justify-stretch md:justify-end">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          className="w-full bg-[#021559] hover:bg-[#162a75] md:w-auto"
        >
          Add Employee
        </Button>
      </div>

      <div className="md:hidden">
        <List
          loading={isLoading}
          dataSource={employees || []}
          rowKey="id"
          className="[&_.ant-list-item]:!px-0 [&_.ant-list-item]:!border-none"
          pagination={{
            pageSize: 20,
            size: 'small',
            hideOnSinglePage: true,
            showTotal: (total) => `${total} employees`,
          }}
          renderItem={(r) => (
            <List.Item>
              <MobileEmployeeCard
                record={r}
                empEmail={empEmail}
                empPhone={empPhone}
                actionItems={actionItems}
                onAction={onAction}
                onOpen={openEmployee}
              />
            </List.Item>
          )}
        />
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table
          dataSource={employees || []}
          columns={cols}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 960 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} employees` }}
          onRow={(r) => ({ onDoubleClick: () => openEmployee(r) })}
        />
      </div>

      <EmployeeFormModal
        open={open}
        editing={editing}
        form={form}
        departments={departments}
        positions={positions}
        loading={saveMutation.isPending}
        onCancel={closeModal}
        onSubmit={(v) => saveMutation.mutate({ id: editing?.id, fd: buildEmployeeFormData(v) })}
      />

      <DocumentPreview
        open={!!docEmployee}
        onClose={() => setDocEmployee(null)}
        documents={docEmployee?.documents}
        title={docEmployee ? `Documents — ${empName(docEmployee)}` : 'Documents'}
      />
    </div>
  );
}
