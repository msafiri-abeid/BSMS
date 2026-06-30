import { Tag } from 'antd';
import { ChevronRight } from 'lucide-react';

const getNested = (obj, path) => {
  if (!path) return undefined;
  const keys = Array.isArray(path) ? path : path.split('.');
  return keys.reduce((o, k) => o?.[k], obj);
};

function MobileCard({ record, fields, onClick, statusColor }) {
  return (
    <div
      className="bg-white rounded-lg border border-slate-100 p-3 cursor-pointer hover:shadow-sm transition-shadow active:bg-slate-50"
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
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      </div>
    </div>
  );
}

export default MobileCard;
