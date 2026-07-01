import { useState } from 'react';
import { Card, Typography, App, DatePicker, Space, Divider, Spin } from 'antd';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function CashFlowPage() {
  const today = dayjs();
  const monthStart = today.startOf('month').format('YYYY-MM-DD');
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today.format('YYYY-MM-DD'));

  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow', dateFrom, dateTo],
    queryFn: () => reportsAPI.cashFlow({ date_from: dateFrom, date_to: dateTo }).then(r => r.data.data),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!data) return null;

  const renderSection = (title, icon, items, net, isPositive) => (
    <Card size="small" className="border border-slate-100 mb-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h5 className="font-semibold text-sm text-slate-700 m-0">{title}</h5>
      </div>
      {items.length === 0 ? (
        <Text type="secondary" className="text-xs">No transactions</Text>
      ) : (
        <table className="w-full border-collapse text-sm mb-3">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left p-1.5 text-xs text-slate-400 font-medium">Type</th>
              <th className="text-right p-1.5 text-xs text-slate-400 font-medium">Direction</th>
              <th className="text-right p-1.5 text-xs text-slate-400 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="p-1.5 text-sm capitalize text-slate-700">{item.reference_type?.replace('_', ' ')}</td>
                <td className="p-1.5 text-right">
                  {item.type === 'in'
                    ? <span className="flex items-center justify-end gap-1 text-emerald-600 text-xs"><ArrowUpRight size={13} /> In</span>
                    : <span className="flex items-center justify-end gap-1 text-red-600 text-xs"><ArrowDownRight size={13} /> Out</span>
                  }
                </td>
                <td className="p-1.5 text-right font-semibold">{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Divider className="my-2" />
      <div className={`flex items-center justify-between font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
        <span>Net {title}</span>
        <span>{fmt(Math.abs(net))} {isPositive ? <TrendingUp size={14} className="inline" /> : <TrendingDown size={14} className="inline" />}</span>
      </div>
    </Card>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Cash Flow Statement</h4>
          <span className="text-xs text-slate-500">{dayjs(data.date_from).format('DD MMM YYYY')} — {dayjs(data.date_to).format('DD MMM YYYY')}</span>
        </div>
        <Space>
          <DatePicker size="small" value={dayjs(data.date_from)} onChange={(d) => d && setDateFrom(d.format('YYYY-MM-DD'))} />
          <DatePicker size="small" value={dayjs(data.date_to)} onChange={(d) => d && setDateTo(d.format('YYYY-MM-DD'))} />
        </Space>
      </div>

      {/* Opening Cash Balance */}
      <Card size="small" className="border border-slate-100 mb-4 bg-slate-50">
        <div className="flex items-center justify-between">
          <Text className="text-sm">Opening Cash Balance</Text>
          <span className="font-bold text-lg text-slate-700">{fmt(data.opening_cash_balance)}</span>
        </div>
      </Card>

      {renderSection(
        'Operating Activities',
        <TrendingUp size={16} className="text-blue-500" />,
        data.operating_activities.items,
        data.operating_activities.net,
        data.operating_activities.net >= 0
      )}

      {renderSection(
        'Investing Activities',
        <TrendingDown size={16} className="text-purple-500" />,
        data.investing_activities.items,
        data.investing_activities.net,
        data.investing_activities.net >= 0
      )}

      {/* Net Cash Flow */}
      <Card size="small" className={`border ${data.net_cash_flow >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center justify-between">
          <Text className={`font-bold ${data.net_cash_flow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Cash Flow</Text>
          <span className={`font-bold text-lg ${data.net_cash_flow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {data.net_cash_flow >= 0 ? '+' : ''}{fmt(data.net_cash_flow)}
          </span>
        </div>
      </Card>
    </div>
  );
}
