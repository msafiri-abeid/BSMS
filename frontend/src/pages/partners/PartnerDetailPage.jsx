import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Descriptions, Tag, Table, Spin, Typography, Button, Modal, App } from 'antd';
import { ArrowLeft, Trash2, FileText, MapPin } from 'lucide-react';
import { partnersAPI } from '../../services/api';

const { Title } = Typography;

const STATUS_COLORS = { active: 'green', inactive: 'red' };
const LABEL_COLORS = { Bentabet: 'green', Dante: 'green', Meteora: 'blue', Other: 'orange' };

export default function PartnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();

  const { data: partner, isLoading } = useQuery({
    queryKey: ['partner', id],
    queryFn: () => partnersAPI.get(id).then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: () => partnersAPI.delete(id),
    onSuccess: () => {
      message.success('Partner deactivated');
      qc.invalidateQueries({ queryKey: ['partners'] });
      navigate('/partners');
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });

  const handleDeactivate = () => {
    Modal.confirm({
      title: 'Deactivate Partner',
      content: `Deactivate "${partner?.name}"?`,
      okText: 'Deactivate',
      okType: 'danger',
      onOk: () => deleteMutation.mutate(),
    });
  };

  if (isLoading) return <Spin size="large" className="block mx-auto mt-20" />;
  if (!partner) {
    return (
      <div>
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/partners')}>Back</Button>
        <p className="mt-4">Partner not found.</p>
      </div>
    );
  }

  const addr = partner.address;
  const isInactive = partner.status === 'inactive';
  const docs = partner.documents || [];

  const shopCols = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Type', dataIndex: 'type' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/partners')} />
          <Title level={4} className="!m-0">{partner.name}</Title>
          <Tag color={STATUS_COLORS[partner.status]}>{partner.status?.toUpperCase()}</Tag>
        </div>
        <Button danger icon={<Trash2 size={14} />} onClick={handleDeactivate} disabled={isInactive} loading={deleteMutation.isPending}>
          {isInactive ? 'Deactivated' : 'Deactivate'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="border border-slate-100" size="small" title={<span className="text-sm font-bold text-slate-700">Partner Details</span>}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Type">
              <Tag color={partner.type === 'own' ? 'green' : 'blue'}>{partner.type === 'own' ? 'Own (Bentabet)' : 'External Partner'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Label">{partner.label || '—'}</Descriptions.Item>
            <Descriptions.Item label="Phone">{partner.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Total Shops">{partner.shops?.length || 0}</Descriptions.Item>
            <Descriptions.Item label="Contract">
              {partner.contract_url ? (
                <a href={partner.contract_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  <FileText size={14} /> View Contract
                </a>
              ) : '—'}
            </Descriptions.Item>
            {docs.length > 0 && (
              <Descriptions.Item label="Documents">
                <div className="flex flex-col gap-1">
                  {docs.map((d, i) => (
                    <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                      <FileText size={14} /> {d.name || `Document ${i + 1}`}
                    </a>
                  ))}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Card className="border border-slate-100" size="small" title={<span className="text-sm font-bold text-slate-700">Address</span>}>
          {addr ? (
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-blue-50 h-fit">
                <MapPin size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">{addr.streetData?.name || addr.street || '—'}</p>
                <p className="text-sm text-slate-600">Ward: {addr.wardData?.name || addr.ward || '—'}</p>
                <p className="text-sm text-slate-600">District: {addr.districtData?.name || '—'}</p>
                <p className="text-sm text-slate-600">Region: {addr.region?.name || '—'}</p>
                <p className="text-sm text-slate-600">Country: {addr.country || 'Tanzania'}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No address recorded</p>
          )}
        </Card>
      </div>

      <Card title={<span className="text-sm font-bold text-slate-700">Shops</span>} className="border border-slate-100" size="small">
        <Table dataSource={partner.shops || []} columns={shopCols} rowKey="id" size="small" pagination={false} />
      </Card>
    </div>
  );
}
