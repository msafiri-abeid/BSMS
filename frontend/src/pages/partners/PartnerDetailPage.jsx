// src/pages/partners/PartnerDetailPage.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Descriptions, Tag, Table, Spin, Typography, Space, Button } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { partnersAPI } from '../../services/api';

const { Title } = Typography;

export default function PartnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: partner, isLoading } = useQuery({
    queryKey: ['partner', id],
    queryFn: () => partnersAPI.get(id).then((r) => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block mx-auto mt-20" />;
  if (!partner) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/partners')}>Back</Button>
        <p className="mt-4">Partner not found.</p>
      </div>
    );
  }

  const shopCols = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Type', dataIndex: 'type' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag> },
    { title: 'Address', dataIndex: 'address', ellipsis: true },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/partners')} />
          <Title level={4} className="!m-0">{partner.name}</Title>
          <Tag color={partner.status === 'active' ? 'green' : 'red'}>{partner.status?.toUpperCase()}</Tag>
        </Space>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate(`/partners/${id}/edit`)}
          className="bg-[#021559] hover:bg-[#162a75]"
        >
          Edit
        </Button>
      </div>

      <Card className="mb-4" size="small">
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Type">
            <Tag color={partner.type === 'own' ? 'green' : 'blue'}>{partner.type === 'own' ? 'Own (Bentabet)' : 'External Partner'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Label / Brand">{partner.label || '—'}</Descriptions.Item>
          <Descriptions.Item label="Phone">{partner.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Total Shops">{partner.shops?.length || 0}</Descriptions.Item>
          <Descriptions.Item label="Address" span={2}>{partner.address || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Shops" size="small">
        <Table dataSource={partner.shops || []} columns={shopCols} rowKey="id" size="small" pagination={false} />
      </Card>
    </div>
  );
}