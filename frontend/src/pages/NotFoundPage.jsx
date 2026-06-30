import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-slate-100">
      <div className="text-7xl leading-none">⚡</div>
      <h2 className="text-2xl font-bold text-slate-800 m-0">404 — Page Not Found</h2>
      <p className="text-slate-500">The page you're looking for doesn't exist.</p>
      <Button type="primary" onClick={() => navigate('/')} className="!bg-brand-dark hover:!bg-brand-light border-none">
        Back to Dashboard
      </Button>
    </div>
  );
}
