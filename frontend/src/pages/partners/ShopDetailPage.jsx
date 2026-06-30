import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Descriptions, Tag, Table, Button, Tabs, Spin, Typography, Statistic } from 'antd';
import { ArrowLeft, FileText, MapPin } from 'lucide-react';
import { shopsAPI, inventoryAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

const SHOP_TYPES = { slot_only: 'Slot Only', bar: 'Bar + Slot', grocery: 'Grocery + Slot', mixed: 'Mixed' };
const TYPE_COLORS = { slot_only: 'blue', bar: 'purple', grocery: 'green', mixed: 'orange' };
const STATUS_COLORS = { active: 'green', inactive: 'red', suspended: 'orange' };
const LABEL_COLORS = { Bentabet: 'green', Dante: 'green', Meteora: 'blue', Other: 'orange' };
const MFG_COLORS = { Meteora: 'blue', Novomatic: 'purple', EGT: 'orange' };
const PAYMENT_COLORS = { cash: 'green', card: 'blue', mobile: 'purple', credit: 'orange' };

const KpiStat = ({ title, value, suffix }) => (
  <Card size="small" className="text-center border border-slate-100">
    <Statistic title={<span className="text-xs font-semibold text-slate-500">{title}</span>} value={value ?? 0} suffix={suffix}
      valueStyle={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }} />
  </Card>
);

