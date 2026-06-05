// src/pages/inventory/ShopInventoryPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Alert, App, Typography, Space, DatePicker } from 'antd';
import { PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ShopInventoryPage() {
  const [open, setOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  // Filter shops: company-owned (Bentabet or Dante) with bar/grocery types
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
    { title: 'Margin', render: (_, r) => `TZS ${(r.selling_price - r.purchase_price)?.toLocaleString()}` },
    {
      title: 'Stock',
      render: (_, r) => {
        const qty = r.stockLevel?.current_qty ?? '—';
        const isLow = r.stockLevel && r.stockLevel.current_qty <= r.stockLevel.reorder_level;
        return <Tag color={isLow ? 'red' : 'green'}>{qty} {isLow && <WarningOutlined />}</Tag>;
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
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Shop Inventory</Title>
        <Space>
          <Select
            placeholder="Filter by shop"
            allowClear
            style={{ width: 200 }}
            onChange={setSelectedShop}
            showSearch
            optionFilterProp="children"
          >
            {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} style={{ background: '#1a6b3a' }}>
            Add Product
          </Button>
        </Space>
      </div>

      {lowStockItems.length > 0 && (
        <Alert
          type="warning"
          message={`${lowStockItems.length} product(s) below reorder level: ${lowStockItems.map(p => p.name).join(', ')}`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {expiringItems.length > 0 && (
        <Alert
          type="error"
          message={`${expiringItems.length} product(s) expiring within 7 days: ${expiringItems.map(p => p.name).join(', ')}`}
          showIcon
          style={{ marginBottom: 16 }}
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

      <Modal
        title="Add Product"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="shop_id" label="Shop" rules={[{ required: true, message: 'Select a shop' }]}>
            <Select placeholder="Select a shop" showSearch optionFilterProp="children">
              {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Product Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="Category">
            <Select
              placeholder="Select or create category"
              mode="tags"
              maxTagCount={1}
              style={{ width: '100%' }}
            >
              {(categoriesData || []).map(c => (
                <Option key={c.value} value={c.value}>{c.value}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="unit" label="Unit" initialValue="pcs"><Input /></Form.Item>
          <Form.Item name="purchase_price" label="Purchase Price (TZS)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="selling_price" label="Selling Price (TZS)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiry_date" label="Expiry Date">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
