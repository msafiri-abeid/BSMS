// src/pages/collections/CreateAssignmentPage.jsx

import { useState } from 'react';
import {
  Card,
  Form,
  Select,
  DatePicker,
  Button,
  Input,
  message,
  Space,
  Alert,
} from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAPI, machinesAPI, collectionsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

export default function CreateAssignmentPage() {
  const [form] = Form.useForm();
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [machineSearch, setMachineSearch] = useState('');
  const qc = useQueryClient();

  // Fetch collectors
  const { data: collectorsData, isLoading: collectorsLoading } = useQuery({
    queryKey: ['users', { role: 'Collector' }],
    queryFn: () =>
      usersAPI
        .list({ role: 'Collector' })
        .then((res) => res.data.data),
  });

  const collectors = collectorsData?.rows || collectorsData || [];

  // Fetch machines
  const { data: machinesData, isLoading: machinesLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: () =>
      machinesAPI
        .list()
        .then((res) => res.data.data),
  });

  const machines = machinesData?.rows || [];

  // Filter machines
  const filteredMachines = machines
    .filter((m) => {
      const search = machineSearch.toLowerCase();

      return (
        m.slot_code?.toLowerCase().includes(search) ||
        m.shop?.name?.toLowerCase().includes(search) ||
        m.currentShop?.name?.toLowerCase().includes(search)
      );
    })
    .slice(0, 50);

  const createAssignmentMutation = useMutation({
    mutationFn: ({ collector_id, machine_ids, date }) =>
      collectionsAPI.createAssignment({
        collector_id,
        machine_ids,
        date,
      }),

    onSuccess: () => {
      message.success('Assignment created successfully');

      form.resetFields();

      form.setFieldValue('date', dayjs());

      setSelectedMachines([]);
      setMachineSearch('');

      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      qc.invalidateQueries({ queryKey: ['machines'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
    },

    onError: (error) => {
      message.error(
        error?.response?.data?.message ||
          'Failed to create assignment'
      );
    },
  });

  const onFinish = (values) => {
    const { collector, date, machines: machineIds } = values;

    createAssignmentMutation.mutate({
      collector_id: collector,
      machine_ids: machineIds,
      date: dayjs(date).format('YYYY-MM-DD'),
    });
  };

  const handleMachineChange = (selectedIds) => {
    const selected = machines.filter((m) =>
      selectedIds.includes(m.id)
    );

    setSelectedMachines(selected);

    form.setFieldValue('machines', selectedIds);
  };

  if (collectorsLoading || machinesLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        Loading...
      </div>
    );
  }

  return (
    <Card
      title="Create Collector Assignment"
      extra={
        <Button
          type="primary"
          icon={<UserOutlined />}
          className="!bg-green-800 hover:!bg-green-700 border-green-800"
        >
          Collectors List
        </Button>
      }
      className="max-w-4xl mx-auto mt-6"
    >
      <Form
        form={form}
        layout="vertical"
        name="assignment_form"
        onFinish={onFinish}
        initialValues={{
          date: dayjs(),
        }}
      >
        <Form.Item
          label="Collector"
          name="collector"
          rules={[
            {
              required: true,
              message: 'Please select a collector',
            },
          ]}
        >
          <Select
            showSearch
            placeholder="Select a collector"
            optionFilterProp="children"
          >
            {collectors.map((collector) => (
              <Option
                key={collector.id}
                value={collector.id}
              >
                {collector.name}
                {collector.username
                  ? ` (${collector.username})`
                  : ''}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Assignment Date"
          name="date"
          rules={[
            {
              required: true,
              message: 'Please select a date',
            },
          ]}
        >
          <DatePicker
            className="w-full"
            format="YYYY-MM-DD"
          />
        </Form.Item>

        <Form.Item
          label="Machines"
          name="machines"
          rules={[
            {
              required: true,
              message: 'Please select at least one machine',
            },
          ]}
        >
          <Space
            direction="vertical"
            className="w-full"
          >
            <Input
              placeholder="Search by slot code or shop name"
              value={machineSearch}
              onChange={(e) =>
                setMachineSearch(e.target.value)
              }
              allowClear
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
            >
              {filteredMachines.map((machine) => (
                <Option
                  key={machine.id}
                  value={machine.id}
                >
                  {machine.slot_code}
                  {' - '}
                  {machine.currentShop?.name ||
                    machine.shop?.name ||
                    'No Shop'}
                  {' ('}
                  {machine.manufacturer}
                  {')'}
                </Option>
              ))}
            </Select>
          </Space>
        </Form.Item>

        {selectedMachines.length > 0 && (
          <Alert
            type="info"
            showIcon
            className="mb-4"
            message={`Selected ${selectedMachines.length} machine(s)`}
            description={selectedMachines
              .map((m) => m.slot_code)
              .join(', ')}
          />
        )}

        <Form.Item className="mb-0">
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createAssignmentMutation.isPending}
              className="!bg-green-800 hover:!bg-green-700 border-green-800"
            >
              Create Assignment
            </Button>

            <Button
              onClick={() => {
                form.resetFields();
                form.setFieldValue('date', dayjs());
                setSelectedMachines([]);
                setMachineSearch('');
              }}
            >
              Reset
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}