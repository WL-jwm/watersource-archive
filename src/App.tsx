import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from '@/components/layout/Layout';
import { OfflineIndicator, SWUpdateToast, InstallPromptBanner } from '@/lib/pwaEnhanced';
// pwaEnhanced.tsx contains PWA hooks and UI components

// F3: 路由级懒加载 — 按页面拆分 chunk，减小首屏加载体积
const Home = lazy(() => import('@/pages/Home'));
const ReportDetail = lazy(() => import('@/pages/ReportDetail'));
const DivisionOverview = lazy(() => import('@/pages/DivisionOverview'));
const MapView = lazy(() => import('@/pages/MapView'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const WaterSourceManager = lazy(() => import('@/pages/WaterSourceManager'));
const ProtectionZoneCalc = lazy(() => import('@/pages/ProtectionZoneCalc'));
const ProjectAnalysis = lazy(() => import('@/pages/ProjectAnalysis'));
const VersionHistory = lazy(() => import('@/pages/VersionHistory'));

/** 懒加载回退 UI */
const PageFallback = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="text-center">
      <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
      <p className="text-sm text-gray-500">页面加载中...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <ErrorBoundary>
        <OfflineIndicator />
        <SWUpdateToast />
        <InstallPromptBanner />
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </HashRouter>
  );
};

export default App;
