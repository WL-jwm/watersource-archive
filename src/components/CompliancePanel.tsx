/**
 * B3: 保护区合规性检查面板
 */

import React, { useState } from 'react';
import {
  runComplianceCheck,
  type ComplianceReport,
  type CheckSeverity,
} from '@/lib/complianceChecker';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';

interface CompliancePanelProps {
  zoneResults: ZoneCalcRecord[];
  sources: WaterSourceRecord[];
}

const SEVERITY_STYLES: Record<
  CheckSeverity,
  { bg: string; text: string; label: string; icon: string }
> = {
  pass: { bg: 'bg-green-50', text: 'text-green-700', label: '通过', icon: '✓' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', label: '警告', icon: '!' },
  error: { bg: 'bg-red-50', text: 'text-red-700', label: '错误', icon: '×' },
  info: { bg: 'bg-gray-50', text: 'text-gray-500', label: '跳过', icon: '-' },
};

const CONCLUSION_STYLES: Record<string, { bg: string; text: string }> = {
  合格: { bg: 'bg-green-100', text: 'text-green-700' },
  基本合格: { bg: 'bg-amber-100', text: 'text-amber-700' },
  需整改: { bg: 'bg-red-100', text: 'text-red-700' },
};

const CompliancePanel: React.FC<CompliancePanelProps> = ({ zoneResults, sources }) => {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const handleCheck = () => {
    const r = runComplianceCheck(zoneResults, sources);
    setReport(r);
    // 自动展开第一个有问题的水源地
    const firstIssue = r.items.find((item) =>
      item.checks.some((c) => c.severity === 'error' || c.severity === 'warning'),
    );
    setExpandedSource(firstIssue?.sourceId || null);
  };

  if (zoneResults.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-gray-400">请先计算保护区后再进行合规性检查</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 标题和检查按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-gray-700">保护区合规性检查</h4>
          <p className="text-[9px] text-gray-400 mt-0.5">
            依据 HJ 338-2018 自动检查面积/半径/拐点/坐标/重叠/编码
          </p>
        </div>
        <button
          onClick={handleCheck}
          className="text-[10px] px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
        >
          开始检查
        </button>
      </div>

      {/* 检查结果总览 */}
      {report && (
        <>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${CONCLUSION_STYLES[report.conclusion].bg} ${CONCLUSION_STYLES[report.conclusion].text}`}
            >
              {report.conclusion}
            </span>
            <span className="text-[10px] text-gray-500">共{report.totalCount}个水源地</span>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {
                label: '通过',
                count: report.passCount,
                color: 'text-green-600',
                bg: 'bg-green-50',
              },
              {
                label: '警告',
                count: report.warningCount,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
              },
              { label: '错误', count: report.errorCount, color: 'text-red-600', bg: 'bg-red-50' },
              { label: '跳过', count: report.infoCount, color: 'text-gray-400', bg: 'bg-gray-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-lg p-2 text-center`}>
                <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
                <div className="text-[9px] text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 逐个水源地检查结果 */}
          <div className="space-y-2">
            {report.items.map((item) => {
              const hasIssue = item.checks.some(
                (c) => c.severity === 'error' || c.severity === 'warning',
              );
              const isExpanded = expandedSource === item.sourceId;

              return (
                <div
                  key={item.sourceId}
                  className={`border rounded-lg overflow-hidden ${
                    hasIssue ? 'border-amber-200' : 'border-green-200'
                  }`}
                >
                  <button
                    onClick={() => setExpandedSource(isExpanded ? null : item.sourceId)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          hasIssue ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {hasIssue ? '有问题' : '合格'}
                      </span>
                      <span className="text-xs font-medium text-gray-700">{item.sourceName}</span>
                    </div>
                    <span className="text-[9px] text-gray-400">
                      {item.checks.filter((c) => c.severity === 'pass').length}/{item.checks.length}{' '}
                      通过
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-2 space-y-1">
                      {item.checks.map((check) => {
                        const style = SEVERITY_STYLES[check.severity];
                        return (
                          <div
                            key={check.id}
                            className={`flex items-start gap-2 ${style.bg} rounded px-2 py-1.5`}
                          >
                            <span className={`text-xs font-bold ${style.text} mt-0.5`}>
                              {style.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-medium text-gray-700">
                                  {check.name}
                                </span>
                                <span
                                  className={`text-[8px] px-1 rounded ${style.bg} ${style.text}`}
                                >
                                  {style.label}
                                </span>
                              </div>
                              <div className="text-[9px] text-gray-500 mt-0.5">{check.message}</div>
                              {check.suggestion && (
                                <div className="text-[9px] text-blue-500 mt-0.5">
                                  建议：{check.suggestion}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CompliancePanel;
