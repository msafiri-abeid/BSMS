import { useState } from 'react';
import { Table, Select, Space, DatePicker, Button, Tabs, Card, Statistic, App, List, Empty } from 'antd';
import { DollarSign, ShoppingCart, TrendingUp, TrendingDown, BarChart3, Box, FileDown, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function AccountingPage() {
  const [selectedShop, setSelectedShop] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [marginRowKeys, setMarginRowKeys] = useState([]);
  const [valuationRowKeys, setValuationRowKeys] = useState([]);
  const { message } = App.useApp();

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => ['Bentabet', 'Dante'].includes(s.partner?.label) && ['bar', 'grocery', 'mixed'].includes(s.type));

  const { data: profitLoss } = useQuery({
    queryKey: ['profit-loss', selectedShop, dateRange],
    queryFn: () => selectedShop
      ? inventoryAPI.getShopProfitLoss({ shop_id: selectedShop, start_date: dateRange[0]?.format('YYYY-MM-DD'), end_date: dateRange[1]?.format('YYYY-MM-DD') }).then(r => r.data.data)
      : Promise.resolve(null),
    enabled: !!selectedShop,
  });

  const { data: margins } = useQuery({
    queryKey: ['margins', selectedShop],
    queryFn: () => (selectedShop ? inventoryAPI.getProductMargins({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([])),
    enabled: !!selectedShop,
  });

  const { data: valuation } = useQuery({
    queryKey: ['valuation', selectedShop],
    queryFn: () => (selectedShop ? inventoryAPI.getInventoryValuation({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve(null)),
    enabled: !!selectedShop,
  });

  const { data: dailyReport } = useQuery({
    queryKey: ['daily-report', selectedShop],
    queryFn: () => selectedShop
      ? inventoryAPI.getDailyReport({ shop_id: selectedShop, date: dayjs().format('YYYY-MM-DD') }).then(r => r.data.data)
      : Promise.resolve(null),
    enabled: !!selectedShop,
  });

  const marginRows = Array.isArray(margins) ? margins : [];
  const valuationRows = valuation?.items || [];
  const profitByProductData = profitLoss?.by_product
    ? Object.entries(profitLoss.by_product).map(([key, value]) => ({ product: key, ...value }))
    : [];

  const handleExport = (rows, selectedKeys, prefix, cols) => {
    const selected = rows.filter(r => selectedKeys.includes(r.id || r.product_id));
    if (selected.length === 0) return;
    const header = cols.map(c => c.title).join(',');
    const csv = [
      header,
      ...selected.map(r => cols.map(c => {
        const val = c.dataIndex ? r[c.dataIndex] : c.render ? '-' : '-';
        return val !== undefined && val !== null ? val : '-';
      }).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${prefix}-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const marginCols = [
    { title: 'Product', dataIndex: 'name', width: 150 },
    { title: 'Category', dataIndex: 'category', width: 100, responsive: ['md'] },
    { title: 'Purchase Price', dataIndex: 'purchase_price', render: (v) => fmt(v), width: 120 },
    { title: 'Selling Price', dataIndex: 'selling_price', render: (v) => fmt(v), width: 120 },
    { title: 'Margin', dataIndex: 'margin_tzs', render: (v) => <span className="font-semibold">{fmt(v)}</span>, width: 100 },
    { title: 'Margin %', dataIndex: 'margin_pct', render: (v) => `${v}%`, width: 90 },
    { title: 'Stock', dataIndex: 'current_stock', width: 60 },
    { title: 'Stock Value', dataIndex: 'stock_value_cost', render: (v) => fmt(v), width: 120, responsive: ['md'] },
  ];

  const valuationCols = [
    { title: 'Product', dataIndex: 'name', width: 150 },
    { title: 'Category', dataIndex: 'category', width: 100, responsive: ['md'] },
    { title: 'Qty', dataIndex: 'qty', width: 60 },
    { title: 'Unit Cost', dataIndex: 'unit_cost', render: (v) => fmt(v), width: 100 },
    { title: 'Total Cost', dataIndex: 'total_cost_value', render: (v) => fmt(v), width: 110 },
    { title: 'Total Retail', dataIndex: 'total_retail_value', render: (v) => fmt(v), width: 110 },
    { title: 'Potential Profit', dataIndex: 'potential_profit', render: (v) => <span className="font-semibold">{fmt(v)}</span>, width: 120 },
  ];

  const pnlMobileFields = [
    { key: 'product', dataIndex: 'product' },
    { key: 'revenue', label: 'Revenue', render: (_, r) => fmt(r.revenue) },
    { key: 'profit', label: 'Profit', render: (_, r) => fmt(r.gross_profit) },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Accounting & Reports</h4>
          <span className="text-xs text-slate-500">{selectedShop ? 'Profit & loss, margins, valuation' : 'Select a shop'}</span>
        </div>
        <Select placeholder="Select shop" className="w-[250px]"
          onChange={(v) => { setSelectedShop(v); setMarginRowKeys([]); setValuationRowKeys([]); }}
          allowClear showSearch optionFilterProp="children">
          {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
        </Select>
      </div>

      {!selectedShop && (
        <div className="text-center py-12 text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a shop to view accounting reports</p>
        </div>
      )}

      {selectedShop && (
        <>
          {/* Page-level KPI summary */}
          {dailyReport && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <KpiCard title="Today's Revenue" value={dailyReport.net_sales || 0} icon={DollarSign} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
              <KpiCard title="Today's Profit" value={dailyReport.net_profit || 0} icon={TrendingUp} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={fmt} />
              <KpiCard title="Items Sold" value={dailyReport.items_sold || 0} icon={ShoppingCart} bgColor="bg-purple-50" iconColor="text-purple-600" formatter={false} />
              <KpiCard title="Transactions" value={dailyReport.num_transactions || 0} icon={BarChart3} bgColor="bg-amber-50" iconColor="text-amber-600" formatter={false} />
            </div>
          )}

          <Tabs defaultActiveKey="daily" items={[
            {
              key: 'daily',
              label: <span className="text-xs font-semibold">Daily Report</span>,
              children: dailyReport ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card size="small" className="border border-slate-100">
                    <Statistic title="Sales Transactions" value={dailyReport.num_transactions} prefix={<ShoppingCart className="w-4 h-4" />} />
                  </Card>
                  <Card size="small" className="border border-slate-100">
                    <Statistic title="Total Revenue" value={dailyReport.net_sales} prefix="TZS" valueStyle={{ fontSize: 20 }} />
                  </Card>
                  <Card size="small" className="border border-slate-100">
                    <Statistic title="Gross Profit" value={dailyReport.gross_profit} prefix="TZS" valueStyle={{ fontSize: 20 }} />
                  </Card>
                  <Card size="small" className="border border-slate-100">
                    <Statistic title="Net Profit" value={dailyReport.net_profit} valueStyle={{ color: dailyReport.net_profit > 0 ? '#059669' : '#dc2626', fontSize: 20 }} prefix={<TrendingUp className="w-4 h-4" />} />
                  </Card>
                  <Card size="small" className="border border-slate-100">
                    <Statistic title="Items Sold" value={dailyReport.items_sold} prefix={<Box className="w-4 h-4" />} />
                  </Card>
                  <Card size="small" className="border border-slate-100">
                    <Statistic title="Total Cost" value={dailyReport.total_cost} prefix="TZS" valueStyle={{ fontSize: 20 }} />
                  </Card>
                </div>
              ) : <Empty description="No daily report data" />,
            },
            {
              key: 'profitloss',
              label: <span className="text-xs font-semibold">Profit & Loss</span>,
              children: (
                <div>
                  <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
                    <Space wrap size={[8, 8]}>
                      <RangePicker value={dateRange} onChange={setDateRange} format="YYYY-MM-DD" />
                    </Space>
                  </div>
                  {profitLoss ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                        <Card size="small" className="border border-slate-100">
                          <Statistic title="Total Revenue" value={profitLoss.total_revenue} prefix="TZS" valueStyle={{ fontSize: 20 }} />
                        </Card>
                        <Card size="small" className="border border-slate-100">
                          <Statistic title="Total Cost" value={profitLoss.total_cost} prefix="TZS" valueStyle={{ fontSize: 20 }} />
                        </Card>
                        <Card size="small" className="border border-slate-100">
                          <Statistic title="Gross Profit" value={profitLoss.total_gross_profit} prefix="TZS" valueStyle={{ fontSize: 20 }} />
                        </Card>
                        <Card size="small" className="border border-slate-100">
                          <Statistic title="Net Profit" value={profitLoss.net_profit} valueStyle={{ color: profitLoss.net_profit > 0 ? '#059669' : '#dc2626', fontSize: 20 }} />
                        </Card>
                      </div>
                      <Card title={<span className="text-sm font-bold">Profit by Product</span>} size="small" className="border border-slate-100">
                        <Table dataSource={profitByProductData}
                          columns={[
                            { title: 'Product', dataIndex: 'product', width: 160 },
                            { title: 'Qty Sold', dataIndex: 'qty_sold', width: 80 },
                            { title: 'Revenue', dataIndex: 'revenue', render: v => fmt(v), width: 120 },
                            { title: 'Cost', dataIndex: 'cost', render: v => fmt(v), width: 120 },
                            { title: 'Gross Profit', dataIndex: 'gross_profit', render: v => <span className="font-semibold">{fmt(v)}</span>, width: 120 },
                            { title: 'Margin %', dataIndex: 'margin_pct', render: v => `${v}%`, width: 90 },
                          ]}
                          rowKey="product" pagination={false} size="middle"
                        />
                      </Card>
                      <div className="md:hidden space-y-2 mt-4">
                        {profitByProductData.length === 0 ? <Empty description="No data" /> : (
                          <List dataSource={profitByProductData} renderItem={(r) => (
                            <MobileCard record={r} fields={pnlMobileFields} onClick={() => {}} />
                          )} />
                        )}
                      </div>
                    </>
                  ) : <Empty description="No P&L data" />}
                </div>
              ),
            },
            {
              key: 'margins',
              label: <span className="text-xs font-semibold">Product Margins</span>,
              children: (
                <div>
                  {marginRowKeys.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-dark">{marginRowKeys.length} selected</span>
                      <Space>
                        <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} onClick={() => handleExport(marginRows, marginRowKeys, 'margins', marginCols)}
                          className="flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
                          Export Selected
                        </Button>
                        <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setMarginRowKeys([])}
                          className="flex items-center gap-1 !text-xs">Deselect</Button>
                      </Space>
                    </div>
                  )}
                  <div className="hidden md:block">
                    <Table dataSource={marginRows} columns={marginCols} rowKey="id"
                      size="middle"
                      rowSelection={{ selectedRowKeys: marginRowKeys, onChange: setMarginRowKeys }}
                      pagination={{ pageSize: 25 }} />
                  </div>
                  <div className="md:hidden space-y-2">
                    {marginRows.length === 0 ? <Empty description="No margins data" /> : (
                      <List dataSource={marginRows} renderItem={(r) => (
                        <MobileCard record={r} fields={[
                          { key: 'name', dataIndex: 'name' },
                          { key: 'margin', label: 'Margin', render: (_, r2) => fmt(r2.margin_tzs) },
                        ]} onClick={() => {}} />
                      )} />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'valuation',
              label: <span className="text-xs font-semibold">Inventory Valuation</span>,
              children: valuation ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <Card size="small" className="border border-slate-100">
                      <Statistic title="Total Items" value={valuation.total_qty_on_hand} prefix={<Box className="w-4 h-4" />} />
                    </Card>
                    <Card size="small" className="border border-slate-100">
                      <Statistic title="Valuation (Cost)" value={valuation.total_valuation_cost} prefix="TZS" valueStyle={{ fontSize: 20 }} />
                    </Card>
                    <Card size="small" className="border border-slate-100">
                      <Statistic title="Valuation (Retail)" value={valuation.total_valuation_retail} prefix="TZS" valueStyle={{ fontSize: 20 }} />
                    </Card>
                  </div>
                  {valuationRowKeys.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-dark">{valuationRowKeys.length} selected</span>
                      <Space>
                        <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} onClick={() => handleExport(valuationRows, valuationRowKeys, 'valuation', valuationCols)}
                          className="flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
                          Export Selected
                        </Button>
                        <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setValuationRowKeys([])}
                          className="flex items-center gap-1 !text-xs">Deselect</Button>
                      </Space>
                    </div>
                  )}
                  <div className="hidden md:block">
                    <Table dataSource={valuationRows} columns={valuationCols} rowKey="product_id"
                      size="middle"
                      rowSelection={{ selectedRowKeys: valuationRowKeys, onChange: setValuationRowKeys }}
                      pagination={{ pageSize: 25 }} />
                  </div>
                  <div className="md:hidden space-y-2">
                    {valuationRows.length === 0 ? <Empty description="No valuation data" /> : (
                      <List dataSource={valuationRows} renderItem={(r) => (
                        <MobileCard record={r} fields={[
                          { key: 'name', dataIndex: 'name' },
                          { key: 'qty', label: 'Qty', dataIndex: 'qty' },
                        ]} onClick={() => {}} />
                      )} />
                    )}
                  </div>
                </div>
              ) : <Empty description="No valuation data" />,
            },
          ]} />
        </>
      )}
    </div>
  );
}
