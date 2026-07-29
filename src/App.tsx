import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from '@/components/layout/Layout';
import { OfflineIndicator, SWUpdateToast, InstallPromptBanner } from '@/lib/pwaEnhanced';
import { I18nProvider, LocaleSwitcher } from '@/lib/i18n';
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
          <Layout>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/manage" element={<WaterSourceManager />} />
              <Route path="/zone-calc" element={<ProtectionZoneCalc />} />
              <Route path="/analysis" element={<ProjectAnalysis />} />
              <Route path="/versions" element={<VersionHistory />} />
              <Route path="/report/:id" element={<ReportDetail />} />
              <Route path="/divisions" element={<DivisionOverview />} />
              <Route path="/audit" element={<AuditLog />} />
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
