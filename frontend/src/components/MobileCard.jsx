import { Tag, Space, Button } from 'antd';
import { ChevronRight } from 'lucide-react';

const getNested = (obj, path) => {
  if (!path) return undefined;
  const keys = Array.isArray(path) ? path : path.split('.');
  return keys.reduce((o, k) => o?.[k], obj);
};

function MobileCard({ record, fields, onClick, statusColor, actions }) {
  return (
    <div
      className="bg-white rounded-lg border border-slate-100 p-3 hover:shadow-sm transition-shadow active:bg-slate-50"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 space-y-1.5">
          {fields.map((f, i) => {
            const val = typeof f.dataIndex === 'function'
              ? f.dataIndex(record)
              : f.dataIndex
                ? getNested(record, f.dataIndex)
                : record[f.key] ?? record[f.name];
            if (i === 0) {
              return (
                <div key={f.key || f.name || i} className="font-medium text-sm text-slate-800 truncate">
                  {val || '—'}
                </div>
              );
            }
            if (f.render) {
              return <div key={f.key || f.name || i} className="text-xs text-slate-500">{f.render(val, record)}</div>;
            }
            return (
              <div key={f.key || f.name || i} className="text-xs text-slate-500">
                {f.label && <span className="font-medium text-slate-400 mr-1">{f.label}:</span>}
                {val || '—'}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {statusColor && (
            <Tag color={statusColor} className="!text-[10px] !px-2 !m-0">
              {record.status}
            </Tag>
          )}
          {!actions && <ChevronRight className="w-4 h-4 text-slate-300" />}
        </div>
      </div>
      {actions && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          {actions.map((action, i) => (
            <Button
              key={i}
              size="small"
              type={action.type || 'default'}
              icon={action.icon}
              onClick={() => action.onClick(record)}
              loading={action.loading}
              danger={action.danger}
              className={`text-xs ${action.className || ''}`}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MobileCard;