// src/pages/inventory/SalesReturnsPage.jsx
import { useState } from 'react';
import { Table, Button, Modal, Form, Select, Input, InputNumber, Space, Alert, Typography, Tag, List } from 'antd';
import { Plus, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import dayjs from 'dayjs';
import MobileCard from '../../components/MobileCard';

const { Text } = Typography;
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

  const mobileFields = [
    { key: 'date', label: 'Date', render: (_, r) => dayjs(r.return_date).format('DD MMM YYYY') },
    { key: 'sale', label: 'Sale ID', render: (_, r) => `#${r.sale_id}` },
    { key: 'product', label: 'Product', render: (_, r) => r.product?.name || '—' },
    { key: 'qty', label: 'Qty', render: (_, r) => r.qty_returned },
    { key: 'refund', label: 'Refund', render: (_, r) => `TZS ${r.refund_amount_tzs?.toLocaleString()}` },
    { key: 'method', label: 'Method', render: (_, r) => <Tag color={r.refund_method === 'cash' ? 'green' : 'blue'}>{r.refund_method}</Tag> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <h4 className="text-base font-bold text-slate-800 m-0">Sales Returns</h4>
        <Select
          placeholder="Select shop"
          className="w-full sm:w-60"
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
        <div className="space-y-4">
          <Button
            type="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setReturnModalOpen(true)}
            className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5"
          >
            Process Return
          </Button>

          <div className="hidden overflow-x-auto md:block">
            <Table
              dataSource={returns}
              columns={returnsColumns}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </div>

          <div className="md:hidden space-y-2">
            <List
              dataSource={returns || []}
              renderItem={(r) => (
                <MobileCard
                  record={r}
                  fields={mobileFields}
                />
              )}
            />
          </div>
        </div>
      )}

      <Modal
        title={<span className="text-sm font-bold text-slate-700">Process Sales Return</span>}
        open={returnModalOpen}
        onCancel={() => setReturnModalOpen(false)}
        onOk={() => returnForm.submit()}
        confirmLoading={processReturnMutation.isPending}
        width={600}
        className="top-8"
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
          className="mt-4"
        >
          <Form.Item name="sale_id" label={<span className="text-xs font-semibold text-slate-600">Sale</span>} rules={[{ required: true, message: 'Select a sale' }]}>
            <Select placeholder="Select a sale to return from">
              {(sales || []).map(s => (
                <Option key={s.id} value={s.id}>
                  Sale #{s.id} - {dayjs(s.sale_date).format('YYYY-MM-DD HH:mm')} (TZS {s.net_amount_tzs.toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="product_id" label={<span className="text-xs font-semibold text-slate-600">Product</span>} rules={[{ required: true, message: 'Select a product' }]}>
            <Select placeholder="Select product to return">
              {/* Products will be filtered from selected sale in a real implementation */}
            </Select>
          </Form.Item>

          <Form.Item name="qty_returned" label={<span className="text-xs font-semibold text-slate-600">Quantity Returned</span>} rules={[{ required: true, message: 'Enter quantity', min: 1 }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>

          <Form.Item name="reason" label={<span className="text-xs font-semibold text-slate-600">Reason for Return</span>} rules={[{ required: true, message: 'Provide a reason' }]}>
            <Input.TextArea rows={3} placeholder="e.g., Defective, Wrong item, Customer request" />
          </Form.Item>

          <Form.Item name="refund_method" label={<span className="text-xs font-semibold text-slate-600">Refund Method</span>} rules={[{ required: true }]}>
            <Select placeholder="How to refund the customer">
              <Option value="cash">Cash Refund</Option>
              <Option value="credit">Store Credit</Option>
            </Select>
          </Form.Item>

          <Alert
            message="The stock will be restored and refund will be processed immediately."
            type="info"
            showIcon
            className="mt-4"
          />
        </Form>
      </Modal>
    </div>
  );
}