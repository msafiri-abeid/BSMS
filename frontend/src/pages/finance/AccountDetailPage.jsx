import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Button, Space, Typography, App, DatePicker, Select, Spin, Divider } from 'antd';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Landmark, Building2, Smartphone, Smartphone as SelcomIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { accountsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [txFilters, setTxFilters] = useState({ limit: 50, offset: 0 });

  const { data: accountData, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: () => accountsAPI.get(id).then(r => r.data.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['account-transactions', id, txFilters],
    queryFn: () => accountsAPI.transactions(id, txFilters).then(r => r.data.data),
  });

  const account = accountData;
  const txRows = txData?.rows || [];

  const TYPE_ICONS = { cash: Landmark, bank: Building2, mobile_money: Smartphone, selcom: SelcomIcon };
  const Icon = TYPE_ICONS[account?.account_type] || Landmark;

  const txCols = [
    { title: 'Date', dataIndex: 'transaction_date', render: v => dayjs(v).format('DD MMM YYYY'), width: 120 },
    {
      title: 'Type', dataIndex: 'type', width: 80,
      render: v => v === 'in'
        ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold"><ArrowUpRight size={14} /> IN</span>
        : <span className="flex items-center gap-1 text-red-600 text-xs font-semibold"><ArrowDownRight size={14} /> OUT</span>,
    },
    { title: 'Amount', dataIndex: 'amount', render: (v, r) => (
      <span className={`font-semibold ${r.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(v)}</span>
    ), width: 130 },
    { title: 'Balance Before', dataIndex: 'balance_before', render: v => <span className="text-xs">{fmt(v)}</span>, width: 120 },
    { title: 'Balance After', dataIndex: 'balance_after', render: v => <span className="font-semibold">{fmt(v)}</span>, width: 120 },
    { title: 'Reference', key: 'reference', render: (_, r) => <Tag className="!text-[10px]">{r.reference_type?.replace('_', ' ')}</Tag>, width: 100 },
    { title: 'Description', dataIndex: 'description', render: v => <span className="text-xs text-slate-500">{v || '—'}</span>, ellipsis: true },
    { title: 'Recorded By', dataIndex: ['recorder', 'name'], render: v => v || '—', width: 120 },
  ];

  if (isLoading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!account) return <div className="text-center py-20 text-slate-400">Account not found</div>;

  return (
    <div>
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button type="text" icon={<ArrowLeft size={16} />} onClick={() => navigate('/finance/accounts')} />
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-brand-dark" />
          <div>
            <h4 className="text-base font-bold text-slate-800 m-0">{account.name}</h4>
            <span className="text-xs text-slate-500 capitalize">{account.account_type?.replace('_', ' ')}{account.shop?.name ? ` • ${account.shop.name}` : ''}</span>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card size="small" className="border border-slate-100">
          <Text type="secondary" className="text-xs">Opening Balance</Text>
          <div className="text-lg font-bold text-slate-700">{fmt(account.opening_balance)}</div>
        </Card>
        <Card size="small" className="border border-slate-100 bg-brand-dark/5 border-brand-dark/20">
          <Text type="secondary" className="text-xs">Current Balance</Text>
          <div className="text-xl font-bold text-brand-dark">{fmt(account.current_balance)}</div>
        </Card>
        <Card size="small" className="border border-slate-100">
          <Text type="secondary" className="text-xs">Status</Text>
          <div><Tag color={account.is_active ? 'green' : 'default'}>{account.is_active ? 'Active' : 'Inactive'}</Tag></div>
        </Card>
      </div>

      {account.description && (
        <div className="mb-4 text-sm text-slate-500 italic">"{account.description}"</div>
      )}

      <Divider className="my-4" />

      {/* Transactions Filters */}
      <div className="flex items-center justify-between mb-4">
        <h5 className="font-semibold text-sm text-slate-700 m-0">Transaction History</h5>
        <Space wrap size={[8, 8]}>
          <DatePicker size="small" placeholder="From" onChange={(d) => setTxFilters(f => ({ ...f, date_from: d ? d.format('YYYY-MM-DD') : undefined, offset: 0 }))} />
          <DatePicker size="small" placeholder="To" onChange={(d) => setTxFilters(f => ({ ...f, date_to: d ? d.format('YYYY-MM-DD') : undefined, offset: 0 }))} />
          <Select size="small" placeholder="Type" allowClear className="w-full sm:w-24"
            onChange={(v) => setTxFilters(f => ({ ...f, type: v, offset: 0 }))}>
            <Option value="in">IN</Option>
            <Option value="out">OUT</Option>
          </Select>
        </Space>
      </div>

      {/* Transactions Table */}
      <Table
        dataSource={txRows}
        columns={txCols}
        rowKey="id"
        size="middle"
        loading={txLoading}
        pagination={{ pageSize: 50, total: txData?.count || 0, showSizeChanger: false,
          onChange: (p) => setTxFilters(f => ({ ...f, offset: (p - 1) * 50 })) }}
      />
    </div>
  );
}
