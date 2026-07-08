// src/pages/inventory/AlertsPage.jsx
import { useState } from 'react';
import { Table, Button, Select, Alert, Typography, Space, Tag, Empty, Modal, InputNumber, Input, Upload, List } from 'antd';
import { Check, RefreshCw, Plus, Upload as UploadIcon, Bell, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import MobileCard from '../../components/MobileCard';

const { Text } = Typography;
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
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alert-summary'] });
      setStockModalAlert(null);
      setStockQty(1);
      setStockRef('');
      setStockReceipt(null);
    },
    onError: (e) => alert(e.response?.data?.message || 'Failed to add stock'),
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
            icon={<Check className="w-3.5 h-3.5" />}
            onClick={() => acknowledgeAlertMutation.mutate(record.id)}
            loading={acknowledgeAlertMutation.isPending}
          >
            Acknowledge
          </Button>
          <Button
            size="small"
            icon={<Plus className="w-3.5 h-3.5" />}
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

  const mobileFields = [
    { key: 'product', label: 'Product', render: (_, r) => r.product?.name || '—' },
    { key: 'qty', label: 'Current Qty', render: (_, r) => r.current_qty },
    { key: 'reorder', label: 'Reorder Level', render: (_, r) => r.reorder_level },
    { key: 'status', label: 'Status', render: (_, r) => {
      const qty = r.current_qty;
      const reorder = r.reorder_level;
      if (qty === 0) return <Tag color="red">Out of Stock</Tag>;
      if (qty <= Math.ceil(reorder * 0.5)) return <Tag color="orange">Urgent</Tag>;
      return <Tag color="volcano">Warning</Tag>;
    }},
    { key: 'date', label: 'Alert Date', render: (_, r) => new Date(r.alert_date).toLocaleDateString() },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <h4 className="text-base font-bold text-slate-800 m-0">Low Stock Alerts</h4>
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

      {selectedShop && alertSummary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border border-slate-100 p-3 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center"><Bell size={14} className="text-blue-600" /></div>
                <span className="text-xs text-slate-500">Total</span>
              </div>
              <div className="text-xl font-bold text-slate-800">{alertSummary.total_alerts}</div>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle size={14} className="text-red-600" /></div>
                <span className="text-xs text-slate-500">Critical</span>
              </div>
              <div className="text-xl font-bold text-red-600">{alertSummary.critical}</div>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center"><Info size={14} className="text-orange-600" /></div>
                <span className="text-xs text-slate-500">Urgent</span>
              </div>
              <div className="text-xl font-bold text-orange-600">{alertSummary.urgent}</div>
            </div>
            <div className="rounded-lg border border-slate-100 p-3 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center"><AlertCircle size={14} className="text-yellow-600" /></div>
                <span className="text-xs text-slate-500">Warning</span>
              </div>
              <div className="text-xl font-bold text-amber-500">{alertSummary.warning}</div>
            </div>
          </div>

          {alertSummary.total_alerts === 0 ? (
            <Empty description="No active alerts" />
          ) : (
            <div className="space-y-4">
              <Button
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={() => checkLowStockMutation.mutate(selectedShop)}
                loading={checkLowStockMutation.isPending}
                className="flex items-center gap-1.5"
              >
                Check Stock Levels
              </Button>

              <div className="hidden overflow-x-auto md:block">
                <Table
                  dataSource={alerts}
                  columns={columns}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  size="small"
                />
              </div>

              <div className="md:hidden space-y-2">
                <List
                  dataSource={alerts || []}
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
        </>
      )}

      {!selectedShop && (
        <Alert message="Select a shop to view low stock alerts" type="info" showIcon />
      )}

      <Modal
        title={<span className="text-sm font-bold text-slate-700">Add Stock — {stockModalAlert?.product?.name || ''}</span>}
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
        className="top-8"
      >
        <div className="space-y-4 mt-4">
          <div>
            <span className="text-slate-400 text-sm">Current stock:</span>{' '}
            <strong>{stockModalAlert?.current_qty}</strong>{' '}
            <span className="text-slate-400 text-sm">Reorder at:</span>{' '}
            <strong>{stockModalAlert?.reorder_level}</strong>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600">Quantity to add</span>
            <InputNumber min={1} value={stockQty} onChange={setStockQty} className="w-full" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600">Reference (optional)</span>
            <Input placeholder="Invoice / PO number" value={stockRef} onChange={(e) => setStockRef(e.target.value)} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600">Receipt (optional)</span>
            <Upload
              maxCount={1}
              beforeUpload={(file) => { setStockReceipt(file); return false; }}
              onRemove={() => setStockReceipt(null)}
              accept="image/*,application/pdf"
            >
              <Button icon={<UploadIcon className="w-4 h-4" />}>Upload Receipt</Button>
            </Upload>
          </div>
        </div>
      </Modal>
    </div>
  );
}