import { useQuery } from '@tanstack/react-query';
import { Table, Progress, Empty, Alert } from 'antd';
import { collectionsAPI } from '../../services/api';

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function WeeklyTargetsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['weekly-targets'],
    queryFn: () => collectionsAPI.weeklyTargets().then(r => r.data.data),
  });

  const cols = [
    { title: 'Slot Code', dataIndex: ['machine', 'slot_code'], render: v => v || '—' },
    { title: 'Shop', dataIndex: ['shop', 'name'], render: v => v || '—' },
    { title: 'Week', dataIndex: 'week_start', render: (v, r) => `${v || '?'} – ${r.week_end || '?'}` },
    { title: 'Target', dataIndex: 'target_tzs', render: v => fmt(v) },
    { title: 'Collected', dataIndex: 'collected_tzs', render: v => <strong>{fmt(v)}</strong> },
    {
      title: 'Progress',
      render: (_, r) => {
        if (!r.target_tzs) return <span className="text-xs text-slate-400">No target</span>;
        const pct = Math.min(100, Math.round((r.collected_tzs / r.target_tzs) * 100));
        return <Progress percent={pct} size="small" strokeColor={pct >= 100 ? '#52c41a' : pct >= 70 ? '#faad14' : '#f5222d'} />;
      },
    },
    {
      title: 'Commission',
      render: (_, r) => {
        const commission = Math.max(0, (r.collected_tzs || 0) - (r.target_tzs || 0));
        if (commission <= 0) return <span className="text-xs text-slate-300">—</span>;
        return <span className="font-semibold text-purple-700">{fmt(commission)}</span>;
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <h4 className="text-base font-bold text-slate-800 m-0">Weekly Targets</h4>
      </div>

      {error && (
        <Alert type="error" message="Failed to load weekly targets" description={error.message} className="mb-4" showIcon />
      )}

      <Table
        dataSource={data || []}
        columns={cols}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description={error ? 'Error loading data' : 'No weekly targets yet — they are created when collections are submitted'} /> }}
      />
    </div>
  );
}
