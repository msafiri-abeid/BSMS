import { useEffect, useState } from 'react';
import { Badge, Dropdown, Button, Empty, Typography, Spin } from 'antd';
import { Bell, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../socket';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Text } = Typography;

const iconMap = {
  collection_disputed: <XCircle className="w-4 h-4 text-red-500" />,
  collection_approved: <CheckCircle className="w-4 h-4 text-green-500" />,
};

export default function NotificationBell() {
  const userId = useAuthStore((s) => s.user?.id);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.list().then(r => r.data.data),
    enabled: !!userId,
  });

  const unreadCount = (notifications || []).filter(n => !n.is_read).length;

  useEffect(() => {
    if (!userId) return;
    connectSocket();
    const socket = require('../socket').default;
    socket.emit('join:user', userId);
    socket.on('notification:new', () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => {
      socket.off('notification:new');
      socket.emit('leave:user', userId);
    };
  }, [userId, qc]);

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllRead();
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      await notificationsAPI.markRead(n.id);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    setOpen(false);
    if (n.reference_type === 'collection') navigate('/collections');
  };

  const items = [
    {
      key: 'header',
      label: (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={(e) => { e.stopPropagation(); handleMarkAllRead(); }}
              className="text-xs text-brand-dark hover:underline cursor-pointer">
              Mark all read
            </button>
          )}
        </div>
      ),
      disabled: true,
    },
    ...(notifications || []).length === 0 ? [
      { key: 'empty', label: <Empty description="No notifications" image={Empty.PRESENTED_IMAGE_SIMPLE} className="!my-4" /> }
    ] : (notifications || []).slice(0, 10).map(n => ({
      key: n.id,
      label: (
        <div className={`flex items-start gap-2 px-1 py-1.5 ${!n.is_read ? 'bg-blue-50/50' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleNotificationClick(n); }}>
          <div className="mt-0.5 shrink-0">{iconMap[n.type] || <AlertTriangle className="w-4 h-4 text-slate-400" />}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-700 truncate">{n.title}</p>
            <p className="text-[11px] text-slate-500 truncate">{n.message}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{dayjs(n.created_at).format('DD MMM HH:mm')}</p>
          </div>
          {!n.is_read && <div className="w-2 h-2 rounded-full bg-brand-dark shrink-0 mt-1" />}
        </div>
      ),
    })),
  ];

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight" open={open} onOpenChange={setOpen}>
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button type="text" icon={<Bell size={18} />} />
      </Badge>
    </Dropdown>
  );
}
