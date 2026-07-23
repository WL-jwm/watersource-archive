import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from '@/components/layout/Layout';
import Home from '@/pages/Home';
import ReportDetail from '@/pages/ReportDetail';
import DivisionOverview from '@/pages/DivisionOverview';
import MapView from '@/pages/MapView';
import Dashboard from '@/pages/Dashboard';
import WaterSourceManager from '@/pages/WaterSourceManager';
import ProtectionZoneCalc from '@/pages/ProtectionZoneCalc';
import ProjectAnalysis from '@/pages/ProjectAnalysis';
import VersionHistory from '@/pages/VersionHistory';

const App: React.FC = () => {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Layout>
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
        </Layout>
      </ErrorBoundary>
    </HashRouter>
  );
};

export default App;
