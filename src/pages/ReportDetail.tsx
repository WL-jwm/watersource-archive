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

// ===== Tab: 基本信息 =====
const BasicInfo: React.FC<{ source: WaterSource }> = ({ source }) => (
  <div className="space-y-6">
    <div>
      <h3 className="section-title">水源地基本信息</h3>
      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">水源地名称</span>
          <span className="info-value">{source.name}</span>
        </div>
        <div className="info-item">
          <span className="info-label">水源代码</span>
          <span className="info-value font-mono text-xs">{source.code}</span>
        </div>
        <div className="info-item">
          <span className="info-label">水源类型</span>
          <span className="info-value">{source.type}</span>
        </div>
        <div className="info-item">
          <span className="info-label">地下水亚型</span>
          <span className="info-value">{source.subType}</span>
        </div>
        <div className="info-item">
          <span className="info-label">补给类型</span>
          <span className="info-value">{source.rechargeType}</span>
        </div>
        <div className="info-item">
          <span className="info-label">地理位置</span>
          <span className="info-value">{source.location}</span>
        </div>
        <div className="info-item">
          <span className="info-label">服务人口</span>
          <span className="info-value">{formatNumber(source.servicePopulation)}人</span>
        </div>
        <div className="info-item">
          <span className="info-label">日供水量</span>
          <span className="info-value">{formatYield(source.dailyYield)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">年供水量</span>
          <span className="info-value">{formatNumber(source.annualYield)} m3/a</span>
        </div>
        <div className="info-item">
          <span className="info-label">开采现状</span>
          <span className="info-value">{source.exploitationStatus}</span>
        </div>
        <div className="info-item">
          <span className="info-label">监测日期</span>
          <span className="info-value">{source.waterQuality.monitoringDate}</span>
        </div>
        <div className="info-item">
          <span className="info-label">监测指标数</span>
          <span className="info-value">{source.waterQuality.totalItems}项</span>
        </div>
      </div>
    </div>

    {/* 水质评价结论 */}
    <div className="card p-4 bg-emerald-50/50 border-emerald-200">
      <h4 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        水质评价结论
      </h4>
      <p className="text-sm text-text-secondary leading-relaxed">
        {source.waterQuality.evaluation}
      </p>
      {source.waterQuality.monitoringPoints.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {source.waterQuality.monitoringPoints.map((pt: string, idx: number) => (
            <span key={idx} className="badge-info text-[10px]">
              {pt}
            </span>
          ))}
        </div>
      )}
    </div>

    {/* 规范化建设要求 */}
    {source.standardizationRequirements && source.standardizationRequirements.length > 0 && (
      <div>
        <h3 className="section-title">规范化建设要求</h3>
        <div className="card p-4">
          <ul className="space-y-2.5">
            {source.standardizationRequirements.map((req: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <span className="w-5 h-5 rounded-full bg-accent-50 text-accent-600 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )}
  </div>
);

// ===== Tab: 水井信息 =====
const WellsInfo: React.FC<{ source: WaterSource }> = ({ source }) => (
  <div>
    <div className="flex items-center justify-between mb-4">
      <h3 className="section-title mb-0">水井信息 ({source.wells.length}眼)</h3>
      <div className="text-xs text-text-tertiary">
        成井深度: {source.wells[0]?.wellDepth || '-'}m | 管材:{' '}
        {source.wells[0]?.casingMaterial || '-'} | 滤水管: {source.wells[0]?.screenMaterial || '-'}
      </div>
    </div>
    {source.wells.map((well: any) => (
      <div key={well.id} className="card p-4 lg:p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-semibold text-text-primary">
            {well.wellNumber}
            <span className="ml-2 text-xs font-mono text-text-tertiary bg-surface-tertiary px-2 py-0.5 rounded">
              {well.wellCode}
            </span>
          </h4>
          <span
            className={`badge ${well.status === '在用' ? 'badge-success' : well.status === '备用' ? 'badge-warning' : 'badge-neutral'}`}
          >
            {well.status}
          </span>
        </div>
        {/* Well visual summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-surface-tertiary rounded-lg">
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">{well.wellDepth}m</div>
            <div className="text-[10px] text-text-tertiary">井深</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">{well.wellDiameter}mm</div>
            <div className="text-[10px] text-text-tertiary">井径</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">{well.staticWaterLevel}m</div>
            <div className="text-[10px] text-text-tertiary">静水位</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">{well.completionDate}</div>
            <div className="text-[10px] text-text-tertiary">建成时间</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div className="info-item">
            <span className="info-label">坐标（经度, 纬度）</span>
            <span className="info-value font-mono text-xs">
              {well.longitude.toFixed(6)}, {well.latitude.toFixed(6)}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">井壁管材质</span>
            <span className="info-value">{well.casingMaterial}</span>
          </div>
          <div className="info-item">
            <span className="info-label">滤水管材质</span>
            <span className="info-value">{well.screenMaterial}</span>
          </div>
          <div className="info-item">
            <span className="info-label">滤水段（取水段）</span>
            <span className="info-value">{well.screenInterval}</span>
          </div>
          <div className="info-item">
            <span className="info-label">涌水量（降深关系）</span>
            <span className="info-value">{well.yieldAtDrawdown}</span>
          </div>
          <div className="info-item">
            <span className="info-label">预期使用年限</span>
            <span className="info-value">{well.expectedLife}</span>
          </div>
        </div>
        {well.remarks && (
          <div className="mt-3 pt-3 border-t border-surface-border text-xs text-text-secondary bg-surface-tertiary/50 rounded px-3 py-2">
            备注: {well.remarks}
          </div>
        )}
      </div>
    ))}
  </div>
);

// ===== Tab: 水文地质 =====
const HydrogeologyInfo: React.FC<{ source: WaterSource }> = ({ source }) => {
  const h = source.hydrogeology;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="section-title">含水层特征参数</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">含水层类型</span>
            <span className="info-value">{h.aquiferType}</span>
          </div>
          <div className="info-item">
            <span className="info-label">岩性</span>
            <span className="info-value">{h.lithology}</span>
          </div>
          <div className="info-item">
            <span className="info-label">含水层厚度</span>
            <span className="info-value">{h.aquiferThickness}m</span>
          </div>
          <div className="info-item">
            <span className="info-label">含水层埋深</span>
            <span className="info-value">{h.aquiferDepth}</span>
          </div>
          <div className="info-item">
            <span className="info-label">渗透系数 K</span>
            <span className="info-value font-mono">{h.permeabilityCoeff}</span>
          </div>
          <div className="info-item">
            <span className="info-label">导水系数 T</span>
            <span className="info-value font-mono">{h.transmissivity}</span>
          </div>
          <div className="info-item">
            <span className="info-label">水力坡度</span>
            <span className="info-value font-mono">{h.hydraulicGradient}</span>
          </div>
          <div className="info-item">
            <span className="info-label">地下水流向</span>
            <span className="info-value">{h.groundwaterFlowDirection}</span>
          </div>
        </div>
      </div>

      {/* Key parameters highlight */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3 bg-blue-50/50 border-blue-200 text-center">
          <div className="text-lg font-bold text-blue-600">{h.permeabilityCoeff}</div>
          <div className="text-[10px] text-text-secondary">渗透系数 K (m/d)</div>
        </div>
        <div className="card p-3 bg-blue-50/50 border-blue-200 text-center">
          <div className="text-lg font-bold text-blue-600">{h.transmissivity}</div>
          <div className="text-[10px] text-text-secondary">导水系数 T (m2/d)</div>
        </div>
        <div className="card p-3 bg-blue-50/50 border-blue-200 text-center">
          <div className="text-lg font-bold text-blue-600">{h.aquiferThickness}m</div>
          <div className="text-[10px] text-text-secondary">含水层厚度</div>
        </div>
        <div className="card p-3 bg-blue-50/50 border-blue-200 text-center">
          <div className="text-lg font-bold text-blue-600">{h.hydraulicGradient}</div>
          <div className="text-[10px] text-text-secondary">水力坡度</div>
        </div>
      </div>

      {/* 补径排 */}
      <div>
        <h3 className="section-title">补给、径流、排泄条件</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-l-emerald-400">
            <h4 className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
              补给条件
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">{h.rechargeConditions}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-sky-400">
            <h4 className="text-sm font-semibold text-sky-600 mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
              径流条件
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">{h.runoffConditions}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-amber-400">
            <h4 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
              排泄条件
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">{h.dischargeConditions}</p>
          </div>
        </div>
      </div>

      {/* 结构与隔水层 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-2">含水层结构描述</h4>
          <p className="text-sm text-text-secondary leading-relaxed">{h.aquiferStructure}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-2">隔水层特征</h4>
          <p className="text-sm text-text-secondary leading-relaxed">{h.confiningBed}</p>
        </div>
      </div>
    </div>
  );
};

// ===== Tab: 水质监测 =====
const WaterQualityInfo: React.FC<{ source: WaterSource }> = ({ source }) => {
  const wq = source.waterQuality;
  const [sortBy, setSortBy] = React.useState<'default' | 'pi-desc' | 'name'>('default');
  const [filterClass, setFilterClass] = React.useState<string>('all');

  const filteredItems = React.useMemo(() => {
    let items = [...wq.items];
    if (filterClass !== 'all') {
      items = items.filter((item) => item.qualifiedClass === filterClass);
    }
    if (sortBy === 'pi-desc') {
      items.sort((a, b) => b.standardIndex - a.standardIndex);
    } else if (sortBy === 'name') {
      items.sort((a, b) => a.paramName.localeCompare(b.paramName, 'zh'));
    }
    return items;
  }, [wq.items, sortBy, filterClass]);

  const classOptions = ['all', 'I类', 'II类', 'III类', 'IV类', 'V类'];

  // Class distribution
  const classDist: Record<string, number> = {};
  wq.items.forEach((item) => {
    const cls = item.qualifiedClass || '-';
    classDist[cls] = (classDist[cls] || 0) + 1;
  });

  return (
    <div className="space-y-5">
      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="text-base font-bold text-accent-500">{wq.monitoringDate}</div>
          <div className="text-xs text-text-secondary">监测日期</div>
        </div>
        <div className="stat-card">
          <div className="text-base font-bold text-accent-500">{wq.totalItems}项</div>
          <div className="text-xs text-text-secondary">监测指标总数</div>
        </div>
        <div className="stat-card">
          <div
            className={`text-base font-bold ${wq.qualifiedRate === 100 ? 'text-success' : 'text-warning'}`}
          >
            {wq.qualifiedRate}%
          </div>
          <div className="text-xs text-text-secondary">达标率（GB/T 14848-2017 III类）</div>
        </div>
        <div className="stat-card">
          <div className="text-base font-bold text-accent-500">{wq.monitoringPoints.length}个</div>
          <div className="text-xs text-text-secondary">监测井</div>
        </div>
      </div>

      {/* Class distribution */}
      <div className="card p-4">
        <h4 className="text-sm font-semibold text-text-primary mb-3">水质类别分布</h4>
        <div className="flex flex-wrap gap-3">
          {Object.entries(classDist)
            .sort(([, a], [, b]) => b - a)
            .map(([cls, count]) => (
              <div key={cls} className="flex items-center gap-2">
                <span className={`badge text-xs ${getClassColor(cls)}`}>{cls}</span>
                <span className="text-sm font-medium text-text-primary">{count}项</span>
                <span className="text-xs text-text-tertiary">
                  ({((count / wq.totalItems) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Evaluation */}
      <div className="card p-4 bg-emerald-50/50 border-emerald-200">
        <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          评价结论
        </h4>
        <p className="text-sm text-text-secondary leading-relaxed">{wq.evaluation}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-secondary">排序:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input w-auto text-xs py-1"
          >
            <option value="default">默认顺序</option>
            <option value="pi-desc">标准指数降序</option>
            <option value="name">名称排序</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-secondary">类别:</span>
          <div className="flex gap-1">
            {classOptions.map((cls) => (
              <button
                key={cls}
                onClick={() => setFilterClass(cls)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  filterClass === cls
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-tertiary text-text-secondary hover:bg-surface-border'
                }`}
              >
                {cls === 'all' ? '全部' : cls}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-text-tertiary ml-auto">
          显示 {filteredItems.length}/{wq.items.length} 项
        </span>
      </div>

      {/* Items table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>指标名称</th>
                <th className="w-16">单位</th>
                <th className="w-20 text-right">III类标准</th>
                <th className="w-20 text-right">监测值</th>
                <th className="w-24 text-right">标准指数Pi</th>
                <th className="w-20 text-center">水质类别</th>
                <th className="w-36">达标指示</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item: any, idx: number) => {
                const piColor =
                  item.standardIndex === 0
                    ? 'text-text-tertiary'
                    : item.standardIndex <= 0.4
                      ? 'text-success'
                      : item.standardIndex <= 0.7
                        ? 'text-accent-500'
                        : item.standardIndex <= 1.0
                          ? 'text-warning'
                          : 'text-danger';
                const barColor =
                  item.standardIndex === 0
                    ? 'bg-surface-border'
                    : item.standardIndex <= 0.4
                      ? 'bg-success'
                      : item.standardIndex <= 0.7
                        ? 'bg-accent-500'
                        : item.standardIndex <= 1.0
                          ? 'bg-warning'
                          : 'bg-danger';
                return (
                  <tr key={idx}>
                    <td className="text-text-tertiary text-xs">{idx + 1}</td>
                    <td className="font-medium">{item.paramName}</td>
                    <td className="text-text-secondary text-xs">{item.unit}</td>
                    <td className="text-right font-mono text-text-secondary text-xs">
                      {item.standardValue > 0 ? item.standardValue : '-'}
                    </td>
                    <td className="text-right font-mono text-xs">{item.monitoringValue}</td>
                    <td className={`text-right font-mono text-xs font-semibold ${piColor}`}>
                      {item.standardIndex > 0 ? item.standardIndex.toFixed(3) : '-'}
                    </td>
                    <td className="text-center">
                      <span className={`badge text-[10px] ${getClassColor(item.qualifiedClass)}`}>
                        {item.qualifiedClass}
                      </span>
                    </td>
                    <td>
                      <div className="quality-bar">
                        <div
                          className={`quality-bar-fill ${barColor}`}
                          style={{ width: `${Math.min((item.standardIndex / 1.5) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pi explanation */}
      <div className="text-xs text-text-tertiary space-y-0.5">
        <p>
          标准指数 Pi = 监测值 / III类标准值。Pi 越小水质越好: &lt;= 0.4 优, &lt;= 0.7 良, &lt;= 1.0
          达标, &gt; 1.0 超标
        </p>
        <p>评价标准: GB/T 14848-2017《地下水质量标准》</p>
      </div>
    </div>
  );
};

// ===== Tab: 保护区划分 =====
const ProtectionInfo: React.FC<{ source: WaterSource }> = ({ source }) => (
  <div className="space-y-5">
    <h3 className="section-title">
      保护区划分方案
      <span className="ml-2 text-sm font-normal text-text-tertiary">
        （依据 HJ 338-2018《饮用水水源保护区划分技术规范》）
      </span>
    </h3>

    {/* Zone summary cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="stat-card">
        <div className="text-base font-bold text-accent-500">{source.protectionZones.length}</div>
        <div className="text-xs text-text-secondary">保护区级别数</div>
      </div>
      <div className="stat-card">
        <div className="text-base font-bold text-accent-500">
          {getTotalZoneArea(source).toFixed(3)}
        </div>
        <div className="text-xs text-text-secondary">总面积 (km2)</div>
      </div>
      <div className="stat-card">
        <div className="text-base font-bold text-accent-500">{getTotalZonePoints(source)}</div>
        <div className="text-xs text-text-secondary">拐点总数</div>
      </div>
      <div className="stat-card">
        <div className="text-base font-bold text-accent-500">HJ 338-2018</div>
        <div className="text-xs text-text-secondary">划分依据</div>
      </div>
    </div>

    {source.protectionZones.map((zone: any) => (
      <div
        key={zone.id}
        className={`card p-4 lg:p-5 ${zone.level.includes('一级') ? 'zone-level-1' : zone.level.includes('二级') ? 'zone-level-2' : 'zone-level-quasi'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${zone.level.includes('一级') ? 'bg-red-500' : zone.level.includes('二级') ? 'bg-amber-500' : 'bg-blue-400'}`}
            />
            {zone.level}
          </h4>
          <div className="flex items-center gap-3">
            <span className="badge-info">{zone.area.toFixed(3)} km2</span>
            <span className="badge-neutral">{zone.boundaryType.split('（')[0]}</span>
          </div>
        </div>
        <div className="mb-4 p-3 bg-surface-tertiary rounded-lg">
          <span className="info-label">边界描述</span>
          <p className="text-sm text-text-secondary leading-relaxed mt-1">
            {zone.boundaryDescription}
          </p>
        </div>

        {zone.boundaryPoints.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-accent-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              拐点坐标 ({zone.boundaryPoints.length}个)
            </h5>
            <div className="card overflow-hidden mb-3">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-16 text-center">编号</th>
                      <th className="w-32 text-right">经度 (E)</th>
                      <th className="w-32 text-right">纬度 (N)</th>
                      <th>位置描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zone.boundaryPoints.map((pt: any, idx: number) => (
                      <tr key={idx}>
                        <td className="text-center font-mono font-medium">{pt.pointNumber}</td>
                        <td className="text-right font-mono text-xs">{pt.longitude.toFixed(6)}</td>
                        <td className="text-right font-mono text-xs">{pt.latitude.toFixed(6)}</td>
                        <td className="text-text-secondary text-xs">{pt.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <CoordinatePreview points={zone.boundaryPoints} zoneName={zone.level} />
          </div>
        )}
      </div>
    ))}
  </div>
);

// ===== Tab: 污染源 =====
const PollutionInfo: React.FC<{ source: WaterSource }> = ({ source }) => {
  const riskColorMap: Record<string, string> = {
    高风险: 'badge-danger',
    中风险: 'badge-warning',
    低风险: 'badge-info',
    无风险: 'badge-success',
  };
  const riskIcon: Record<string, string> = {
    高风险:
      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
    中风险: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    低风险: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    无风险: 'M5 13l4 4L19 7',
  };

  // Summary
  const riskSummary: Record<string, number> = {};
  source.pollutionSources.forEach((ps) => {
    riskSummary[ps.riskLevel] = (riskSummary[ps.riskLevel] || 0) + 1;
  });

  return (
    <div className="space-y-5">
      <h3 className="section-title">污染源调查与风险评估</h3>

      {/* Risk summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(riskSummary).map(([level, count]) => (
          <div key={level} className="stat-card">
            <div
              className={`text-base font-bold ${
                level === '高风险'
                  ? 'text-danger'
                  : level === '中风险'
                    ? 'text-warning'
                    : level === '低风险'
                      ? 'text-accent-500'
                      : 'text-success'
              }`}
            >
              {count}
            </div>
            <div className="text-xs text-text-secondary">{level}</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="text-base font-bold text-text-primary">
            {source.pollutionSources.length}
          </div>
          <div className="text-xs text-text-secondary">调查类别总数</div>
        </div>
      </div>

      {/* Source cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {source.pollutionSources.map((ps) => (
          <div key={ps.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-text-primary">{ps.category}</h4>
              <span className={`badge ${riskColorMap[ps.riskLevel] || 'badge-neutral'}`}>
                {ps.riskLevel}
              </span>
            </div>
            <div className="space-y-2.5">
              <div>
                <span className="text-xs font-medium text-text-secondary block mb-0.5">
                  现状描述
                </span>
                <p className="text-sm text-text-primary leading-relaxed">{ps.description}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-text-secondary block mb-0.5">
                  影响评估
                </span>
                <p className="text-sm text-text-primary leading-relaxed">{ps.impact}</p>
              </div>
              {ps.mitigationMeasures && (
                <div className="pt-2 border-t border-surface-border">
                  <span className="text-xs font-medium text-text-secondary block mb-0.5">
                    防治措施
                  </span>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {ps.mitigationMeasures}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===== Coordinate Preview (Canvas) =====
const CoordinatePreview: React.FC<{ points: any[]; zoneName: string }> = ({ points, zoneName }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || points.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = 300;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const padding = { top: 30, right: 30, bottom: 35, left: 60 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const lngs = points.map((p) => p.longitude);
    const lats = points.map((p) => p.latitude);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const rangeLng = maxLng - minLng || 0.001;
    const rangeLat = maxLat - minLat || 0.001;

    const scaleX = (lng: number) => padding.left + ((lng - minLng) / rangeLng) * plotW;
    const scaleY = (lat: number) => padding.top + plotH - ((lat - minLat) / rangeLat) * plotH;

    // Background
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (i / 5) * plotW;
      const y = padding.top + (i / 5) * plotH;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Area fill
    ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = scaleX(pt.longitude);
      const y = scaleY(pt.latitude);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();

    // Area line
    ctx.strokeStyle = '#0EA5E9';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = scaleX(pt.longitude);
      const y = scaleY(pt.latitude);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();

    // Points + labels
    points.forEach((pt) => {
      const x = scaleX(pt.longitude);
      const y = scaleY(pt.latitude);

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1E3A5F';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#1E293B';
      ctx.font = '11px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`#${pt.pointNumber}`, x + 10, y - 4);
    });

    // Axis labels
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${minLng.toFixed(4)}E`, scaleX(minLng), height - padding.bottom + 8);
    ctx.fillText(`${maxLng.toFixed(4)}E`, scaleX(maxLng), height - padding.bottom + 8);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${minLat.toFixed(4)}N`, padding.left - 6, scaleY(minLat));
    ctx.fillText(`${maxLat.toFixed(4)}N`, padding.left - 6, scaleY(maxLat));

    // Title
    ctx.fillStyle = '#64748B';
    ctx.font = '11px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${zoneName} - 拐点坐标分布图`, width / 2, 8);
  }, [points, zoneName]);

  if (points.length < 2) return null;

  return (
    <div className="mt-3">
      <div ref={containerRef} className="card overflow-hidden">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
};

export default ReportDetail;
