import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Alert, App, Typography, Space, DatePicker } from 'antd';
import { Plus, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

export default function ShopInventoryPage() {
  const [open, setOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => 
    ['Bentabet', 'Dante'].includes(s.partner?.label) && 
    ['bar', 'grocery', 'mixed'].includes(s.type)
  );

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', selectedShop],
    queryFn: () => inventoryAPI.products(selectedShop ? { shop_id: selectedShop } : {}).then(r => r.data.data),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.categories(selectedShop).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop && open,
  });

  const createMutation = useMutation({
    mutationFn: (d) => inventoryAPI.createProduct(d),
    onSuccess: () => {
      message.success('Product added');
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      setOpen(false);
      form.resetFields();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const lowStockItems = (products || []).filter(p => p.stockLevel && p.stockLevel.current_qty <= p.stockLevel.reorder_level);
  const expiringItems = (products || []).filter(p => {
    if (!p.stockLevel?.expiry_date) return false;
    const daysLeft = dayjs(p.stockLevel.expiry_date).diff(dayjs(), 'day');
    return daysLeft <= 7 && daysLeft >= 0;
  });

  const cols = [
    { title: 'Product', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Category', dataIndex: 'category' },
    { title: 'Unit', dataIndex: 'unit' },
    { title: 'Purchase Price', dataIndex: 'purchase_price', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Selling Price', dataIndex: 'selling_price', render: v => `TZS ${v?.toLocaleString()}` },
    { title: 'Margin', render: (_, r) => <span className="font-semibold">TZS {`${(r.selling_price - r.purchase_price)?.toLocaleString()}`}</span> },
    {
      title: 'Stock',
      render: (_, r) => {
        const qty = r.stockLevel?.current_qty ?? '—';
        const isLow = r.stockLevel && r.stockLevel.current_qty <= r.stockLevel.reorder_level;
        return <Tag color={isLow ? 'red' : 'green'} className="flex items-center gap-1">{qty} {isLow && <AlertTriangle className="w-3 h-3" />}</Tag>;
      },
    },
    {
      title: 'Expiry',
      render: (_, r) => {
        if (!r.stockLevel?.expiry_date) return '—';
        const daysLeft = dayjs(r.stockLevel.expiry_date).diff(dayjs(), 'day');
        return <Tag color={daysLeft <= 7 ? 'red' : daysLeft <= 14 ? 'orange' : 'green'}>{r.stockLevel.expiry_date} ({daysLeft}d)</Tag>;
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <h4 className="text-base font-bold text-slate-800 m-0">Shop Inventory</h4>
        <Space>
          <Select
            placeholder="Filter by shop"
            allowClear
            className="w-[200px]"
            onChange={setSelectedShop}
            showSearch
            optionFilterProp="children"
          >
            {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
          </Select>
          <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}
            className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5">
            Add Product
          </Button>
        </Space>
      </div>

      {lowStockItems.length > 0 && (
        <Alert
          type="warning"
          message={`${lowStockItems.length} product(s) below reorder level: ${lowStockItems.map(p => p.name).join(', ')}`}
          showIcon
          className="mb-4"
        />
      )}
      {expiringItems.length > 0 && (
        <Alert
          type="error"
          message={`${expiringItems.length} product(s) expiring within 7 days: ${expiringItems.map(p => p.name).join(', ')}`}
          showIcon
          className="mb-4"
        />
      )}

      <Table
        dataSource={products || []}
        columns={cols}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 20 }}
      />

      <Modal title={<span className="text-sm font-bold text-slate-700">Add Product</span>}
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        className="top-8">
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate({ ...v, category: Array.isArray(v.category) ? v.category[0] : v.category })} className="mt-4">
          <Form.Item name="shop_id" label={<span className="text-xs font-semibold text-slate-600">Shop</span>} rules={[{ required: true, message: 'Select a shop' }]}>
            <Select placeholder="Select a shop" showSearch optionFilterProp="children">
              {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label={<span className="text-xs font-semibold text-slate-600">Product Name</span>} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label={<span className="text-xs font-semibold text-slate-600">Category</span>}>
            <Select
              placeholder="Select or create category"
              mode="tags"
              maxTagCount={1}
              className="w-full"
            >
              {(categoriesData || []).map(c => (
                <Option key={c.value} value={c.value}>{c.value}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="unit" label={<span className="text-xs font-semibold text-slate-600">Unit</span>} initialValue="pcs">
            <Input />
          </Form.Item>
          <Form.Item name="purchase_price" label={<span className="text-xs font-semibold text-slate-600">Purchase Price (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="selling_price" label={<span className="text-xs font-semibold text-slate-600">Selling Price (TZS)</span>} rules={[{ required: true }]}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="expiry_date" label={<span className="text-xs font-semibold text-slate-600">Expiry Date</span>}>
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
