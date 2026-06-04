export const STATUS_COLORS = { active: 'green', inactive: 'orange', terminated: 'red' };

export const empName = (e) => e?.full_name || e?.user?.name || e?.employee_code || '—';

export const isImage = (name) => /\.(jpe?g|png|webp)$/i.test(name || '');
export const isPdf = (name) => /\.pdf$/i.test(name || '');

export const buildEmployeeFormData = (values) => {
  const fd = new FormData();
  ['full_name', 'email', 'phone', 'department_id', 'position_id', 'hire_date', 'basic_salary', 'national_id', 'bank_account', 'status'].forEach((k) => {
    if (values[k] !== undefined && values[k] !== null && values[k] !== '') fd.append(k, values[k]);
  });
  (values.documents?.fileList || []).forEach((f) => {
    const file = f.originFileObj;
    if (file) fd.append('documents', file);
  });
  return fd;
};

export const buildDeptTreeSelect = (departments, parentId = null, depth = 0) => {
  const items = [];
  (departments || [])
    .filter((d) => (d.parent_id ?? null) === parentId)
    .forEach((d) => {
      items.push({
        value: d.id,
        label: `${'\u00A0'.repeat(depth * 4)}${d.name}`,
      });
      items.push(...buildDeptTreeSelect(departments, d.id, depth + 1));
    });
  return items;
};
