import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import { installGlobalErrorHandlers } from '@/lib/errorReporter';
import Layout from '@/components/layout/Layout';
import { OfflineIndicator, SWUpdateToast, InstallPromptBanner } from '@/lib/pwaEnhanced';
import { I18nProvider, LocaleSwitcher } from '@/lib/i18n';
import ToastContainer from '@/components/ToastContainer';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getPageImporter } from '@/lib/preload';

// F3: 路由级懒加载 — 按页面拆分 chunk，减小首屏加载体积
// 方案A: lazy 的 import 函数与 preloadPage 共享，预加载后点击零延迟
const Home = lazy(getPageImporter('/'));
const ReportDetail = lazy(() => import('@/pages/ReportDetail'));
const DivisionOverview = lazy(getPageImporter('/divisions'));
const MapView = lazy(getPageImporter('/map'));
const Dashboard = lazy(getPageImporter('/dashboard'));
const WaterSourceManager = lazy(getPageImporter('/manage'));
const ProtectionZoneCalc = lazy(getPageImporter('/zone-calc'));
const ProjectAnalysis = lazy(getPageImporter('/analysis'));
const VersionHistory = lazy(getPageImporter('/versions'));
const AuditLog = lazy(getPageImporter('/audit'));
const Trash = lazy(getPageImporter('/trash'));
const MultiSourceOverlay = lazy(getPageImporter('/overlay'));
const Timeline = lazy(getPageImporter('/timeline'));

// ReportDetail 是动态路由 /report/:id，无法从路径直接预加载，保持独立 lazy
// 用户从报告列表点击进入时，Home 页面已渲染，chunk 加载可接受

/** 懒加载回退 UI */
const PageFallback = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="text-center">
      <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  React.useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <I18nProvider>
      <HashRouter>
        <ErrorBoundary>
          <OfflineIndicator />
          <SWUpdateToast />
          <InstallPromptBanner />
          <div className="fixed top-2 right-2 z-50">
            <LocaleSwitcher />
          </div>
          <ToastContainer />
          <ConfirmDialog />
          <Layout>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<PageErrorBoundary pageName="首页"><Home /></PageErrorBoundary>} />
              <Route path="/map" element={<PageErrorBoundary pageName="地图视图"><MapView /></PageErrorBoundary>} />
              <Route path="/dashboard" element={<PageErrorBoundary pageName="仪表盘"><Dashboard /></PageErrorBoundary>} />
              <Route path="/manage" element={<PageErrorBoundary pageName="水源地管理"><WaterSourceManager /></PageErrorBoundary>} />
              <Route path="/zone-calc" element={<PageErrorBoundary pageName="保护区计算"><ProtectionZoneCalc /></PageErrorBoundary>} />
              <Route path="/analysis" element={<PageErrorBoundary pageName="项目分析"><ProjectAnalysis /></PageErrorBoundary>} />
              <Route path="/versions" element={<PageErrorBoundary pageName="版本历史"><VersionHistory /></PageErrorBoundary>} />
              <Route path="/report/:id" element={<PageErrorBoundary pageName="报告详情"><ReportDetail /></PageErrorBoundary>} />
              <Route path="/divisions" element={<PageErrorBoundary pageName="区划概览"><DivisionOverview /></PageErrorBoundary>} />
              <Route path="/audit" element={<PageErrorBoundary pageName="审计日志"><AuditLog /></PageErrorBoundary>} />
          <Route path="/trash" element={<PageErrorBoundary pageName="回收站"><Trash /></PageErrorBoundary>} />
          <Route path="/overlay" element={<PageErrorBoundary pageName="叠加分析"><MultiSourceOverlay /></PageErrorBoundary>} />
          <Route path="/timeline" element={<PageErrorBoundary pageName="活动时间线"><Timeline /></PageErrorBoundary>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </HashRouter>
    </I18nProvider>
  );
};

export default App;
