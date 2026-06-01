// src/pages/staff/StaffPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Tag, Tabs, App, Typography, Row, Col, Card, Statistic } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAPI } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

export default function StaffPage() {
  const [empOpen, setEmpOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: employees, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => staffAPI.employees().then(r => r.data.data) });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => staffAPI.departments().then(r => r.data.data) });
  const { data: positions } = useQuery({ queryKey: ['positions'], queryFn: () => staffAPI.positions().then(r => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (d) => staffAPI.createEmployee(d),
    onSuccess: () => { message.success('Employee added'); qc.invalidateQueries({ queryKey: ['employees'] }); setEmpOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const active = (employees || []).filter(e => e.status === 'active').length;

  const empCols = [
    { title: 'Code', dataIndex: 'employee_code', width: 100 },
    { title: 'Name', dataIndex: ['user', 'name'] },
    { title: 'Email', dataIndex: ['user', 'email'] },
    { title: 'Department', dataIndex: ['department', 'name'] },
    { title: 'Position', dataIndex: ['position', 'name'] },
    { title: 'Hire Date', dataIndex: 'hire_date' },
    { title: 'Basic Salary', dataIndex: 'basic_salary', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag> },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Staff & HR</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEmpOpen(true)} style={{ background: '#1a6b3a' }}>
          Add Employee
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}><Card size="small"><Statistic title="Total Staff" value={employees?.length || 0} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={active} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Departments" value={departments?.length || 0} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Positions" value={positions?.length || 0} /></Card></Col>
      </Row>

      <Tabs items={[
        {
          key: 'employees',
          label: 'Employees',
          children: (
            <Table
              dataSource={employees || []}
              columns={empCols}
              rowKey="id"
              loading={isLoading}
              size="middle"
              pagination={{ pageSize: 20 }}
            />
          ),
        },
        {
          key: 'departments',
          label: 'Departments',
          children: (
            <Table
              dataSource={departments || []}
              columns={[
                { title: 'Name', dataIndex: 'name' },
                { title: 'Created', dataIndex: 'created_at' },
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          ),
        },
        {
          key: 'positions',
          label: 'Positions',
          children: (
            <Table
              dataSource={positions || []}
              columns={[
                { title: 'Position', dataIndex: 'name' },
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          ),
        },
      ]} />

      <Modal title="Add Employee" open={empOpen} onCancel={() => { setEmpOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} width={560}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="user_id" label="Linked User ID (from Users)">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="employee_code" label="Employee Code" rules={[{ required: true }]}>
            <Input placeholder="EMP-001" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="department_id" label="Department">
                <Select allowClear>
                  {(departments || []).map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="position_id" label="Position">
                <Select allowClear>
                  {(positions || []).map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="hire_date" label="Hire Date"><Input type="date" /></Form.Item>
          <Form.Item name="basic_salary" label="Basic Salary (TZS)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="national_id" label="National ID"><Input /></Form.Item>
          <Form.Item name="bank_account" label="Bank Account"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
