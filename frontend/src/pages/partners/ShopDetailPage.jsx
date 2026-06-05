// src/pages/partners/ShopDetailPage.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Descriptions, Tag, Spin, Typography, Space, Button } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { shopsAPI } from '../../services/api';

const { Title } = Typography;

const SHOP_TYPES = { slot_only: 'Slot Only', bar: 'Bar + Slot', grocery: 'Grocery + Slot', mixed: 'Mixed' };
const TYPE_COLORS = { slot_only: 'blue', bar: 'purple', grocery: 'green', mixed: 'orange' };

export default function ShopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: shop, isLoading } = useQuery({
    queryKey: ['shop', id],
    queryFn: () => shopsAPI.get(id).then((r) => r.data.data),
  });

  if (isLoading) return <Spin size="large" className="block mx-auto mt-20" />;
  if (!shop) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shops')}>Back</Button>
        <p className="mt-4">Shop not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shops')} />
          <Title level={4} className="!m-0">{shop.name}</Title>
          <Tag color={shop.status === 'active' ? 'green' : shop.status === 'suspended' ? 'orange' : 'red'}>{shop.status?.toUpperCase()}</Tag>
        </Space>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate(`/shops/${id}/edit`)}
          className="bg-[#021559] hover:bg-[#162a75]"
        >
          Edit
        </Button>
      </div>

      <Card className="mb-4" size="small">
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Shop Name"><strong>{shop.name}</strong></Descriptions.Item>
          <Descriptions.Item label="Partner">{shop.partner?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag color={TYPE_COLORS[shop.type]}>{SHOP_TYPES[shop.type] || shop.type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={shop.status === 'active' ? 'green' : shop.status === 'suspended' ? 'orange' : 'red'}>{shop.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Address" span={2}>{shop.address || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}