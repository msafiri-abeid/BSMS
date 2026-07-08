import { useState } from 'react';
import { Form, Input, Select, InputNumber, Upload, Button, Modal, Switch } from 'antd';
import { Upload as UploadIcon, Key, Shield } from 'lucide-react';
import { buildDeptTreeSelect } from '../staffUtils';

const { Option } = Select;

export default function EmployeeFormModal({
  open,
  editing,
  form,
  departments,
  positions,
  roles,
  employeeList = [],
  loading,
  onCancel,
  onSubmit,
}) {
  const deptId = Form.useWatch('department_id', form);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const filteredPositions = (deptId
    ? (positions || []).filter((p) => !p.department_id || p.department_id === deptId)
    : positions) || [];

  const hasExistingUser = !!editing?.user;

  return (
    <Modal
      title={editing ? `${editing.employee_code} — Edit Employee` : 'Add Employee'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={640}
      destroyOnClose
      className="top-8"
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        {/* Employee Info */}
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Employee Details</div>

        <Form.Item name="full_name" label={<span className="text-xs font-semibold text-slate-600">Full name</span>} rules={[{ required: true, message: 'Enter full name' }]}>
          <Input />
        </Form.Item>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Form.Item name="phone" label={<span className="text-xs font-semibold text-slate-600">Phone</span>} rules={[{ required: true, message: 'Phone is required for SMS' }]}>
            <Input placeholder="+255..." />
          </Form.Item>
          <Form.Item name="email" label={<span className="text-xs font-semibold text-slate-600">Email</span>}>
            <Input type="email" />
          </Form.Item>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Form.Item name="department_id" label={<span className="text-xs font-semibold text-slate-600">Department</span>}>
            <Select
              allowClear
              placeholder="Select department"
              options={buildDeptTreeSelect(departments)}
              onChange={() => form.setFieldValue('position_id', undefined)}
            />
          </Form.Item>
          <Form.Item name="position_id" label={<span className="text-xs font-semibold text-slate-600">Position</span>}>
            <Select allowClear placeholder="Select position" loading={!positions}>
              {filteredPositions.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}{p.department?.name ? ` (${p.department.name})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
          <Form.Item name="hire_date" label={<span className="text-xs font-semibold text-slate-600">Hire Date</span>}><Input type="date" /></Form.Item>
          <Form.Item name="basic_salary" label={<span className="text-xs font-semibold text-slate-600">Basic Salary (TZS)</span>} initialValue={0}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="status" label={<span className="text-xs font-semibold text-slate-600">Status</span>} initialValue="active" rules={[{ required: true }]}>
            <Select>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
              <Option value="terminated">Terminated</Option>
            </Select>
          </Form.Item>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Form.Item name="reports_to" label={<span className="text-xs font-semibold text-slate-600">Reporting To</span>}>
            <Select allowClear placeholder="Select supervisor" showSearch optionFilterProp="label">
              {(employeeList || []).filter((e) => !editing || e.id !== editing.id).map((e) => (
                <Option key={e.id} value={e.id} label={`${e.employee_code} — ${e.full_name || e.user?.name || ''}`}>
                  {e.employee_code} — {e.full_name || e.user?.name || ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="national_id" label={<span className="text-xs font-semibold text-slate-600">National ID</span>}><Input /></Form.Item>
        </div>

        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Bank Account Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="account_holder_name" label={<span className="text-xs font-semibold text-slate-600">Account Holder's Name</span>}><Input /></Form.Item>
            <Form.Item name="bank_account" label={<span className="text-xs font-semibold text-slate-600">Account No</span>}><Input /></Form.Item>
            <Form.Item name="bank_name" label={<span className="text-xs font-semibold text-slate-600">Bank Name</span>}><Input /></Form.Item>
            <Form.Item name="bank_code" label={<span className="text-xs font-semibold text-slate-600">Bank Identifier Code</span>}><Input /></Form.Item>
            <Form.Item name="bank_branch" label={<span className="text-xs font-semibold text-slate-600">Branch</span>}><Input /></Form.Item>
            <Form.Item name="tax_payer_id" label={<span className="text-xs font-semibold text-slate-600">Tax Payer ID</span>}><Input /></Form.Item>
          </div>
        </div>

        {/* User Account */}
        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">User Account</span>
          </div>

          {editing && !hasExistingUser && (
            <div className="mb-3">
              <Button
                size="small"
                icon={showCreateUser ? null : <Key className="w-3.5 h-3.5" />}
                onClick={() => {
                  setShowCreateUser(!showCreateUser);
                  if (!showCreateUser) {
                    form.setFieldsValue({ user_role_id: undefined, user_password: undefined });
                  }
                }}
                className="flex items-center gap-1.5 !text-xs hover:!border-brand-dark hover:!text-brand-dark"
              >
                {showCreateUser ? 'Cancel' : 'Create User Account'}
              </Button>
            </div>
          )}

          {(showCreateUser || hasExistingUser || !editing) && (
            <div className="border border-dashed border-gray-300 rounded-md p-4 bg-gray-50/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <Form.Item
                  name="user_role_id"
                  label={<span className="text-xs font-semibold text-slate-600">Role</span>}
                  rules={(!editing || hasExistingUser || showCreateUser) ? [{ required: true, message: 'Select a role' }] : []}
                  initialValue={editing?.user?.role_id || undefined}
                >
                  <Select placeholder="Select role">
                    {(roles || []).map((r) => (
                      <Option key={r.id} value={r.id}>{r.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item
                  name="user_password"
                  label={<span className="text-xs font-semibold text-slate-600">{editing && hasExistingUser ? 'Reset password (leave blank to keep)' : 'Password'}</span>}
                  rules={(!editing || showCreateUser) ? [{ required: true, min: 6, message: 'Min 6 characters' }] : []}
                >
                  <Input.Password
                    placeholder={editing && hasExistingUser ? 'Leave blank to keep current' : 'Min 6 characters'}
                  />
                </Form.Item>
              </div>

              {hasExistingUser && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mt-2">
                    <Form.Item
                      name="user_email"
                      label={<span className="text-xs font-semibold text-slate-600">Login Email</span>}
                      rules={[{ type: 'email', message: 'Enter a valid email' }]}
                    >
                      <Input type="email" placeholder="Login email address" />
                    </Form.Item>
                    <Form.Item name="user_is_active" label={<span className="text-xs font-semibold text-slate-600">Active</span>} valuePropName="checked" initialValue={editing?.user?.is_active !== false}>
                      <Switch />
                    </Form.Item>
                  </div>
                </>
              )}

              {(!editing || showCreateUser) && (
                <div className="text-xs text-slate-400 mt-1">A user account grants system access with the selected role.</div>
              )}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <UploadIcon className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Documents</span>
          </div>
          <Form.Item name="documents" valuePropName="fileList" getValueFromEvent={(e) => e?.fileList}>
            <Upload.Dragger beforeUpload={() => false} multiple accept=".pdf,.jpg,.jpeg,.png" maxCount={5}>
              <p className="ant-upload-drag-icon"><UploadIcon className="w-8 h-8 mx-auto text-slate-300" /></p>
              <p className="ant-upload-text text-sm">PDF, JPG, PNG</p>
            </Upload.Dragger>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
