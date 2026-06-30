import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, App, Typography, Upload, Space, List, Empty } from 'antd';
import { Plus, Search, Eye, Edit, Trash2, Store, Upload as UploadIcon, FileDown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopsAPI, partnersAPI, regionsAPI, districtsAPI, wardsAPI, streetsAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import ActionMenu from '../../components/ActionMenu';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

const SHOP_TYPES = { slot_only: 'Slot Only', bar: 'Bar + Slot', grocery: 'Grocery + Slot', mixed: 'Mixed' };
const TYPE_COLORS = { slot_only: 'blue', bar: 'purple', grocery: 'green', mixed: 'orange' };
const LABEL_COLORS = { Bentabet: 'green', Dante: 'green', Meteora: 'blue', Other: 'orange' };

export default function ShopsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const params = {};
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;
  if (typeFilter) params.type = typeFilter;

  const { data, isLoading } = useQuery({ queryKey: ['shops', params], queryFn: () => shopsAPI.list(params).then(r => r.data.data) });
  const { data: partnersData } = useQuery({ queryKey: ['partners-list'], queryFn: () => partnersAPI.list().then(r => r.data.data) });
  const { data: regions } = useQuery({ queryKey: ['regions'], queryFn: () => regionsAPI.list().then(r => r.data.data) });

  const { data: districts, isLoading: districtsLoading } = useQuery({
    queryKey: ['districts', selectedRegion],
    queryFn: () => districtsAPI.list(selectedRegion).then(r => r.data.data),
    enabled: !!selectedRegion,
  });

  const { data: wards, isLoading: wardsLoading } = useQuery({
    queryKey: ['wards', selectedDistrict],
    queryFn: () => wardsAPI.list(selectedDistrict).then(r => r.data.data),
    enabled: !!selectedDistrict,
  });

  const { data: streets, isLoading: streetsLoading } = useQuery({
    queryKey: ['streets', selectedWard],
    queryFn: () => streetsAPI.list(selectedWard).then(r => r.data.data),
    enabled: !!selectedWard,
  });

  const hasFilters = search || statusFilter || typeFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
  };

  const saveMutation = useMutation({
    mutationFn: (d) => editing ? shopsAPI.update(editing.id, d) : shopsAPI.create(d),
    onSuccess: () => {
      message.success('Saved');
      qc.invalidateQueries({ queryKey: ['shops'] });
      setOpen(false); form.resetFields();
      setSelectedRegion(null); setSelectedDistrict(null); setSelectedWard(null); setFileList([]);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => shopsAPI.delete(id),
    onSuccess: () => {
      message.success('Shop deleted');
      qc.invalidateQueries({ queryKey: ['shops'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });

  const onFinish = (values) => {
    const fd = new FormData();
    const addr = {};
    if (values.country) addr.country = values.country;
    if (values.region_id) addr.region_id = values.region_id;
    if (values.district_id) addr.district_id = values.district_id;
    if (values.ward_id) addr.ward_id = values.ward_id;
    if (values.street_id) addr.street_id = values.street_id;
    Object.entries(values).forEach(([k, v]) => {
      if (['country', 'region_id', 'district_id', 'ward_id', 'street_id', 'documents'].includes(k)) return;
      if (v !== undefined) fd.append(k, v);
    });
    if (Object.keys(addr).length) fd.append('address', JSON.stringify(addr));
    fileList.forEach(f => {
      if (f.originFileObj) fd.append('documents', f.originFileObj);
    });
    saveMutation.mutate(fd);
  };

  const handleRegionChange = (value) => {
    setSelectedRegion(value || null);
    setSelectedDistrict(null);
    setSelectedWard(null);
    form.setFieldsValue({ district_id: undefined, ward_id: undefined, street_id: undefined });
  };

  const handleDistrictChange = (value) => {
    setSelectedDistrict(value || null);
    setSelectedWard(null);
    form.setFieldsValue({ ward_id: undefined, street_id: undefined });
  };

  const handleWardChange = (value) => {
    setSelectedWard(value || null);
    form.setFieldsValue({ street_id: undefined });
  };

  const handleEdit = (r) => {
    setEditing(r);
    const addr = r.address || {};
    form.setFieldsValue({ ...r, ...addr });
    if (addr.region_id) setSelectedRegion(addr.region_id);
    if (addr.district_id) setSelectedDistrict(addr.district_id);
    if (addr.ward_id) setSelectedWard(addr.ward_id);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) {
      setSelectedRegion(null);
      setSelectedDistrict(null);
      setSelectedWard(null);
      setFileList([]);
    }
  }, [open]);

  const rows = data?.rows || [];
  const activeCount = rows.filter(r => r.status === 'active').length;
  const slotCount = rows.filter(r => r.type === 'slot_only').length;
  const barCount = rows.filter(r => ['bar', 'mixed', 'grocery'].includes(r.type)).length;

  const handleExport = async () => {
    try {
      const res = await shopsAPI.list({ ...params, export: true });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `shops-${dayjs().format('YYYY-MM-DD')}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('Export failed');
    }
  };

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Name', 'Partner', 'Label', 'Type', 'Status'].join(','),
      ...selected.map(r => [r.name, r.partner?.name, r.partner?.label, r.type, r.status].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `shops-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const handleAction = (key, r) => {
    if (key === 'view') navigate(`/shops/${r.id}`);
    if (key === 'edit') handleEdit(r);
    if (key === 'delete') {
      Modal.confirm({ title: 'Delete Shop', content: `Delete "${r.name}"?`, okText: 'Delete', okType: 'danger', onOk: () => deleteMutation.mutate(r.id) });
    }
  };

  const actionItems = (r) => [
    { key: 'view', icon: <Eye className="w-4 h-4" />, label: 'View' },
    { key: 'edit', icon: <Edit className="w-4 h-4" />, label: 'Edit' },
    { type: 'divider' },
    { key: 'delete', icon: <Trash2 className="w-4 h-4" />, label: 'Delete', danger: true },
  ];

  const cols = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), width: 160 },
    { title: 'Partner', dataIndex: ['partner', 'name'], width: 140, responsive: ['md'] },
    { title: 'Label', dataIndex: ['partner', 'label'], render: v => v ? <Tag color={LABEL_COLORS[v] || 'default'} className="!text-[10px]">{v}</Tag> : '—', width: 90 },
    { title: 'Type', dataIndex: 'type', render: v => <Tag color={TYPE_COLORS[v]} className="!text-[10px]">{SHOP_TYPES[v]}</Tag>, width: 120 },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'active' ? 'green' : v === 'suspended' ? 'orange' : 'red'} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    {
      title: 'Actions', key: 'actions', width: 55, align: 'center',
      render: (_, r) => <ActionMenu record={r} actionItems={actionItems} onAction={handleAction} />,
    },
  ];

  const mobileFields = [
    { key: 'name', dataIndex: 'name' },
    { key: 'partner', label: 'Partner', render: (_, r) => r.partner?.name || '—' },
    { key: 'type', label: 'Type', render: (_, r) => SHOP_TYPES[r.type] || r.type },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Shops</h4>
          <span className="text-xs text-slate-500">{data?.count || 0} total</span>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}
          className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
          Add Shop
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Total Shops" value={rows.length} icon={Store} bgColor="bg-slate-50" iconColor="text-slate-600" />
        <KpiCard title="Active" value={activeCount} icon={Store} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard title="Has Bar/Grocery" value={barCount} icon={Store} bgColor="bg-purple-50" iconColor="text-purple-600" />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Input.Search size="small" placeholder="Search by name..." allowClear
            defaultValue={search}
            onSearch={(v) => setSearch(v || '')}
            className="w-full sm:w-56" />
          <Select size="small" placeholder="Filter by type" value={typeFilter || undefined}
            onChange={(v) => setTypeFilter(v || '')} allowClear className="w-40">
            {Object.entries(SHOP_TYPES).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
          </Select>
          <Select size="small" placeholder="Filter by status" value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')} allowClear className="w-36">
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
            <Option value="suspended">Suspended</Option>
          </Select>
          {hasFilters && (
            <Button size="small" icon={<X className="w-3 h-3" />} onClick={clearFilters}
              className="flex items-center gap-1 !text-xs hover:!border-brand-dark hover:!text-brand-dark">
              Clear
            </Button>
          )}
          <Button size="small" icon={<FileDown className="w-4 h-4" />} onClick={handleExport}
            className="group flex items-center gap-1.5 hover:!bg-brand-dark hover:!text-white hover:!border-brand-dark">
            Export
          </Button>
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
      <div className="hidden md:block">
        <Table dataSource={rows} columns={cols} rowKey="id" loading={isLoading}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: data?.count, pageSize: 20 }}
          summary={() => rows.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-slate-50 font-semibold">
                <Table.Summary.Cell index={0} colSpan={2}>TOTAL ({data?.count || 0} records)</Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3}>{slotCount} slot-only</Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
                <Table.Summary.Cell index={5} />
              </Table.Summary.Row>
            </Table.Summary>
          ) : null}
        />
      </div>

      {/* Mobile List */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <Empty description="No shops found" />
        ) : (
          <List
            dataSource={rows}
            renderItem={(r) => (
              <MobileCard
                record={r}
                fields={mobileFields}
                onClick={() => navigate(`/shops/${r.id}`)}
                statusColor={r.status === 'active' ? 'green' : r.status === 'suspended' ? 'orange' : 'red'}
              />
            )}
          />
        )}
      </div>

      {/* Modal */}
      <Modal title={editing ? 'Edit Shop' : 'New Shop'} open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={saveMutation.isPending} width={600} className="top-8">
        <Form form={form} layout="vertical" onFinish={onFinish} className="mt-4">
          <Form.Item name="partner_id" label={<span className="text-xs font-semibold text-slate-600">Partner</span>} rules={[{ required: true }]}>
            <Select placeholder="Select partner" showSearch optionFilterProp="children">
              {(partnersData?.rows || []).map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label={<span className="text-xs font-semibold text-slate-600">Shop Name</span>} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label={<span className="text-xs font-semibold text-slate-600">Shop Type</span>} rules={[{ required: true }]}>
            <Select>
              {Object.entries(SHOP_TYPES).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
            </Select>
          </Form.Item>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Address</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="country" label={<span className="text-xs font-semibold text-slate-600">Country</span>} className="!mb-3" initialValue="Tanzania">
              <Input />
            </Form.Item>
            <Form.Item name="region_id" label={<span className="text-xs font-semibold text-slate-600">Region</span>} className="!mb-3">
              <Select allowClear showSearch placeholder="Select region" loading={!regions}
                onChange={handleRegionChange}>
                {(regions || []).map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}
              </Select>
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="district_id" label={<span className="text-xs font-semibold text-slate-600">District</span>} className="!mb-3">
              <Select allowClear showSearch placeholder="Select region first" loading={districtsLoading}
                disabled={!selectedRegion} onChange={handleDistrictChange}>
                {(districts || []).map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="ward_id" label={<span className="text-xs font-semibold text-slate-600">Ward</span>} className="!mb-3">
              <Select allowClear showSearch placeholder="Select district first" loading={wardsLoading}
                disabled={!selectedDistrict} onChange={handleWardChange}>
                {(wards || []).map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
              </Select>
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="street_id" label={<span className="text-xs font-semibold text-slate-600">Street</span>} className="!mb-3">
              <Select allowClear showSearch placeholder="Select ward first" loading={streetsLoading}
                disabled={!selectedWard}>
                {(streets || []).map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="status" label={<span className="text-xs font-semibold text-slate-600">Status</span>} initialValue="active">
            <Select><Option value="active">Active</Option><Option value="inactive">Inactive</Option><Option value="suspended">Suspended</Option></Select>
          </Form.Item>
          <Form.Item name="documents" label={<span className="text-xs font-semibold text-slate-600">Documents</span>}>
            <Upload.Dragger multiple fileList={fileList} beforeUpload={(f) => { setFileList(prev => [...prev, f]); return false; }}
              onRemove={(f) => { setFileList(prev => prev.filter(item => item.uid !== f.uid)); }}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx">
              <p className="ant-upload-drag-icon"><UploadIcon size={24} className="text-slate-400 mx-auto" /></p>
              <p className="text-sm text-slate-600">Click or drag files to upload</p>
              <p className="text-xs text-slate-400">Contract, letter, agreement — PDF, DOC, XLS, images accepted</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
