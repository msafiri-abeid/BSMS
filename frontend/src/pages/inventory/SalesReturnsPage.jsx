// src/pages/inventory/SalesReturnsPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Select, Input, InputNumber, Space, Alert, Typography, Tag } from 'antd';
import { PlusOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

export default function SalesReturnsPage() {
  const [selectedShop, setSelectedShop] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnForm] = Form.useForm();
  const qc = useQueryClient();

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => ['Bentabet', 'Dante'].includes(s.partner?.label) && ['bar', 'grocery', 'mixed'].includes(s.type));

  const { data: sales } = useQuery({
    queryKey: ['sales', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.listSales({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const { data: returns } = useQuery({
    queryKey: ['returns', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.listReturns({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const processReturnMutation = useMutation({
    mutationFn: (data) => inventoryAPI.processReturn(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      returnForm.resetFields();
      setReturnModalOpen(false);
    },
    onError: (err) => alert(err.response?.data?.message || 'Error processing return'),
  });

  const returnsColumns = [
    { title: 'Date', dataIndex: 'return_date', render: (d) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: 'Sale ID', dataIndex: 'sale_id' },
    { title: 'Product', dataIndex: ['product', 'name'] },
    { title: 'Qty Returned', dataIndex: 'qty_returned' },
    {
      title: 'Refund Amount',
      dataIndex: 'refund_amount_tzs',
      render: (v) => `TZS ${v?.toLocaleString()}`,
    },
    {
      title: 'Refund Method',
      dataIndex: 'refund_method',
      render: (method) => <Tag color={method === 'cash' ? 'green' : 'blue'}>{method}</Tag>,
    },
    { title: 'Reason', dataIndex: 'reason', render: (r) => <span title={r}>{r?.substring(0, 30)}...</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} style={{ margin: 0 }}>Sales Returns</Title>
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
        <Alert message="Select a shop to view returns" type="info" showIcon />
      )}

      {selectedShop && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setReturnModalOpen(true)}
          >
            Process Return
          </Button>

          <Table
            dataSource={returns}
            columns={returnsColumns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="small"
          />
        </Space>
      )}

      <Modal
        title="Process Sales Return"
        open={returnModalOpen}
        onCancel={() => setReturnModalOpen(false)}
        onOk={() => returnForm.submit()}
        confirmLoading={processReturnMutation.isPending}
        width={600}
      >
        <Form
          form={returnForm}
          layout="vertical"
          onFinish={(values) => {
            processReturnMutation.mutate({
              ...values,
              shop_id: selectedShop,
            });
          }}
        >
          <Form.Item name="sale_id" label="Sale" rules={[{ required: true, message: 'Select a sale' }]}>
            <Select placeholder="Select a sale to return from">
              {(sales || []).map(s => (
                <Option key={s.id} value={s.id}>
                  Sale #{s.id} - {dayjs(s.sale_date).format('YYYY-MM-DD HH:mm')} (TZS {s.net_amount_tzs.toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="product_id" label="Product" rules={[{ required: true, message: 'Select a product' }]}>
            <Select placeholder="Select product to return">
              {/* Products will be filtered from selected sale in a real implementation */}
            </Select>
          </Form.Item>

          <Form.Item name="qty_returned" label="Quantity Returned" rules={[{ required: true, message: 'Enter quantity', min: 1 }]}>
            <InputNumber min={1} />
          </Form.Item>

          <Form.Item name="reason" label="Reason for Return" rules={[{ required: true, message: 'Provide a reason' }]}>
            <Input.TextArea rows={3} placeholder="e.g., Defective, Wrong item, Customer request" />
          </Form.Item>

          <Form.Item name="refund_method" label="Refund Method" rules={[{ required: true }]}>
            <Select placeholder="How to refund the customer">
              <Option value="cash">Cash Refund</Option>
              <Option value="credit">Store Credit</Option>
            </Select>
          </Form.Item>

          <Alert
            message="The stock will be restored and refund will be processed immediately."
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>
    </div>
  );
}
