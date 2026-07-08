import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, App, Upload, Space, InputNumber, List, Empty, AutoComplete } from 'antd';
import { Plus, Eye, Edit, Trash2, Store, Upload as UploadIcon, FileDown, X, Phone, MapPin, User, PlusCircle, Type } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopsAPI, regionsAPI, districtsAPI, wardsAPI, streetsAPI, staffAPI } from '../../services/api';
import KpiCard from '../../components/KpiCard';
import ActionMenu from '../../components/ActionMenu';
import MobileCard from '../../components/MobileCard';
import dayjs from 'dayjs';

const { Option } = Select;

export default function SlotShopsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  const [useCustomStreet, setUseCustomStreet] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const params = { business_type: 'slot' };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;
  if (supervisorFilter) params.supervisor_id = supervisorFilter;

  const { data, isLoading } = useQuery({ queryKey: ['shops', params], queryFn: () => shopsAPI.list(params).then(r => r.data.data) });
  const { data: regions } = useQuery({ queryKey: ['regions'], queryFn: () => regionsAPI.list().then(r => r.data.data) });
  const { data: employeesData } = useQuery({ queryKey: ['employees-list'], queryFn: () => staffAPI.employees().then(r => r.data.data) });

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

  const employees = employeesData || [];
  const hasFilters = search || statusFilter || supervisorFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSupervisorFilter('');
  };

  const saveMutation = useMutation({
    mutationFn: (d) => editing ? shopsAPI.update(editing.id, d) : shopsAPI.create(d),
    onSuccess: () => {
      message.success('Saved');
      qc.invalidateQueries({ queryKey: ['shops'] });
      setOpen(false); form.resetFields();
      setSelectedRegion(null); setSelectedDistrict(null); setSelectedWard(null); setUseCustomStreet(false); setFileList([]);
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
    if (useCustomStreet && values.street) {
      addr.street = values.street;
    } else if (values.street_id) {
      addr.street_id = values.street_id;
    }
    Object.entries(values).forEach(([k, v]) => {
      if (['country', 'region_id', 'district_id', 'ward_id', 'street_id', 'street', 'documents'].includes(k)) return;
      if (v !== undefined && v !== null) fd.append(k, v);
    });
    fd.append('business_type', 'slot');
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
    setUseCustomStreet(false);
    form.setFieldsValue({ district_id: undefined, ward_id: undefined, street_id: undefined, street: undefined });
  };

  const handleDistrictChange = (value) => {
    setSelectedDistrict(value || null);
    setSelectedWard(null);
    setUseCustomStreet(false);
    form.setFieldsValue({ ward_id: undefined, street_id: undefined, street: undefined });
  };

  const handleWardChange = (value) => {
    setSelectedWard(value || null);
    setUseCustomStreet(false);
    form.setFieldsValue({ street_id: undefined, street: undefined });
  };

  const handleEdit = (r) => {
    setEditing(r);
    const addr = r.address || {};
    const hasCustomStreet = addr.street && !addr.street_id;
    if (hasCustomStreet) setUseCustomStreet(true);
    form.setFieldsValue({
      ...r,
      ...addr,
      supervisor_id: r.supervisor_id || undefined,
      lat: r.lat ? Number(r.lat) : undefined,
      lng: r.lng ? Number(r.lng) : undefined,
    });
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
      setUseCustomStreet(false);
      setFileList([]);
    }
  }, [open]);

  const rows = data?.rows || [];
  const activeCount = rows.filter(r => r.status === 'active').length;

  const renderLocation = (r) => {
    const addr = r.address || {};
    const street = addr.streetData?.name || addr.street || '';
    const ward = addr.wardData?.name || addr.ward || '';
    const parts = [street, ward].filter(Boolean);
    return parts.length ? parts.join(', ') : <span className="text-xs text-slate-300">—</span>;
  };

  const handleExport = async () => {
    try {
      const res = await shopsAPI.list({ ...params, export: true });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `slot-shops-${dayjs().format('YYYY-MM-DD')}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('Export failed');
    }
  };

  const handleExportSelected = () => {
    const selected = rows.filter(r => selectedRowKeys.includes(r.id));
    if (selected.length === 0) return;
    const csv = [
      ['Name', 'Supervisor', 'Location', 'Status'].join(','),
      ...selected.map(r => [
        r.name,
        r.supervisor?.full_name || '',
        renderLocation(r),
        r.status,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `slot-shops-selected-${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const handleAction = (key, r) => {
    if (key === 'view') navigate(`/shops/slot/${r.id}`);
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
    {
      title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), width: 180,
      render: (v, r) => (
        <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold" onClick={() => navigate(`/shops/slot/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Supervisor', key: 'supervisor', width: 180,
      render: (_, r) => {
        if (!r.supervisor) return <span className="text-xs text-slate-300">—</span>;
        return (
          <Button type="link" size="small" className="!p-0 !text-brand-dark font-semibold"
            onClick={() => navigate(`/staff/employees/${r.supervisor.id}`)}>
            {r.supervisor.full_name}
          </Button>
        );
      },
    },
    {
      title: 'Location', key: 'location', width: 200,
      render: (_, r) => renderLocation(r),
    },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'active' ? 'green' : v === 'suspended' ? 'orange' : 'red'} className="!text-[10px] uppercase">{v}</Tag>, width: 90 },
    {
      title: 'Actions', key: 'actions', width: 55, align: 'center',
      render: (_, r) => <ActionMenu record={r} actionItems={actionItems} onAction={handleAction} />,
    },
  ];

  const mobileFields = [
    { key: 'name', dataIndex: 'name' },
    { key: 'supervisor', label: 'Supervisor', render: (_, r) => r.supervisor?.full_name || '—' },
    { key: 'location', label: 'Location', render: (_, r) => renderLocation(r) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/60">
        <div>
          <h4 className="text-base font-bold text-slate-800 m-0">Slot Shops</h4>
          <span className="text-xs text-slate-500">{data?.count || 0} total</span>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}
          className="!bg-brand-dark hover:!bg-brand-light border-none shadow-sm flex items-center gap-1.5 text-white">
          Add Shop
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <KpiCard title="Total Slot Shops" value={rows.length} icon={Store} bgColor="bg-slate-50" iconColor="text-slate-600" />
        <KpiCard title="Active" value={activeCount} icon={Store} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      <div className="rounded-lg border border-slate-100 p-4 mb-4 bg-white">
        <Space wrap size={[8, 8]}>
          <Input.Search size="small" placeholder="Search by name..." allowClear
            defaultValue={search}
            onSearch={(v) => setSearch(v || '')}
            className="w-full sm:w-56" />
          <Select size="small" placeholder="Supervisor" allowClear className="w-full sm:w-44"
            value={supervisorFilter || undefined}
            onChange={(v) => setSupervisorFilter(v || '')}>
            {employees.map(e => <Option key={e.id} value={String(e.id)}>{e.full_name}</Option>)}
          </Select>
          <Select size="small" placeholder="Filter by status" value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')} allowClear className="w-full sm:w-36">
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

      <div className="hidden overflow-x-auto md:block">
        <Table dataSource={rows} columns={cols} rowKey="id" loading={isLoading}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ total: data?.count, pageSize: 20 }}
          summary={() => rows.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-slate-50 font-semibold">
                <Table.Summary.Cell index={0} colSpan={2}>TOTAL ({data?.count || 0} records)</Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} />
              </Table.Summary.Row>
            </Table.Summary>
          ) : null}
        />
      </div>

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
                onClick={() => navigate(`/shops/slot/${r.id}`)}
                statusColor={r.status === 'active' ? 'green' : r.status === 'suspended' ? 'orange' : 'red'}
              />
            )}
          />
        )}
      </div>

      <Modal title={editing ? 'Edit Shop' : 'New Slot Shop'} open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={saveMutation.isPending} width={640} className="top-8" destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onFinish} className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="name" label={<span className="text-xs font-semibold text-slate-600">Shop Name</span>} rules={[{ required: true }]} className="!mb-3">
              <Input placeholder="e.g. Bentabet Arusha" />
            </Form.Item>
            <Form.Item name="supervisor_id" label={<span className="text-xs font-semibold text-slate-600">Supervisor</span>} className="!mb-3">
              <Select allowClear showSearch placeholder="Select supervisor" optionFilterProp="children">
                {employees.map(e => (
                  <Option key={e.id} value={e.id}>
                    <span className="flex items-center gap-2">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <span>{e.full_name}</span>
                      {e.phone && <span className="text-xs text-slate-400">— {e.phone}</span>}
                    </span>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>
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
          {useCustomStreet ? (
            <div className="grid grid-cols-1 gap-3">
              <Form.Item name="street" label={<span className="text-xs font-semibold text-slate-600">Street (custom)</span>} className="!mb-3">
                <Input placeholder="Type street name" />
              </Form.Item>
              <Button type="link" size="small" onClick={() => { setUseCustomStreet(false); form.setFieldsValue({ street: undefined, street_id: undefined }); }}
                className="!text-xs !text-brand-dark self-start -mt-2 !p-0">
                <Type size={14} className="inline mr-1" />Pick from list instead
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <Form.Item name="street_id" label={<span className="text-xs font-semibold text-slate-600">Street</span>} className="!mb-3">
                <Select allowClear showSearch placeholder="Select ward first" loading={streetsLoading}
                  disabled={!selectedWard}>
                  {(streets || []).map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                </Select>
              </Form.Item>
              <Button type="link" size="small" onClick={() => { setUseCustomStreet(true); form.setFieldsValue({ street_id: undefined }); }}
                className="!text-xs !text-brand-dark self-start -mt-2 !p-0">
                <PlusCircle size={14} className="inline mr-1" />Or type custom street name
              </Button>
            </div>
          )}
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">GPS Coordinates</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item name="lat" label={<span className="text-xs font-semibold text-slate-600">Latitude</span>} className="!mb-3">
              <InputNumber step={0.0001} className="w-full" placeholder="e.g. -3.3818" prefix={<MapPin size={14} className="text-slate-400" />} />
            </Form.Item>
            <Form.Item name="lng" label={<span className="text-xs font-semibold text-slate-600">Longitude</span>} className="!mb-3">
              <InputNumber step={0.0001} className="w-full" placeholder="e.g. 36.6826" />
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
