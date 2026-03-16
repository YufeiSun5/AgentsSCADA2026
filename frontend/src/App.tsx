import { ConfigProvider, Layout, Space, Typography, theme } from 'antd';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import EditorPage from './pages/editor/EditorPage';
import ManagementPage from './pages/management/ManagementPage';
import PreviewPage from './pages/preview/PreviewPage';

const navigationItems = [
  { to: '/', label: '页面资产' },
  { to: '/editor/demo', label: '编辑器示例' },
  { to: '/preview/demo', label: '预览示例' },
];

function AppFrame() {
  const location = useLocation();

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div>
          <Typography.Text className="app-kicker">Industrial Low-Code Studio</Typography.Text>
          <Typography.Title level={3} className="app-title">
            工业低代码可视化页面编辑器
          </Typography.Title>
        </div>
        <Space size={12} wrap>
          {navigationItems.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={active ? 'app-nav-link app-nav-link-active' : 'app-nav-link'}
              >
                {item.label}
              </NavLink>
            );
          })}
        </Space>
      </Layout.Header>
      <Layout.Content className="app-content">
        <Routes>
          <Route path="/" element={<ManagementPage />} />
          <Route path="/editor/:pageId" element={<EditorPage />} />
          <Route path="/preview/:pageId" element={<PreviewPage />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}

export default function RootApp() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#0f766e',
          colorBgBase: '#f4f6f1',
          borderRadius: 16,
          fontFamily: 'IBM Plex Sans, PingFang SC, Microsoft YaHei, sans-serif',
        },
      }}
    >
      <AppFrame />
    </ConfigProvider>
  );
}