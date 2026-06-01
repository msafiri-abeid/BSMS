// src/pages/collections/WeeklyTargetsPage.jsx
import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Progress, Typography, Card } from 'antd';
import { collectionsAPI } from '../../services/api';

const { Title } = Typography;

export default function WeeklyTargetsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['weekly-targets'],
    queryFn: () => collectionsAPI.weeklyTargets().then(r => r.data.data),
  });

  const cols = [
    { title: 'Slot Code', dataIndex: ['machine', 'slot_code'] },
    { title: 'Shop', dataIndex: ['shop', 'name'] },
    { title: 'Week', dataIndex: 'week_start', render: (v, r) => `${v} – ${r.week_end}` },
    { title: 'Target', dataIndex: 'target_tzs', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Collected', dataIndex: 'collected_tzs', render: v => <strong>TZS {v?.toLocaleString()}</strong> },
    {
      title: 'Progress',
      render: (_, r) => {
        const pct = Math.min(100, Math.round((r.collected_tzs / r.target_tzs) * 100));
        return <Progress percent={pct} size="small" strokeColor={pct >= 100 ? '#52c41a' : pct >= 70 ? '#faad14' : '#f5222d'} />;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: v => <Tag color={v === 'met' ? 'green' : v === 'unmet' ? 'red' : 'orange'}>{v}</Tag>,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Weekly Targets</Title>
      </div>
      <Table dataSource={data || []} columns={cols} rowKey="id" loading={isLoading} size="middle"
        pagination={{ pageSize: 20 }}
        rowClassName={(r) => r.status === 'unmet' ? 'ant-table-row-danger' : ''}
      />
    </div>
  );
}
