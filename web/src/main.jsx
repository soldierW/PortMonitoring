import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00d4ff',
          colorBgContainer: '#111827',
          colorBgElevated: '#1a1f2e',
          colorBorder: '#1e293b',
          colorText: '#c5cdd9',
          colorTextSecondary: '#64748b',
          borderRadius: 6,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
