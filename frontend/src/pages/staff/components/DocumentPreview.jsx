import { useState } from 'react';
import { Modal, List, Button, Space } from 'antd';
import { FileOutlined } from '@ant-design/icons';
import { isImage, isPdf } from '../staffUtils';

export default function DocumentPreview({ documents, title, open, onClose }) {
  const [activeDoc, setActiveDoc] = useState(null);

  const handleClose = () => {
    setActiveDoc(null);
    onClose();
  };

  if (!open) return null;

  return (
    <Modal title={title || 'Documents'} open={open} onCancel={handleClose} footer={null} width={760} destroyOnClose>
      <List
        dataSource={documents || []}
        locale={{ emptyText: 'No documents' }}
        renderItem={(doc) => (
          <List.Item
            actions={[
              <Button key="open" type="link" href={doc.url} target="_blank" rel="noopener noreferrer">Open</Button>,
              (isImage(doc.name) || isPdf(doc.name)) && (
                <Button key="preview" type="link" onClick={() => setActiveDoc(doc)}>Preview</Button>
              ),
            ].filter(Boolean)}
          >
            <Space><FileOutlined /><span>{doc.name}</span></Space>
          </List.Item>
        )}
      />
      {activeDoc && (
        <div className="mt-4 border rounded overflow-hidden bg-gray-50">
          {isImage(activeDoc.name) && (
            <img src={activeDoc.url} alt={activeDoc.name} className="max-w-full mx-auto block" />
          )}
          {isPdf(activeDoc.name) && (
            <iframe title={activeDoc.name} src={activeDoc.url} className="w-full h-[480px] border-0" />
          )}
        </div>
      )}
    </Modal>
  );
}
