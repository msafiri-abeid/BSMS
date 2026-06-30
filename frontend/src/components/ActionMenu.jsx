import { Dropdown, Button } from 'antd';
import { MoreHorizontal } from 'lucide-react';

function ActionMenu({ record, actionItems, onAction }) {
  return (
    <Dropdown
      menu={{
        items: actionItems(record),
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          onAction(key, record);
        },
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text" size="small"
        icon={<MoreHorizontal className="w-4 h-4 text-slate-500" />}
        aria-label="Actions"
        onClick={(e) => e.stopPropagation()}
      />
    </Dropdown>
  );
}

export default ActionMenu;
