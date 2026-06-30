import { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Button,
  Input,
  App,
  Space,
  Alert,
  Tag,
} from 'antd';
import { User, Cpu, Building2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAPI, machinesAPI, collectionsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Option } = Select;

export default function CreateAssignmentModal({ open, onClose }) {
  const [form] = Form.useForm();
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [machineSearch, setMachineSearch] = useState('');
  const { message } = App.useApp();
  const qc = useQueryClient();
  const roleName = useAuthStore((s) => s.user?.role?.name);
  const canAssign = ['Admin', 'General Manager', 'Operations Manager'].includes(roleName);

  const { data: collectorsData, isLoading: collectorsLoading } = useQuery({
    queryKey: ['users', { role: 'Collector' }],
    queryFn: () => usersAPI.list({ role: 'Collector' }).then((res) => res.data.data),
    enabled: open,
  });
  const collectors = collectorsData?.rows || collectorsData || [];

  const { data: machinesData, isLoading: machinesLoading } = useQuery({
    queryKey: ['machines', { status: 'active' }],
    queryFn: () => machinesAPI.list({ status: 'active' }).then((res) => res.data.data),
    enabled: open,
  });
  const machines = machinesData?.rows || [];

  const filteredMachines = machines
    .filter((m) => {
      const search = machineSearch.toLowerCase();
      return (
        m.slot_code?.toLowerCase().includes(search) ||
        m.currentShop?.name?.toLowerCase().includes(search)
      );
    })
    .slice(0, 50);

  const createMutation = useMutation({
    mutationFn: ({ collector_id, machine_ids, date }) =>
      collectionsAPI.createAssignment({ collector_id, machine_ids, date }),
    onSuccess: () => {
      message.success('Assignment created successfully');
      form.resetFields();
      form.setFieldValue('date', dayjs());
      setSelectedMachines([]);
      setMachineSearch('');
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      qc.invalidateQueries({ queryKey: ['all-assignments'] });
      qc.invalidateQueries({ queryKey: ['machines'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      onClose();
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to create assignment');
    },
  });

  const onFinish = (values) => {
    if (!canAssign) {
      message.error('You do not have permission to create assignments');
      return;
    }
    createMutation.mutate({
      collector_id: values.collector,
      machine_ids: values.machines,
      date: dayjs(values.date).format('YYYY-MM-DD'),
    });
  };

  const handleMachineChange = (selectedIds) => {
    const selected = machines.filter((m) => selectedIds.includes(m.id));
    setSelectedMachines(selected);
    form.setFieldValue('machines', selectedIds);
  };

  return (
    <Modal
      title={<span className="text-sm font-bold text-slate-700">Create Collector Assignment</span>}
      open={open}
      onCancel={() => { onClose(); form.resetFields(); setSelectedMachines([]); setMachineSearch(''); }}
      onOk={() => form.submit()}
      confirmLoading={createMutation.isPending}
      width={560}
      className="top-8"
      okText="Create Assignment"
    >
      <Form
        form={form}
        layout="vertical"
        name="assignment_form"
        onFinish={onFinish}
        initialValues={{ date: dayjs() }}
        className="mt-2"
      >
        <Form.Item
          label={<span className="text-xs font-semibold text-slate-600">Collector</span>}
          name="collector"
          rules={[{ required: true, message: 'Please select a collector' }]}
        >
          <Select
            showSearch
            placeholder="Select a collector"
            optionFilterProp="children"
            loading={collectorsLoading}
            prefix={<User className="w-4 h-4 text-slate-400" />}
          >
            {collectors.map((c) => (
              <Option key={c.id} value={c.id}>
                {c.name}{c.username ? ` (${c.username})` : ''}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label={<span className="text-xs font-semibold text-slate-600">Assignment Date</span>}
          name="date"
          rules={[{ required: true, message: 'Please select a date' }]}
        >
          <DatePicker className="w-full" format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item
          label={<span className="text-xs font-semibold text-slate-600">Machines <span className="text-slate-400 font-normal">(deployed machines only)</span></span>}
          name="machines"
          rules={[{ required: true, message: 'Please select at least one machine' }]}
        >
          <Space direction="vertical" className="w-full">
            <Input
              placeholder="Search by slot code or shop name"
              value={machineSearch}
              onChange={(e) => setMachineSearch(e.target.value)}
              allowClear
              prefix={<Cpu className="w-3.5 h-3.5 text-slate-400" />}
            />
            <Select
              mode="multiple"
              placeholder="Select machines"
              className="w-full"
              allowClear
              maxTagCount={5}
              showSearch={false}
              value={selectedMachines.map((m) => m.id)}
              onChange={handleMachineChange}
              loading={machinesLoading}
            >
              {filteredMachines.map((m) => (
                <Option key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">{m.slot_code}</span>
                    <span className="text-slate-400">-</span>
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-500 text-xs">{m.currentShop?.name || 'No Shop'}</span>
                    <Tag className="!text-[10px] !ml-1">{m.manufacturer}</Tag>
                  </div>
                </Option>
              ))}
            </Select>
          </Space>
        </Form.Item>

        {selectedMachines.length > 0 && (
          <Alert
            type="info"
            showIcon
            className="mb-0"
            message={
              <span className="text-xs">
                <strong>{selectedMachines.length}</strong> machine(s) selected: {selectedMachines.map((m) => m.slot_code).join(', ')}
              </span>
            }
          />
        )}
      </Form>
    </Modal>
  );
}
