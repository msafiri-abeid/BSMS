import { useState } from 'react';
import { Table, Typography, App, DatePicker, Tag, Spin } from 'antd';
import { BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function TrialBalancePage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data, isLoading } = useQuery({
    queryKey: ['trial-balance', date],
    queryFn: () => reportsAPI.trialBalance({ as_of_date: date }).then(r => r.data.data),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  const rows = data?.rows || [];

  const cols = [
    { title: 'Account', dataIndex: 'name', render: v => <span className="font-semibold text-sm">{v}</span>, width: 200 },
    { title: 'Type', dataIndex: 'type', render: v => <Tag className="!text-[10px] capitalize">{v?.replace('_', ' ')}</Tag>, width: 100 },
    { title: 'Debit (TZS)', dataIndex: 'debit', render: v => v > 0 ? <span className="font-semibold text-emerald-600">{fmt(v)}</span> : '—', align: 'right', width: 150 },
    { title: 'Credit (TZS)', dataIndex: 'credit', render: v => v > 0 ? <span className="font-semibold text-red-600">{fmt(v)}</span> : '—', align: 'right', width: 150 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Trial Balance</h4>
          <span className="text-xs text-slate-500">As of {dayjs(data?.as_of_date).format('DD MMM YYYY')}</span>
        </div>
        <DatePicker size="small" value={dayjs(data?.as_of_date)} onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))} />
      </div>

      <Table
        dataSource={rows}
        columns={cols}
        rowKey="id"
        size="middle"
        pagination={false}
        summary={() => (
          <Table.Summary>
            <Table.Summary.Row className="bg-slate-50">
              <Table.Summary.Cell index={0}><span className="font-bold text-sm">Totals</span></Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2}><span className="font-bold text-emerald-600">{fmt(data?.total_debit)}</span></Table.Summary.Cell>
              <Table.Summary.Cell index={3}><span className="font-bold text-red-600">{fmt(data?.total_credit)}</span></Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      {data?.total_debit === data?.total_credit && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm text-center font-semibold">
          ✓ Balanced — Debits equal Credits
        </div>
      )}
    </div>
  );
}
