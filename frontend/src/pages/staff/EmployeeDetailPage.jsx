import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Tag, Spin, Typography, Space, Form, App, Popconfirm, Modal } from 'antd';
import { ArrowLeft, Edit3, Trash2, FileText, User, Building2, Briefcase, CalendarDays, DollarSign, BadgePercent, Landmark, Phone, Mail, Shield, Clock, Eye, Trash } from 'lucide-react';
import dayjs from 'dayjs';
import { staffAPI } from '../../services/api';
import { STATUS_COLORS, empName, buildEmployeeFormData, isImage, isPdf } from './staffUtils';
import EmployeeFormModal from './components/EmployeeFormModal';

const { Title, Text } = Typography;

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="group flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0 transition-colors hover:bg-brand-dark/[0.02]">
      <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400 mt-0.5 group-hover:bg-brand-dark/10 group-hover:text-brand-dark transition-colors">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-slate-800 mt-0.5">{value || <span className="text-slate-300">—</span>}</div>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [activeDoc, setActiveDoc] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
  const [docLoading, setDocLoading] = useState(false);

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

  const { data: roles } = useQuery({
    queryKey: ['staff-roles'],
    queryFn: () => staffAPI.roles().then((r) => r.data.data),
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
      reports_to: employee.reports_to,
      hire_date: employee.hire_date,
      basic_salary: employee.basic_salary,
      national_id: employee.national_id,
      bank_account: employee.bank_account,
      account_holder_name: employee.account_holder_name,
      bank_name: employee.bank_name,
      bank_code: employee.bank_code,
      bank_branch: employee.bank_branch,
      tax_payer_id: employee.tax_payer_id,
      status: employee.status,
      user_role_id: employee.user?.role_id,
      user_email: employee.user?.email,
      user_is_active: employee.user?.is_active !== false,
    });
    setEditOpen(true);
  };

  const handleView = async (doc) => {
    if (activeDoc?.url === doc.url) {
      setActiveDoc(null);
      setSignedUrl(null);
      return;
    }
    setDocLoading(true);
    setActiveDoc(doc);
    setSignedUrl(null);
    try {
      const res = await staffAPI.getSignedDocumentUrl(doc.url);
      setSignedUrl(res.data.url);
    } catch {
      message.error('Failed to load document');
      setActiveDoc(null);
    } finally {
      setDocLoading(false);
    }
  };

  const handleDelete = (doc) => {
    Modal.confirm({
      title: 'Delete document?',
      content: 'Remove "' + doc.name + '" permanently?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await staffAPI.deleteEmployeeDocument(id, doc.url);
          message.success('Document deleted');
          if (activeDoc?.url === doc.url) { setActiveDoc(null); setSignedUrl(null); }
          qc.invalidateQueries({ queryKey: ['employee', id] });
        } catch (e) {
          message.error(e.response?.data?.message || 'Failed to delete document');
        }
      },
    });
  };

  if (isLoading) return <Spin size="large" className="block mx-auto mt-20" />;
  if (!employee) {
    return (
      <div>
        <Button icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/staff/employees')}>Back</Button>
        <p className="mt-4 text-slate-500">Employee not found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <Space>
          <Button
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/staff/employees')}
            className="flex items-center hover:!text-brand-dark hover:!border-brand-dark"
          />
          <div>
            <Title level={4} className="!m-0">{empName(employee)}</Title>
            <div className="flex items-center gap-2 mt-0.5">
              <Tag color={STATUS_COLORS[employee.status]} className="!text-[10px] !px-2 capitalize">{employee.status}</Tag>
              <span className="text-xs text-slate-400">{employee.employee_code}</span>
            </div>
          </div>
        </Space>
        <Space>
          <Button
            type="primary"
            icon={<Edit3 className="w-4 h-4" />}
            onClick={openEdit}
            className="!bg-brand-dark hover:!bg-brand-light border-none flex items-center gap-1.5"
          >
            Edit
          </Button>
          <Popconfirm title="Delete this employee?" onConfirm={() => deleteMutation.mutate()}>
            <Button danger icon={<Trash2 className="w-4 h-4" />} loading={deleteMutation.isPending} />
          </Popconfirm>
        </Space>
      </div>

      {/* Employee Details Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="border border-slate-100" size="small"
          title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2"><User className="w-3.5 h-3.5" /> Personal Info</span>}>
          <InfoRow icon={User} label="Full Name" value={empName(employee)} />
          <InfoRow icon={Phone} label="Phone" value={employee.phone} />
          <InfoRow icon={Mail} label="Email" value={employee.email} />
          <InfoRow icon={BadgePercent} label="National ID" value={employee.national_id} />
        </Card>

        <Card className="border border-slate-100" size="small"
          title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" /> Employment</span>}>
          <InfoRow icon={Building2} label="Department" value={employee.department?.name} />
          <InfoRow icon={Briefcase} label="Position" value={employee.position?.name} />
          <InfoRow icon={User} label="Reporting To" value={employee.supervisor?.full_name} />
          <InfoRow icon={CalendarDays} label="Hire Date" value={employee.hire_date ? dayjs(employee.hire_date).format('DD MMM YYYY') : null} />
          <InfoRow icon={DollarSign} label="Basic Salary" value={employee.basic_salary ? 'TZS ' + (employee.basic_salary || 0).toLocaleString() : null} />
        </Card>

        <Card className="border border-slate-100" size="small"
          title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2"><Landmark className="w-3.5 h-3.5" /> Bank Account Details</span>}>
          <InfoRow icon={User} label="Account Holder" value={employee.account_holder_name} />
          <InfoRow icon={Landmark} label="Account No" value={employee.bank_account} />
          <InfoRow icon={Landmark} label="Bank Name" value={employee.bank_name} />
          <InfoRow icon={Landmark} label="Bank Identifier Code" value={employee.bank_code} />
          <InfoRow icon={Landmark} label="Branch" value={employee.bank_branch} />
          <InfoRow icon={BadgePercent} label="Tax Payer ID" value={employee.tax_payer_id} />
        </Card>
      </div>

      {/* User Account Card */}
      <Card className="mb-4 border border-slate-100" size="small"
        title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> User Account</span>}>
        {employee.user ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</div>
              <div className="text-sm font-medium text-slate-800 mt-0.5">{employee.user.email}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Role</div>
              <div className="mt-0.5"><Tag color="blue" className="!text-[10px] !px-2">{employee.user.role?.name || 'User'}</Tag></div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</div>
              <div className="mt-0.5">
                <Tag color={employee.user.is_active ? 'green' : 'red'} className="!text-[10px] !px-2">
                  {employee.user.is_active ? 'Active' : 'Inactive'}
                </Tag>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last Login
              </div>
              <div className="text-sm font-medium text-slate-800 mt-0.5">
                {employee.user.last_login
                  ? dayjs(employee.user.last_login).format('DD MMM YYYY HH:mm')
                  : <Text type="secondary">Never</Text>}
              </div>
            </div>
          </div>
        ) : (
          <Text type="secondary" className="text-sm">No user account linked to this employee.</Text>
        )}
      </Card>

      {/* Documents Card */}
      <Card className="mb-4 border border-slate-100" size="small"
        title={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Documents</span>}>
        {(employee.documents?.length > 0) ? (
          <div>
            <div className="divide-y divide-slate-100">
              {employee.documents.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400 flex-shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">{d.name}</span>
                  </div>
                  <Space size="small">
                    <Button type="link" size="small" icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => handleView(d)}
                      className="!text-brand-dark hover:!opacity-80 flex items-center gap-1 !text-xs">
                      View
                    </Button>
                    <Button type="link" size="small" danger icon={<Trash className="w-3.5 h-3.5" />}
                      onClick={() => handleDelete(d)}
                      className="flex items-center gap-1 !text-xs">
                      Delete
                    </Button>
                  </Space>
                </div>
              ))}
            </div>

            {/* Inline viewer */}
            {docLoading && (
              <div className="mt-4 flex justify-center py-8 border border-slate-100 rounded-lg bg-slate-50">
                <Spin />
              </div>
            )}
            {activeDoc && !docLoading && signedUrl && (
              <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                {isImage(activeDoc.name) && (
                  <img src={signedUrl} alt={activeDoc.name} className="max-w-full mx-auto block" />
                )}
                {isPdf(activeDoc.name) && (
                  <iframe title={activeDoc.name} src={signedUrl} className="w-full h-[480px] border-0" />
                )}
                {!isImage(activeDoc.name) && !isPdf(activeDoc.name) && (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Preview not available for this file type.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <Text type="secondary" className="text-sm">No documents uploaded.</Text>
        )}
      </Card>

      <EmployeeFormModal
        open={editOpen}
        editing={employee}
        form={form}
        departments={departments}
        positions={positions}
        roles={roles}
        loading={updateMutation.isPending}
        onCancel={() => setEditOpen(false)}
        onSubmit={(v) => updateMutation.mutate(buildEmployeeFormData(v))}
      />
    </div>
  );
}
