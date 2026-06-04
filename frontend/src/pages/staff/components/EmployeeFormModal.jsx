import { Form, Input, Select, InputNumber, Upload, Button, Modal } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { buildDeptTreeSelect } from '../staffUtils';

const { Option } = Select;

export default function EmployeeFormModal({
  open,
  editing,
  form,
  departments,
  positions,
  loading,
  onCancel,
  onSubmit,
}) {
  const deptId = Form.useWatch('department_id', form);

  const filteredPositions = (deptId
    ? (positions || []).filter((p) => !p.department_id || p.department_id === deptId)
    : positions) || [];

  return (
    <Modal
      title={editing ? 'Edit Employee' : 'Add Employee'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        {editing && (
          <Form.Item label="Employee ID">
            <Input value={editing.employee_code} disabled />
          </Form.Item>
        )}
        <Form.Item name="full_name" label="Full name" rules={[{ required: true, message: 'Enter full name' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Phone is required for SMS' }]}>
          <Input placeholder="+255..." />
        </Form.Item>
        <Form.Item name="email" label="Email"><Input type="email" /></Form.Item>
        <Form.Item name="department_id" label="Department">
          <Select
            allowClear
            placeholder="Select department"
            options={buildDeptTreeSelect(departments)}
            onChange={() => form.setFieldValue('position_id', undefined)}
          />
        </Form.Item>
        <Form.Item name="position_id" label="Position">
          <Select allowClear placeholder="Select position" loading={!positions}>
            {filteredPositions.map((p) => (
              <Option key={p.id} value={p.id}>
                {p.name}{p.department?.name ? ` (${p.department.name})` : ''}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="hire_date" label="Hire Date"><Input type="date" /></Form.Item>
        <Form.Item name="basic_salary" label="Basic Salary (TZS)" initialValue={0}>
          <InputNumber min={0} className="w-full" />
        </Form.Item>
        <Form.Item name="status" label="Status" initialValue="active" rules={[{ required: true }]}>
          <Select>
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
            <Option value="terminated">Terminated</Option>
          </Select>
        </Form.Item>
        <Form.Item name="national_id" label="National ID"><Input /></Form.Item>
        <Form.Item name="bank_account" label="Bank Account"><Input /></Form.Item>
        <Form.Item name="documents" label="Documents" valuePropName="fileList" getValueFromEvent={(e) => e?.fileList}>
          <Upload.Dragger beforeUpload={() => false} multiple accept=".pdf,.jpg,.jpeg,.png" maxCount={5}>
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p className="ant-upload-text">PDF, JPG, PNG</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
