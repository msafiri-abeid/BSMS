// src/pages/machines/MachinesPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, InputNumber, App, Typography, Tooltip, Dropdown, } from 'antd';
import { UserOutlined, PlusOutlined, DeploymentUnitOutlined, SwapOutlined, GiftOutlined, EyeOutlined, MoreOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { machinesAPI, shopsAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { Option } = Select;

const STATUS_COLORS = { active: 'green', inactive: 'default', maintenance: 'orange', transferred: 'blue' };
const MANUFACTURERS = ['Meteora', 'Novomatic', 'EGT'];
const DEFAULT_CV = { Meteora: 200, Novomatic: 10, EGT: 100 };

export default function MachinesPage() {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(null);
  const [exchangeOpen, setExchangeOpen] = useState(null);
  const [refillOpen, setRefillOpen] = useState(null);
  const [form] = Form.useForm();
  const [deployForm] = Form.useForm();
  const [exchangeForm] = Form.useForm();
  const [refillForm] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: machines, isLoading } = useQuery({ queryKey: ['machines'], queryFn: () => machinesAPI.list().then(r => r.data.data) });
  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = shopsData?.rows || [];

  const createMutation = useMutation({
    mutationFn: (d) => machinesAPI.create(d),
    onSuccess: () => { message.success('Machine registered'); qc.invalidateQueries({ queryKey: ['machines'] }); setRegisterOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deployMutation = useMutation({
    mutationFn: ({ id, ...d }) => machinesAPI.deploy(id, d),
    onSuccess: () => { message.success('Machine deployed'); qc.invalidateQueries({ queryKey: ['machines'] }); setDeployOpen(null); deployForm.resetFields(); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const exchangeMutation = useMutation({
    mutationFn: ({ id, ...d }) => machinesAPI.exchange(id, d),
    onSuccess: () => { message.success('Machine exchanged'); qc.invalidateQueries({ queryKey: ['machines'] }); setExchangeOpen(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const refillMutation = useMutation({
    mutationFn: ({ id, ...d }) => machinesAPI.refill(id, d),
    onSuccess: () => { message.success('Refill recorded'); qc.invalidateQueries({ queryKey: ['machines'] }); setRefillOpen(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const cols = [
    { title: 'Slot Code', dataIndex: 'slot_code', sorter: (a, b) => a.slot_code.localeCompare(b.slot_code) },
    { title: 'Manufacturer', dataIndex: 'manufacturer', render: v => <Tag color={v === 'Meteora' ? 'blue' : v === 'Novomatic' ? 'purple' : 'orange'}>{v}</Tag> },
    { title: 'Serial No.', dataIndex: 'serial_number' },
    { title: 'Sticker No.', dataIndex: 'sticker_no' },
    { title: 'Location', dataIndex: ['currentShop', 'name'], render: v => v || <Tag>Office</Tag> },
    { title: 'Credit', dataIndex: 'credit_value_tzs', render: v => `${v} TZS` },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    {
      title: 'Actions',
      width: 80,
      render: (_, r) => {
        const items = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: 'View Details',
            onClick: () => navigate(`/machines/${r.id}`),
          },
          {
            key: 'deploy',
            icon: <DeploymentUnitOutlined />,
            label: 'Deploy',
            onClick: () => {
              setDeployOpen(r);
              deployForm.resetFields();
            },
          },
        ];

        if (r.status === 'active') {
          items.push({
            key: 'exchange',
            icon: <SwapOutlined />,
            label: 'Exchange',
            onClick: () => {
              setExchangeOpen(r);
              exchangeForm.resetFields();
            },
          });
        }

        if (r.manufacturer !== 'Novomatic' && r.status === 'active') {
          items.push({
            key: 'refill',
            icon: <GiftOutlined />,
            label: 'Refill Tokens',
            onClick: () => {
              setRefillOpen(r);
              refillForm.resetFields();
            },
          });
        }

        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) => {
                const action = items.find((item) => item.key === key);
                action?.onClick?.();
              },
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              className="flex items-center justify-center"
            />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Title level={4} style={{ margin: 0 }}>Machines ({machines?.count || 0})</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterOpen(true)} style={{ background: '#1a6b3a' }}>
            Register Machine
          </Button>
          <Button type="primary" icon={<UserOutlined />} onClick={() => navigate('/create-assignment')}>
            Create Assignment
          </Button>
        </div>
      </div>

      <Table dataSource={machines?.rows || []} columns={cols} rowKey="id" loading={isLoading} size="middle"
        pagination={{ total: machines?.count, pageSize: 20 }} />

      {/* Register Modal */}
      <Modal title="Register Machine" open={registerOpen} onCancel={() => setRegisterOpen(false)}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="slot_code" label="Slot Code" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="serial_number" label="Serial Number"><Input /></Form.Item>
          <Form.Item name="sticker_no" label="Sticker Number"><Input /></Form.Item>
          <Form.Item name="manufacturer" label="Manufacturer" rules={[{ required: true }]}>
            <Select onChange={(v) => form.setFieldValue('credit_value_tzs', DEFAULT_CV[v])}>
              {MANUFACTURERS.map(m => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="credit_value_tzs" label="Credit Value (TZS)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Deploy Modal */}
      <Modal title={`Deploy: ${deployOpen?.slot_code}`} open={!!deployOpen} onCancel={() => setDeployOpen(null)}
        onOk={() => deployForm.submit()} confirmLoading={deployMutation.isPending}>
        <Form form={deployForm} layout="vertical" onFinish={(v) => deployMutation.mutate({ id: deployOpen.id, ...v })} style={{ marginTop: 16 }}>
          <Form.Item name="shop_id" label="Deploy to Shop" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="opening_count" label="Opening Counter Reading" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="initial_load_tzs" label="Initial Token Load (TZS)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Exchange Modal */}
      <Modal title={`Exchange: ${exchangeOpen?.slot_code}`} open={!!exchangeOpen} onCancel={() => setExchangeOpen(null)}
        onOk={() => exchangeForm.submit()} confirmLoading={exchangeMutation.isPending}>
        <Form form={exchangeForm} layout="vertical" onFinish={(v) => exchangeMutation.mutate({ id: exchangeOpen.id, ...v })} style={{ marginTop: 16 }}>
          <Form.Item name="to_shop_id" label="Transfer to Shop" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {shops.filter(s => s.id !== exchangeOpen?.current_shop_id).map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="Reason"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Refill Modal */}
      <Modal title={`Token Refill: ${refillOpen?.slot_code}`} open={!!refillOpen} onCancel={() => setRefillOpen(null)}
        onOk={() => refillForm.submit()} confirmLoading={refillMutation.isPending}>
        <Form form={refillForm} layout="vertical" onFinish={(v) => refillMutation.mutate({ id: refillOpen.id, ...v })} style={{ marginTop: 16 }}>
          <Form.Item name="token_qty" label="Token Quantity" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="token_value_tzs" label="Value per Token (TZS)" rules={[{ required: true }]} initialValue={refillOpen?.credit_value_tzs}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
