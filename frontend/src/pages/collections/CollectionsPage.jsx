// src/pages/collections/CollectionsPage.jsx
import { useState } from 'react';
import { Table, Tag, Button, Space, DatePicker, Select, Typography, Card, Row, Col, Statistic } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { collectionsAPI, financeAPI, shopsAPI, machinesAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

export default function CollectionsPage() {
  const [filters, setFilters] = useState({ limit: 50, offset: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['collections', filters],
    queryFn: () => collectionsAPI.list(filters).then(r => r.data.data),
  });

  const totals = (data?.rows || []).reduce((acc, c) => ({
    gross: acc.gross + (c.gross_tzs || 0),
    office: acc.office + (c.office_tzs || 0),
    owner: acc.owner + (c.owner_tzs || 0),
  }), { gross: 0, office: 0, owner: 0 });

  const handleExport = async () => {
    const res = await financeAPI.exportCollections();
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a'); a.href = url;
    a.download = `collections-${dayjs().format('YYYY-MM-DD')}.xlsx`; a.click();
  };

  const cols = [
    { title: 'Date', dataIndex: 'collected_at', render: v => dayjs(v).format('DD MMM YYYY HH:mm'), sorter: true },
    { title: 'Slot Code', dataIndex: ['machine', 'slot_code'] },
    { title: 'Manufacturer', dataIndex: ['machine', 'manufacturer'], render: v => <Tag>{v}</Tag> },
    { title: 'Shop', dataIndex: ['shop', 'name'] },
    { title: 'Collector', dataIndex: ['collector', 'name'] },
    { title: 'Prev Count', dataIndex: 'prev_count', render: v => v?.toLocaleString() },
    { title: 'Curr Count', dataIndex: 'curr_count', render: v => v?.toLocaleString() },
    { title: 'Diff', dataIndex: 'difference', render: v => v?.toLocaleString() },
    { title: 'Gross (TZS)', dataIndex: 'gross_tzs', render: v => <span className="tzs-amount">{v?.toLocaleString()}</span> },
    { title: 'Office (TZS)', dataIndex: 'office_tzs', render: v => <span className="tzs-amount" style={{ color: '#1a6b3a' }}>{v?.toLocaleString()}</span> },
    { title: 'Owner (TZS)', dataIndex: 'owner_tzs', render: v => <span className="tzs-amount" style={{ color: '#722ed1' }}>{v?.toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'approved' ? 'green' : 'orange'}>{v}</Tag> },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Collections</Title>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>Export Excel</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title="Total Gross" value={totals.gross} formatter={fmt} valueStyle={{ color: '#1a6b3a', fontSize: 18 }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Office Share" value={totals.office} formatter={fmt} valueStyle={{ fontSize: 18 }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Owner Share" value={totals.owner} formatter={fmt} valueStyle={{ color: '#722ed1', fontSize: 18 }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker size="small" onChange={(d) => setFilters(f => ({ ...f, date_from: d?.[0]?.toISOString(), date_to: d?.[1]?.toISOString() }))} />
        </Space>
      </Card>

      <Table
        dataSource={data?.rows || []}
        columns={cols}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 1200 }}
        pagination={{
          total: data?.count,
          pageSize: 50,
          onChange: (p) => setFilters(f => ({ ...f, offset: (p - 1) * 50 })),
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
              <Table.Summary.Cell index={0} colSpan={8}>TOTAL ({data?.count || 0} records)</Table.Summary.Cell>
              <Table.Summary.Cell index={8}>{fmt(totals.gross)}</Table.Summary.Cell>
              <Table.Summary.Cell index={9}>{fmt(totals.office)}</Table.Summary.Cell>
              <Table.Summary.Cell index={10}>{fmt(totals.owner)}</Table.Summary.Cell>
              <Table.Summary.Cell index={11} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
}
