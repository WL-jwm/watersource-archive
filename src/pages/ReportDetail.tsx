import React from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  formatNumber,
  formatYield,
  formatArea,
  getTotalZoneArea,
  getTotalZonePoints,
  getClassColor,
} from '@/utils/helpers';
import type { TabId, WaterSource } from '@/types';

import BasicInfo from '@/components/report-tabs/BasicInfo';
import WellsInfo from '@/components/report-tabs/WellsInfo';
import HydrogeologyInfo from '@/components/report-tabs/HydrogeologyInfo';
import WaterQualityInfo from '@/components/report-tabs/WaterQualityInfo';
import ProtectionInfo from '@/components/report-tabs/ProtectionInfo';
import PollutionInfo from '@/components/report-tabs/PollutionInfo';

const tabs: { id: TabId; label: string; desc: string }[] = [
  { id: 'basic', label: '基本信息', desc: '水源代码/类型/供水量/服务人口' },
  { id: 'wells', label: '水井信息', desc: '井深/结构/滤水段/涌水量' },
  { id: 'hydrogeology', label: '水文地质', desc: '含水层/渗透系数/补径排条件' },
  { id: 'waterquality', label: '水质监测', desc: '45项指标/标准指数评价' },
  { id: 'protection', label: '保护区划分', desc: '面积/拐点坐标/边界描述' },
  { id: 'pollution', label: '污染源调查', desc: '工业/农业/生活/养殖' },
];

