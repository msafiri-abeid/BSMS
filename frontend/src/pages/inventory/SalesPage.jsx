// src/pages/inventory/SalesPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Card, Statistic, Typography, Empty, Tag, Drawer } from 'antd';
import { PlusOutlined, PrinterOutlined, DollarOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

export default function SalesPage() {
  const [selectedShop, setSelectedShop] = useState(null);
  const [saleDrawerOpen, setSaleDrawerOpen] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [saleForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [saleItems, setSaleItems] = useState([]);
  const qc = useQueryClient();

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => ['Bentabet', 'Dante'].includes(s.partner?.label) && ['bar', 'grocery', 'mixed'].includes(s.type));

  const { data: products } = useQuery({
    queryKey: ['products', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.products({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const { data: sales } = useQuery({
    queryKey: ['sales', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.listSales({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
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
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sales-report'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      saleForm.resetFields();
      setSaleItems([]);
      setSaleDrawerOpen(false);
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (data) => inventoryAPI.recordPayment(selectedSaleId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      paymentForm.resetFields();
      setPaymentDrawerOpen(false);
    },
  });

  const handleAddItem = (productId, qty, unitPrice) => {
    if (!productId || !qty || !unitPrice) return;
    const newItem = {
      key: Date.now(),
      product_id: productId,
      product_name: products.find(p => p.id === productId)?.name,
      qty,
      unit_price_tzs: unitPrice,
      discount_pct: 0,
    };
    setSaleItems([...saleItems, newItem]);
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

  const salesColumns = [
    { title: 'Date', dataIndex: 'sale_date', render: (d) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: 'Customer', dataIndex: 'customer_name', render: (v) => v || 'Walk-in' },
    { title: 'Items', dataIndex: 'items', render: (items) => items?.length || 0 },
    {
      title: 'Amount',
      dataIndex: 'net_amount_tzs',
      render: (v) => `TZS ${v?.toLocaleString()}`,
    },
    { title: 'Method', dataIndex: 'payment_method', render: (m) => <Tag>{m}</Tag> },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          <Button size="small" type="link">View</Button>
          <Button
            size="small"
            type="link"
            onClick={() => {
              setSelectedSaleId(record.id);
              setPaymentDrawerOpen(true);
            }}
          >
            Payment
          </Button>
        </Space>
      ),
    },
  ];

  const itemColumns = [
    { title: 'Product', dataIndex: 'product_name' },
    { title: 'Qty', dataIndex: 'qty' },
    { title: 'Unit Price', dataIndex: 'unit_price_tzs', render: (v) => `TZS ${v?.toLocaleString()}` },
    { title: 'Discount %', dataIndex: 'discount_pct', render: (v) => `${v || 0}%` },
    {
      title: 'Total',
      render: (_, record) => {
        const lineTotal = (record.unit_price_tzs * record.qty) - ((record.discount_pct || 0) * (record.unit_price_tzs * record.qty) / 100);
        return `TZS ${lineTotal.toLocaleString()}`;
      },
    },
    {
      title: '',
      render: (_, record) => (
        <Button size="small" danger type="text" onClick={() => handleRemoveItem(record.key)}>
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} style={{ margin: 0 }}>Sales</Title>
        <Select
          placeholder="Select shop"
          style={{ width: 250 }}
          onChange={setSelectedShop}
          allowClear
          showSearch
          optionFilterProp="children"
        >
          {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
        </Select>
      </div>

      {selectedShop && salesReport && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <Statistic
              title="Total Sales"
              value={salesReport.total_sales}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
          <Card>
            <Statistic
              title="Total Revenue"
              value={Math.round(salesReport.net_total / 1000)}
              prefix="TZS"
              suffix="K"
            />
          </Card>
          <Card>
            <Statistic
              title="Total Discount"
              value={Math.round(salesReport.total_discount / 1000)}
              prefix="TZS"
              suffix="K"
            />
          </Card>
          <Card>
            <Statistic
              title="Gross Profit"
              value={Math.round((salesReport.net_total - (Object.values(salesReport.by_product || {}).reduce((sum, p) => sum + p.cost, 0))) / 1000)}
              prefix="TZS"
              suffix="K"
            />
          </Card>
        </div>
      )}

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => setSaleDrawerOpen(true)}
        >
          Record Sale
        </Button>

        <Table
          dataSource={sales}
          columns={salesColumns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Space>

      <Drawer
        title="Record New Sale"
        placement="right"
        onClose={() => setSaleDrawerOpen(false)}
        open={saleDrawerOpen}
        width={600}
      >
        <Form form={saleForm} layout="vertical">
          <Form.Item label="Customer Name">
            <Input placeholder="Optional" onChange={(e) => saleForm.setFieldValue('customer_name', e.target.value)} />
          </Form.Item>

          <div className="mb-6">
            <Title level={5}>Add Items</Title>
            <Form layout="inline" style={{ marginBottom: 16 }}>
              <Form.Item>
                <Select
                  placeholder="Select product"
                  style={{ width: 200 }}
                  id="product_select"
                  onChange={(val) => {
                    document.getElementById('qty_input').value = '';
                    document.getElementById('price_input').value = products.find(p => p.id === val)?.selling_price || '';
                  }}
                >
                  {(products || []).map(p => (
                    <Option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stockLevel?.current_qty || 0})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <InputNumber placeholder="Qty" id="qty_input" min={1} />
              </Form.Item>
              <Form.Item>
                <InputNumber placeholder="Price" id="price_input" min={0} />
              </Form.Item>
              <Form.Item>
                <Button
                  onClick={() => {
                    const productSel = document.getElementById('product_select').value;
                    const qty = parseInt(document.getElementById('qty_input').value) || 0;
                    const price = parseInt(document.getElementById('price_input').value) || 0;
                    if (productSel && qty && price) {
                      handleAddItem(productSel, qty, price);
                      document.getElementById('product_select').value = '';
                      document.getElementById('qty_input').value = '';
                      document.getElementById('price_input').value = '';
                    }
                  }}
                >
                  Add
                </Button>
              </Form.Item>
            </Form>

            {saleItems.length > 0 ? (
              <Table
                dataSource={saleItems}
                columns={itemColumns}
                rowKey="key"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="No items added" />
            )}
          </div>

          <Card>
            <Statistic
              title="Total Amount"
              value={Math.round(calculateTotals() / 1000)}
              prefix="TZS"
              suffix="K"
            />
          </Card>

          <Form.Item label="Discount (TZS)" style={{ marginTop: 16 }}>
            <InputNumber min={0} />
          </Form.Item>

          <Form.Item label="Payment Method" rules={[{ required: true }]}>
            <Select placeholder="Select method">
              <Option value="cash">Cash</Option>
              <Option value="card">Card</Option>
              <Option value="mobile">Mobile</Option>
              <Option value="credit">Credit</Option>
            </Select>
          </Form.Item>

          <Space>
            <Button
              type="primary"
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
              loading={recordSaleMutation.isPending}
            >
              Save Sale
            </Button>
            <Button onClick={() => setSaleDrawerOpen(false)}>Cancel</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer
        title="Record Payment"
        placement="right"
        onClose={() => setPaymentDrawerOpen(false)}
        open={paymentDrawerOpen}
        width={500}
      >
        <Form
          form={paymentForm}
          layout="vertical"
          onFinish={(values) => recordPaymentMutation.mutate(values)}
        >
          <Form.Item name="amount_tzs" label="Amount (TZS)" rules={[{ required: true }]}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="payment_method" label="Payment Method" rules={[{ required: true }]}>
            <Select>
              <Option value="cash">Cash</Option>
              <Option value="card">Card</Option>
              <Option value="mobile">Mobile</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Reference (e.g. receipt #)">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={recordPaymentMutation.isPending}>
              Record Payment
            </Button>
            <Button onClick={() => setPaymentDrawerOpen(false)}>Cancel</Button>
          </Space>
        </Form>
      </Drawer>
    </div>
  );
}
