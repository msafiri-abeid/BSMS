import { Card, Tree, Tag, Spin, Typography, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { staffAPI } from '../../services/api';
import { empName } from './staffUtils';

const { Text } = Typography;

const buildTreeNodes = (nodes, employees) => nodes.map((dept) => {
  const deptEmployees = employees.filter((e) => e.department_id === dept.id);
  const childDepts = buildTreeNodes(dept.children || [], employees);
  const employeeChildren = deptEmployees.map((e) => ({
    key: `emp-${e.id}`,
    title: (
      <span>
        <Tag color="blue" className="mr-1">{e.employee_code}</Tag>
        {empName(e)}
        {e.position?.name && <Text type="secondary" className="ml-2">— {e.position.name}</Text>}
      </span>
    ),
    isLeaf: true,
  }));
  return {
    key: `dept-${dept.id}`,
    title: <strong>{dept.name}</strong>,
    children: [...childDepts, ...employeeChildren],
  };
});

export default function OrganizationPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => staffAPI.organization().then((r) => r.data.data),
  });

  if (isLoading) return <Spin className="block mx-auto mt-16" />;

  const employees = data?.employees || [];
  const treeData = buildTreeNodes(data?.tree || [], employees);

  const unassigned = (data?.unassigned || []).map((e) => ({
    key: `emp-${e.id}`,
    title: (
      <span>
        <Tag color="blue" className="mr-1">{e.employee_code}</Tag>
        {empName(e)}
      </span>
    ),
    isLeaf: true,
  }));

  const onSelect = (keys) => {
    const key = keys[0];
    if (key?.startsWith('emp-')) navigate(`/staff/employees/${key.replace('emp-', '')}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Organization structure" className="lg:col-span-2" size="small">
        {treeData.length === 0 && unassigned.length === 0 ? (
          <Empty description="No departments yet" />
        ) : (
          <Tree
            showLine
            defaultExpandAll
            treeData={[...treeData, ...(unassigned.length ? [{ key: 'unassigned', title: <strong>Unassigned</strong>, children: unassigned }] : [])]}
            onSelect={onSelect}
          />
        )}
      </Card>
      <Card title="Summary" size="small">
        <p><Text type="secondary">Departments</Text><br /><strong>{(data?.tree || []).length} top-level</strong></p>
        <p className="mt-3"><Text type="secondary">Active employees</Text><br /><strong>{employees.length}</strong></p>
        <p className="mt-3"><Text type="secondary">Positions</Text><br /><strong>{data?.positions?.length || 0}</strong></p>
        <p className="mt-3"><Text type="secondary">Unassigned staff</Text><br /><strong>{data?.unassigned?.length || 0}</strong></p>
      </Card>
    </div>
  );
}
