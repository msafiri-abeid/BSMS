import { useState, useEffect } from 'react';
import { Modal, Form, Select, InputNumber, Upload, App, Typography } from 'antd';
import { Camera } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { machinesAPI, collectionsAPI, shopsAPI } from '../../services/api';

const { Text } = Typography;
const { Option } = Select;

export default function RecordCollectionModal({ open, onClose }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [fileList, setFileList] = useState([]);
  const [openingCredits, setOpeningCredits] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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

  const { data: prevCollection } = useQuery({
    queryKey: ['prev-novomatic-collection', selectedMachineId],
    queryFn: () => collectionsAPI.list({ machine_id: selectedMachineId, limit: 1 }).then(r => {
      const rows = r.data.data?.rows || [];
      return rows[0]?.novomaticReading || null;
    }),
    enabled: !!selectedMachineId,
  });

  useEffect(() => {
    if (prevCollection) {
      const opening = prevCollection.closing_credits || 0;
      setOpeningCredits(opening);
      form.setFieldsValue({ opening_credits: opening });
    } else {
      setOpeningCredits(0);
      form.setFieldsValue({ opening_credits: 0 });
    }
  }, [prevCollection, form]);

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
      fd.append('novomatic_data', JSON.stringify({
        closing_credits: values.closing_credits,
        opening_credits: openingCredits,
      }));
      if (fileList[0]?.originFileObj) {
        fd.append('meter_image', fileList[0].originFileObj);
      }
      await collectionsAPI.submit(fd);
      message.success('Collection recorded successfully');
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

        <Form.Item name="closing_credits" label={<span className="text-slate-600 font-medium text-xs">Closing Meter (TOTAL IN-OUT credits)</span>}
          rules={[{ required: true, message: 'Enter the closing meter reading' }]}>
          <InputNumber min={0} className="w-full rounded-lg h-9 font-mono"
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
              <Text className="text-xs text-slate-500">Tap or drop a photo of the TOTAL IN-OUT screen</Text>
            </div>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
