// src/pages/machines/MachineDetailPage.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Descriptions, Tag, Table, Button, Tabs, Spin, Typography, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { machinesAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function MachineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: machine, isLoading } = useQuery({
    queryKey: ['machine', id],
    queryFn: () => machinesAPI.get(id).then(r => r.data.data),
  });

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (!machine) return <div>Machine not found</div>;

  const deploymentCols = [
    { title: 'Shop', dataIndex: ['shop', 'name'] },
    { title: 'Opening Count', dataIndex: 'opening_count', render: v => v?.toLocaleString() },
    { title: 'Initial Load', dataIndex: 'initial_load_tzs', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Deployed', dataIndex: 'deployed_at', render: v => dayjs(v).format('DD MMM YYYY HH:mm') },
    { title: 'Withdrawn', dataIndex: 'withdrawn_at', render: v => v ? dayjs(v).format('DD MMM YYYY') : <Tag color="green">Active</Tag> },
  ];

  const exchangeCols = [
    { title: 'From Shop', dataIndex: 'from_shop_id' },
    { title: 'To Shop', dataIndex: 'to_shop_id' },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
    { title: 'Date', dataIndex: 'exchanged_at', render: v => dayjs(v).format('DD MMM YYYY HH:mm') },
  ];

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/machines')} />
          <Title level={4} style={{ margin: 0 }}>Machine: {machine.slot_code}</Title>
        </Space>
        <Tag color={machine.status === 'active' ? 'green' : 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
          {machine.status?.toUpperCase()}
        </Tag>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Slot Code"><strong>{machine.slot_code}</strong></Descriptions.Item>
          <Descriptions.Item label="Manufacturer">
            <Tag color={machine.manufacturer === 'Meteora' ? 'blue' : 'purple'}>{machine.manufacturer}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Credit Value">{machine.credit_value_tzs} TZS/credit</Descriptions.Item>
          <Descriptions.Item label="Serial Number">{machine.serial_number || '—'}</Descriptions.Item>
          <Descriptions.Item label="Sticker No.">{machine.sticker_no || '—'}</Descriptions.Item>
          <Descriptions.Item label="Current Shop">{machine.currentShop?.name || <Tag>Undeployed</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Previous Count">{machine.previous_count?.toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="Opening Count">{machine.opening_count?.toLocaleString()}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Tabs items={[
        {
          key: 'deployments', label: 'Deployment History',
          children: <Table dataSource={machine.deployments || []} columns={deploymentCols} rowKey="id" size="small" pagination={false} />,
        },
        {
          key: 'exchanges', label: 'Exchange History',
          children: <Table dataSource={machine.exchanges || []} columns={exchangeCols} rowKey="id" size="small" pagination={false} />,
        },
      ]} />
    </div>
  );
}
