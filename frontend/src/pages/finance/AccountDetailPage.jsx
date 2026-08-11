import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Button, Space, Typography, App, DatePicker, Select, Spin, Divider, Modal, InputNumber, Input, Upload } from 'antd';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Landmark, Building2, Download, Upload as UploadIcon, Plus, Minus, ArrowLeftRight, Eye, Ban } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import TransactionDetailModal from '../../components/TransactionDetailModal';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [txFilters, setTxFilters] = useState({ limit: 50, offset: 0 });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ amount: 0, description: '', receipt: null, to_account_id: null, date_from: null, date_to: null, transaction_date: dayjs().format('YYYY-MM-DD') });
  const [viewTx, setViewTx] = useState(null);
  const [cancelTx, setCancelTx] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const { hasPermission } = useAuthStore();
  const canCancel = hasPermission('accounts', 'update');

  const { data: accountData, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: () => accountsAPI.get(id).then(r => r.data.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['account-transactions', id, txFilters],
    queryFn: () => accountsAPI.transactions(id, txFilters).then(r => r.data.data),
  });

  const { data: allAccounts } = useQuery({
    queryKey: ['accounts-list-for-transfer'],
    queryFn: () => accountsAPI.list({ is_active: 'true', limit: 200 }).then(r => r.data.data?.rows || r.data.data || []),
    enabled: modal === 'transfer',
  });

  const depositMutation = useMutation({
    mutationFn: (fd) => accountsAPI.deposit(id, fd),
    onSuccess: () => { message.success('Deposit recorded'); qc.invalidateQueries({ queryKey: ['account', id] }); qc.invalidateQueries({ queryKey: ['account-transactions', id] }); setModal(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });

  const withdrawMutation = useMutation({
    mutationFn: (fd) => accountsAPI.withdraw(id, fd),
    onSuccess: () => { message.success('Withdrawal recorded'); qc.invalidateQueries({ queryKey: ['account', id] }); qc.invalidateQueries({ queryKey: ['account-transactions', id] }); setModal(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });

  const transferMutation = useMutation({
    mutationFn: (d) => accountsAPI.transfer({ ...d, from_account_id: Number(id) }),
    onSuccess: () => { message.success('Transfer completed'); qc.invalidateQueries({ queryKey: ['account', id] }); qc.invalidateQueries({ queryKey: ['account-transactions', id] }); setModal(null); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ tid, reason }) => accountsAPI.cancelTransaction(tid, reason),
    onSuccess: () => {
      message.success('Transaction cancelled — account balance recalculated');
      qc.invalidateQueries({ queryKey: ['account', id] });
      qc.invalidateQueries({ queryKey: ['account-transactions', id] });
      setCancelTx(null);
      setCancelReason('');
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to cancel transaction'),
  });

  const account = accountData;
  const txRows = txData?.rows || [];

  const handleSubmit = () => {
    if (modal === 'deposit') {
      const fd = new FormData();
      fd.append('amount', form.amount || 0);
      fd.append('transaction_date', form.transaction_date || dayjs().format('YYYY-MM-DD'));
      fd.append('description', form.description || '');
      if (form.receipt?.originFileObj) fd.append('receipt', form.receipt.originFileObj);
      depositMutation.mutate(fd);
    } else if (modal === 'withdraw') {
      const fd = new FormData();
      fd.append('amount', form.amount || 0);
      fd.append('transaction_date', form.transaction_date || dayjs().format('YYYY-MM-DD'));
      fd.append('description', form.description || '');
      if (form.receipt?.originFileObj) fd.append('receipt', form.receipt.originFileObj);
      withdrawMutation.mutate(fd);
    } else if (modal === 'transfer') {
      transferMutation.mutate({ to_account_id: form.to_account_id, amount: form.amount, description: form.description, transaction_date: form.transaction_date });
    } else if (modal === 'statement') {
      accountsAPI.statement(id, { date_from: form.date_from, date_to: form.date_to }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `statement-${account?.name?.replace(/\s+/g, '-')}-${form.date_from || 'all'}-${form.date_to || 'all'}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        setModal(null);
        message.success('Statement downloaded');
      }).catch(() => message.error('Failed to generate statement'));
    }
  };

  const openModal = (type) => {
    setForm({ amount: 0, description: '', receipt: null, to_account_id: null, date_from: null, date_to: null, transaction_date: dayjs().format('YYYY-MM-DD') });
    setModal(type);
  };

  const TYPE_ICONS = { cash: Landmark, bank: Building2, mobile_money: Landmark };
  const Icon = TYPE_ICONS[account?.account_type] || Landmark;

  const txCols = [
    { title: 'Date', dataIndex: 'transaction_date', render: v => dayjs(v).format('DD MMM YYYY'), width: 120 },
    {
      title: 'Type', dataIndex: 'type', width: 80,
      render: (v, r) => v === 'in'
        ? <span className={`flex items-center gap-1 text-emerald-600 text-xs font-semibold ${r.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}><ArrowUpRight size={14} /> IN</span>
        : <span className={`flex items-center gap-1 text-red-600 text-xs font-semibold ${r.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}><ArrowDownRight size={14} /> OUT</span>,
    },
    { title: 'Amount', dataIndex: 'amount', render: (v, r) => (
      <span className={`font-semibold ${r.type === 'in' ? 'text-emerald-600' : 'text-red-600'} ${r.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>{fmt(v)}</span>
    ), width: 130 },
    { title: 'Balance Before', dataIndex: 'balance_before', render: (v, r) => r.status === 'cancelled' ? <span className="text-xs text-slate-300">—</span> : <span className="text-xs">{fmt(v)}</span>, width: 120 },
    { title: 'Balance After', dataIndex: 'balance_after', render: (v, r) => r.status === 'cancelled' ? <span className="text-xs text-slate-300">—</span> : <span className="font-semibold">{fmt(v)}</span>, width: 120 },
    { title: 'Reference', key: 'reference', render: (_, r) => <Tag className="!text-[10px]">{r.reference_type?.replace(/_/g, ' ')}</Tag>, width: 100 },
    { title: 'Description', dataIndex: 'description', render: v => <span className="text-xs text-slate-500">{v || '—'}</span>, ellipsis: true },
    { title: 'Recorded By', dataIndex: ['recorder', 'name'], render: v => v || '—', width: 120 },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: (v) => v === 'cancelled'
        ? <Tag color="red" className="!text-[10px]">Cancelled</Tag>
        : <Tag color="green" className="!text-[10px]">Active</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 80,
      render: (_, r) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<Eye size={15} />} onClick={() => setViewTx(r)} />
          {canCancel && r.status !== 'cancelled' && ['adjustment', 'transfer'].includes(r.reference_type) && (
            <Button type="text" size="small" className="!text-rose-500" icon={<Ban size={15} />}
              onClick={() => { setCancelTx(r); setCancelReason(''); }} />
          )}
        </Space>
      ),
    },
  ];

  if (isLoading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!account) return <div className="text-center py-20 text-slate-400">Account not found</div>;

  return (
    <div>
      {/* Back + Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button type="text" icon={<ArrowLeft size={16} />} onClick={() => navigate('/finance/accounts')} />
          <div className="flex items-center gap-2">
            <Icon size={20} className="text-brand-dark" />
            <div>
              <h4 className="text-base font-bold text-slate-800 m-0">{account.name}</h4>
              <span className="text-xs text-slate-500 capitalize">{account.account_type?.replace('_', ' ')}{account.shop?.name ? ` • ${account.shop.name}` : ''}</span>
            </div>
          </div>
        </div>
        <Space>
          <Button size="small" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openModal('deposit')}
            className="!bg-emerald-600 hover:!bg-emerald-700 text-white hover:!text-white border-none flex items-center gap-1">Deposit</Button>
          <Button size="small" icon={<Minus className="w-3.5 h-3.5" />} onClick={() => openModal('withdraw')}
            className="!bg-rose-600 hover:!bg-rose-700 text-white hover:!text-white border-none flex items-center gap-1">Withdraw</Button>
          <Button size="small" icon={<ArrowLeftRight className="w-3.5 h-3.5" />} onClick={() => openModal('transfer')}
            className="!bg-brand-dark hover:!bg-brand-light text-white hover:!text-white border-none flex items-center gap-1">Transfer</Button>
          <Button size="small" icon={<Download className="w-3.5 h-3.5" />} onClick={() => openModal('statement')}
            className="!text-brand-dark !border-brand-dark/30 hover:!bg-brand-dark/5 flex items-center gap-1">Statement</Button>
        </Space>
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

      {/* Bank / Float Details */}
      {account.account_type === 'bank' && (account.bank_name || account.account_number || account.till_number) && (
        <Card size="small" title={<span className="text-xs font-bold text-slate-700">Bank Details</span>} className="mb-6 border border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {account.bank_name && (
              <div>
                <Text type="secondary" className="text-xs">Bank Name</Text>
                <div className="text-sm font-medium text-slate-700">{account.bank_name}</div>
              </div>
            )}
            {account.account_number && (
              <div>
                <Text type="secondary" className="text-xs">Account Number</Text>
                <div className="text-sm font-medium text-slate-700">{account.account_number}</div>
              </div>
            )}
            {account.till_number && (
              <div>
                <Text type="secondary" className="text-xs">Till Number</Text>
                <div className="text-sm font-medium text-slate-700">{account.till_number}</div>
              </div>
            )}
            {account.currency && (
              <div>
                <Text type="secondary" className="text-xs">Currency</Text>
                <div className="text-sm font-medium text-slate-700">{account.currency}</div>
              </div>
            )}
            {account.swift_code && (
              <div>
                <Text type="secondary" className="text-xs">SWIFT Code</Text>
                <div className="text-sm font-medium text-slate-700">{account.swift_code}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {account.account_type === 'cash' && account.float_minimum > 0 && (
        <Card size="small" className="mb-6 border border-slate-100">
          <div className="flex items-center justify-between">
            <Text type="secondary" className="text-xs">Float Minimum Threshold</Text>
            <span className={`text-sm font-bold ${account.current_balance >= account.float_minimum ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmt(account.float_minimum)}
            </span>
          </div>
        </Card>
      )}

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
        rowClassName={(r) => (r.status === 'cancelled' ? 'opacity-50' : '')}
        pagination={{ pageSize: 50, total: txData?.count || 0, showSizeChanger: false,
          onChange: (p) => setTxFilters(f => ({ ...f, offset: (p - 1) * 50 })) }}
      />

      {/* Deposit Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Record Deposit — {account?.name}</span>}
        open={modal === 'deposit'} onCancel={() => setModal(null)}
        onOk={handleSubmit} confirmLoading={depositMutation.isPending}
        okText="Deposit" okButtonProps={{ className: '!bg-emerald-600 rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }} width={480} className="top-8" destroyOnClose>
        <div className="space-y-3 mt-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Date</span>
            <DatePicker className="w-full rounded-lg" value={dayjs(form.transaction_date)}
              onChange={(d) => setForm(f => ({ ...f, transaction_date: d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD') }))} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Amount (TZS)</span>
            <InputNumber min={0} className="w-full rounded-lg h-9 w-full"
              formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v.replace(/[^0-9]/g, ''))}
              value={form.amount} onChange={(v) => setForm(f => ({ ...f, amount: v || 0 }))} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Receipt</span>
            <Upload beforeUpload={() => false} maxCount={1} accept="image/*,application/pdf"
              fileList={form.receipt ? [form.receipt] : []}
              onChange={(info) => setForm(f => ({ ...f, receipt: info.fileList?.[0] || null }))}>
              <Button icon={<UploadIcon size={14} />}>Attach Receipt</Button>
            </Upload>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Description</span>
            <Input.TextArea rows={2} className="rounded-lg" value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Record Withdrawal — {account?.name}</span>}
        open={modal === 'withdraw'} onCancel={() => setModal(null)}
        onOk={handleSubmit} confirmLoading={withdrawMutation.isPending}
        okText="Withdraw" okButtonProps={{ className: '!bg-rose-600 rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }} width={480} className="top-8" destroyOnClose>
        <div className="space-y-3 mt-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Date</span>
            <DatePicker className="w-full rounded-lg" value={dayjs(form.transaction_date)}
              onChange={(d) => setForm(f => ({ ...f, transaction_date: d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD') }))} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Amount (TZS)</span>
            <InputNumber min={0} className="w-full rounded-lg h-9 w-full"
              formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v.replace(/[^0-9]/g, ''))}
              value={form.amount} onChange={(v) => setForm(f => ({ ...f, amount: v || 0 }))} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Receipt</span>
            <Upload beforeUpload={() => false} maxCount={1} accept="image/*,application/pdf"
              fileList={form.receipt ? [form.receipt] : []}
              onChange={(info) => setForm(f => ({ ...f, receipt: info.fileList?.[0] || null }))}>
              <Button icon={<UploadIcon size={14} />}>Attach Receipt</Button>
            </Upload>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Description</span>
            <Input.TextArea rows={2} className="rounded-lg" value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Transfer Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Transfer from {account?.name}</span>}
        open={modal === 'transfer'} onCancel={() => setModal(null)}
        onOk={handleSubmit} confirmLoading={transferMutation.isPending}
        okText="Transfer" okButtonProps={{ className: '!bg-brand-dark rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }} width={480} className="top-8" destroyOnClose>
        <div className="space-y-3 mt-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Date</span>
            <DatePicker className="w-full rounded-lg" value={dayjs(form.transaction_date)}
              onChange={(d) => setForm(f => ({ ...f, transaction_date: d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD') }))} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Destination Account</span>
            <Select placeholder="Select account" className="w-full" showSearch optionFilterProp="children"
              value={form.to_account_id}
              onChange={(v) => setForm(f => ({ ...f, to_account_id: v }))}>
              {(allAccounts || []).filter(a => a.id !== Number(id)).map(a => (
                <Option key={a.id} value={a.id}>{a.name}{a.shop?.name ? ` (${a.shop.name})` : ''}</Option>
              ))}
            </Select>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Amount (TZS)</span>
            <InputNumber min={0} className="w-full rounded-lg h-9 w-full"
              formatter={v => `TZS ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v.replace(/[^0-9]/g, ''))}
              value={form.amount} onChange={(v) => setForm(f => ({ ...f, amount: v || 0 }))} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Description</span>
            <Input.TextArea rows={2} className="rounded-lg" value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Statement Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Download Statement — {account?.name}</span>}
        open={modal === 'statement'} onCancel={() => setModal(null)}
        onOk={handleSubmit}
        okText="Download" okButtonProps={{ className: '!bg-brand-dark rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }} width={400} className="top-8" destroyOnClose>
        <div className="space-y-3 mt-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">From</span>
            <DatePicker className="w-full rounded-lg" value={form.date_from ? dayjs(form.date_from) : null}
              onChange={(d) => setForm(f => ({ ...f, date_from: d ? d.format('YYYY-MM-DD') : null }))} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">To</span>
            <DatePicker className="w-full rounded-lg" value={form.date_to ? dayjs(form.date_to) : null}
              onChange={(d) => setForm(f => ({ ...f, date_to: d ? d.format('YYYY-MM-DD') : null }))} />
          </div>
          <p className="text-[10px] text-slate-400 m-0">Leave blank for full statement (all time)</p>
        </div>
      </Modal>

      {/* Cancel Transaction Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Cancel Transaction #{cancelTx?.id}</span>}
        open={!!cancelTx} onCancel={() => setCancelTx(null)}
        onOk={() => cancelMutation.mutate({ tid: cancelTx?.id, reason: cancelReason })}
        confirmLoading={cancelMutation.isPending}
        okText="Cancel Transaction" okButtonProps={{ danger: true, disabled: !cancelReason.trim(), className: 'rounded-lg' }}
        cancelButtonProps={{ className: 'rounded-lg' }} width={460} className="top-8" destroyOnClose>
        <div className="space-y-3 mt-4">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            Cancelling reverses this transaction on the account balance. The record is kept and marked as cancelled — nothing is deleted. This cannot be undone.
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Reason (required)</span>
            <Input.TextArea rows={3} className="rounded-lg" placeholder="Why is this transaction being cancelled?"
              value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal tx={viewTx} open={!!viewTx} onClose={() => setViewTx(null)} />
    </div>
  );
}