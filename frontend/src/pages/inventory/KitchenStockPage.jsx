import { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Select, InputNumber, Input, Space, Tabs, App, List, Empty, Tag, DatePicker, Popconfirm,
} from 'antd';
import {
  Plus, Minus, RefreshCw, FileDown, X, MapPin, Box, AlertTriangle, CalendarCheck,
  Package, Settings2, Save,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kitchenStockAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

const CATEGORY_META = {
  meats_proteins: { label: 'Meats & Proteins', color: 'red' },
  perishables: { label: 'Perishables', color: 'green' },
  staples: { label: 'Staples', color: 'geekblue' },
  seasonings: { label: 'Seasonings & Pantry', color: 'purple' },
  consumables: { label: 'Consumables', color: 'cyan' },
  beverages: { label: 'Beverages', color: 'blue' },
  other: { label: 'Other', color: 'default' },
};

const UNIT_META = {
  portions: 'Portions', kg: 'kg', qty: 'Qty', packs: 'Packs',
  bottles: 'Bottles', liters: 'Liters', boxes: 'Boxes', bags: 'Bags',
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function KitchenStockPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('inventory', 'create');
  const canUpdate = hasPermission('inventory', 'update');

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [draftRows, setDraftRows] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [categoryFilter, setCategoryFilter] = useState(null);

  const [adjustModal, setAdjustModal] = useState({ open: false, row: null, type: 'sold', qty: 1 });
  const [editModal, setEditModal] = useState({ open: false, row: null });
  const [locationModal, setLocationModal] = useState({ open: false, editing: null });
  const [itemModal, setItemModal] = useState({ open: false, editing: null });
  const [locationForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const dateStr = selectedDate.format('YYYY-MM-DD');

  // ── Locations ──
  const { data: locationsRes } = useQuery({
    queryKey: ['kitchen-locations'],
    queryFn: () => kitchenStockAPI.listLocations().then(r => r.data.data),
  });
  const locations = useMemo(() => (locationsRes?.data || []).filter(l => l.is_active), [locationsRes]);

  // Auto-select first location if none yet
  useEffect(() => {
    if (!selectedLocation && locations.length > 0) setSelectedLocation(locations[0].id);
  }, [locations, selectedLocation]);

  // ── Items catalog ──
  const { data: itemsRes } = useQuery({
    queryKey: ['kitchen-items'],
    queryFn: () => kitchenStockAPI.listItems().then(r => r.data.data),
  });
  const items = itemsRes?.data || [];

  // ── Daily entries ──
  const { data: entriesRes, isLoading: entriesLoading } = useQuery({
    queryKey: ['kitchen-entries', selectedLocation, dateStr],
    queryFn: () => kitchenStockAPI.getEntries({ location_id: selectedLocation, date: dateStr }).then(r => r.data.data),
    enabled: !!selectedLocation,
  });

  useEffect(() => {
    if (entriesRes) setDraftRows(entriesRes.data || []);
  }, [entriesRes]);

  // ── Stats ──
  const { data: statsRes } = useQuery({
    queryKey: ['kitchen-stats', selectedLocation, dateStr],
    queryFn: () => kitchenStockAPI.getStats({ location_id: selectedLocation, date: dateStr }).then(r => r.data.data),
    enabled: !!selectedLocation,
  });
  const stats = statsRes || {};

  // ── Restock list ──
  const { data: restockRes, isLoading: restockLoading } = useQuery({
    queryKey: ['kitchen-restock', selectedLocation, dateStr],
    queryFn: () => kitchenStockAPI.getRestockList({ location_id: selectedLocation, date: dateStr }).then(r => r.data.data),
    enabled: !!selectedLocation,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['kitchen-entries'] });
    qc.invalidateQueries({ queryKey: ['kitchen-stats'] });
    qc.invalidateQueries({ queryKey: ['kitchen-restock'] });
  };

  // ── Mutations ──
  const saveEntriesMutation = useMutation({
    mutationFn: (items) => kitchenStockAPI.upsertEntries({ location_id: selectedLocation, entry_date: dateStr, items }),
    onSuccess: () => { message.success('Daily stock entry saved'); invalidateAll(); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to save entry'),
  });

  const quickAdjustMutation = useMutation({
    mutationFn: (d) => kitchenStockAPI.quickAdjust(d),
    onSuccess: () => { message.success('Stock updated'); invalidateAll(); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to update stock'),
  });

  const createItemMutation = useMutation({
    mutationFn: (d) => itemModal.editing ? kitchenStockAPI.updateItem(itemModal.editing.id, d) : kitchenStockAPI.createItem(d),
    onSuccess: () => { message.success('Item saved'); qc.invalidateQueries({ queryKey: ['kitchen-items'] }); itemForm.resetFields(); setItemModal({ open: false, editing: null }); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to save item'),
  });

  const createLocationMutation = useMutation({
    mutationFn: (d) => locationModal.editing ? kitchenStockAPI.updateLocation(locationModal.editing.id, d) : kitchenStockAPI.createLocation(d),
    onSuccess: () => { message.success('Location saved'); qc.invalidateQueries({ queryKey: ['kitchen-locations'] }); locationForm.resetFields(); setLocationModal({ open: false, editing: null }); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to save location'),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (id) => kitchenStockAPI.deleteLocation(id),
    onSuccess: () => { message.success('Location deactivated'); setSelectedLocation(null); qc.invalidateQueries({ queryKey: ['kitchen-locations'] }); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to deactivate location'),
  });

  // ── Row editing helpers ──
  const updateDraft = (itemId, field, value) => {
    setDraftRows(prev => prev.map(r => {
      if (r.item_id !== itemId) return r;
      const next = { ...r, [field]: value };
      const opening = toNum(next.opening_stock);
      const received = toNum(next.received);
      const sold = toNum(next.sold);
      const spoiled = toNum(next.spoiled);
      next.closing_stock = Math.round((opening + received - sold - spoiled) * 100) / 100;
      const physical = next.physical_count === null || next.physical_count === '' ? null : toNum(next.physical_count);
      next.variance = physical === null ? null : Math.round((physical - next.closing_stock) * 100) / 100;
      return next;
    }));
  };

  const handleSaveAll = () => {
    if (!canCreate && !canUpdate) return;
    const items = draftRows.map(r => ({
      item_id: r.item_id,
      received: toNum(r.received),
      sold: toNum(r.sold),
      spoiled: toNum(r.spoiled),
      physical_count: r.physical_count === null || r.physical_count === '' ? null : toNum(r.physical_count),
      notes: r.notes || null,
    }));
    saveEntriesMutation.mutate(items);
  };

  const handleQuickAdjust = () => {
    if (!canCreate) return;
    quickAdjustMutation.mutate({
      location_id: selectedLocation,
      item_id: adjustModal.row.item_id,
      type: adjustModal.type,
      adjustment: adjustModal.qty,
      entry_date: dateStr,
    });
    setAdjustModal({ open: false, row: null, type: 'sold', qty: 1 });
  };

  const handleExport = () => {
    kitchenStockAPI.exportEntries({ location_id: selectedLocation, date_from: dateStr, date_to: dateStr })
      .then(r => {
        const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `kitchen-stock-${dateStr}.xlsx`;
        a.click();
      })
      .catch(() => message.error('Export failed'));
  };

  const handleExportRestock = () => {
    const rows = restockRes?.data || [];
    if (rows.length === 0) { message.info('Nothing to export'); return; }
    const csv = [
      ['Item', 'Location', 'Current Stock', 'Min Threshold', 'Unit'].join(','),
      ...rows.map(r => [r.item?.name, r.location?.name || locationName(), r.closing_stock, r.item?.min_threshold || 0, r.item?.default_unit || ''].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `restock-list-${dateStr}.csv`; a.click();
  };

  const locationName = () => locations.find(l => l.id === selectedLocation)?.name || '';

  // ── Desktop columns (Daily Entry tab) ──
  const entryCols = [
    {
      title: 'Item Name', dataIndex: ['item', 'name'], width: 180,
      render: (name, r) => (
        <div>
          <span className="font-medium text-sm text-slate-700">{name}</span>
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">{UNIT_META[r.item?.default_unit] || r.item?.default_unit}</div>
        </div>
      ),
    },
    {
      title: 'Opening', dataIndex: 'opening_stock', width: 90, align: 'right',
      render: (v) => <span className="text-slate-500">{toNum(v)}</span>,
    },
    {
      title: 'Received', dataIndex: 'received', width: 100, align: 'right',
      render: (_, r) => (
        <InputNumber size="small" min={0} value={r.received} className="w-full"
          onChange={(v) => updateDraft(r.item_id, 'received', v ?? 0)}
          disabled={!canCreate && !canUpdate} />
      ),
    },
    {
      title: 'Sold', dataIndex: 'sold', width: 90, align: 'right',
      render: (_, r) => (
        <InputNumber size="small" min={0} value={r.sold} className="w-full"
          onChange={(v) => updateDraft(r.item_id, 'sold', v ?? 0)}
          disabled={!canCreate && !canUpdate} />
      ),
    },
    {
      title: 'Spoiled', dataIndex: 'spoiled', width: 90, align: 'right',
      render: (_, r) => (
        <InputNumber size="small" min={0} value={r.spoiled} className="w-full"
          onChange={(v) => updateDraft(r.item_id, 'spoiled', v ?? 0)}
          disabled={!canCreate && !canUpdate} />
      ),
    },
    {
      title: 'Closing', dataIndex: 'closing_stock', width: 100, align: 'right',
      render: (v, r) => {
        const low = toNum(v) <= toNum(r.item?.min_threshold) && toNum(r.item?.min_threshold) > 0;
        return (
          <span className={`font-bold text-sm ${low ? 'text-red-600' : 'text-slate-800'}`}>
            {toNum(v)}
            {low && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 text-red-500" />}
          </span>
        );
      },
    },
    {
      title: 'Physical Count', dataIndex: 'physical_count', width: 110, align: 'right',
      render: (_, r) => (
        <InputNumber size="small" value={r.physical_count} className="w-full" placeholder="—"
          onChange={(v) => updateDraft(r.item_id, 'physical_count', v === null || v === undefined ? '' : v)}
          disabled={!canCreate && !canUpdate} />
      ),
    },
    {
      title: 'Shot', width: 110, align: 'right',
      render: (_, r) => {
        if (r.variance === null || r.variance === undefined) return <span className="text-slate-300">—</span>;
        const v = toNum(r.variance);
        const color = v < 0 ? 'text-red-600' : v > 0 ? 'text-emerald-600' : 'text-slate-500';
        return <span className={`font-semibold ${color}`}>{v > 0 ? '+' : ''}{v}</span>;
      },
    },
    {
      title: 'Quick', width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="text" className="!text-red-600 hover:!bg-red-50 flex items-center justify-center" icon={<Minus className="w-3.5 h-3.5" />}
            onClick={() => canCreate && setAdjustModal({ open: true, row: r, type: 'sold', qty: 1 })} />
          <Button size="small" type="text" className="!text-emerald-600 hover:!bg-emerald-50 flex items-center justify-center" icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => canCreate && setAdjustModal({ open: true, row: r, type: 'received', qty: 1 })} />
        </Space>
      ),
    },
  ];

  // ── Per-item details row (expand) ──
  const entryDetailsRender = (r) => {
    const cat = CATEGORY_META[r.item?.category] || CATEGORY_META.other;
    return (
      <div className="px-2 py-2 text-xs text-slate-600 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-400 uppercase tracking-wide font-semibold">Category</span>
          <Tag color={cat.color}>{cat.label}</Tag>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-slate-400 uppercase tracking-wide font-semibold">Min Threshold</span>
          <span className="font-semibold text-slate-700">{toNum(r.item?.min_threshold)} {UNIT_META[r.item?.default_unit] || ''}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-slate-400 uppercase tracking-wide font-semibold">Unit</span>
          <span className="font-medium">{UNIT_META[r.item?.default_unit] || r.item?.default_unit || '—'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-slate-400 uppercase tracking-wide font-semibold">Notes</span>
          <span className="font-medium">{r.notes || '—'}</span>
        </span>
      </div>
    );
  };

  // Category-filtered view (display only — Save All always saves every draft row)
  const visibleRows = useMemo(() => {
    if (!categoryFilter) return draftRows || [];
    return (draftRows || []).filter(r => r.item?.category === categoryFilter);
  }, [draftRows, categoryFilter]);

  const summaryTotals = useMemo(() => {
    const t = { opening: 0, received: 0, sold: 0, spoiled: 0, closing: 0 };
    (visibleRows || []).forEach(r => {
      t.opening += toNum(r.opening_stock);
      t.received += toNum(r.received);
      t.sold += toNum(r.sold);
      t.spoiled += toNum(r.spoiled);
      t.closing += toNum(r.closing_stock);
    });
    return t;
  }, [visibleRows]);

  // ── Overview columns ──
  const overviewCols = [
    { title: 'Item', dataIndex: ['item', 'name'], render: (name, r) => (
      <span className="font-medium text-sm text-slate-700">{name} <span className="text-xs text-slate-400 ml-1">({UNIT_META[r.item?.default_unit] || ''})</span></span>
    ) },
    { title: 'Category', render: (_, r) => { const c = CATEGORY_META[r.item?.category] || CATEGORY_META.other; return <Tag color={c.color}>{c.label}</Tag>; }, responsive: ['md'] },
    { title: 'Current Stock', dataIndex: 'closing_stock', align: 'right', render: (v, r) => <span className="font-semibold">{toNum(v)}</span> },
    { title: 'Min Threshold', render: (_, r) => toNum(r.item?.min_threshold), align: 'right', responsive: ['md'] },
    { title: 'Status', render: (_, r) => {
      const v = toNum(r.closing_stock);
      const th = toNum(r.item?.min_threshold);
      if (th > 0 && v <= th) return <Tag color="red" className="!font-semibold">Low Stock</Tag>;
      return <Tag color="green">OK</Tag>;
    } },
  ];

  // ── Restock columns ──
  const restockCols = [
    { title: 'Item', dataIndex: ['item', 'name'], render: (n) => <span className="font-medium text-sm text-slate-700">{n}</span> },
    { title: 'Current', dataIndex: 'closing_stock', align: 'right', render: (v) => <span className="font-bold text-red-600">{toNum(v)}</span> },
    { title: 'Threshold', render: (_, r) => <span className="font-semibold">{toNum(r.item?.min_threshold)}</span>, align: 'right' },
    { title: 'Unit', render: (_, r) => UNIT_META[r.item?.default_unit] || '', responsive: ['md'] },
  ];

  // ── Mobile fields ──
  const mobileEntryFields = (row) => [
    { key: 'name', dataIndex: ['item', 'name'] },
    {
      key: 'cat', label: 'Category',
      render: (_, r) => CATEGORY_META[r.item?.category]?.label || 'Other',
    },
    {
      key: 'flow', label: 'O / R / S / Sp',
      render: (_, r) => `${toNum(r.opening_stock)} / ${toNum(r.received)} / ${toNum(r.sold)} / ${toNum(r.spoiled)}`,
    },
    {
      key: 'closing', label: 'Closing',
      render: (_, r) => {
        const low = toNum(r.closing_stock) <= toNum(r.item?.min_threshold) && toNum(r.item?.min_threshold) > 0;
        return <span className={low ? 'text-red-600 font-semibold' : ''}>{toNum(r.closing_stock)}</span>;
      },
    },
    {
      key: 'shot', label: 'Shot',
      render: (_, r) => r.variance === null || r.variance === undefined ? '—' : `${toNum(r.variance) > 0 ? '+' : ''}${toNum(r.variance)}`,
    },
  ];

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Kitchen Stock</h4>
          <span className="text-xs text-slate-500">
            {selectedLocation ? `${locations.find(l => l.id === selectedLocation)?.name || ''} — daily kitchen ledger` : 'Select a location'}
          </span>
        </div>
        <Space size={[8, 8]} wrap>
          <Select
            placeholder="Select location"
            className="w-full sm:w-[240px]"
            value={selectedLocation || undefined}
            onChange={(v) => { setSelectedLocation(v); setDraftRows([]); }}
            allowClear showSearch optionFilterProp="children">
            {locations.map(l => <Option key={l.id} value={l.id}>{l.name} ({l.code})</Option>)}
          </Select>
          {canCreate && (
            <>
              <Button icon={<Settings2 className="w-4 h-4" />} className="flex items-center gap-1 !text-xs"
                onClick={() => { locationForm.resetFields(); setLocationModal({ open: true, editing: null }); }}>
                Locations
              </Button>
              <Button icon={<Plus className="w-4 h-4" />} className="flex items-center gap-1 !text-xs"
                onClick={() => { itemForm.resetFields(); setItemModal({ open: true, editing: null }); }}>
                Add Item
              </Button>
            </>
          )}
        </Space>
      </div>

      {/* No locations yet */}
      {locations.length === 0 && canCreate && (
        <div className="text-center py-12 text-slate-400 rounded-lg border border-dashed border-slate-200">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No locations yet — create one to start tracking kitchen stock</p>
          <Button type="primary" className="mt-4 !bg-brand-dark hover:!bg-brand-light border-none"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => { locationForm.resetFields(); setLocationModal({ open: true, editing: null }); }}>
            Create Location
          </Button>
        </div>
      )}

      {locations.length === 0 && !canCreate && (
        <div className="text-center py-12 text-slate-400">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No kitchen locations available</p>
        </div>
      )}

      {/* ── MAIN (location selected) ── */}
      {selectedLocation && (
        <>
          {/* KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <KpiCard title="Total Items" value={stats.totalItems ?? draftRows.length} icon={Package} bgColor="bg-slate-50" iconColor="text-slate-600" formatter={false} />
            <KpiCard title="Recorded Today" value={stats.todayCount ?? 0} icon={CalendarCheck} bgColor="bg-emerald-50" iconColor="text-emerald-600" formatter={false} />
            <KpiCard title="Low Stock" value={stats.lowStock ?? 0} icon={AlertTriangle} bgColor="bg-red-50" iconColor="text-red-600" formatter={false} />
            <KpiCard title="Locations" value={stats.activeLocationCount ?? locations.length} icon={MapPin} bgColor="bg-blue-50" iconColor="text-blue-600" formatter={false} />
          </div>

          {/* FILTER BAR */}
          <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
            <Space wrap size={[8, 8]} className="w-full">
              <DatePicker
                allowClear={false}
                value={selectedDate}
                onChange={(d) => { setSelectedDate(d || dayjs()); setDraftRows([]); }}
                className="w-full sm:w-[160px]"
              />
              <Select
                allowClear
                placeholder="All categories"
                className="w-full sm:w-[180px]"
                value={categoryFilter || undefined}
                onChange={(v) => setCategoryFilter(v || null)}>
                {Object.entries(CATEGORY_META).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
              </Select>
              <span className="text-xs text-slate-400">Closing = Opening + Received − Sold − Spoiled · Shot = Physical − Closing</span>
              <div className="flex-1" />
              <Button size="small" icon={<RefreshCw className="w-3.5 h-3.5" />} className="flex items-center gap-1 !text-xs"
                onClick={() => invalidateAll()}>
                Refresh
              </Button>
              <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} className="flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark"
                onClick={handleExport}>
                Export Excel
              </Button>
              {(canCreate || canUpdate) && (
                <Button type="primary" size="small" icon={<Save className="w-3.5 h-3.5" />} className="!bg-brand-dark hover:!bg-brand-light border-none flex items-center gap-1 text-white !text-xs"
                  loading={saveEntriesMutation.isPending} onClick={handleSaveAll}>
                  Save All
                </Button>
              )}
            </Space>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            {
              key: 'daily',
              label: <span className="text-xs font-semibold">Daily Entry</span>,
              children: (
                <div>
                  <div className="hidden overflow-x-auto md:block">
                    <Table
                      dataSource={visibleRows}
                      columns={entryCols}
                      rowKey={(r) => r.id || `new-${r.item_id}`}
                      loading={entriesLoading}
                      size="middle"
                      scroll={{ x: 980 }}
                      locale={{ emptyText: <Empty description="No items available" /> }}
                      pagination={false}
                      expandable={{ expandedRowRender: entryDetailsRender }}
                      summary={() => (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={2}>
                            <span className="text-xs font-bold uppercase text-slate-500">Totals</span>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right"><span className="font-bold">{summaryTotals.opening}</span></Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right"><span className="font-bold text-emerald-600">{summaryTotals.received}</span></Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right"><span className="font-bold text-red-600">{summaryTotals.sold}</span></Table.Summary.Cell>
                          <Table.Summary.Cell index={5} align="right"><span className="font-bold text-amber-600">{summaryTotals.spoiled}</span></Table.Summary.Cell>
                          <Table.Summary.Cell index={6} align="right"><span className="font-bold">{summaryTotals.closing}</span></Table.Summary.Cell>
                          <Table.Summary.Cell index={7} colSpan={3} />
                        </Table.Summary.Row>
                      )}
                    />
                  </div>

                  {/* MOBILE */}
                  <div className="md:hidden space-y-2">
                    {visibleRows.length === 0 ? <Empty description="No items" /> : (
                      <List
                        dataSource={visibleRows}
                        renderItem={(r) => (
                          <MobileCard
                            record={r}
                            fields={mobileEntryFields(r)}
                            onClick={() => {
                              editForm.setFieldsValue({
                                received: toNum(r.received),
                                sold: toNum(r.sold),
                                spoiled: toNum(r.spoiled),
                                physical_count: r.physical_count === null ? undefined : toNum(r.physical_count),
                                notes: r.notes || '',
                              });
                              setEditModal({ open: true, row: r });
                            }}
                            actions={[
                              { label: '-', icon: <Minus className="w-3.5 h-3.5" />, danger: true, onClick: (row) => canCreate && setAdjustModal({ open: true, row, type: 'sold', qty: 1 }) },
                              { label: '+', icon: <Plus className="w-3.5 h-3.5" />, onClick: (row) => canCreate && setAdjustModal({ open: true, row, type: 'received', qty: 1 }) },
                            ]}
                          />
                        )}
                      />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'overview',
              label: <span className="text-xs font-semibold">Stock Overview</span>,
              children: (
                <div className="hidden overflow-x-auto md:block">
                  <Table dataSource={draftRows} columns={overviewCols} rowKey={(r) => r.id || `new-${r.item_id}`}
                    size="middle" pagination={false} loading={entriesLoading} />
                </div>
              ),
            },
            {
              key: 'restock',
              label: <span className="text-xs font-semibold">Restock List</span>,
              children: (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-slate-500">
                      {restockRes?.count ?? 0} item(s) at or below minimum threshold
                    </span>
                    <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} className="flex items-center gap-1 !text-xs"
                      onClick={handleExportRestock}>
                      Export CSV
                    </Button>
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <Table dataSource={restockRes?.data || []} columns={restockCols} rowKey={(r) => `restock-${r.item_id}`}
                      size="middle" pagination={false} loading={restockLoading}
                      locale={{ emptyText: <Empty description="All items above threshold" /> }} />
                  </div>
                  <div className="md:hidden space-y-2">
                    {(restockRes?.data || []).length === 0 ? <Empty description="All items above threshold" /> : (
                      <List dataSource={restockRes?.data || []} renderItem={(r) => (
                        <MobileCard record={r} statusColor="red"
                          fields={[
                            { key: 'item', dataIndex: ['item', 'name'] },
                            { key: 'closing', label: 'Current', render: (_, rr) => toNum(rr.closing_stock) },
                            { key: 'threshold', label: 'Threshold', render: (_, rr) => toNum(rr.item?.min_threshold) },
                          ]} />
                      )} />
                    )}
                  </div>
                </div>
              ),
            },
          ]} />
        </>
      )}

      {/* ── QUICK ADJUST MODAL ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">{adjustModal.row?.item?.name} — {adjustModal.type === 'received' ? 'Restock (+)' : 'Consume (−)'}</span>}
        open={adjustModal.open}
        onCancel={() => setAdjustModal({ open: false, row: null, type: 'sold', qty: 1 })}
        onOk={handleQuickAdjust}
        confirmLoading={quickAdjustMutation.isPending}
        destroyOnClose
        className="top-8">
        <p className="text-xs text-slate-500 mb-4">
          {adjustModal.type === 'received'
            ? 'This adds to today\'s Received column.'
            : 'This adds to today\'s Sold column (consumption).'}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Quantity:</span>
          <InputNumber min={1} value={adjustModal.qty} onChange={(v) => setAdjustModal(m => ({ ...m, qty: v || 1 }))} className="flex-1" />
          <span className="text-xs text-slate-400">{adjustModal.row?.item?.default_unit || ''}</span>
        </div>
      </Modal>

      {/* ── EDIT ROW MODAL (mobile) ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">{editModal.row?.item?.name}</span>}
        open={editModal.open}
        onCancel={() => setEditModal({ open: false, row: null })}
        onOk={() => editForm.submit()}
        confirmLoading={saveEntriesMutation.isPending}
        destroyOnClose
        className="top-8">
        <Form form={editForm} layout="vertical" className="mt-4"
          onFinish={(values) => {
            const r = editModal.row;
            saveEntriesMutation.mutate([{
              item_id: r.item_id,
              received: values.received || 0,
              sold: values.sold || 0,
              spoiled: values.spoiled || 0,
              physical_count: values.physical_count === undefined || values.physical_count === null ? null : values.physical_count,
              notes: values.notes || null,
            }]);
            setEditModal({ open: false, row: null });
          }}>
          {editModal.row && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 mb-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Category</p>
                <span>{CATEGORY_META[editModal.row.item?.category]?.label || 'Other'}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Unit</p>
                <span>{UNIT_META[editModal.row.item?.default_unit] || editModal.row.item?.default_unit || '—'}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Min Threshold</p>
                <span className="font-semibold">{toNum(editModal.row.item?.min_threshold)}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Closing</p>
                <span className={toNum(editModal.row.closing_stock) <= toNum(editModal.row.item?.min_threshold) && toNum(editModal.row.item?.min_threshold) > 0 ? 'text-red-600 font-semibold' : 'font-semibold'}>{toNum(editModal.row.closing_stock)}</span>
              </div>
            </div>
          )}
          <Form.Item name="received" label={<span className="text-xs font-semibold text-slate-600">Received</span>}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="sold" label={<span className="text-xs font-semibold text-slate-600">Sold</span>}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="spoiled" label={<span className="text-xs font-semibold text-slate-600">Spoiled / Damaged</span>}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="physical_count" label={<span className="text-xs font-semibold text-slate-600">Physical Count</span>}>
            <InputNumber className="w-full" />
          </Form.Item>
          <Form.Item name="notes" label={<span className="text-xs font-semibold text-slate-600">Notes</span>}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── LOCATION MODAL ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">{locationModal.editing ? 'Edit Location' : 'Create Location'}</span>}
        open={locationModal.open}
        onCancel={() => { locationForm.resetFields(); setLocationModal({ open: false, editing: null }); }}
        onOk={() => locationForm.submit()}
        confirmLoading={createLocationMutation.isPending}
        destroyOnClose
        className="top-8">
        <Form form={locationForm} layout="vertical" className="mt-4"
          initialValues={locationModal.editing ? { name: locationModal.editing.name, code: locationModal.editing.code, is_active: locationModal.editing.is_active } : { is_active: true }}
          onFinish={(values) => createLocationMutation.mutate(values)}>
          <Form.Item name="name" label={<span className="text-xs font-semibold text-slate-600">Location Name</span>} rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Dante26 Main Kitchen" />
          </Form.Item>
          <Form.Item name="code" label={<span className="text-xs font-semibold text-slate-600">Code</span>} rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. DANTE26" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="is_active" label={<span className="text-xs font-semibold text-slate-600">Active</span>}>
            <Select>
              <Option value={true}>Yes</Option>
              <Option value={false}>No</Option>
            </Select>
          </Form.Item>
        </Form>
        {locationModal.editing && (
          <Popconfirm title="Deactivate this location?" description="Historical entries are kept."
            okText="Deactivate" okButtonProps={{ danger: true }} cancelText="Cancel"
            onConfirm={() => { deleteLocationMutation.mutate(locationModal.editing.id); setLocationModal({ open: false, editing: null }); }}>
            <Button danger size="small" className="mt-2">Deactivate Location</Button>
          </Popconfirm>
        )}
      </Modal>

      {/* ── ITEM MODAL ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">{itemModal.editing ? 'Edit Item' : 'Add Item to Catalog'}</span>}
        open={itemModal.open}
        onCancel={() => { itemForm.resetFields(); setItemModal({ open: false, editing: null }); }}
        onOk={() => itemForm.submit()}
        confirmLoading={createItemMutation.isPending}
        destroyOnClose
        className="top-8">
        <Form form={itemForm} layout="vertical" className="mt-4"
          initialValues={itemModal.editing ? {
            name: itemModal.editing.name,
            category: itemModal.editing.category,
            default_unit: itemModal.editing.default_unit,
            min_threshold: toNum(itemModal.editing.min_threshold),
          } : { category: 'meats_proteins', default_unit: 'qty' }}
          onFinish={(values) => {
            createItemMutation.mutate({ ...values, v: undefined });
          }}>
          <Form.Item name="name" label={<span className="text-xs font-semibold text-slate-600">Item Name</span>} rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Beef Ribs" />
          </Form.Item>
          <Form.Item name="category" label={<span className="text-xs font-semibold text-slate-600">Category</span>} rules={[{ required: true }]}>
            <Select>
              {Object.entries(CATEGORY_META).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="default_unit" label={<span className="text-xs font-semibold text-slate-600">Unit of Measure</span>} rules={[{ required: true }]}>
            <Select>
              {Object.entries(UNIT_META).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="min_threshold" label={<span className="text-xs font-semibold text-slate-600">Min Threshold (low-stock alert)</span>}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}