import { Card, Row, Col, Tag, Typography } from 'antd';

const { Text } = Typography;

export default function SystemTab() {
  return (
    <Row gutter={16}>
      <Col xs={24}>
        <Card size="small" title="System Info" className="border border-slate-100">
          <div className="mb-3">
            <Text type="secondary" className="text-xs">App Version</Text>
            <div><Text strong>1.0.0</Text></div>
          </div>
          <div className="mb-3">
            <Text type="secondary" className="text-xs">Environment</Text>
            <div><Tag color="green" className="rounded-full">Production</Tag></div>
          </div>
          <div>
            <Text type="secondary" className="text-xs">Company</Text>
            <div><Text>Bentabet Ltd · Dar es Salaam, Tanzania</Text></div>
          </div>
        </Card>
      </Col>
    </Row>
  );
}
