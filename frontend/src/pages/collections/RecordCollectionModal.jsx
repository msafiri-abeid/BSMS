import { useState, useEffect } from 'react';
import { Modal, Form, Select, InputNumber, Upload, App, Typography, DatePicker } from 'antd';
import { Camera } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { machinesAPI, collectionsAPI, shopsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const ADMIN_ROLES = ['Admin', 'General Manager', 'Operations Manager'];

const yesterday = dayjs().subtract(1, 'day');

export default function RecordCollectionModal({ open, onClose }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [fileList, setFileList] = useState([]);
  const [openingCredits, setOpeningCredits] = useState(0);
  const [creditValue, setCreditValue] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const roleName = useAuthStore((s) => s.user?.role?.name);
  const canEditDate = ADMIN_ROLES.includes(roleName);

  const { data: machinesData } = useQuery({
    queryKey: ['novomatic-machines'],
    queryFn: () => machinesAPI.list({ manufacturer: 'Novomatic', limit: 200 }).then(r => r.data.data),
    enabled: open,
  });
  const machines = machinesData?.rows || [];
  const [selectedShopId, setSelectedShopId] = useState(null);
  const filteredMachines = selectedShopId
    ? machines.filter(m => m.current_shop_id === selectedShopId)
    : [];

  const { data: shopsData } = useQuery({
    queryKey: ['slot-shops'],
    queryFn: () => shopsAPI.list({ business_type: 'slot', limit: 200 }).then(r => r.data.data),
    enabled: open,
  });
  const allShops = shopsData?.rows || shopsData || [];

  const selectedMachineId = Form.useWatch('machine_id', form);
  const closingCredits = Form.useWatch('closing_credits', form) || 0;

  // Auto-calculated gross (credit_value_tzs from machine data)
  const grossTzs = (closingCredits - openingCredits) * creditValue;

  const { data: machineDetail } = useQuery({
    queryKey: ['machine-detail', selectedMachineId],
    queryFn: () => machinesAPI.get(selectedMachineId).then(r => r.data.data),
    enabled: !!selectedMachineId,
  });

  useEffect(() => {
    if (machineDetail) {
      const opening = machineDetail.lastNovomaticReading?.closing_credits ?? machineDetail.previous_count ?? machineDetail.opening_count ?? 0;
      setOpeningCredits(opening);
      form.setFieldsValue({ opening_credits: opening });
      if (machineDetail.credit_value_tzs) setCreditValue(machineDetail.credit_value_tzs);
    } else {
      setOpeningCredits(0);
      form.setFieldsValue({ opening_credits: 0 });
    }
  }, [machineDetail, form]);

  // Set default collection date on open
  useEffect(() => {
    if (open) {
      form.setFieldsValue({ collection_date: yesterday });
    }
  }, [open, form]);

  const handleClose = () => {
    form.resetFields();
    setFileList([]);
    setOpeningCredits(0);
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const fd = new FormData();
      fd.append('machine_id', values.machine_id);
      fd.append('shop_id', values.shop_id || '');
      fd.append('collection_date', values.collection_date.format('YYYY-MM-DD'));
      fd.append('novomatic_data', JSON.stringify({
        closing_credits: values.closing_credits,
        opening_credits: openingCredits,
      }));
      if (fileList[0]?.originFileObj) {
        fd.append('meter_image', fileList[0].originFileObj);
      }
      await collectionsAPI.submit(fd);
      message.success('Collection recorded successfully');
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['machine-detail'] });
      qc.invalidateQueries({ queryKey: ['machine', selectedMachineId] });
      handleClose();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to record collection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={<span className="text-sm font-bold text-slate-700">Record Novomatic Collection</span>}
      open={open}
      onCancel={handleClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="Record Collection"
      okButtonProps={{ className: '!bg-brand-dark rounded-lg' }}
      cancelButtonProps={{ className: 'rounded-lg' }}
      width={520}
      className="top-8"
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4 space-y-1">
        <Form.Item name="collection_date" label={<span className="text-slate-600 font-medium text-xs">Collection Date</span>}
          rules={[{ required: true, message: 'Select collection date' }]}>
          <DatePicker className="w-full rounded-lg h-9" disabled={!canEditDate} disabledDate={(d) => d.isAfter(dayjs())} />
        </Form.Item>

        <Form.Item name="shop_id" label={<span className="text-slate-600 font-medium text-xs">Shop</span>}
          rules={[{ required: true, message: 'Select a shop' }]}>
          <Select showSearch optionFilterProp="children" className="h-9" popupClassName="rounded-lg"
            placeholder="Select Slot shop"
            onChange={(v) => {
              setSelectedShopId(v);
              form.setFieldsValue({ machine_id: undefined });
            }}>
            {allShops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
          </Select>
        </Form.Item>

        {selectedShopId && (
          <Form.Item name="machine_id" label={<span className="text-slate-600 font-medium text-xs">Machine</span>}
            rules={[{ required: true, message: 'Select a machine' }]}>
            <Select showSearch optionFilterProp="children" className="h-9" popupClassName="rounded-lg"
              placeholder="Select machine in this shop">
              {filteredMachines.map(m => <Option key={m.id} value={m.id}>{m.slot_code}</Option>)}
            </Select>
          </Form.Item>
        )}

        <Form.Item name="opening_credits" label={<span className="text-slate-600 font-medium text-xs">Opening Meter (auto-filled)</span>}>
          <InputNumber disabled className="w-full rounded-lg h-9 font-mono" />
        </Form.Item>

        <Form.Item name="closing_credits" label={<span className="text-slate-600 font-medium text-xs">Closing Meter (TOTAL IN-OUT)</span>}
          rules={[{ required: true, message: 'Enter the closing meter reading' }]}>
          <InputNumber className="w-full rounded-lg h-9 font-mono"
            placeholder="Enter TOTAL IN-OUT value from screen" />
        </Form.Item>

        <Form.Item label={<span className="text-slate-600 font-medium text-xs">Meter Screen Photo</span>}>
          <Upload.Dragger
            fileList={fileList}
            beforeUpload={(file) => { setFileList([file]); return false; }}
            onRemove={() => setFileList([])}
            accept="image/*"
            maxCount={1}
            className="rounded-lg"
          >
            <div className="flex flex-col items-center gap-1 py-3">
              <Camera className="w-8 h-8 text-slate-400" />
              <Text className="text-xs text-slate-500">Tap to open camera or upload a photo</Text>
            </div>
          </Upload.Dragger>
          {fileList[0]?.originFileObj && (
            <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
              <img src={URL.createObjectURL(fileList[0].originFileObj)} alt="Meter preview" className="w-full max-h-48 object-contain bg-slate-50" />
            </div>
          )}
        </Form.Item>

        {/* Gross summary (read-only) */}
        {selectedMachineId && closingCredits > 0 && (
          <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between">
            <span className="text-slate-500">Gross ({(closingCredits - openingCredits).toLocaleString()} × TZS {creditValue})</span>
            <span className="font-semibold text-slate-700">TZS {(grossTzs || 0).toLocaleString()}</span>
          </div>
        )}
      </Form>
    </Modal>
  );
}
