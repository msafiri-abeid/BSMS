import { useState } from 'react';
import { Table, Button, Modal, Form, Select, InputNumber, Input, Space, Tabs, Upload, App, List, Empty } from 'antd';
import { Plus, RefreshCw, FileDown, Upload as UploadIcon, X, Box, ArrowRightLeft, ClipboardCheck, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function StockManagementPage() {
  const [selectedShop, setSelectedShop] = useState(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [auditForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [stockForm] = Form.useForm();
  const [stockRowKeys, setStockRowKeys] = useState([]);
  const [auditRowKeys, setAuditRowKeys] = useState([]);
  const [transferRowKeys, setTransferRowKeys] = useState([]);
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => ['Bentabet', 'Dante'].includes(s.partner?.label) && ['bar', 'grocery', 'mixed'].includes(s.type));

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.products({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const { data: audits, isLoading: auditsLoading } = useQuery({
    queryKey: ['audits', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.listAudits({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ['transfers', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.listTransfers({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const productRows = Array.isArray(products) ? products : [];
  const auditRows = Array.isArray(audits) ? audits : [];
  const transferRows = Array.isArray(transfers) ? transfers : [];

  const lowStock = productRows.filter(p => (p.stockLevel?.current_qty || 0) <= (p.stockLevel?.reorder_level || 0) && p.stockLevel?.current_qty > 0).length;
  const outOfStock = productRows.filter(p => (p.stockLevel?.current_qty || 0) === 0).length;
  const inStock = productRows.filter(p => (p.stockLevel?.current_qty || 0) > (p.stockLevel?.reorder_level || 0)).length;
  const totalProducts = productRows.length;

  const startAuditMutation = useMutation({
    mutationFn: (data) => inventoryAPI.startAudit(data),
    onSuccess: () => { message.success('Audit started'); qc.invalidateQueries({ queryKey: ['audits'] }); auditForm.resetFields(); setAuditOpen(false); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const initTransferMutation = useMutation({
    mutationFn: (data) => inventoryAPI.initializeTransfer(data),
    onSuccess: () => { message.success('Transfer initialized'); qc.invalidateQueries({ queryKey: ['transfers'] }); transferForm.resetFields(); setTransferOpen(false); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const addStockMutation = useMutation({
    mutationFn: (fd) => inventoryAPI.addStock(fd),
    onSuccess: () => { message.success('Stock added'); qc.invalidateQueries({ queryKey: ['products'] }); stockForm.resetFields(); setStockOpen(false); },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const handleExport = (rows, selectedKeys, prefix) => {
    const selected = rows.filter(r => selectedKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Product', 'Category', 'Current Stock', 'Reorder Level'].join(','),
      ...selected.map(r => [r.product?.name, r.product?.category, r.stockLevel?.current_qty || 0, r.stockLevel?.reorder_level || 0].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${prefix}-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const stockCols = [
    { title: 'Product', dataIndex: ['product', 'name'], width: 160 },
    { title: 'Category', dataIndex: ['product', 'category'], width: 120 },
    { title: 'Current Stock', dataIndex: ['stockLevel', 'current_qty'], render: (qty) => <span className="font-semibold">{qty || 0}</span>, width: 110 },
    { title: 'Reorder Level', dataIndex: ['stockLevel', 'reorder_level'], width: 110, responsive: ['md'] },
    {
      title: 'Status', width: 110,
      render: (_, r) => {
        const qty = r.stockLevel?.current_qty || 0;
        const reorder = r.stockLevel?.reorder_level || 0;
        if (qty === 0) return <span className="text-red-600 font-semibold text-xs">Out of Stock</span>;
        if (qty <= reorder) return <span className="text-amber-600 font-semibold text-xs">Low Stock</span>;
        return <span className="text-green-600 font-semibold text-xs">OK</span>;
      },
    },
  ];

  const auditCols = [
    { title: 'Date', dataIndex: 'audit_date', render: (d) => dayjs(d).format('DD MMM YYYY'), width: 120 },
    { title: 'Status', dataIndex: 'status', render: (s) => <span className="capitalize text-xs font-semibold">{s}</span>, width: 90 },
    { title: 'Variance Items', dataIndex: 'total_variance_items', width: 110 },
    { title: 'Actions', width: 80, render: (_, r) => <Button size="small" type="link" className="!text-xs">View</Button> },
  ];

  const transferCols = [
    { title: 'Date', dataIndex: 'transfer_date', render: (d) => dayjs(d).format('DD MMM YYYY'), width: 120 },
    { title: 'Product', dataIndex: ['product', 'name'], width: 150 },
    { title: 'Qty', dataIndex: 'qty', width: 60 },
    { title: 'Status', dataIndex: 'status', render: (s) => <span className="capitalize text-xs font-semibold">{s}</span>, width: 90 },
    {
      title: 'Actions', width: 90,
      render: (_, r) => r.status === 'in_transit'
        ? <Button size="small" className="!bg-brand-dark text-white border-none !text-xs">Receive</Button>
        : <Button size="small" type="link" className="!text-xs">View</Button>,
    },
  ];

  const mobileStockFields = [
    { key: 'product', dataIndex: ['product', 'name'] },
    { key: 'stock', label: 'Stock', render: (_, r) => r.stockLevel?.current_qty || 0 },
    { key: 'status', label: 'Status', render: (_, r) => {
      const qty = r.stockLevel?.current_qty || 0;
      const reorder = r.stockLevel?.reorder_level || 0;
      return qty === 0 ? 'Out of Stock' : qty <= reorder ? 'Low Stock' : 'OK';
    }},
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Stock Management</h4>
          <span className="text-xs text-slate-500">{selectedShop ? `${totalProducts} products` : 'Select a shop'}</span>
        </div>
        <Select placeholder="Select shop" className="w-[250px]"
          onChange={(v) => { setSelectedShop(v); }}
          allowClear showSearch optionFilterProp="children">
          {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
        </Select>
      </div>

      {!selectedShop && (
        <div className="text-center py-12 text-slate-400">
          <Box className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a shop to view stock management</p>
        </div>
      )}

      {selectedShop && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <KpiCard title="Total Products" value={totalProducts} icon={Box} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={false} />
            <KpiCard title="In Stock" value={inStock} icon={RefreshCw} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={false} />
            <KpiCard title="Low Stock" value={lowStock} icon={X} bgColor="bg-amber-50" iconColor="text-amber-600" formatter={false} />
            <KpiCard title="Out of Stock" value={outOfStock} icon={X} bgColor="bg-red-50" iconColor="text-red-600" formatter={false} />
          </div>

          <Tabs defaultActiveKey="stock" items={[
            {
              key: 'stock',
              label: <span className="text-xs font-semibold">Current Stock</span>,
              children: (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Button size="small" icon={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={() => qc.invalidateQueries({ queryKey: ['products'] })}
                      className="flex items-center gap-1 !text-xs">
                      Refresh
                    </Button>
                  </div>
                  {stockRowKeys.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-dark">{stockRowKeys.length} selected</span>
                      <Space>
                        <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} onClick={() => handleExport(productRows, stockRowKeys, 'stock')}
                          className="flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
                          Export Selected
                        </Button>
                        <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setStockRowKeys([])}
                          className="flex items-center gap-1 !text-xs">Deselect</Button>
                      </Space>
                    </div>
                  )}
                  <div className="hidden md:block">
                    <Table dataSource={productRows} columns={stockCols} rowKey="id" loading={productsLoading}
                      size="middle" rowSelection={{ selectedRowKeys: stockRowKeys, onChange: setStockRowKeys }}
                      pagination={{ pageSize: 20 }} />
                  </div>
                  <div className="md:hidden space-y-2">
                    {productRows.length === 0 ? <Empty description="No products" /> : (
                      <List dataSource={productRows} renderItem={(r) => (
                        <MobileCard record={r} fields={mobileStockFields} onClick={() => {}} />
                      )} />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'audits',
              label: <span className="text-xs font-semibold">Stock Audits</span>,
              children: (
                <div>
                  <div className="mb-4">
                    <Button type="primary" icon={<ClipboardCheck className="w-4 h-4" />} onClick={() => setAuditOpen(true)}
                      className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
                      Start Audit
                    </Button>
                  </div>
                  {auditRowKeys.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-dark">{auditRowKeys.length} selected</span>
                      <Space>
                        <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} onClick={() => handleExport(auditRows, auditRowKeys, 'audits')}
                          className="flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
                          Export Selected
                        </Button>
                        <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setAuditRowKeys([])}
                          className="flex items-center gap-1 !text-xs">Deselect</Button>
                      </Space>
                    </div>
                  )}
                  <div className="hidden md:block">
                    <Table dataSource={auditRows} columns={auditCols} rowKey="id" loading={auditsLoading}
                      size="middle" rowSelection={{ selectedRowKeys: auditRowKeys, onChange: setAuditRowKeys }}
                      pagination={{ pageSize: 10 }} />
                  </div>
                  <div className="md:hidden space-y-2">
                    {auditRows.length === 0 ? <Empty description="No audits" /> : (
                      <List dataSource={auditRows} renderItem={(r) => (
                        <MobileCard record={r} fields={[{ key: 'date', dataIndex: 'audit_date' }, { key: 'status', dataIndex: 'status' }]} onClick={() => {}} />
                      )} />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'add-stock',
              label: <span className="text-xs font-semibold">Add Stock</span>,
              children: (
                <div>
                  <div className="mb-4">
                    <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setStockOpen(true)}
                      className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
                      Add Stock
                    </Button>
                  </div>
                  <div className="hidden md:block">
                    <Table dataSource={productRows} columns={stockCols} rowKey="id" loading={productsLoading}
                      size="middle" pagination={{ pageSize: 20 }} />
                  </div>
                  <div className="md:hidden space-y-2">
                    {productRows.length === 0 ? <Empty description="No products" /> : (
                      <List dataSource={productRows} renderItem={(r) => (
                        <MobileCard record={r} fields={mobileStockFields} onClick={() => {}} />
                      )} />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'transfers',
              label: <span className="text-xs font-semibold">Stock Transfers</span>,
              children: (
                <div>
                  <div className="mb-4">
                    <Button type="primary" icon={<ArrowRightLeft className="w-4 h-4" />} onClick={() => setTransferOpen(true)}
                      className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
                      New Transfer
                    </Button>
                  </div>
                  {transferRowKeys.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-brand-dark/5 border border-brand-dark/20 flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-dark">{transferRowKeys.length} selected</span>
                      <Space>
                        <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} onClick={() => handleExport(transferRows, transferRowKeys, 'transfers')}
                          className="flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
                          Export Selected
                        </Button>
                        <Button size="small" icon={<X className="w-3.5 h-3.5" />} onClick={() => setTransferRowKeys([])}
                          className="flex items-center gap-1 !text-xs">Deselect</Button>
                      </Space>
                    </div>
                  )}
                  <div className="hidden md:block">
                    <Table dataSource={transferRows} columns={transferCols} rowKey="id" loading={transfersLoading}
                      size="middle" rowSelection={{ selectedRowKeys: transferRowKeys, onChange: setTransferRowKeys }}
                      pagination={{ pageSize: 10 }} />
                  </div>
                  <div className="md:hidden space-y-2">
                    {transferRows.length === 0 ? <Empty description="No transfers" /> : (
                      <List dataSource={transferRows} renderItem={(r) => (
                        <MobileCard record={r} fields={[{ key: 'product', dataIndex: ['product', 'name'] }, { key: 'qty', dataIndex: 'qty' }, { key: 'status', dataIndex: 'status' }]} onClick={() => {}} />
                      )} />
                    )}
                  </div>
                </div>
              ),
            },
          ]} />
        </>
      )}

      {/* Start Audit Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Start Stock Audit</span>}
        open={auditOpen} onCancel={() => setAuditOpen(false)}
        onOk={() => auditForm.submit()} confirmLoading={startAuditMutation.isPending}
        className="top-8">
        <Form form={auditForm} layout="vertical" onFinish={() => startAuditMutation.mutate({ shop_id: selectedShop })} className="mt-4">
          <p className="text-sm text-slate-500">This will create a new audit for this shop. Count all items and update quantities.</p>
        </Form>
      </Modal>

      {/* Transfer Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Create Stock Transfer</span>}
        open={transferOpen} onCancel={() => setTransferOpen(false)}
        onOk={() => transferForm.submit()} confirmLoading={initTransferMutation.isPending}
        className="top-8">
        <Form form={transferForm} layout="vertical"
          onFinish={(values) => initTransferMutation.mutate({ from_shop_id: selectedShop, ...values })}
          className="mt-4">
          <Form.Item name="to_shop_id" label={<span className="text-xs font-semibold text-slate-600">To Shop</span>} rules={[{ required: true }]}>
            <Select placeholder="Select destination shop">
              {shops.filter(s => s.id !== selectedShop).map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="product_id" label={<span className="text-xs font-semibold text-slate-600">Product</span>} rules={[{ required: true }]}>
            <Select placeholder="Select product">
              {productRows.map(p => <Option key={p.id} value={p.id}>{p.product?.name} (Stock: {p.stockLevel?.current_qty || 0})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="qty" label={<span className="text-xs font-semibold text-slate-600">Quantity</span>} rules={[{ required: true, min: 1 }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="notes" label={<span className="text-xs font-semibold text-slate-600">Notes</span>}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Stock Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Add Stock</span>}
        open={stockOpen} onCancel={() => { setStockOpen(false); stockForm.resetFields(); }}
        onOk={() => stockForm.submit()} confirmLoading={addStockMutation.isPending}
        className="top-8">
        <Form form={stockForm} layout="vertical"
          onFinish={(values) => {
            const fd = new FormData();
            fd.append('product_id', values.product_id);
            fd.append('qty', values.qty);
            if (values.reference_no) fd.append('reference_no', values.reference_no);
            if (values.note) fd.append('note', values.note);
            if (values.receipt?.file?.originFileObj) fd.append('receipt', values.receipt.file.originFileObj);
            addStockMutation.mutate(fd);
          }}
          className="mt-4">
          <Form.Item name="product_id" label={<span className="text-xs font-semibold text-slate-600">Product</span>} rules={[{ required: true }]}>
            <Select placeholder="Select product" showSearch optionFilterProp="children">
              {productRows.map(p => <Option key={p.id} value={p.id}>{p.product?.name} (Stock: {p.stockLevel?.current_qty || 0})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="qty" label={<span className="text-xs font-semibold text-slate-600">Quantity</span>} rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="reference_no" label={<span className="text-xs font-semibold text-slate-600">Reference No</span>}>
            <Input placeholder="Invoice / PO number" />
          </Form.Item>
          <Form.Item name="receipt" label={<span className="text-xs font-semibold text-slate-600">Receipt</span>}>
            <Upload maxCount={1} beforeUpload={() => false} accept="image/*,application/pdf">
              <Button icon={<UploadIcon size={14} />}>Upload Receipt</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="note" label={<span className="text-xs font-semibold text-slate-600">Note</span>}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
