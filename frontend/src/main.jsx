// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1a6b3a',
          colorLink: '#1a6b3a',
          borderRadius: 6,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        components: {
          Layout: { siderBg: '#0f1f14', headerBg: '#ffffff' },
          Menu: { darkItemBg: '#0f1f14', darkSubMenuItemBg: '#162b1c', darkItemSelectedBg: '#1a6b3a' },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
