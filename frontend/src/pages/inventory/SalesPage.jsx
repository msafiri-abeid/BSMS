import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, Drawer, Empty, App, List } from 'antd';
import { Plus, ShoppingCart, DollarSign, Percent, TrendingUp, FileDown, X, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { inventoryAPI, shopsAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function SalesPage() {
  const [searchParams] = useSearchParams();
  const [selectedShop, setSelectedShop] = useState(null);
  const [saleDrawerOpen, setSaleDrawerOpen] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [saleForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [saleItems, setSaleItems] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { message } = App.useApp();
  const qc = useQueryClient();

  const isQuickSale = searchParams.get('quick') === '1';

  useEffect(() => {
    if (isQuickSale && selectedShop) {
      setSaleDrawerOpen(true);
    }
  }, [isQuickSale, selectedShop]);

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => ['Bentabet', 'Dante'].includes(s.partner?.label) && ['bar', 'grocery', 'mixed'].includes(s.type));

  const { data: products } = useQuery({
    queryKey: ['products', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.products({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', selectedShop, search],
    queryFn: () => selectedShop ? inventoryAPI.listSales({ shop_id: selectedShop, search: search || undefined }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const { data: salesReport } = useQuery({
    queryKey: ['sales-report', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.getSaleReport({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve(null),
    enabled: !!selectedShop,
  });

  const recordSaleMutation = useMutation({
    mutationFn: (data) => inventoryAPI.recordSale(data),
    onSuccess: () => {
      message.success('Sale recorded');
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sales-report'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      saleForm.resetFields();
      setSaleItems([]);
      setSaleDrawerOpen(false);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (data) => inventoryAPI.recordPayment(selectedSaleId, data),
    onSuccess: () => {
      message.success('Payment recorded');
      qc.invalidateQueries({ queryKey: ['sales'] });
      paymentForm.resetFields();
      setPaymentDrawerOpen(false);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const handleAddItem = (productId, qtyVal, unitPrice) => {
    if (!productId || !qtyVal || !unitPrice) return;
    const prod = products.find(p => p.id === productId);
    setSaleItems([...saleItems, {
      key: Date.now(),
      product_id: productId,
      product_name: prod?.name || 'Product',
      qty: qtyVal,
      unit_price_tzs: unitPrice,
      discount_pct: 0,
    }]);
    setSelectedProduct(null);
    setQty(1);
    setPrice(0);
  };

  const handleRemoveItem = (key) => {
    setSaleItems(saleItems.filter(item => item.key !== key));
  };

  const calculateTotals = () => {
    let total = 0;
    saleItems.forEach(item => {
      const lineTotal = (item.unit_price_tzs * item.qty) - ((item.discount_pct || 0) * (item.unit_price_tzs * item.qty) / 100);
      total += lineTotal;
    });
    return total;
  };

  const handleExportSelected = () => {
    const rows = sales?.rows || sales || [];
    const selected = (Array.isArray(rows) ? rows : []).filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Date', 'Customer', 'Items', 'Amount', 'Method'].join(','),
      ...selected.map(r =>
        [dayjs(r.sale_date).format('DD MMM YYYY'), r.customer_name || 'Walk-in', r.items?.length || 0, r.net_amount_tzs, r.payment_method].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sales-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const rows = Array.isArray(sales) ? sales : sales?.rows || [];

  const cols = [
    { title: 'Date', dataIndex: 'sale_date', render: (d) => dayjs(d).format('DD MMM YYYY HH:mm'), width: 140 },
    { title: 'Customer', dataIndex: 'customer_name', render: (v) => v || 'Walk-in', width: 140 },
    { title: 'Items', dataIndex: 'items', render: (items) => items?.length || 0, width: 60 },
    { title: 'Amount', dataIndex: 'net_amount_tzs', render: (v) => <span className="font-semibold">{fmt(v)}</span>, width: 120 },
    { title: 'Method', dataIndex: 'payment_method', render: (m) => <Tag className="!text-[10px] uppercase">{m}</Tag>, width: 100 },
    {
      title: 'Actions', width: 120,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => setSelectedSaleId(r.id)} className="!text-xs">View</Button>
          <Button size="small" type="link" onClick={() => { setSelectedSaleId(r.id); setPaymentDrawerOpen(true); }} className="!text-xs">Payment</Button>
        </Space>
      ),
    },
  ];

  const mobileFields = [
    { key: 'customer', dataIndex: 'customer_name' },
    { key: 'amount', label: 'Amount', dataIndex: 'net_amount_tzs' },
    { key: 'method', label: 'Method', dataIndex: 'payment_method' },
  ];

  const hasFilters = search || !!selectedShop;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Sales</h4>
          <span className="text-xs text-slate-500">{rows.length} transactions</span>
        </div>
        <Space>
          <Select placeholder="Select shop" className="w-[200px]"
            onChange={(v) => { setSelectedShop(v); setSelectedRowKeys([]); }}
            allowClear showSearch optionFilterProp="children">
            {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
          </Select>
          <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setSaleDrawerOpen(true)}
            className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
            Record Sale
          </Button>
        </Space>
      </div>

      {/* KPI Cards */}
      {selectedShop && salesReport && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <KpiCard title="Total Sales" value={salesReport.total_sales || 0} icon={ShoppingCart} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={false} />
          <KpiCard title="Total Revenue" value={salesReport.net_total || 0} icon={DollarSign} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={fmt} />
          <KpiCard title="Total Discount" value={salesReport.total_discount || 0} icon={Percent} bgColor="bg-amber-50" iconColor="text-amber-600" formatter={fmt} />
          <KpiCard title="Gross Profit" value={(salesReport.net_total || 0) - ((salesReport.by_product ? Object.values(salesReport.by_product).reduce((s, p) => s + p.cost, 0) : 0))} icon={TrendingUp} bgColor="bg-purple-50" iconColor="text-purple-600" formatter={fmt} />
        </div>
      )}

      {!selectedShop && (
        <div className="text-center py-12 text-slate-400">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a shop to view sales</p>
        </div>
      )}

      {selectedShop && (
        <>
          {/* Filters */}
          <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
            <Space wrap size={[8, 8]}>
              <Input.Search size="small" placeholder="Search customer..." allowClear
                defaultValue={search}
                onSearch={(v) => setSearch(v || '')}
                className="w-full sm:w-56" />
              {hasFilters && (
                <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => { setSearch(''); }}
                  className="flex items-center gap-1 !text-xs hover:!border-brand-dark hover:!text-brand-dark">
                  Clear
                </Button>
              )}
            </Space>
          </div>

          {/* Bulk Action Bar */}
          {selectedRowKeys.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
              <span className="text-sm font-medium text-brand-dark">{selectedRowKeys.length} selected</span>
              <Space>
                <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} onClick={handleExportSelected}
                  className="group flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
                  Export Selected
                </Button>
                <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setSelectedRowKeys([])}
                  className="flex items-center gap-1 !text-xs">
                  Deselect
                </Button>
              </Space>
            </div>
          )}

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <Table dataSource={rows} columns={cols} rowKey="id" loading={isLoading}
              size="middle"
              rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
              pagination={{ total: rows.length, pageSize: 20 }} />
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-2">
            {rows.length === 0 ? (
              <Empty description="No sales found" />
            ) : (
              <List
                dataSource={rows}
                renderItem={(r) => (
                  <MobileCard
                    record={r}
                    fields={mobileFields}
                    onClick={() => {}}
                    statusColor="blue"
                  />
                )}
              />
            )}
          </div>
        </>
      )}

      {/* Record Sale Drawer */}
      <Drawer title={<span className="text-sm font-bold text-slate-700">Record New Sale</span>}
        placement="right" onClose={() => setSaleDrawerOpen(false)}
        open={saleDrawerOpen} width={600}>
        <Form form={saleForm} layout="vertical">
          <Form.Item label={<span className="text-xs font-semibold text-slate-600">Customer Name</span>}>
            <Input placeholder="Optional" onChange={(e) => saleForm.setFieldValue('customer_name', e.target.value)} />
          </Form.Item>

          <div className="mb-4">
            <h5 className="text-xs font-bold text-slate-700 mb-2">Add Items</h5>
            <div className="flex gap-2 mb-2 items-start">
              <div className="flex-[3]">
                <Select placeholder="Select product" className="w-full"
                  value={selectedProduct}
                  onChange={(val) => {
                    setSelectedProduct(val);
                    const p = products?.find(pr => pr.id === val);
                    setPrice(p?.selling_price || 0);
                  }}
                  showSearch filterOption={(i, o) => o.children.toLowerCase().includes(i.toLowerCase())}>
                  {(products || []).map(p => (
                    <Option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stockLevel?.current_qty || 0})
                    </Option>
                  ))}
                </Select>
              </div>
              <InputNumber placeholder="Qty" min={1} value={qty} onChange={setQty} className="w-[70px]" />
              <InputNumber placeholder="Price" min={0} value={price} onChange={setPrice} className="w-[120px]" />
              <Button size="small" className="!bg-brand-dark text-white border-none"
                onClick={() => handleAddItem(selectedProduct, qty, price)}>
                Add
              </Button>
            </div>

            {saleItems.length > 0 ? (
              <Table dataSource={saleItems}
                columns={[
                  { title: 'Product', dataIndex: 'product_name' },
                  { title: 'Qty', dataIndex: 'qty' },
                  { title: 'Price', dataIndex: 'unit_price_tzs', render: v => fmt(v) },
                  {
                    title: '', render: (_, r) => (
                      <Button size="small" danger type="text" onClick={() => handleRemoveItem(r.key)}>
                        <X className="w-3 h-3" />
                      </Button>
                    ),
                  },
                ]}
                rowKey="key" pagination={false} size="small" />
            ) : (
              <Empty description="No items added" className="my-4" />
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-lg mb-4 text-right">
            <span className="text-base font-bold">Total: {fmt(Math.round(calculateTotals()))}</span>
          </div>

          <Form.Item label={<span className="text-xs font-semibold text-slate-600">Discount (TZS)</span>}>
            <InputNumber min={0} />
          </Form.Item>

          <Form.Item label={<span className="text-xs font-semibold text-slate-600">Payment Method</span>} rules={[{ required: true }]}>
            <Select placeholder="Select method">
              <Option value="cash">Cash</Option>
              <Option value="card">Card</Option>
              <Option value="mobile">Mobile</Option>
              <Option value="credit">Credit</Option>
            </Select>
          </Form.Item>

          <Space>
            <Button type="primary" className="!bg-brand-dark hover:!bg-brand-light border-none"
              onClick={() => {
                const formData = saleForm.getFieldsValue();
                recordSaleMutation.mutate({
                  shop_id: selectedShop,
                  items: saleItems,
                  customer_name: formData.customer_name,
                  discount_amount_tzs: formData.discount || 0,
                  payment_method: formData.payment_method,
                });
              }}
              loading={recordSaleMutation.isPending}>
              Save Sale
            </Button>
            <Button onClick={() => setSaleDrawerOpen(false)}>Cancel</Button>
          </Space>
        </Form>
      </Drawer>

      {/* Record Payment Drawer */}
      <Drawer title={<span className="text-sm font-bold text-slate-700">Record Payment</span>}
        placement="right" onClose={() => setPaymentDrawerOpen(false)}
        open={paymentDrawerOpen} width={500}>
        <Form form={paymentForm} layout="vertical"
          onFinish={(values) => recordPaymentMutation.mutate(values)}>
          <Form.Item name="amount_tzs" label={<span className="text-xs font-semibold text-slate-600">Amount (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="payment_method" label={<span className="text-xs font-semibold text-slate-600">Payment Method</span>} rules={[{ required: true }]}>
            <Select><Option value="cash">Cash</Option><Option value="card">Card</Option><Option value="mobile">Mobile</Option></Select>
          </Form.Item>
          <Form.Item name="reference" label={<span className="text-xs font-semibold text-slate-600">Reference</span>}>
            <Input />
          </Form.Item>
          <Form.Item name="notes" label={<span className="text-xs font-semibold text-slate-600">Notes</span>}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" className="!bg-brand-dark hover:!bg-brand-light border-none"
              loading={recordPaymentMutation.isPending}>
              Record Payment
            </Button>
            <Button onClick={() => setPaymentDrawerOpen(false)}>Cancel</Button>
          </Space>
        </Form>
      </Drawer>
    </div>
  );
}
