// src/pages/inventory/AlertsPage.jsx
import { useState } from 'react';
import { Table, Button, Select, Alert, Typography, Space, Card, Statistic, Tag, Empty, Modal, InputNumber, Input, Upload, message as antMsg } from 'antd';
import { CheckOutlined, BellOutlined, ReloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';

const { Title } = Typography;
const { Option } = Select;

export default function AlertsPage() {
  const [selectedShop, setSelectedShop] = useState(null);
  const [stockModalAlert, setStockModalAlert] = useState(null);
  const [stockQty, setStockQty] = useState(1);
  const [stockRef, setStockRef] = useState('');
  const [stockReceipt, setStockReceipt] = useState(null);
  const qc = useQueryClient();

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => ['Bentabet', 'Dante'].includes(s.partner?.label) && ['bar', 'grocery', 'mixed'].includes(s.type));

  const { data: alertSummary } = useQuery({
    queryKey: ['alert-summary', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.getAlertSummary({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve(null),
    enabled: !!selectedShop,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', selectedShop],
    queryFn: () => selectedShop ? inventoryAPI.listAlerts({ shop_id: selectedShop, acknowledged: false }).then(r => r.data.data) : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: (alertId) => inventoryAPI.acknowledgeAlert(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alert-summary'] });
    },
  });

  const checkLowStockMutation = useMutation({
    mutationFn: (shopId) => inventoryAPI.checkLowStock({ shop_id: shopId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alert-summary'] });
    },
  });

  const addStockMutation = useMutation({
    mutationFn: (fd) => inventoryAPI.addStock(fd),
    onSuccess: () => {
      antMsg.success('Stock added');
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alert-summary'] });
      setStockModalAlert(null);
      setStockQty(1);
      setStockRef('');
      setStockReceipt(null);
    },
    onError: (e) => antMsg.error(e.response?.data?.message || 'Failed to add stock'),
  });

  const columns = [
    { title: 'Product', dataIndex: ['product', 'name'] },
    { title: 'Current Qty', dataIndex: 'current_qty' },
    { title: 'Reorder Level', dataIndex: 'reorder_level' },
    {
      title: 'Status',
      render: (_, record) => {
        const qty = record.current_qty;
        const reorder = record.reorder_level;
        if (qty === 0) return <Tag color="red">Out of Stock</Tag>;
        if (qty <= Math.ceil(reorder * 0.5)) return <Tag color="orange">Urgent</Tag>;
        return <Tag color="volcano">Warning</Tag>;
      },
    },
    { title: 'Alert Date', dataIndex: 'alert_date', render: (d) => new Date(d).toLocaleDateString() },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<CheckOutlined />}
            onClick={() => acknowledgeAlertMutation.mutate(record.id)}
            loading={acknowledgeAlertMutation.isPending}
          >
            Acknowledge
          </Button>
          <Button
            size="small"
            icon={<PlusOutlined />}
            type="primary"
            ghost
            onClick={() => setStockModalAlert(record)}
          >
            Add Stock
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} style={{ margin: 0 }}>Low Stock Alerts</Title>
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

      {selectedShop && alertSummary && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <Statistic
                title="Total Alerts"
                value={alertSummary.total_alerts}
                prefix={<BellOutlined />}
              />
            </Card>
            <Card>
              <Statistic
                title="Critical"
                value={alertSummary.critical}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Urgent"
                value={alertSummary.urgent}
                valueStyle={{ color: '#ff7a45' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Warning"
                value={alertSummary.warning}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </div>

          {alertSummary.total_alerts === 0 ? (
            <Empty description="No active alerts" style={{ marginTop: 50 }} />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => checkLowStockMutation.mutate(selectedShop)}
                loading={checkLowStockMutation.isPending}
              >
                Check Stock Levels
              </Button>

              <Table
                dataSource={alerts}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                size="small"
              />
            </Space>
          )}
        </>
      )}

      {!selectedShop && (
        <Alert message="Select a shop to view low stock alerts" type="info" showIcon />
      )}

      <Modal
        title={`Add Stock — ${stockModalAlert?.product?.name || ''}`}
        open={!!stockModalAlert}
        onCancel={() => { setStockModalAlert(null); setStockReceipt(null); }}
        onOk={() => {
          const fd = new FormData();
          fd.append('product_id', stockModalAlert.product_id);
          fd.append('qty', stockQty);
          if (stockRef) fd.append('reference_no', stockRef);
          if (stockReceipt) fd.append('receipt', stockReceipt);
          addStockMutation.mutate(fd);
        }}
        confirmLoading={addStockMutation.isPending}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <span className="text-gray-500 text-sm">Current stock:</span>{' '}
            <strong>{stockModalAlert?.current_qty}</strong>{' '}
            <span className="text-gray-500 text-sm">Reorder at:</span>{' '}
            <strong>{stockModalAlert?.reorder_level}</strong>
          </div>
          <div>
            <span className="text-gray-500 text-sm">Quantity to add</span>
            <InputNumber min={1} value={stockQty} onChange={setStockQty} style={{ width: '100%' }} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">Reference (optional)</span>
            <Input placeholder="Invoice / PO number" value={stockRef} onChange={(e) => setStockRef(e.target.value)} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">Receipt (optional)</span>
            <Upload
              maxCount={1}
              beforeUpload={(file) => { setStockReceipt(file); return false; }}
              onRemove={() => setStockReceipt(null)}
              accept="image/*,application/pdf"
            >
              <Button icon={<UploadOutlined />}>Upload Receipt</Button>
            </Upload>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
