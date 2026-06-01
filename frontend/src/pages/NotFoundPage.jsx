// src/pages/NotFoundPage.jsx
import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, background: '#f5f5f5',
    }}>
      <div style={{ fontSize: 80, lineHeight: 1 }}>⚡</div>
      <Title level={2} style={{ margin: 0 }}>404 — Page Not Found</Title>
      <Text type="secondary">The page you're looking for doesn't exist.</Text>
      <Button type="primary" onClick={() => navigate('/')} style={{ background: '#1a6b3a' }}>
        Back to Dashboard
      </Button>
    </div>
  );
}
