import { useState } from 'react';
import { Table, Select, Typography, App, DatePicker, Tag, Spin, Card } from 'antd';
import { BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, accountsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function AccountReportPage() {
  const [accountId, setAccountId] = useState(null);
  const today = dayjs();
  const [dateFrom, setDateFrom] = useState(today.startOf('month').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(today.format('YYYY-MM-DD'));

  const { data: accountsData } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: () => accountsAPI.list({ limit: 200 }).then(r => r.data.data),
  });
  const accounts = accountsData?.rows || [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['account-report', accountId, dateFrom, dateTo],
    queryFn: () => reportsAPI.accountReport(accountId, { date_from: dateFrom, date_to: dateTo }).then(r => r.data.data),
    enabled: !!accountId,
  });

  const report = data;
  const txCols = [
    { title: 'Date', dataIndex: 'date', render: v => dayjs(v).format('DD MMM YYYY'), width: 120 },
    {
      title: 'Type', dataIndex: 'type', width: 70,
      render: v => v === 'in'
        ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold"><ArrowUpRight size={13} /> IN</span>
        : <span className="flex items-center gap-1 text-red-600 text-xs font-semibold"><ArrowDownRight size={13} /> OUT</span>,
    },
    { title: 'Amount', dataIndex: 'amount', render: (v, r) => (
      <span className={`font-semibold ${r.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(v)}</span>
    ), width: 130 },
    { title: 'Balance', dataIndex: 'balance_after', render: v => <span className="font-semibold">{fmt(v)}</span>, width: 120 },
    { title: 'Reference', dataIndex: 'reference_type', render: v => <Tag className="!text-[10px] capitalize">{v?.replace('_', ' ')}</Tag>, width: 100 },
    { title: 'Description', dataIndex: 'description', render: v => <span className="text-xs text-slate-500">{v || '—'}</span>, ellipsis: true },
    { title: 'Recorded By', dataIndex: 'recorded_by', render: v => v || '—', width: 120 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Account Report</h4>
          <span className="text-xs text-slate-500">Transaction history for a selected account</span>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          <Select size="small" placeholder="Select Account" className="w-60" value={accountId} onChange={setAccountId} allowClear>
            {accounts.map(a => <Option key={a.id} value={a.id}>{a.name} ({a.account_type?.replace('_', ' ')})</Option>)}
          </Select>
          <DatePicker size="small" placeholder="From" value={dayjs(dateFrom)} onChange={(d) => d && setDateFrom(d.format('YYYY-MM-DD'))} />
          <DatePicker size="small" placeholder="To" value={dayjs(dateTo)} onChange={(d) => d && setDateTo(d.format('YYYY-MM-DD'))} />
        </div>
      </div>

      {!accountId && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <BarChart3 size={40} className="mb-3 text-slate-300" />
          <Text type="secondary">Select an account to view its transaction report</Text>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-20"><Spin size="large" /></div>}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card size="small" className="border border-slate-100">
              <Text type="secondary" className="text-xs">Opening Balance</Text>
              <div className="text-lg font-bold text-slate-700">{fmt(report.opening_balance)}</div>
            </Card>
            <Card size="small" className="border border-slate-100 bg-brand-dark/5 border-brand-dark/20">
              <Text type="secondary" className="text-xs">Closing Balance</Text>
              <div className="text-xl font-bold text-brand-dark">{fmt(report.closing_balance)}</div>
            </Card>
            <Card size="small" className="border border-slate-100">
              <Text type="secondary" className="text-xs">Account</Text>
              <div className="font-semibold text-sm text-slate-700 capitalize">{report.account?.name} <Tag className="!text-[10px]">{report.account?.type?.replace('_', ' ')}</Tag></div>
            </Card>
          </div>

          <Table
            dataSource={report.transactions}
            columns={txCols}
            rowKey="id"
            size="middle"
            loading={isFetching}
            pagination={{ pageSize: 50, showSizeChanger: false }}
          />
        </>
      )}
    </div>
  );
}
