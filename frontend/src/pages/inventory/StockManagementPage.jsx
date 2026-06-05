// src/pages/inventory/StockManagementPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Select, InputNumber, Input, Space, Alert, Typography, Tabs, Card, Statistic } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';

const { Title } = Typography;
const { Option } = Select;

export default function StockManagementPage() {
  const [selectedShop, setSelectedShop] = useState(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [auditForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => ['Bentabet', 'Dante'].includes(s.partner?.label) && ['bar', 'grocery', 'mixed'].includes(s.type));

  // Get products for selected shop
  const { data: products } = useQuery({
    queryKey: ['products', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.products({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  // Get audits
  const { data: audits } = useQuery({
    queryKey: ['audits', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.listAudits({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  // Get transfers
  const { data: transfers } = useQuery({
    queryKey: ['transfers', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.listTransfers({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const startAuditMutation = useMutation({
    mutationFn: (data) => inventoryAPI.startAudit(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audits'] });
      auditForm.resetFields();
      setAuditOpen(false);
    },
  });

  const initTransferMutation = useMutation({
    mutationFn: (data) => inventoryAPI.initializeTransfer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      transferForm.resetFields();
      setTransferOpen(false);
    },
  });

  const stockColumns = [
    { title: 'Product', dataIndex: ['product', 'name'] },
    { title: 'Category', dataIndex: ['product', 'category'] },
    {
      title: 'Current Stock',
      dataIndex: ['stockLevel', 'current_qty'],
      render: (qty) => <strong>{qty || 0}</strong>,
    },
    {
      title: 'Reorder Level',
      dataIndex: ['stockLevel', 'reorder_level'],
    },
    {
      title: 'Status',
      render: (_, record) => {
        const qty = record.stockLevel?.current_qty || 0;
        const reorder = record.stockLevel?.reorder_level || 0;
        if (qty === 0) return <span className="text-red-600">Out of Stock</span>;
        if (qty <= reorder) return <span className="text-orange-600">Low Stock</span>;
        return <span className="text-green-600">OK</span>;
      },
    },
  ];

  const auditColumns = [
    { title: 'Date', dataIndex: 'audit_date', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Status', dataIndex: 'status', render: (s) => <span className={`badge badge-${s}`}>{s}</span> },
    { title: 'Variance Items', dataIndex: 'total_variance_items' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Button size="small" type="link">
          View
        </Button>
      ),
    },
  ];

  const transferColumns = [
    { title: 'Date', dataIndex: 'transfer_date', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Product', dataIndex: ['product', 'name'] },
    { title: 'Qty', dataIndex: 'qty' },
    { title: 'Status', dataIndex: 'status', render: (s) => <span className={`badge badge-${s}`}>{s}</span> },
    {
      title: 'Actions',
      render: (_, record) => {
        if (record.status === 'in_transit') {
          return <Button size="small" type="primary">Receive</Button>;
        }
        return <Button size="small" type="link">View</Button>;
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} style={{ margin: 0 }}>Stock Management</Title>
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

      {!selectedShop && (
        <Alert message="Select a shop to view stock management" type="info" showIcon />
      )}

      {selectedShop && (
        <Tabs
          items={[
            {
              key: 'stock',
              label: 'Current Stock',
              children: (
                <div>
                  <div className="mb-4">
                    <Space>
                      <Button icon={<ReloadOutlined />}>Refresh</Button>
                    </Space>
                  </div>
                  <Table
                    dataSource={products}
                    columns={stockColumns}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    size="small"
                  />
                </div>
              ),
            },
            {
              key: 'audits',
              label: 'Stock Audits',
              children: (
                <div>
                  <div className="mb-4">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setAuditOpen(true)}
                    >
                      Start Audit
                    </Button>
                  </div>
                  <Table
                    dataSource={audits}
                    columns={auditColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                </div>
              ),
            },
            {
              key: 'transfers',
              label: 'Stock Transfers',
              children: (
                <div>
                  <div className="mb-4">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setTransferOpen(true)}
                    >
                      New Transfer
                    </Button>
                  </div>
                  <Table
                    dataSource={transfers}
                    columns={transferColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        title="Start Stock Audit"
        open={auditOpen}
        onCancel={() => setAuditOpen(false)}
        onOk={() => auditForm.submit()}
        confirmLoading={startAuditMutation.isPending}
      >
        <Form
          form={auditForm}
          layout="vertical"
          onFinish={(values) => startAuditMutation.mutate({ shop_id: selectedShop })}
        >
          <p>This will create a new audit for this shop. Count all items and update quantities.</p>
        </Form>
      </Modal>

      <Modal
        title="Create Stock Transfer"
        open={transferOpen}
        onCancel={() => setTransferOpen(false)}
        onOk={() => transferForm.submit()}
        confirmLoading={initTransferMutation.isPending}
      >
        <Form
          form={transferForm}
          layout="vertical"
          onFinish={(values) => {
            initTransferMutation.mutate({
              from_shop_id: selectedShop,
              ...values,
            });
          }}
        >
          <Form.Item name="to_shop_id" label="To Shop" rules={[{ required: true }]}>
            <Select placeholder="Select destination shop">
              {shops.filter(s => s.id !== selectedShop).map(s => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="product_id" label="Product" rules={[{ required: true }]}>
            <Select placeholder="Select product">
              {(products || []).map(p => (
                <Option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.stockLevel?.current_qty || 0})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="qty" label="Quantity" rules={[{ required: true, min: 1 }]}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
