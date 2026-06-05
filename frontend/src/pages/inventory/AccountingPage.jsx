import { useState } from 'react';
import { Card, Select, Statistic, Table, Typography, Space, DatePicker, Button, Tabs, Row, Col } from 'antd';
import { DollarOutlined, ShoppingOutlined, BarChartOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { inventoryAPI, shopsAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AccountingPage() {
  const [selectedShop, setSelectedShop] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);

  const { data: shopsData } = useQuery({ queryKey: ['shops-list'], queryFn: () => shopsAPI.list().then(r => r.data.data) });
  const shops = (shopsData?.rows || []).filter(s => ['Bentabet', 'Dante'].includes(s.partner?.label) && ['bar', 'grocery', 'mixed'].includes(s.type));

  const { data: profitLoss } = useQuery({
    queryKey: ['profit-loss', selectedShop, dateRange],
    queryFn: () =>
      selectedShop
        ? inventoryAPI.getShopProfitLoss({
            shop_id: selectedShop,
            start_date: dateRange[0]?.format('YYYY-MM-DD'),
            end_date: dateRange[1]?.format('YYYY-MM-DD'),
          }).then(r => r.data.data)
        : Promise.resolve(null),
    enabled: !!selectedShop,
  });

  const { data: margins } = useQuery({
    queryKey: ['margins', selectedShop],
    queryFn: () => (selectedShop ? inventoryAPI.getProductMargins({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve([])),
    enabled: !!selectedShop,
  });

  const { data: valuation } = useQuery({
    queryKey: ['valuation', selectedShop],
    queryFn: () => (selectedShop ? inventoryAPI.getInventoryValuation({ shop_id: selectedShop }).then(r => r.data.data) : Promise.resolve(null)),
    enabled: !!selectedShop,
  });

  const { data: dailyReport } = useQuery({
    queryKey: ['daily-report', selectedShop],
    queryFn: () =>
      selectedShop
        ? inventoryAPI.getDailyReport({
            shop_id: selectedShop,
            date: dayjs().format('YYYY-MM-DD'),
          }).then(r => r.data.data)
        : Promise.resolve(null),
    enabled: !!selectedShop,
  });

  const marginColumns = [
    { title: 'Product', dataIndex: 'name' },
    { title: 'Category', dataIndex: 'category' },
    {
      title: 'Purchase Price',
      dataIndex: 'purchase_price',
      render: (v) => `TZS ${v?.toLocaleString()}`,
    },
    {
      title: 'Selling Price',
      dataIndex: 'selling_price',
      render: (v) => `TZS ${v?.toLocaleString()}`,
    },
    {
      title: 'Margin',
      dataIndex: 'margin_tzs',
      render: (v) => <Text strong>{`TZS ${v?.toLocaleString()}`}</Text>,
    },
    {
      title: 'Margin %',
      dataIndex: 'margin_pct',
      render: (v) => `${v}%`,
    },
    { title: 'Stock', dataIndex: 'current_stock' },
    {
      title: 'Stock Value (Cost)',
      dataIndex: 'stock_value_cost',
      render: (v) => `TZS ${v?.toLocaleString()}`,
    },
  ];

  const valuationColumns = [
    { title: 'Product', dataIndex: 'name' },
    { title: 'Category', dataIndex: 'category' },
    { title: 'Qty', dataIndex: 'qty' },
    { title: 'Unit Cost', dataIndex: 'unit_cost', render: (v) => `TZS ${v?.toLocaleString()}` },
    { title: 'Total Cost', dataIndex: 'total_cost_value', render: (v) => `TZS ${v?.toLocaleString()}` },
    { title: 'Total Retail', dataIndex: 'total_retail_value', render: (v) => `TZS ${v?.toLocaleString()}` },
    { title: 'Potential Profit', dataIndex: 'potential_profit', render: (v) => <Text strong>{`TZS ${v?.toLocaleString()}`}</Text> },
  ];

  const profitByProductColumns = [
    { title: 'Product', dataIndex: 0 },
    { title: 'Qty Sold', dataIndex: ['qty_sold'] },
    { title: 'Revenue', dataIndex: ['revenue'], render: (v) => `TZS ${v?.toLocaleString()}` },
    { title: 'Cost', dataIndex: ['cost'], render: (v) => `TZS ${v?.toLocaleString()}` },
    { title: 'Gross Profit', dataIndex: ['gross_profit'], render: (v) => `TZS ${v?.toLocaleString()}` },
    { title: 'Margin %', dataIndex: ['margin_pct'], render: (v) => `${v}%` },
  ];

  const profitByProductData = profitLoss?.by_product
    ? Object.entries(profitLoss.by_product).map(([key, value]) => [key, value])
    : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} style={{ margin: 0 }}>Accounting & Reports</Title>
        <Select
          placeholder="Select shop"
          style={{ width: 250 }}
          onChange={setSelectedShop}
          allowClear
          showSearch
          optionFilterProp="children"
        >
          {shops.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
        </Select>
      </div>

      {selectedShop && (
        <Tabs
          items={[
            {
              key: 'daily',
              label: 'Daily Report',
              children: (
                <div>
                  {dailyReport && (
                    <>
                      <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="Sales Transactions"
                              value={dailyReport.num_transactions}
                              prefix={<ShoppingOutlined />}
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="Total Revenue"
                              value={Math.round(dailyReport.net_sales / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="Gross Profit"
                              value={Math.round(dailyReport.gross_profit / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="Net Profit"
                              value={Math.round(dailyReport.net_profit / 1000)}
                              prefix="TZS"
                              suffix="K"
                              valueStyle={{ color: dailyReport.net_profit > 0 ? 'green' : 'red' }}
                            />
                          </Card>
                        </Col>
                      </Row>

                      <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Items Sold"
                              value={dailyReport.items_sold}
                              prefix={<ShoppingOutlined />}
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Total Cost"
                              value={Math.round(dailyReport.total_cost / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Refunds"
                              value={Math.round(dailyReport.returns / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                      </Row>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'profitloss',
              label: 'Profit & Loss',
              children: (
                <div>
                  <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }} size="large">
                    <RangePicker
                      value={dateRange}
                      onChange={setDateRange}
                      format="YYYY-MM-DD"
                    />
                  </Space>

                  {profitLoss && (
                    <>
                      <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="Total Revenue"
                              value={Math.round(profitLoss.total_revenue / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="Total Cost"
                              value={Math.round(profitLoss.total_cost / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="Gross Profit"
                              value={Math.round(profitLoss.total_gross_profit / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card>
                            <Statistic
                              title="Net Profit"
                              value={Math.round(profitLoss.net_profit / 1000)}
                              prefix="TZS"
                              suffix="K"
                              valueStyle={{ color: profitLoss.net_profit > 0 ? 'green' : 'red' }}
                            />
                          </Card>
                        </Col>
                      </Row>

                      <Card title="Profit by Product" style={{ marginTop: 24 }}>
                        <Table
                          dataSource={profitByProductData}
                          columns={profitByProductColumns}
                          rowKey={record => record[0]}
                          pagination={false}
                          size="small"
                        />
                      </Card>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'margins',
              label: 'Product Margins',
              children: (
                <div>
                  {margins && (
                    <Table
                      dataSource={margins}
                      columns={marginColumns}
                      rowKey="id"
                      pagination={{ pageSize: 25 }}
                      size="small"
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'valuation',
              label: 'Inventory Valuation',
              children: (
                <div>
                  {valuation && (
                    <>
                      <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Total Items"
                              value={valuation.total_qty_on_hand}
                              prefix={<ShoppingOutlined />}
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Valuation (Cost)"
                              value={Math.round(valuation.total_valuation_cost / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Valuation (Retail)"
                              value={Math.round(valuation.total_valuation_retail / 1000)}
                              prefix="TZS"
                              suffix="K"
                            />
                          </Card>
                        </Col>
                      </Row>

                      <Table
                        dataSource={valuation.items}
                        columns={valuationColumns}
                        rowKey="product_id"
                        pagination={{ pageSize: 25 }}
                        size="small"
                      />
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