export default function ShopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: shop, isLoading } = useQuery({
    queryKey: ['shop', id],
    queryFn: () => shopsAPI.get(id).then((r) => r.data.data),
  });

  const partnerLabel = shop?.partner?.label;
  const showSales = partnerLabel === 'Bentabet' || partnerLabel === 'Dante';

  const { data: salesData } = useQuery({
    queryKey: ['shop-sales', id],
    queryFn: () => inventoryAPI.listSales({ shop_id: id }).then((r) => r.data.data),
    enabled: showSales,
  });

  if (isLoading) return <Spin size="large" className="block mx-auto mt-20" />;
  if (!shop) {
    return (
      <div>
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/shops')}>Back</Button>
        <p className="mt-4">Shop not found.</p>
      </div>
    );
  }

  const machines = shop.machines || [];
  const perfSummary = machines.length > 0
    ? machines.reduce((acc, m) => {
        const p = m.performance || [];
        p.forEach((r) => {
          acc.gross += r.gross_tzs || 0;
          acc.net += r.net_tzs || 0;
          acc.office += r.office_tzs || 0;
          acc.owner += r.owner_tzs || 0;
        });
        return acc;
      }, { gross: 0, net: 0, office: 0, owner: 0 })
    : null;
  const latestPerf = (m) => (m.performance && m.performance[0]) || null;

  const machineCols = [
    { title: 'Slot Code', dataIndex: 'slot_code' },
    { title: 'Manufacturer', dataIndex: 'manufacturer', render: (v) => <Tag color={MFG_COLORS[v]}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: 'Latest Gross', key: 'gross', render: (_, r) => { const p = latestPerf(r); return p ? p.gross_tzs?.toLocaleString() : '—'; } },
    { title: 'Latest Net', key: 'net', render: (_, r) => { const p = latestPerf(r); return p ? p.net_tzs?.toLocaleString() : '—'; } },
    { title: 'Office Share', key: 'office', render: (_, r) => { const p = latestPerf(r); return p ? p.office_tzs?.toLocaleString() : '—'; } },
    { title: 'Owner Share', key: 'owner', render: (_, r) => { const p = latestPerf(r); return p ? p.owner_tzs?.toLocaleString() : '—'; } },
  ];

  const sales = Array.isArray(salesData) ? salesData : [];
  const salesTotal = sales.reduce((s, r) => s + (r.net_amount_tzs || 0), 0);

  const salesCols = [
    { title: 'Date', dataIndex: 'sale_date', render: (v) => dayjs(v).format('DD MMM YYYY HH:mm') },
    { title: 'Customer', dataIndex: 'customer_name', render: (v) => v || '—' },
    { title: 'Items', key: 'items', render: (_, r) => (r.items || []).map((i) => i.product?.name || `#${i.product_id}`).join(', ') || '—' },
    { title: 'Total (TZS)', dataIndex: 'total_amount_tzs', render: (v) => v?.toLocaleString() },
    { title: 'Net (TZS)', dataIndex: 'net_amount_tzs', render: (v) => v?.toLocaleString() },
    { title: 'Payment', dataIndex: 'payment_method', render: (v) => <Tag color={PAYMENT_COLORS[v]}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'completed' ? 'green' : 'orange'}>{v}</Tag> },
  ];

  const addr = shop.address;

  const tabItems = [
    {
      key: 'machines',
      label: `Machines & Performance (${machines.length})`,
      children: (
        <div>
          {perfSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <KpiStat title="Total Machines" value={machines.length} />
              <KpiStat title="Gross" value={perfSummary.gross} suffix="TZS" />
              <KpiStat title="Net" value={perfSummary.net} suffix="TZS" />
              <KpiStat title="Office Share" value={perfSummary.office} suffix="TZS" />
              <KpiStat title="Owner Share" value={perfSummary.owner} suffix="TZS" />
            </div>
          )}
          <Table dataSource={machines} columns={machineCols} rowKey="id" size="small" pagination={false} />
        </div>
      ),
    },
  ];

  if (showSales) {
    tabItems.push({
      key: 'sales',
      label: `Sales (${sales.length})`,
      children: (
        <div>
          {sales.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <KpiStat title="Total Transactions" value={sales.length} />
              <KpiStat title="Total Revenue" value={salesTotal} suffix="TZS" />
              <KpiStat title="Cash" value={sales.filter((s) => s.payment_method === 'cash').reduce((a, s) => a + (s.net_amount_tzs || 0), 0)} suffix="TZS" />
              <KpiStat title="Mobile/Card" value={sales.filter((s) => s.payment_method !== 'cash').reduce((a, s) => a + (s.net_amount_tzs || 0), 0)} suffix="TZS" />
            </div>
          )}
          <Table dataSource={sales} columns={salesCols} rowKey="id" size="small" pagination={{ pageSize: 15 }} />
        </div>
      ),
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/shops')} />
          <Title level={4} className="!m-0">{shop.name}</Title>
          <Tag color={STATUS_COLORS[shop.status]}>{shop.status?.toUpperCase()}</Tag>
        </div>
        <Button type="primary" icon={<ArrowLeft size={14} />} onClick={() => navigate('/shops')}
          className="!bg-brand-dark hover:!bg-brand-light">
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="border border-slate-100" size="small" title={<span className="text-sm font-bold text-slate-700">Shop Details</span>}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Shop Name"><strong>{shop.name}</strong></Descriptions.Item>
            <Descriptions.Item label="Partner">{shop.partner?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Label">
              {shop.partner?.label ? <Tag color={LABEL_COLORS[shop.partner.label]}>{shop.partner.label}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Type"><Tag color={TYPE_COLORS[shop.type]}>{SHOP_TYPES[shop.type] || shop.type}</Tag></Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[shop.status]}>{shop.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="Contract">
              {shop.contract_url ? (
                <a href={shop.contract_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  <FileText size={14} /> View Contract
                </a>
              ) : '—'}
            </Descriptions.Item>
            {(shop.documents || []).length > 0 && (
              <Descriptions.Item label="Documents">
                <div className="flex flex-col gap-1">
                  {shop.documents.map((d, i) => (
                    <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                      <FileText size={14} /> {d.name || `Document ${i + 1}`}
                    </a>
                  ))}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Card className="border border-slate-100" size="small" title={<span className="text-sm font-bold text-slate-700">Address</span>}>
          {addr ? (
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-blue-50 h-fit">
                <MapPin size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">{addr.streetData?.name || addr.street || '—'}</p>
                <p className="text-sm text-slate-600">Ward: {addr.wardData?.name || addr.ward || '—'}</p>
                <p className="text-sm text-slate-600">District: {addr.districtData?.name || '—'}</p>
                <p className="text-sm text-slate-600">Region: {addr.region?.name || '—'}</p>
                <p className="text-sm text-slate-600">Country: {addr.country || 'Tanzania'}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No address recorded</p>
          )}
        </Card>
      </div>

      <Tabs items={tabItems} />
    </div>
  );
}
