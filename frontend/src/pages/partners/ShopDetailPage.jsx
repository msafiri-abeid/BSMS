import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Button, Spin, Descriptions, Tooltip } from 'antd';
import { ArrowLeft, Store, Cpu, TrendingUp, DollarSign, PiggyBank, MapPin, User, Globe, FileText, Phone, Target, BarChart3, History, ExternalLink, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { shopsAPI, financeAPI, collectionsAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import dayjs from 'dayjs';

const STATUS_COLORS = { active: 'green', inactive: 'red', suspended: 'orange' };
const MFG_COLORS = { Meteora: 'blue', Novomatic: 'purple' };
const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function ShopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: shop, isLoading } = useQuery({
    queryKey: ['shop', id],
    queryFn: () => shopsAPI.get(id).then((r) => r.data.data),
  });

  const shopType = shop?.business_type;
  const isSlot = shopType === 'slot';

  const machines = shop?.machines || [];
  const novomaticMachines = machines.filter(m => m.manufacturer === 'Novomatic');
  const meteoraMachines = machines.filter(m => m.manufacturer === 'Meteora');
  const displayMachines = isSlot ? novomaticMachines : meteoraMachines;

  const perfSummary = machines.length > 0
    ? machines.reduce((acc, m) => {
        (m.performance || []).forEach((r) => {
          acc.gross += r.gross_tzs || 0;
          acc.net += r.net_tzs || 0;
          acc.office += r.office_tzs || 0;
          acc.owner += r.owner_tzs || 0;
        });
        return acc;
      }, { gross: 0, net: 0, office: 0, owner: 0 })
    : null;

  const latestPerf = (m) => (m.performance && m.performance[0]) || null;

  const monthlyMap = {};
  machines.forEach(m => {
    (m.performance || []).forEach(p => {
      if (!p.collected_at) return;
      const monthKey = dayjs(p.collected_at).format('YYYY-MM');
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
      monthlyMap[monthKey] += p.gross_tzs || 0;
    });
  });
  const chartData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, gross]) => ({
      month: dayjs(month).format('MMM'),
      gross,
    }));

  const backPath = location.pathname.startsWith('/shops/slot/') ? '/shops/slot' : '/shops/meteora';

  const { data: expenses } = useQuery({
    queryKey: ['shop-expenses', id],
    queryFn: () => financeAPI.listExpenses({ shop_id: id, limit: 50 }).then(r => r.data.data),
    enabled: isSlot,
  });
  const totalExpenses = isSlot && Array.isArray(expenses) ? expenses.reduce((s, e) => s + (e.amount || 0), 0) : 0;

  const { data: collectionsData } = useQuery({
    queryKey: ['shop-novomatic-collections', id],
    queryFn: () => collectionsAPI.list({ shop_id: id, manufacturer: 'Novomatic', limit: 50 }).then(r => r.data.data),
    enabled: isSlot,
  });
  const collectionRows = (collectionsData?.rows || []).map(c => ({
    ...c,
    _weekday: dayjs(c.collected_at).format('ddd DD MMM YYYY'),
    _slotCode: c.machine?.slot_code || '—',
    _manufacturer: c.machine?.manufacturer || '—',
    _cashier: c.collector?.full_name || '—',
    _opening: c.novomaticReading?.opening_credits,
    _closing: c.novomaticReading?.closing_credits,
    _totalCredits: c.novomaticReading?.total_credits,
  }));

  const machineCols = [
    { title: 'Slot Code', dataIndex: 'slot_code', sorter: (a, b) => a.slot_code.localeCompare(b.slot_code), width: 140,
      render: (v, r) => (
        <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => navigate(`/machines/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    { title: 'Manufacturer', dataIndex: 'manufacturer', render: (v) => <Tag color={MFG_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 110 },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={STATUS_COLORS[v]} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    { title: 'Latest Gross', key: 'gross', render: (_, r) => { const p = latestPerf(r); return p ? <span className="font-semibold">{fmt(p.gross_tzs)}</span> : <span className="text-xs text-slate-300">—</span>; }, width: 130 },
    { title: 'Latest Net', key: 'net', render: (_, r) => { const p = latestPerf(r); return p ? <span className="font-semibold">{fmt(p.net_tzs)}</span> : <span className="text-xs text-slate-300">—</span>; }, width: 130 },
    { title: 'Office', key: 'office', render: (_, r) => { const p = latestPerf(r); return p ? <span className="font-semibold">{fmt(p.office_tzs)}</span> : <span className="text-xs text-slate-300">—</span>; }, width: 120 },
    { title: 'Owner', key: 'owner', render: (_, r) => { const p = latestPerf(r); return p ? <span className="font-semibold">{fmt(p.owner_tzs)}</span> : <span className="text-xs text-slate-300">—</span>; }, width: 120 },
  ];

  const novomaticCols = [
    { title: 'Weekday', key: '_weekday', render: (_, r) => <span className="text-xs">{r._weekday}</span>, width: 130 },
    { title: 'Slot Code', key: '_slotCode', render: (_, r) => (
      <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => navigate(`/machines/${r.machine_id}`)}>
        {r._slotCode}
      </Button>
    ), width: 120 },
    { title: 'Manufacturer', key: '_manufacturer', render: (_, r) => <Tag color="purple" className="!text-[10px] uppercase">{r._manufacturer}</Tag>, width: 110 },
    { title: 'Cashier', key: '_cashier', render: (_, r) => <span className="text-xs">{r._cashier}</span>, width: 130 },
    { title: 'Opening Meter', key: '_opening', render: (_, r) => <span className="font-semibold">{r._opening?.toLocaleString() ?? '—'}</span>, width: 120 },
    { title: 'Closing Meter', key: '_closing', render: (_, r) => <span className="font-semibold">{r._closing?.toLocaleString() ?? '—'}</span>, width: 120 },
    { title: 'Total Credits', key: '_totalCredits', render: (_, r) => <span className="font-semibold">{r._totalCredits?.toLocaleString() ?? '—'}</span>, width: 120 },
    { title: 'Amount', key: 'gross_tzs', render: (_, r) => <span className="font-semibold">{fmt(r.gross_tzs)}</span>, width: 130 },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'approved' ? 'green' : v === 'supervisor_approved' ? 'blue' : v === 'disputed' ? 'red' : 'orange'} className="!text-[10px] uppercase">{v === 'supervisor_approved' ? 'Sup. Approved' : v}</Tag>, width: 120 },
  ];

  if (isLoading) return <Spin size="large" className="block mx-auto mt-20" />;
  if (!shop) {
    return (
      <div>
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(backPath)}>Back</Button>
        <p className="mt-4">Shop not found.</p>
      </div>
    );
  }

  const addr = shop.address || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => navigate(backPath)}
            className="!text-slate-500 hover:!text-brand-dark flex items-center justify-center" />
          <h4 className="text-base font-bold text-slate-800 m-0">{shop.name}</h4>
          <Tag color={STATUS_COLORS[shop.status]} className="!text-[10px] uppercase !m-0">{shop.status}</Tag>
          <Tag color={isSlot ? 'purple' : 'blue'} className="!text-[10px] !m-0">{isSlot ? 'Slot Shop' : 'Meteora Shop'}</Tag>
        </div>
      </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <KpiCard title="Total Machines" value={displayMachines.length} icon={Cpu} bgColor="bg-indigo-50" iconColor="text-indigo-600" />
        <KpiCard title="Gross Revenue" value={perfSummary?.gross || 0} formatter={fmt} icon={TrendingUp} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard title="Net Revenue" value={perfSummary?.net || 0} formatter={fmt} icon={DollarSign} bgColor="bg-blue-50" iconColor="text-blue-600" />
        {isSlot ? (
          <KpiCard title="Total Expenses" value={totalExpenses} formatter={fmt} icon={Receipt} bgColor="bg-rose-50" iconColor="text-rose-600" />
        ) : (
          <KpiCard title="Office Share" value={perfSummary?.office || 0} formatter={fmt} icon={PiggyBank} bgColor="bg-amber-50" iconColor="text-amber-600" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border border-slate-100 p-4 bg-white">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <Store size={14} className="text-brand-dark" /> Shop Details
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-slate-400 text-xs">Name</span>
              <p className="font-semibold text-slate-700">{shop.name}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">{isSlot ? 'Supervisor' : 'Partner'}</span>
              <p className="font-semibold text-slate-700">
                {isSlot
                  ? (shop.supervisor
                    ? <>
                        <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold !text-sm"
                          onClick={() => navigate(`/staff/employees/${shop.supervisor.id}`)}>
                          {shop.supervisor.full_name}
                        </Button>
                      </>
                    : <span className="text-slate-300">—</span>)
                  : (shop.partner?.name || <span className="text-slate-300">—</span>)}
              </p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Phone</span>
              <p className="font-semibold text-slate-700">{isSlot ? (shop.supervisor?.phone || <span className="text-slate-300">—</span>) : (shop.phone || <span className="text-slate-300">—</span>)}</p>
            </div>
            {isSlot && (
              <div>
                <span className="text-slate-400 text-xs">Shop Type</span>
                <p><Tag color="purple" className="!text-[10px]">Slot Shop</Tag></p>
              </div>
            )}
            <div>
              <span className="text-slate-400 text-xs">Documents</span>
              <p>
                {(shop.documents || []).length > 0
                  ? shop.documents.map((d, i) => (
                      <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs mb-0.5">
                        <FileText size={12} /> {d.name || `Doc ${i + 1}`}
                      </a>
                    ))
                  : <span className="text-slate-300">—</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 p-4 bg-white">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <MapPin size={14} className="text-brand-dark" /> Address
          </h5>
          {addr.id ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-slate-400 text-xs">Street</span>
                <p className="font-semibold text-slate-700">{addr.streetData?.name || addr.street || <span className="text-slate-300">—</span>}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Ward</span>
                <p className="font-semibold text-slate-700">{addr.wardData?.name || addr.ward || <span className="text-slate-300">—</span>}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">District</span>
                <p className="font-semibold text-slate-700">{addr.districtData?.name || <span className="text-slate-300">—</span>}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Region</span>
                <p className="font-semibold text-slate-700">{addr.region?.name || <span className="text-slate-300">—</span>}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Country</span>
                <p className="font-semibold text-slate-700">{addr.country || 'Tanzania'}</p>
              </div>
              {(shop.lat || shop.lng) && (
                <div>
                  <span className="text-slate-400 text-xs">GPS</span>
                  <p className="font-semibold text-slate-700">
                    <a href={`https://www.google.com/maps?q=${shop.lat},${shop.lng}`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs">
                      <ExternalLink size={12} /> {Number(shop.lat).toFixed(4)}, {Number(shop.lng).toFixed(4)}
                    </a>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No address recorded</p>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border border-slate-100 p-4 bg-white mb-6">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-brand-dark" /> Monthly Revenue Trend
          </h5>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <RechartsTooltip formatter={(v) => [`${(v || 0).toLocaleString()} TZS`, 'Gross']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="gross" fill="#021559" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="rounded-lg border border-slate-100 p-6 bg-white mb-6 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">No collection data yet for revenue trend</p>
        </div>
      )}

      <div className="rounded-lg border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 m-0">
            <History size={14} className="text-brand-dark" /> {isSlot ? 'Novomatic Collection History' : 'Meteora Machines'} ({isSlot ? collectionRows.length : displayMachines.length})
          </h5>
        </div>
        {isSlot ? (
          <Table dataSource={collectionRows} columns={novomaticCols} rowKey="id" size="middle" pagination={{ pageSize: 10, showSizeChanger: false }}
            summary={() => {
              const totalAmount = collectionRows.reduce((s, r) => s + (r.gross_tzs || 0), 0);
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row className="bg-slate-50">
                    <Table.Summary.Cell index={0} colSpan={7}>
                      <span className="font-semibold text-xs text-slate-600">TOTAL ({collectionRows.length} collections)</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7}>
                      <span className="font-semibold">{fmt(totalAmount)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} />
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }} />
        ) : displayMachines.length > 0 ? (
          <Table dataSource={displayMachines} columns={machineCols} rowKey="id" size="middle" pagination={{ pageSize: 10, showSizeChanger: false }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row className="bg-slate-50">
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <span className="font-semibold text-xs text-slate-600">TOTAL ({displayMachines.length} machines)</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3}>
                    <span className="font-semibold">{fmt(displayMachines.reduce((s, m) => s + (latestPerf(m)?.gross_tzs || 0), 0))}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>
                    <span className="font-semibold">{fmt(displayMachines.reduce((s, m) => s + (latestPerf(m)?.net_tzs || 0), 0))}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>
                    <span className="font-semibold">{fmt(displayMachines.reduce((s, m) => s + (latestPerf(m)?.office_tzs || 0), 0))}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6}>
                    <span className="font-semibold">{fmt(displayMachines.reduce((s, m) => s + (latestPerf(m)?.owner_tzs || 0), 0))}</span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )} />
        ) : (
          <div className="p-10 text-center bg-white">
            <Cpu className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No {isSlot ? 'Novomatic' : 'Meteora'} machines assigned</p>
          </div>
        )}
      </div>

      {isSlot && (
        <div className="rounded-lg border border-slate-100 overflow-hidden mt-6">
          <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 m-0">
              <Receipt size={14} className="text-brand-dark" /> Expenses ({Array.isArray(expenses) ? expenses.length : 0})
              <span className="font-normal normal-case text-slate-400">| Total {fmt(totalExpenses)}</span>
            </h5>
          </div>
          {Array.isArray(expenses) && expenses.length > 0 ? (
            <Table dataSource={expenses} columns={[
              { title: 'Date', dataIndex: 'created_at', render: (v) => dayjs(v).format('DD MMM YYYY'), width: 120 },
              { title: 'Category', key: 'category', render: (_, r) => r.category?.name || '—', width: 120 },
              { title: 'Amount', dataIndex: 'amount', render: (v) => <span className="font-semibold">{fmt(v)}</span>, width: 130 },
              { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'approved' ? 'green' : v === 'rejected' ? 'red' : 'orange'} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
              { title: 'Description', dataIndex: 'description', render: (v) => <span className="text-xs text-slate-600 line-clamp-1">{v}</span> },
            ]} rowKey="id" size="middle" pagination={{ pageSize: 5, showSizeChanger: false }} />
          ) : (
            <div className="p-8 text-center bg-white">
              <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">No expenses recorded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
