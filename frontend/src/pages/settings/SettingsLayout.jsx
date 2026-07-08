import { Outlet } from 'react-router-dom';
import { Typography } from 'antd';

const { Title } = Typography;

export default function SettingsLayout() {
  return (
    <div>
      <div className="mb-6 pb-4 border-b border-slate-200/60">
        <Title level={4} className="!m-0 !text-slate-800 !font-extrabold !tracking-tight">Settings</Title>
      </div>
      <Outlet />
    </div>
  );
}
