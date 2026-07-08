import { useState, useMemo } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, Card, App, Empty, List } from 'antd';
import { Package, ArrowDownLeft, BadgeDollarSign, User, FileDown, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensAPI, usersAPI, partnersAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

const TYPE_COLORS = {
  purchase: 'green', refill_out: 'orange', adjustment: 'blue',
  distribute: 'purple', return: 'cyan', lend: 'gold', debt_repayment: 'pink',
};

const TYPE_LABELS = {
  purchase: 'Purchase (IN)',
  refill_out: 'Refill Out',
  adjustment: 'Adjustment',
  distribute: 'Distribute (OUT)',
  return: 'Return (IN)',
  lend: 'Lend to Vendor (OUT)',
  debt_repayment: 'Debt Repayment (IN)',
};

const MOVEMENT_ICONS = {
  purchase: ArrowDownLeft, refill_out: Package,
  adjustment: Package, distribute: Package,
  return: ArrowDownLeft, lend: Package, debt_repayment: BadgeDollarSign,
};

const OUT_TYPES = ['refill_out', 'distribute', 'lend'];

const FORM_CONFIG = {
  purchase: { fields: ['qty', 'unit_value_tzs', 'note'], recipient: false, vendor: false },
  distribute: { fields: ['qty', 'unit_value_tzs', 'note'], recipient: true, recipientTypes: ['collector', 'technician', 'partner'], vendor: false },
  return: { fields: ['qty', 'unit_value_tzs', 'note'], recipient: true, recipientTypes: ['collector', 'technician', 'partner', 'shop'], vendor: false },
  lend: { fields: ['qty', 'unit_value_tzs', 'note'], recipient: false, vendor: true },
};

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function TokenInventoryPage() {
  const [openModal, setOpenModal] = useState(null);
  const [movementTypeFilter, setMovementTypeFilter] = useState();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const movementType = Form.useWatch('movement_type', form);

  const { data: movData, isLoading } = useQuery({
    queryKey: ['token-movements'],
    queryFn: () => tokensAPI.movements({ limit: 500 }).then(r => r.data.data),
  });

  const { data: balData, isLoading: balLoading } = useQuery({
    queryKey: ['token-balances'],
    queryFn: () => tokensAPI.balances().then(r => r.data.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-tokens'],
    queryFn: () => usersAPI.list({ role: ['Collector', 'Technician'] }).then(r => r.data.data),
  });
  const { data: partners } = useQuery({
    queryKey: ['partners-for-tokens'],
    queryFn: () => partnersAPI.list().then(r => r.data.data),
  });

  const users = usersData?.rows || usersData || [];
  const allPartners = partners?.rows || partners || [];

  const allMovements = movData?.rows || [];

  const movements = useMemo(() => {
    if (!movementTypeFilter) return allMovements;
    return allMovements.filter(m => m.movement_type === movementTypeFilter);
  }, [allMovements, movementTypeFilter]);

  const movementsWithBalance = useMemo(() => {
    const sorted = [...movements].sort((a, b) =>
      dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf()
    );
    let running = 0;
    return sorted.map(m => {
      running += m.qty;
      return { ...m, running_balance: running };
    }).reverse();
  }, [movements]);

  const officeStock = balData?.office || 0;
  const outstanding = balData?.outstanding || [];

  const addMutation = useMutation({
    mutationFn: (d) => tokensAPI.addMovement(d),
    onSuccess: () => {
      message.success('Movement recorded');
      qc.invalidateQueries({ queryKey: ['token-movements'] });
      qc.invalidateQueries({ queryKey: ['token-balances'] });
      setOpenModal(null);
      form.resetFields();
    },
    onError: (e) => {
      if (e.response?.data?.code === 'TOKEN_EXPIRED') {
        message.warning('Session expired. Please log in again — your data was saved.');
      } else {
        message.error(e.response?.data?.message || 'Error recording movement');
      }
    },
  });

  const handleSubmit = (values) => {
    addMutation.mutate({
      movement_type: values.movement_type,
      qty: values.qty,
      unit_value_tzs: values.unit_value_tzs,
      recipient_type: values.recipient_type,
      recipient_id: values.recipient_id,
      vendor_name: values.vendor_name,
      note: values.note,
    });
  };

  const handleExportSelected = () => {
    const selected = allMovements.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Date', 'Type', 'Qty', 'Total Value', 'Recipient', 'Note'].join(','),
      ...selected.map(r =>
        [dayjs(r.created_at).format('DD MMM YYYY HH:mm'), r.movement_type,
         r.qty, r.total_value_tzs,
         r.vendor_name || r.recipient_type || 'Office', r.note || ''].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `token-movements-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const cols = [
    {
      title: 'Date', dataIndex: 'created_at',
      render: v => dayjs(v).format('DD MMM YYYY HH:mm'),
      width: 150, sorter: (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Type', dataIndex: 'movement_type',
      render: (v) => {
        const Icon = MOVEMENT_ICONS[v];
        return (
          <Space size={4}>
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <Tag color={TYPE_COLORS[v]} className="!text-[10px] !px-2">{TYPE_LABELS[v] || v}</Tag>
          </Space>
        );
      }, width: 170,
    },
    {
      title: 'Qty', key: 'qty',
      render: (_, r) => {
        const isOut = ['refill_out', 'distribute', 'lend'].includes(r.movement_type);
        return (
          <span className={`font-semibold ${isOut ? 'text-red-600' : 'text-green-600'}`}>
            {isOut ? '-' : '+'}{Math.abs(r.qty).toLocaleString()}
          </span>
        );
      },
      width: 80,
    },
    {
      title: 'Total Value', dataIndex: 'total_value_tzs',
      render: v => fmt(v),
      width: 110,
    },
    {
      title: 'Balance', dataIndex: 'running_balance',
      render: v => {
        const color = v < 0 ? 'text-red-600' : v === 0 ? 'text-slate-500' : 'text-brand-dark';
        return <span className={`font-bold ${color}`}>{v?.toLocaleString()}</span>;
      },
      width: 130,
    },
    {
      title: 'Recipient', key: 'recipient',
      render: (_, r) => {
        if (r.vendor_name) return r.vendor_name;
        if (r.recipient_type === 'shop' && r.recipient_id) return `Shop #${r.recipient_id}`;
        if (r.recipient_type) return `${r.recipient_type} #${r.recipient_id}`;
        if (r.movement_type === 'purchase') return 'Office';
        return '—';
      }, width: 140,
    },
    {
      title: 'Issuer', key: 'creator',
      render: (_, r) => (
        <Space size={4}>
          <User className="w-3 h-3 text-slate-400" />
          <span className="text-sm">{r.creator?.name || '—'}</span>
        </Space>
      ),
      width: 130,
    },
    {
      title: 'Note', dataIndex: 'note',
      ellipsis: true,
    },
  ];

  const mobileFields = [
    { key: 'type', dataIndex: 'movement_type',
      render: (v) => TYPE_LABELS[v] || v },
    { key: 'qty', label: 'Qty', dataIndex: 'qty' },
    { key: 'value', label: 'Value', dataIndex: 'total_value_tzs' },
  ];

  const renderFormFields = () => {
    const cfg = FORM_CONFIG[movementType];
    if (!cfg) return null;

    return (
      <>
        {cfg.recipient && (
          <>
            <Form.Item name="recipient_type" label="Recipient Type" rules={[{ required: true }]}>
              <Select onChange={() => form.setFieldValue('recipient_id', undefined)} placeholder="Select type">
                {cfg.recipientTypes.map(t => <Option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(p, n) => p.recipient_type !== n.recipient_type}>
              {({ getFieldValue }) => {
                const rtype = getFieldValue('recipient_type');
                if (!rtype) return null;
                const isShop = rtype === 'shop';
                if (isShop) return null;
                const options = rtype === 'partner'
                  ? allPartners.map(p => ({ id: p.id, name: p.name }))
                  : users.filter(u => u.role?.name === (rtype === 'collector' ? 'Collector' : 'Technician'))
                      .map(u => ({ id: u.id, name: u.name }));
                return (
                  <Form.Item name="recipient_id" label="Select Recipient" rules={[{ required: true }]}>
                    <Select showSearch optionFilterProp="label" placeholder="Search...">
                      {options.map(o => <Option key={o.id} value={o.id} label={o.name}>{o.name}</Option>)}
                    </Select>
                  </Form.Item>
                );
              }}
            </Form.Item>
          </>
        )}

        {cfg.vendor && (
          <>
            <Form.Item name="vendor_name" label="Vendor Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Meteora Supplies Ltd" />
            </Form.Item>
            <Form.Item name="reference" label="Reference">
              <Input placeholder="Agreement / contract number" />
            </Form.Item>
          </>
        )}

        {cfg.fields.includes('qty') && (
          <Form.Item name="qty" label="Quantity (tokens)" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber min={1} className="!w-full" />
          </Form.Item>
        )}

        {cfg.fields.includes('unit_value_tzs') && (
          <Form.Item name="unit_value_tzs" label="Value per Token (TZS)" rules={[{ required: true }]} initialValue={200}>
            <InputNumber min={1} className="!w-full" />
          </Form.Item>
        )}

        {cfg.fields.includes('note') && (
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} />
          </Form.Item>
        )}
      </>
    );
  };

  const kpiTotalDistributed = allMovements.filter(m => m.movement_type === 'distribute').reduce((s, m) => s + Math.abs(m.qty), 0);
  const kpiTotalRefilled = allMovements.filter(m => m.movement_type === 'refill_out').reduce((s, m) => s + Math.abs(m.qty), 0);
  const kpiOutstandingHolders = outstanding.filter(o => o.direction === 'out').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Token Inventory</h4>
          <span className="text-xs text-slate-500">{allMovements.length} movements</span>
        </div>
        <Button icon={<Package className="w-4 h-4" />} onClick={() => { form.resetFields(); setOpenModal('record'); }}
          className="!bg-brand-dark hover:!bg-brand-light hover:!text-white border-none shadow-sm flex items-center gap-1.5 text-white">
          Record Movement
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Office Stock" value={officeStock} icon={Package} bgColor={officeStock < 500 ? 'bg-red-50' : 'bg-slate-50'} iconColor={officeStock < 500 ? 'text-red-600' : 'text-slate-600'} />
        <KpiCard title="Total Distributed" value={kpiTotalDistributed} icon={Package} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard title="Total Refilled" value={kpiTotalRefilled} icon={Package} bgColor="bg-amber-50" iconColor="text-amber-600" />
        <KpiCard title="Outstanding Holders" value={kpiOutstandingHolders} icon={User} bgColor="bg-purple-50" iconColor="text-purple-600" />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Select size="small" allowClear placeholder="Filter by type"
            value={movementTypeFilter}
            onChange={(v) => setMovementTypeFilter(v)}
            className="w-full sm:w-44">
            {Object.entries(TYPE_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
          </Select>
          {movementTypeFilter && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={() => setMovementTypeFilter(undefined)}
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
        <Table
          dataSource={rows}
          columns={cols}
          rowKey="id"
          loading={isLoading}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          locale={{ emptyText: <Empty description="No movements recorded" /> }}
          pagination={{ pageSize: 25, showSizeChanger: false }}
        />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {movementsWithBalance.length === 0 ? (
          <Empty description="No movements recorded" />
        ) : (
          <List
            dataSource={movementsWithBalance}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={mobileFields}
                onClick={() => {}}
              />
            )}
          />
        )}
      </div>

      {/* Record Movement Modal */}
      <Modal title={<span className="text-sm font-bold text-slate-700">Record Token Movement</span>}
        open={openModal === 'record'} onCancel={() => { setOpenModal(null); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={addMutation.isPending} width={520}
        className="top-8">
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Form.Item name="movement_type" label={<span className="text-xs font-semibold text-slate-600">Movement Type</span>} rules={[{ required: true }]}>
            <Select placeholder="Select movement type" onChange={() => form.resetFields(['recipient_type', 'recipient_id', 'vendor_name', 'qty', 'unit_value_tzs', 'note'])}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Select>
          </Form.Item>
          {renderFormFields()}
        </Form>
      </Modal>
    </div>
  );
}
