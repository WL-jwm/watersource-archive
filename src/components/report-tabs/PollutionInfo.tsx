import React from 'react';
import {
  formatNumber,
  formatYield,
  formatArea,
  getTotalZoneArea,
  getTotalZonePoints,
  getClassColor,
} from '@/utils/helpers';
import type { WaterSource } from '@/types';

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

export default PollutionInfo;
