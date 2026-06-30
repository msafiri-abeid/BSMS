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
          colorPrimary: '#021559',
          colorLink: '#021559',
          borderRadius: 6,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        components: {
          Layout: { siderBg: '#021559', headerBg: '#ffffff' },
          Menu: { darkItemBg: '#021559', darkSubMenuItemBg: '#0a237a', darkItemSelectedBg: 'rgba(255,255,255,0.12)' },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
