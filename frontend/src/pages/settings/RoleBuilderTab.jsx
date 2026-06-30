import { useState } from 'react';
import { Form, Input, Button, Table, Modal, Card, Row, Col, Checkbox, Tag, App, Typography, Space, Spin, Select } from 'antd';
import { Plus, Save, Pencil, Trash2, Shield } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { Text } = Typography;

const FALLBACK_MODULES = ['partners', 'shops', 'machines', 'collections', 'finance', 'inventory', 'tickets', 'staff', 'reports', 'settings', 'users'];
const ACTIONS = ['read', 'create', 'update', 'delete', 'approve'];
const ACTION_LABELS = { read: 'View', create: 'Create', update: 'Update', delete: 'Delete', approve: 'Approve' };

export default function RoleBuilderTab() {
  const [newRoleName, setNewRoleName] = useState('');
  const [selected, setSelected] = useState(null);
  const [permMatrix, setPermMatrix] = useState({});
  const [editModal, setEditModal] = useState(null);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('settings', 'update');

  const { data: modulesData } = useQuery({ queryKey: ['modules'], queryFn: () => settingsAPI.getModules().then(r => r.data.data) });
  const MODULES = modulesData || FALLBACK_MODULES;

  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: () => settingsAPI.getRoles().then(r => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (d) => settingsAPI.createRole(d),
    onSuccess: () => { message.success('Role created'); qc.invalidateQueries({ queryKey: ['roles'] }); setNewRoleName(''); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }) => settingsAPI.updateRole(id, data),
    onSuccess: () => { message.success('Role updated'); qc.invalidateQueries({ queryKey: ['roles'] }); setEditModal(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => settingsAPI.deleteRole(id),
    onSuccess: () => { message.success('Role deleted'); qc.invalidateQueries({ queryKey: ['roles'] }); if (selected?.id === editModal?.id) setSelected(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const permMutation = useMutation({
    mutationFn: ({ roleId, permissions }) => settingsAPI.updatePermissions(roleId, { permissions }),
    onSuccess: () => { message.success('Permissions saved'); qc.invalidateQueries({ queryKey: ['roles'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const selectRole = (role) => {
    setSelected(role);
    const matrix = {};
    MODULES.forEach(mod => {
      matrix[mod] = {};
      ACTIONS.forEach(act => {
        matrix[mod][act] = role.permissions?.some(p => p.module === mod && p.action === act) || false;
      });
    });
    setPermMatrix(matrix);
  };

  const toggle = (mod, act) => {
    if (!canEdit) return;
    setPermMatrix(prev => ({ ...prev, [mod]: { ...prev[mod], [act]: !prev[mod][act] } }));
  };

  const savePermissions = () => {
    if (!selected) return;
    const permissions = MODULES.map(mod => ({
      module: mod,
      actions: ACTIONS.filter(act => permMatrix[mod]?.[act]),
    })).filter(p => p.actions.length > 0);
    permMutation.mutate({ roleId: selected.id, permissions });
  };

  const roleColumns = [
    { title: 'Name', dataIndex: 'name', render: (v, r) => <span className="font-semibold text-sm">{v} {r.is_system && <Tag className="ml-1 text-[10px]">System</Tag>}</span> },
    { title: 'Permissions', dataIndex: 'permissions', render: (v) => <span className="text-xs text-slate-500">{v?.length || 0} permissions</span> },
    { title: 'Type', render: (_, r) => r.is_system ? <Tag className="rounded-full text-[10px]" color="default">System</Tag> : <Tag className="rounded-full text-[10px]" color="blue">Custom</Tag> },
    ...(canEdit ? [{
      title: 'Actions', render: (_, r) => (
        <Space>
          <Button type="text" size="small" icon={<Pencil size={14} />} disabled={r.is_system}
            onClick={(e) => { e.stopPropagation(); setEditModal({ id: r.id, name: r.name }); }} />
          <Button type="text" size="small" icon={<Trash2 size={14} className="text-red-500" />} disabled={r.is_system}
            onClick={(e) => { e.stopPropagation(); Modal.confirm({ title: 'Delete role?', content: `Delete "${r.name}"? This cannot be undone.`, okText: 'Delete', okType: 'danger', onOk: () => deleteRoleMutation.mutate(r.id) }); }} />
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card size="small" title={<span className="flex items-center gap-2"><Shield size={14} />Roles {!canEdit && <Tag className="!text-[10px] rounded-full">Read-only</Tag>}</span>} className="border border-slate-100"
            extra={canEdit ? (
              <Space>
                <Input size="small" placeholder="New role name" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="!w-[130px]" />
                <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => newRoleName && createMutation.mutate({ name: newRoleName })} className="!bg-brand-dark !border-0">Add</Button>
              </Space>
            ) : undefined}>
            <Table dataSource={roles || []} columns={roleColumns} rowKey="id" size="small" pagination={false}
              onRow={(record) => ({ onClick: () => selectRole(record), className: selected?.id === record.id ? 'bg-blue-50' : '' })}
              showHeader={false} />
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          {selected ? (
            <Card size="small" title={`Permissions: ${selected.name}`}
              className="border border-slate-100"
              extra={canEdit && !selected.is_system ? (
                  <Button type="primary" size="small" onClick={savePermissions} loading={permMutation.isPending} className="!bg-brand-dark !border-0">
                    <Save size={14} className="mr-1" /> Save Permissions
                  </Button>
                ) : undefined}>
              {selected.is_system ? (
                <Text type="secondary" className="text-sm">System roles cannot be modified via the role builder.</Text>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-1.5 text-xs border-b border-slate-100">Module</th>
                        {ACTIONS.map(a => <th key={a} className="text-center p-1.5 text-xs border-b border-slate-100">{ACTION_LABELS[a] || a}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(mod => (
                        <tr key={mod} className="border-b border-slate-50">
                          <td className="p-1.5 text-sm capitalize">{mod}</td>
                          {ACTIONS.map(act => (
                            <td key={act} className="text-center p-1.5">
                              <Checkbox checked={permMatrix[mod]?.[act] || false} onChange={() => toggle(mod, act)} disabled={!canEdit} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : (
            <Card size="small" className="border border-slate-100">
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Shield size={32} className="mb-2 text-slate-300" />
                <Text type="secondary">Select a role to manage its permissions</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {canEdit && (
        <Modal
          title="Edit Role"
          open={!!editModal}
          onCancel={() => setEditModal(null)}
          footer={null}
          className="top-8"
        >
          <Form
            layout="vertical"
            initialValues={{ name: editModal?.name }}
            onFinish={(values) => updateRoleMutation.mutate({ id: editModal.id, data: values })}
            className="mt-4"
          >
            <Form.Item name="name" label="Role Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item className="mb-0">
              <Space>
                <Button onClick={() => setEditModal(null)}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={updateRoleMutation.isPending} className="!bg-brand-dark !border-0">Save</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      )}
    </>
  );
}
