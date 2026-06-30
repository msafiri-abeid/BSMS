const KpiCard = ({ title, value, icon: Icon, bgColor, iconColor, formatter }) => (
  <div className="rounded-lg border border-slate-100 p-4 bg-white hover:shadow-md transition-shadow duration-200">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
        <div className="text-2xl font-bold text-slate-800 tracking-tight mt-1">
          {formatter ? formatter(value) : (value ?? 0)}
        </div>
      </div>
      {Icon && (
        <div className={`p-3 rounded-xl ${bgColor} flex items-center justify-center ml-4`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      )}
    </div>
  </div>
);

export default KpiCard;