const ReportDetail: React.FC = () => {
  const {
    reports,
    selectedReportId,
    selectedSourceId,
    activeTab,
    setSelectedReportId,
    setSelectedSourceId,
    setActiveTab,
  } = useAppStore();

  const report = reports.find((r) => r.id === selectedReportId);

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-4">
        <div className="w-16 h-16 rounded-full bg-surface-tertiary flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-text-secondary mb-4 text-center">请从左侧选择一份报告，或返回首页</p>
        <button onClick={() => setSelectedReportId(null)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          返回首页
        </button>
      </div>
    );
  }

  const source = selectedSourceId
    ? report.waterSources.find((ws) => ws.id === selectedSourceId)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Report overview */}
      {!source && (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto w-full">
          <button onClick={() => setSelectedReportId(null)} className="btn-ghost mb-4 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            返回
          </button>

          <h2 className="text-xl font-bold text-text-primary mb-2">{report.reportName}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary mb-6">
            <span className="badge-info">{report.region}</span>
            {report.reportVersion && <span className="badge-neutral">{report.reportVersion}</span>}
            <span>{report.reportDate}</span>
            {report.approvalDoc && <span>批复: {report.approvalDoc}</span>}
          </div>

          {/* Report info grid */}
          <div className="info-grid mb-6">
            {report.entrustUnit && (
              <div className="info-item">
                <span className="info-label">委托单位</span>
                <span className="info-value">{report.entrustUnit}</span>
              </div>
            )}
            {report.compileUnit && (
              <div className="info-item">
                <span className="info-label">编制单位</span>
                <span className="info-value">{report.compileUnit}</span>
              </div>
            )}
            {report.approvalDate && (
              <div className="info-item">
                <span className="info-label">批复日期</span>
                <span className="info-value">{report.approvalDate}</span>
              </div>
            )}
            {report.regionCode && (
              <div className="info-item">
                <span className="info-label">行政区划代码</span>
                <span className="info-value font-mono">{report.regionCode}</span>
              </div>
            )}
          </div>

          {/* Overview */}
          {report.overview && (
            <div className="card p-4 mb-6">
              <h3 className="section-title">项目概况</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{report.overview}</p>
            </div>
          )}

          {/* Water sources list */}
          <h3 className="section-title">
            水源地档案
            <span className="ml-2 text-sm font-normal text-text-tertiary">
              -- 点击卡片查看完整信息
            </span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {report.waterSources.map((ws) => (
              <div
                key={ws.id}
                onClick={() => {
                  if (selectedReportId !== report.id) {
                    setSelectedReportId(report.id);
                    setTimeout(() => setSelectedSourceId(ws.id), 0);
                  } else {
                    setSelectedSourceId(ws.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedSourceId(ws.id);
                  }
                }}
                tabIndex={0}
                role="button"
                className="card-hover cursor-pointer group relative overflow-hidden outline-none focus:ring-2 focus:ring-accent-500"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-primary-500/0 group-hover:bg-primary-500/5 transition-colors duration-200 z-10 pointer-events-none">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-medium text-primary-500 bg-surface/90 px-3 py-1.5 rounded-full shadow-card">
                    点击查看完整档案 &rarr;
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-base font-semibold text-text-primary">{ws.name}</h4>
                    <span className="badge-success text-xs">{ws.subType}</span>
                  </div>
                  <div className="text-xs text-text-tertiary font-mono mb-3">{ws.code}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="info-item">
                      <span className="info-label">服务人口</span>
                      <span className="info-value">{formatNumber(ws.servicePopulation)}人</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">日供水量</span>
                      <span className="info-value">{formatYield(ws.dailyYield)}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">水井数</span>
                      <span className="info-value">{ws.wells.length}眼</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">保护区面积</span>
                      <span className="info-value">{getTotalZoneArea(ws).toFixed(3)} km2</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-border flex items-center justify-between text-xs text-text-secondary">
                    <div>
                      水质达标率:{' '}
                      <span
                        className={
                          ws.waterQuality.qualifiedRate === 100
                            ? 'text-success font-semibold'
                            : 'text-warning font-semibold'
                        }
                      >
                        {ws.waterQuality.qualifiedRate}%
                      </span>
                      <span className="mx-1.5 text-text-tertiary">|</span>
                      监测: {ws.waterQuality.totalItems}项
                      <span className="mx-1.5 text-text-tertiary">|</span>
                      拐点: {getTotalZonePoints(ws)}个
                    </div>
                    <svg
                      className="w-4 h-4 text-text-tertiary group-hover:text-accent-500 group-hover:translate-x-0.5 transition-all"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Water source detail with tabs */}
      {source && (
        <div className="flex flex-col h-full">
          <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-7xl mx-auto w-full shrink-0">
            <button onClick={() => setSelectedSourceId(null)} className="btn-ghost mb-3 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              返回报告
            </button>

            <h2 className="text-xl font-bold text-text-primary mb-1">{source.name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary mb-4">
              <span className="badge-success">
                {source.type} - {source.subType}
              </span>
              <span className="badge-info">{source.rechargeType}</span>
              <span className="font-mono text-xs text-text-tertiary bg-surface-tertiary px-2 py-0.5 rounded">
                {source.code}
              </span>
              <span className="text-text-tertiary">|</span>
              <span>{source.location}</span>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="stat-card">
                <div className="text-base font-bold text-accent-500">
                  {formatNumber(source.servicePopulation)}
                </div>
                <div className="text-xs text-text-secondary">服务人口(人)</div>
              </div>
              <div className="stat-card">
                <div className="text-base font-bold text-accent-500">
                  {formatYield(source.dailyYield)}
                </div>
                <div className="text-xs text-text-secondary">日供水量</div>
              </div>
              <div className="stat-card">
                <div className="text-base font-bold text-accent-500">
                  {formatYield(source.annualYield)}
                </div>
                <div className="text-xs text-text-secondary">年供水量</div>
              </div>
              <div className="stat-card">
                <div className="text-base font-bold text-accent-500">{source.wells.length}</div>
                <div className="text-xs text-text-secondary">水井数(眼)</div>
              </div>
              <div className="stat-card">
                <div className="text-base font-bold text-accent-500">
                  {getTotalZoneArea(source).toFixed(3)}
                </div>
                <div className="text-xs text-text-secondary">保护区(km2)</div>
              </div>
              <div className="stat-card">
                <div
                  className={`text-base font-bold ${source.waterQuality.qualifiedRate === 100 ? 'text-success' : 'text-warning'}`}
                >
                  {source.waterQuality.qualifiedRate}%
                </div>
                <div className="text-xs text-text-secondary">水质达标率</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-surface-border overflow-x-auto gap-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 border-b-2 ${
                    activeTab === tab.id
                      ? 'text-accent-500 border-accent-500'
                      : 'text-text-secondary border-transparent hover:text-text-primary hover:border-accent-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Tab description */}
            <div className="py-2 text-xs text-text-tertiary">
              {tabs.find((t) => t.id === activeTab)?.desc}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-7xl mx-auto w-full">
            {activeTab === 'basic' && <BasicInfo source={source} />}
            {activeTab === 'wells' && <WellsInfo source={source} />}
            {activeTab === 'hydrogeology' && <HydrogeologyInfo source={source} />}
            {activeTab === 'waterquality' && <WaterQualityInfo source={source} />}
            {activeTab === 'protection' && <ProtectionInfo source={source} />}
            {activeTab === 'pollution' && <PollutionInfo source={source} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportDetail;
