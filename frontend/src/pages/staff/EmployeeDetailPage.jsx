import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button, Card, Descriptions, Table, Tag, Spin, Typography, Space, Form, App, Popconfirm,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, FileOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { staffAPI } from '../../services/api';
import { STATUS_COLORS, empName, buildEmployeeFormData } from './staffUtils';
import EmployeeFormModal from './components/EmployeeFormModal';
import DocumentPreview from './components/DocumentPreview';

const { Title, Text } = Typography;

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => staffAPI.getEmployee(id).then((r) => r.data.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => staffAPI.departments().then((r) => r.data.data),
  });

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => staffAPI.positions().then((r) => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: (fd) => staffAPI.updateEmployee(id, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      message.success('Employee updated');
      qc.invalidateQueries({ queryKey: ['employee', id] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      setEditOpen(false);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => staffAPI.deleteEmployee(id),
    onSuccess: () => {
      message.success('Employee deleted');
      navigate('/staff/employees');
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const openEdit = () => {
    if (!employee) return;
    form.setFieldsValue({
      full_name: employee.full_name || employee.user?.name,
      email: employee.email || employee.user?.email,
      phone: employee.phone || employee.user?.phone,
      department_id: employee.department_id,
      position_id: employee.position_id,
      hire_date: employee.hire_date,
      basic_salary: employee.basic_salary,
      national_id: employee.national_id,
      bank_account: employee.bank_account,
      status: employee.status,
    });
    setEditOpen(true);
  };

  if (isLoading) return <Spin size="large" className="block mx-auto mt-20" />;
  if (!employee) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/staff/employees')}>Back</Button>
        <p className="mt-4">Employee not found.</p>
      </div>
    );
  }

  const attendanceCols = [
    { title: 'Date', dataIndex: 'date', render: (v) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Check In', dataIndex: 'check_in', render: (v) => v || '—' },
    { title: 'Check Out', dataIndex: 'check_out', render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
    { title: 'Notes', dataIndex: 'notes', ellipsis: true },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/staff/employees')} />
          <Title level={4} className="!m-0">{empName(employee)}</Title>
          <Tag color={STATUS_COLORS[employee.status]}>{employee.status}</Tag>
        </Space>
        <Space>
          {(employee.documents?.length > 0) && (
            <Button icon={<FileOutlined />} onClick={() => setDocsOpen(true)}>Documents ({employee.documents.length})</Button>
          )}
          <Button type="primary" icon={<EditOutlined />} onClick={openEdit} className="bg-[#021559] hover:bg-[#162a75]">Edit</Button>
          <Popconfirm title="Delete this employee?" onConfirm={() => deleteMutation.mutate()}>
            <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending} />
          </Popconfirm>
        </Space>
      </div>

      <Card className="mb-4" size="small">
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Employee ID"><strong>{employee.employee_code}</strong></Descriptions.Item>
          <Descriptions.Item label="Full name">{empName(employee)}</Descriptions.Item>
          <Descriptions.Item label="Phone">{employee.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{employee.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="Department">{employee.department?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Position">{employee.position?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Hire Date">{employee.hire_date ? dayjs(employee.hire_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Basic Salary">TZS {(employee.basic_salary || 0).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="National ID">{employee.national_id || '—'}</Descriptions.Item>
          <Descriptions.Item label="Bank Account">{employee.bank_account || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {(employee.documents?.length === 0) && (
        <Card size="small" className="mb-4"><Text type="secondary">No documents uploaded.</Text></Card>
      )}

      <Card title="Attendance (recent)" size="small">
        <Table dataSource={employee.attendance || []} columns={attendanceCols} rowKey="id" size="small" pagination={{ pageSize: 15 }} />
      </Card>

      <EmployeeFormModal
        open={editOpen}
        editing={employee}
        form={form}
        departments={departments}
        positions={positions}
        loading={updateMutation.isPending}
        onCancel={() => setEditOpen(false)}
        onSubmit={(v) => updateMutation.mutate(buildEmployeeFormData(v))}
      />

      <DocumentPreview
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        documents={employee.documents}
        title={`Documents — ${empName(employee)}`}
      />
    </div>
  );
}
