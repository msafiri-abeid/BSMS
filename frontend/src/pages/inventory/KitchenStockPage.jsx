import { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Select, InputNumber, Input, Space, Tabs, App, List, Empty, Tag, DatePicker, Popconfirm,
} from 'antd';
import {
  Plus, Minus, FileDown, MapPin, AlertTriangle, CalendarCheck,
  Package, PackagePlus, Settings2, Pencil, Trash2, ArrowLeft, SlidersHorizontal, X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kitchenStockAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import KpiCard from '../../components/KpiCard';
import MobileCard from '../../components/MobileCard';
import ActionMenu from '../../components/ActionMenu';
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

const MOVE_TYPE_META = {
  received: { label: 'Received', color: 'green' },
  sold: { label: 'Sold', color: 'orange' },
  spoiled: { label: 'Spoiled / Damaged', color: 'red' },
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function KitchenStockPage() {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('inventory', 'create');
  const canUpdate = hasPermission('inventory', 'update');
  const canDelete = hasPermission('inventory', 'delete');

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [draftRows, setDraftRows] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [categoryFilter, setCategoryFilter] = useState(null);

  const [adjustModal, setAdjustModal] = useState({ open: false, row: null, qty: 1, notes: '' });
  const [restockModal, setRestockModal] = useState({ open: false, item_id: null, qty: 1, expiry: null, notes: '' });
  const [disposeModal, setDisposeModal] = useState({ open: false, item_id: null, qty: 1, notes: '' });
  const [editModal, setEditModal] = useState({ open: false, row: null });
  const [detailModal, setDetailModal] = useState(null);
  const [editDayNotes, setEditDayNotes] = useState([]);
  const [editNoteInput, setEditNoteInput] = useState('');
  const [locationModal, setLocationModal] = useState({ open: false, showForm: false, editing: null });
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
  const allLocations = locationsRes?.data || [];
  const locations = useMemo(() => allLocations.filter(l => l.is_active), [allLocations]);

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

  const deleteEntryMutation = useMutation({
    mutationFn: (id) => kitchenStockAPI.deleteEntry(id),
    onSuccess: () => { message.success('Entry deleted'); invalidateAll(); },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to delete entry'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => kitchenStockAPI.deleteItem(id),
    onSuccess: () => {
      message.success('Item removed from stock');
      qc.invalidateQueries({ queryKey: ['kitchen-items'] });
      invalidateAll();
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to delete item'),
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
  const openEditModal = (row) => {
    editForm.setFieldsValue({
      received: toNum(row.received),
      sold: toNum(row.sold),
      spoiled: toNum(row.spoiled),
    });
    setEditDayNotes(Array.isArray(row.notes) ? row.notes.filter(Boolean) : []);
    setEditNoteInput('');
    setEditModal({ open: true, row });
  };

  const handleStockAdjust = (type) => {
    if (!canCreate) return;
    quickAdjustMutation.mutate({
      location_id: selectedLocation,
      item_id: adjustModal.row.item_id,
      type,
      adjustment: adjustModal.qty,
      notes: adjustModal.notes || null,
      entry_date: dateStr,
    });
    setAdjustModal({ open: false, row: null, qty: 1, notes: '' });
  };

  const handleRestock = () => {
    if (!canCreate || !restockModal.item_id) return;
    quickAdjustMutation.mutate({
      location_id: selectedLocation,
      item_id: restockModal.item_id,
      type: 'received',
      expiry_date: restockModal.expiry ? restockModal.expiry.format('YYYY-MM-DD') : null,
      notes: restockModal.notes || null,
      adjustment: restockModal.qty,
      entry_date: dateStr,
    });
    setRestockModal({ open: false, item_id: null, qty: 1, expiry: null, notes: '' });
  };

  const handleDispose = () => {
    if (!canCreate || !disposeModal.item_id) return;
    quickAdjustMutation.mutate({
      location_id: selectedLocation,
      item_id: disposeModal.item_id,
      type: 'spoiled',
      adjustment: disposeModal.qty,
      notes: disposeModal.notes || null,
      entry_date: dateStr,
    });
    setDisposeModal({ open: false, item_id: null, qty: 1, notes: '' });
  };

  const confirmDeleteEntry = (row) => {
    if (!row.id) return;
    modal.confirm({
      title: `Delete this entry for ${row.item?.name || 'this item'}?`,
      content: 'This removes the row from the day\u2019s ledger. Other days are unaffected.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => deleteEntryMutation.mutate(row.id),
    });
  };

  const confirmDeleteItem = (r) => {
    modal.confirm({
      title: `Remove ${r.item?.name || 'this item'} from stock?`,
      content: 'The item and its historical ledger entries are kept — it is no longer active.',
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => deleteItemMutation.mutate(r.item_id),
    });
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

  const handleExportRestockPdf = () => {
    kitchenStockAPI.exportRestockPdf({ location_id: selectedLocation, date: dateStr })
      .then(r => {
        const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `restock-list-${dateStr}.pdf`;
        a.click();
      })
      .catch(() => message.error('Export PDF failed'));
  };

  // ── Desktop columns (Daily Entry tab) ──
  const entryCols = [
    {
      title: 'Item Name', dataIndex: ['item', 'name'],
      render: (name, r) => (
        <button type="button" onClick={() => setDetailModal(r)} className="text-left group">
          <span className="block font-medium text-sm text-slate-700 group-hover:text-brand-dark transition-colors">{name}</span>
          <span className="block text-[10px] uppercase tracking-wide text-slate-400 group-hover:text-brand-dark transition-colors">{UNIT_META[r.item?.default_unit] || r.item?.default_unit}</span>
        </button>
      ),
    },
    { title: 'Opening Stock', dataIndex: 'opening_stock', width: 90, align: 'center', render: (v) => <span className="text-slate-600">{toNum(v)}</span> },
    { title: 'Received', dataIndex: 'received', width: 90, align: 'center', render: (v) => <span className="font-medium text-emerald-600">{toNum(v)}</span> },
    { title: 'Sold', dataIndex: 'sold', width: 90, align: 'center', render: (v) => <span className="font-medium text-orange-600">{toNum(v)}</span> },
    { title: 'Spoiled / Damaged', dataIndex: 'spoiled', width: 120, align: 'center', render: (v) => <span className="font-medium text-red-600">{toNum(v)}</span> },
    {
      title: 'Stock Level', dataIndex: 'closing_stock', width: 130, align: 'center',
      render: (v, r) => {
        const low = toNum(v) <= toNum(r.item?.min_threshold) && toNum(r.item?.min_threshold) > 0;
        return (
          <button type="button" onClick={() => canCreate && setAdjustModal({ open: true, row: r, qty: 1, notes: '' })}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-sm font-bold transition-colors ${low ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-slate-800 bg-slate-100 hover:bg-slate-200'}`}>
            {toNum(v)}
            {low && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
          </button>
        );
      },
    },
    {
      title: 'Actions', width: 60, align: 'center',
      render: (_, r) => (
        <ActionMenu
          record={r}
          actionItems={() => [
            ...(canCreate ? [{ key: 'adjust', label: 'Adjust Stock', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> }] : []),
            { key: 'edit', label: 'Edit Entry', icon: <Pencil className="w-3.5 h-3.5" /> },
            ...(canUpdate && r.id ? [{ key: 'delete', label: 'Delete Entry', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true }] : []),
          ]}
          onAction={(key) => {
            if (key === 'adjust') setAdjustModal({ open: true, row: r, qty: 1, notes: '' });
            if (key === 'edit') openEditModal(r);
            if (key === 'delete') confirmDeleteEntry(r);
          }}
        />
      ),
    },
  ];

  // Category-filtered view (display only)
  const visibleRows = useMemo(() => {
    if (!categoryFilter) return draftRows || [];
    return (draftRows || []).filter(r => r.item?.category === categoryFilter);
  }, [draftRows, categoryFilter]);

  const renderExpiry = (d) => {
    if (!d) return <span className="text-slate-300">—</span>;
    const dd = dayjs(d);
    const expired = dd.isBefore(dayjs().startOf('day'));
    return <span className={expired ? 'text-red-600 font-semibold' : 'font-medium text-slate-600'}>{dd.format('DD MMM YYYY')}</span>;
  };

  // ── Overview columns ──
  const overviewCols = [
    { title: 'Item', dataIndex: ['item', 'name'], render: (name, r) => (
      <span className="font-medium text-sm text-slate-700">{name} <span className="text-xs text-slate-400 ml-1">({UNIT_META[r.item?.default_unit] || ''})</span></span>
    ) },
    { title: 'Category', render: (_, r) => { const c = CATEGORY_META[r.item?.category] || CATEGORY_META.other; return <Tag color={c.color}>{c.label}</Tag>; }, responsive: ['md'] },
    { title: 'Current Stock', dataIndex: 'closing_stock', align: 'center', render: (v, r) => {
      const low = toNum(v) <= toNum(r.item?.min_threshold) && toNum(r.item?.min_threshold) > 0;
      return <span className={`font-semibold ${low ? 'text-red-600' : ''}`}>{toNum(v)}</span>;
    } },
    { title: 'Min Threshold', render: (_, r) => toNum(r.item?.min_threshold), align: 'center', responsive: ['md'] },
    { title: 'Expiry', render: (_, r) => renderExpiry(r.expiry_date), align: 'center' },
    { title: 'Status', render: (_, r) => {
      const v = toNum(r.closing_stock);
      const th = toNum(r.item?.min_threshold);
      if (th > 0 && v <= th) return <Tag color="red" className="!font-semibold">Low Stock</Tag>;
      return <Tag color="green">OK</Tag>;
    } },
    ...(canDelete ? [{
      title: 'Actions', width: 60, align: 'center',
      render: (_, r) => (
        <ActionMenu
          record={r}
          actionItems={() => [{ key: 'deleteItem', label: 'Delete Item', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true }]}
          onAction={(key) => { if (key === 'deleteItem') confirmDeleteItem(r); }}
        />
      ),
    }] : []),
  ];

  // ── Restock columns ──
  const restockCols = [
    { title: 'Item', dataIndex: ['item', 'name'], render: (n) => <span className="font-medium text-sm text-slate-700">{n}</span> },
    { title: 'Current', dataIndex: 'closing_stock', align: 'center', render: (v) => <span className="font-bold text-red-600">{toNum(v)}</span> },
    { title: 'Threshold', render: (_, r) => <span className="font-semibold">{toNum(r.item?.min_threshold)}</span>, align: 'center' },
    { title: 'Unit', render: (_, r) => UNIT_META[r.item?.default_unit] || '', responsive: ['md'] },
  ];

  // ── Mobile fields ──
  const mobileEntryFields = (row) => [
    { key: 'name', dataIndex: ['item', 'name'] },
    { key: 'opening', label: 'Opening', render: (_, r) => toNum(r.opening_stock) },
    { key: 'received', label: 'Received', render: (_, r) => <span className="text-emerald-600 font-medium">{toNum(r.received)}</span> },
    { key: 'sold', label: 'Sold', render: (_, r) => <span className="text-orange-600 font-medium">{toNum(r.sold)}</span> },
    { key: 'spoiled', label: 'Spoiled/Dmg', render: (_, r) => <span className="text-red-600 font-medium">{toNum(r.spoiled)}</span> },
    {
      key: 'stock', label: 'Stock Level',
      render: (_, r) => {
        const low = toNum(r.closing_stock) <= toNum(r.item?.min_threshold) && toNum(r.item?.min_threshold) > 0;
        return <span className={low ? 'text-red-600 font-semibold' : ''}>{toNum(r.closing_stock)} <span className="text-xs text-slate-400">{UNIT_META[r.item?.default_unit] || ''}</span></span>;
      },
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
                onClick={() => { locationForm.resetFields(); setLocationModal({ open: true, showForm: false, editing: null }); }}>
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
            onClick={() => { locationForm.resetFields(); setLocationModal({ open: true, showForm: true, editing: null }); }}>
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
              <div className="flex-1" />
              {canCreate && (
                <>
                  <Button size="small" icon={<PackagePlus className="w-3.5 h-3.5" />} className="flex items-center gap-1 !text-xs !bg-emerald-600 hover:!bg-emerald-500 !border-0 text-white"
                    onClick={() => setRestockModal({ open: true, item_id: null, qty: 1, expiry: null, notes: '' })}>
                    Restock
                  </Button>
                  <Button size="small" icon={<AlertTriangle className="w-3.5 h-3.5" />} className="flex items-center gap-1 !text-xs !bg-red-600 hover:!bg-red-500 !border-0 text-white"
                    onClick={() => setDisposeModal({ open: true, item_id: null, qty: 1, notes: '' })}>
                    Dispose Stock
                  </Button>
                </>
              )}
              <Button size="small" icon={<FileDown className="w-3.5 h-3.5" />} className="flex items-center gap-1 !text-xs hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark"
                onClick={handleExport}>
                Export
              </Button>
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
                      locale={{ emptyText: <Empty description="No items available" /> }}
                      pagination={false}
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
                            onClick={() => setDetailModal(r)}
                            actions={canCreate ? [
                              { label: 'Adjust Stock', icon: <SlidersHorizontal className="w-3.5 h-3.5" />, onClick: (row) => setAdjustModal({ open: true, row, qty: 1, notes: '' }) },
                            ] : []}
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
                      onClick={handleExportRestockPdf}>
                      Export PDF
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

      {/* ── ADJUST STOCK POPUP ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">{adjustModal.row?.item?.name} — adjust stock</span>}
        open={adjustModal.open}
        onCancel={() => setAdjustModal({ open: false, row: null, qty: 1, notes: '' })}
        footer={null}
        destroyOnClose
        className="top-8">
        <div className="text-center mb-5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Current Stock Level</p>
          <p className={`text-4xl font-bold ${toNum(adjustModal.row?.closing_stock) <= toNum(adjustModal.row?.item?.min_threshold) && toNum(adjustModal.row?.item?.min_threshold) > 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {toNum(adjustModal.row?.closing_stock)}
            <span className="text-sm font-medium text-slate-400 ml-2">{adjustModal.row?.item?.default_unit || ''}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-slate-700">Quantity:</span>
          <InputNumber min={1} value={adjustModal.qty} onChange={(v) => setAdjustModal(m => ({ ...m, qty: v || 1 }))} className="flex-1" />
        </div>
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes (optional)</label>
          <Input.TextArea
            rows={2}
            value={adjustModal.notes}
            onChange={(e) => setAdjustModal(m => ({ ...m, notes: e.target.value }))}
            placeholder="e.g. 5 packs received from supplier"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button block danger icon={<Minus className="w-4 h-4" />} disabled={!canCreate}
            loading={quickAdjustMutation.isPending}
            onClick={() => handleStockAdjust('sold')}>
            Consume
          </Button>
          <Button block type="primary" className="!bg-emerald-600 hover:!bg-emerald-500 !border-0" icon={<Plus className="w-4 h-4" />}
            disabled={!canCreate}
            loading={quickAdjustMutation.isPending}
            onClick={() => handleStockAdjust('received')}>
            Add
          </Button>
        </div>
      </Modal>

      {/* ── RESTOCK MODAL ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Restock — add to received</span>}
        open={restockModal.open}
        onCancel={() => setRestockModal({ open: false, item_id: null, qty: 1, expiry: null, notes: '' })}
        onOk={handleRestock}
        okButtonProps={{ disabled: !restockModal.item_id }}
        confirmLoading={quickAdjustMutation.isPending}
        destroyOnClose
        className="top-8">
        <p className="text-xs text-slate-500 mb-4">
          Adds the quantity to {dateStr}&apos;s Received column for the selected item.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Item</label>
            <Select
              showSearch
              optionFilterProp="children"
              placeholder="Select item"
              className="w-full"
              value={restockModal.item_id || undefined}
              onChange={(v) => setRestockModal(m => ({ ...m, item_id: v }))}>
              {(items || []).filter(i => i.is_active !== false).map(i => (
                <Option key={i.id} value={i.id}>{i.name} ({UNIT_META[i.default_unit] || i.default_unit})</Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Quantity</label>
            <InputNumber min={1} value={restockModal.qty} onChange={(v) => setRestockModal(m => ({ ...m, qty: v || 1 }))} className="w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes (optional)</label>
            <Input.TextArea
              rows={2}
              value={restockModal.notes}
              onChange={(e) => setRestockModal(m => ({ ...m, notes: e.target.value }))}
              placeholder="e.g. 10kg delivery from Bongo Fresh"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Expiry (optional)</label>
            <DatePicker className="w-full" value={restockModal.expiry}
              onChange={(d) => setRestockModal(m => ({ ...m, expiry: d }))} placeholder="Received batch expiry date" />
          </div>
        </div>
      </Modal>

      {/* ── DISPOSE STOCK MODAL ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">Dispose Stock — record spoiled / damaged</span>}
        open={disposeModal.open}
        onCancel={() => setDisposeModal({ open: false, item_id: null, qty: 1, notes: '' })}
        onOk={handleDispose}
        okText="Record Spoiled"
        okButtonProps={{ danger: true, disabled: !disposeModal.item_id }}
        confirmLoading={quickAdjustMutation.isPending}
        destroyOnClose
        className="top-8">
        <p className="text-xs text-slate-500 mb-4">
          Adds the quantity to {dateStr}&apos;s Spoiled / Damaged column for the selected item.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Item</label>
            <Select
              showSearch
              optionFilterProp="children"
              placeholder="Select item"
              className="w-full"
              value={disposeModal.item_id || undefined}
              onChange={(v) => setDisposeModal(m => ({ ...m, item_id: v }))}>
              {(items || []).filter(i => i.is_active !== false).map(i => (
                <Option key={i.id} value={i.id}>{i.name} ({UNIT_META[i.default_unit] || i.default_unit})</Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Quantity</label>
            <InputNumber min={1} value={disposeModal.qty} onChange={(v) => setDisposeModal(m => ({ ...m, qty: v || 1 }))} className="w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes (optional)</label>
            <Input.TextArea
              rows={2}
              value={disposeModal.notes}
              onChange={(e) => setDisposeModal(m => ({ ...m, notes: e.target.value }))}
              placeholder="e.g. expired before opening, stored at wrong temp"
            />
          </div>
        </div>
      </Modal>

      {/* ── EDIT ENTRY MODAL (desktop + mobile) ── */}
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
              notes: editDayNotes.length ? editDayNotes : null,
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
          {/* Day-level notes list (append-only with remove) */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Day Notes</label>
            {editDayNotes.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {editDayNotes.map((n, i) => (
                  <div key={`${i}-${n}`} className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <span className="text-xs text-slate-600 flex-1 break-words">{n}</span>
                    <button type="button" onClick={() => setEditDayNotes((arr) => arr.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-600 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="Add a note for today" value={editNoteInput} onChange={(e) => setEditNoteInput(e.target.value)} />
              <Button type="primary" className="!bg-brand-dark hover:!bg-brand-light !border-0"
                onClick={() => { const t = editNoteInput.trim(); if (t) { setEditDayNotes((a) => [...a, t]); setEditNoteInput(''); } }}>
                Add
              </Button>
            </Space.Compact>
          </div>
        </Form>
      </Modal>

      {/* ── LOCATION MODAL (manage: list + add/edit form) ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">
          {!locationModal.showForm
            ? 'Manage Locations'
            : locationModal.editing ? 'Edit Location' : 'Add Location'}
        </span>}
        open={locationModal.open}
        onCancel={() => { locationForm.resetFields(); setLocationModal({ open: false, showForm: false, editing: null }); }}
        footer={null}
        destroyOnClose
        className="top-8">
        {!locationModal.showForm ? (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500">{allLocations.length} location(s)</span>
              <Button size="small" icon={<Plus className="w-3.5 h-3.5" />} className="flex items-center gap-1 !text-xs !bg-brand-dark hover:!bg-brand-light !border-0 text-white"
                onClick={() => { locationForm.resetFields(); setLocationModal({ open: true, showForm: true, editing: null }); }}>
                Add Location
              </Button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {allLocations.length === 0 ? <Empty description="No locations yet" /> : (
                allLocations.map(loc => (
                  <div key={loc.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{loc.name}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono">{loc.code}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Tag color={loc.is_active ? 'green' : 'default'} className="!m-0 !text-[10px]">{loc.is_active ? 'Active' : 'Inactive'}</Tag>
                      <Button size="small" type="text" icon={<Pencil className="w-3.5 h-3.5" />}
                        onClick={() => setLocationModal({ open: true, showForm: true, editing: loc })} />
                      {canDelete && (
                        <Popconfirm title="Delete this location?" description="Deactivates it — historical entries are kept."
                          okText="Delete" okButtonProps={{ danger: true }} cancelText="Cancel"
                          onConfirm={() => deleteLocationMutation.mutate(loc.id)} disabled={deleteLocationMutation.isPending}>
                          <Button size="small" type="text" danger icon={<Trash2 className="w-3.5 h-3.5" />}
                            loading={deleteLocationMutation.isPending} />
                        </Popconfirm>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            <Button size="small" type="text" icon={<ArrowLeft className="w-3.5 h-3.5" />} className="flex items-center gap-1 !text-xs !text-slate-500 mb-2 mt-1"
              onClick={() => setLocationModal({ open: true, showForm: false, editing: null })}>
              Locations
            </Button>
            <Form form={locationForm} layout="vertical" className="mt-2"
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
              <div>
                <Button type="primary" htmlType="submit" loading={createLocationMutation.isPending}
                  className="!bg-brand-dark hover:!bg-brand-light border-none !text-xs !font-semibold">
                  {locationModal.editing ? 'Save Changes' : 'Create Location'}
                </Button>
              </div>
            </Form>
            {locationModal.editing && (
              <Popconfirm title="Deactivate this location?" description="Historical entries are kept."
                okText="Deactivate" okButtonProps={{ danger: true }} cancelText="Cancel"
                onConfirm={() => { deleteLocationMutation.mutate(locationModal.editing.id); setLocationModal({ open: false, showForm: false, editing: null }); }}>
                <Button danger size="small" className="mt-3">Deactivate Location</Button>
              </Popconfirm>
            )}
          </>
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

      {/* ── ITEM DETAIL MODAL ── */}
      <Modal
        title={<span className="text-sm font-bold text-slate-700">{detailModal?.item?.name || 'Item Details'}</span>}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        destroyOnClose
        className="top-8">
        <div className="mt-4 space-y-5">
          {detailModal && (
            <>
              {/* Item meta */}
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Category</p>
                  <span>{CATEGORY_META[detailModal.item?.category]?.label || 'Other'}</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Unit</p>
                  <span>{UNIT_META[detailModal.item?.default_unit] || detailModal.item?.default_unit || '—'}</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Min Threshold</p>
                  <span className="font-semibold">{toNum(detailModal.item?.min_threshold)}</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Expiry</p>
                  <span>{detailModal.expiry_date ? dayjs(detailModal.expiry_date).format('DD MMM YYYY') : '—'}</span>
                </div>
              </div>

              {/* Day numbers */}
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: 'Opening', value: toNum(detailModal.opening_stock), cls: 'text-slate-600' },
                  { label: 'Received', value: toNum(detailModal.received), cls: 'text-emerald-600' },
                  { label: 'Sold', value: toNum(detailModal.sold), cls: 'text-orange-600' },
                  { label: 'Spoiled', value: toNum(detailModal.spoiled), cls: 'text-red-600' },
                  { label: 'Stock', value: toNum(detailModal.closing_stock), cls: toNum(detailModal.closing_stock) <= toNum(detailModal.item?.min_threshold) && toNum(detailModal.item?.min_threshold) > 0 ? 'text-red-600 font-bold' : 'font-bold' },
                ].map(c => (
                  <div key={c.label} className="rounded-lg border border-slate-100 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">{c.label}</p>
                    <span className={`text-sm ${c.cls}`}>{c.value}</span>
                  </div>
                ))}
              </div>

              {/* Day-level notes */}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Day Notes</p>
                {detailModal.notes?.length ? (
                  <div className="space-y-1.5">
                    {detailModal.notes.map((n, i) => (
                      <div key={`${i}-${n}`} className="rounded bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-xs text-slate-600">{n}</div>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-300">No day notes</p>}
              </div>

              {/* Movement log (labeled notes) */}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Movements</p>
                {detailModal.movements?.length ? (
                  <div className="space-y-2">
                    {detailModal.movements.map(m => {
                      const meta = MOVE_TYPE_META[m.type] || { label: m.type, color: 'default' };
                      return (
                        <div key={m.id} className="flex items-start gap-2.5 rounded-lg border border-slate-100 p-2.5">
                          <Tag color={meta.color} className="!m-0 shrink-0 !text-[10px]">{meta.label}</Tag>
                          <div className="flex-1 min-w-0">
                            {m.notes ? <p className="text-xs text-slate-700 break-words">{m.notes}</p> : <p className="text-xs italic text-slate-400">No comment</p>}
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {m.quantity} {UNIT_META[detailModal.item?.default_unit] || detailModal.item?.default_unit || ''}
                              {m.recorded_by ? ` · ${m.recorded_by}` : ''}
                              {m.created_at ? ` · ${dayjs(m.created_at).format('DD MMM HH:mm')}` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-slate-300">No movements recorded for this day</p>}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}