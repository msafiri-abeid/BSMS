import { useState } from 'react';
import { Card, Table, Typography, App, DatePicker, Divider, Spin } from 'antd';
import { BarChart3, Landmark, Building2, Smartphone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function BalanceSheetPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const { message } = App.useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['balance-sheet', date],
    queryFn: () => reportsAPI.balanceSheet({ as_of_date: date }).then(r => r.data.data),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  const renderAccountTable = (title, icon, accounts, total) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h5 className="font-semibold text-sm text-slate-700 m-0">{title}</h5>
        <span className="text-sm font-bold text-brand-dark ml-auto">{fmt(total)}</span>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left p-2 text-xs text-slate-400 font-medium">Account</th>
            <th className="text-right p-2 text-xs text-slate-400 font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id} className="border-b border-slate-50">
              <td className="p-2 text-slate-700">{a.name}{a.shop ? <span className="text-slate-400 text-xs ml-1">({a.shop})</span> : ''}</td>
              <td className="p-2 text-right font-semibold">{fmt(a.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!data) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Balance Sheet</h4>
          <span className="text-xs text-slate-500">As of {dayjs(data.as_of_date).format('DD MMM YYYY')}</span>
        </div>
        <DatePicker size="small" value={dayjs(data.as_of_date)} onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card size="small" className="border border-slate-100">
          <h5 className="font-semibold text-sm text-slate-700 mb-4 flex items-center gap-2">
            <Landmark size={16} className="text-emerald-600" /> Assets
          </h5>
          {data.assets.cash.accounts.length > 0 && renderAccountTable('Cash', <Landmark size={14} className="text-emerald-500" />, data.assets.cash.accounts, data.assets.cash.total)}
          {data.assets.bank.accounts.length > 0 && renderAccountTable('Bank', <Building2 size={14} className="text-blue-500" />, data.assets.bank.accounts, data.assets.bank.total)}
          {data.assets.mobile_money.accounts.length > 0 && renderAccountTable('Mobile Money', <Smartphone size={14} className="text-purple-500" />, data.assets.mobile_money.accounts, data.assets.mobile_money.total)}
          <Divider className="my-2" />
          <div className="flex items-center justify-between font-bold text-brand-dark">
            <span>Total Assets</span>
            <span>{fmt(data.assets.total)}</span>
          </div>
        </Card>

        {/* Equity & Liabilities */}
        <Card size="small" className="border border-slate-100">
          <h5 className="font-semibold text-sm text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-600" /> Equity
          </h5>
          <table className="w-full border-collapse text-sm mb-4">
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="p-2 text-slate-700">Total Opening Balances</td>
                <td className="p-2 text-right font-semibold">{fmt(data.equity.total_opening)}</td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="p-2 text-slate-700">Net Income (Revenue − Expenses)</td>
                <td className="p-2 text-right font-semibold">{fmt(data.equity.net_income)}</td>
              </tr>
            </tbody>
          </table>
          <Divider className="my-2" />
          <div className="flex items-center justify-between font-bold text-brand-dark">
            <span>Total Equity</span>
            <span>{fmt(data.equity.total)}</span>
          </div>
          <Divider className="my-2" />
          <div className="flex items-center justify-between font-bold text-brand-dark text-base">
            <span>Total Liabilities + Equity</span>
            <span>{fmt(data.total_liabilities_equity)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
