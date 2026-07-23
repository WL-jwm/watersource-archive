import React from 'react';
import { formatNumber, formatYield } from '@/utils/helpers';
import type { WaterSource } from '@/types';

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

export default BasicInfo;
