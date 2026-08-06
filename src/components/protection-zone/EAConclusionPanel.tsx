/**
 * P1: H2 环评结论面板
 *
 * 集成 eaConclusionEngine 到 ProtectionZoneCalc
 * 展示5维度检查结果+总体结论+置信度
 */

import { useMemo, useState } from 'react';
import { type ZoneCalcRecord, useWaterSourceStore } from '@/stores/waterSourceStore';
import { formatConclusionText, generateEAConclusion, type EAFinalConclusion, type EASeverity } from '@/lib/eaConclusionEngine';

interface Props {
  zoneResults: ZoneCalcRecord[];
}

const conclusionColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  '符合': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: '✓ 符合' },
  '基本符合': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: '◐ 基本符合' },
  '需调整': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: '⚠ 需调整' },
  '不符合': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: '✕ 不符合' },
};

const severityIcons: Record<EASeverity, string> = {
  critical: '✕',
  major: '⚠',
  minor: '◇',
  info: '✓',
};

const severityColors: Record<EASeverity, string> = {
  critical: 'text-red-600',
  major: 'text-amber-600',
  minor: 'text-blue-500',
  info: 'text-green-500',
};

export default function EAConclusionPanel({ zoneResults }: Props) {
  const { sources } = useWaterSourceStore();
  const [showDetail, setShowDetail] = useState(false);
  const [showText, setShowText] = useState(false);

  const conclusion: EAFinalConclusion | null = useMemo(() => {
    if (zoneResults.length === 0) return null;
    return generateEAConclusion(zoneResults, sources);
  }, [zoneResults, sources]);

  if (!conclusion) return null;

  const colors = conclusionColors[conclusion.conclusion] || conclusionColors['需调整'];

  // 按维度分组
  const dimensions = new Map<string, { passed: number; warnings: number; failed: number }>();
  for (const c of conclusion.checks) {
    if (!dimensions.has(c.dimension)) {
      dimensions.set(c.dimension, { passed: 0, warnings: 0, failed: 0 });
    }
    const d = dimensions.get(c.dimension)!;
    if (c.result === '通过') d.passed++;
    else if (c.result === '警告') d.warnings++;
    else d.failed++;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">环评结论自动判定</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowText(!showText)}
            className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-white"
          >
            {showText ? '收起文本' : '结论文本'}
          </button>
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-white"
          >
            {showDetail ? '收起详情' : '展开详情'}
          </button>
        </div>
      </div>

      {/* 总体结论 */}
      <div className={`px-4 py-3 ${colors.bg} ${colors.border} border-b`}>
        <div className="flex items-center gap-4">
          <div className={`text-lg font-bold ${colors.text}`}>{colors.label}</div>
          <div className="flex-1">
            <div className="text-xs text-gray-600">{conclusion.summary}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-gray-400">置信度</div>
            <div className={`text-lg font-bold ${colors.text}`}>{conclusion.confidence}%</div>
          </div>
        </div>
      </div>

      {/* 维度汇总 */}
      <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        {Array.from(dimensions.entries()).map(([dim, stats]) => (
          <div key={dim} className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500 mb-1">{dim}</div>
            <div className="flex items-center justify-center gap-2 text-[10px]">
              <span className="text-green-600">{stats.passed}✓</span>
              {stats.warnings > 0 && <span className="text-amber-600">{stats.warnings}⚠</span>}
              {stats.failed > 0 && <span className="text-red-600">{stats.failed}✕</span>}
            </div>
          </div>
        ))}
      </div>

      {/* 关键问题 */}
      {conclusion.keyIssues.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <div className="text-xs font-semibold text-red-600 mb-1">关键问题（{conclusion.keyIssues.length}）</div>
          <div className="space-y-1">
            {conclusion.keyIssues.slice(0, showDetail ? undefined : 3).map((issue, i) => (
              <div key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                <span className="text-red-500 flex-shrink-0">{i + 1}.</span>
                <span>{issue}</span>
              </div>
            ))}
            {!showDetail && conclusion.keyIssues.length > 3 && (
              <div className="text-[10px] text-gray-400">...共{conclusion.keyIssues.length}条</div>
            )}
          </div>
        </div>
      )}

      {/* 建议措施 */}
      {conclusion.recommendations.length > 0 && showDetail && (
        <div className="px-4 py-2 border-t border-gray-100">
          <div className="text-xs font-semibold text-blue-600 mb-1">建议措施</div>
          <div className="space-y-1">
            {Array.from(new Set(conclusion.recommendations)).map((rec, i) => (
              <div key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                <span className="text-blue-500 flex-shrink-0">→</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 详细检查项 */}
      {showDetail && (
        <div className="px-4 py-2 border-t border-gray-100 max-h-60 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-700 mb-1">检查项详情（{conclusion.checks.length}）</div>
          <div className="space-y-1">
            {conclusion.checks.map((check, i) => (
              <div key={i} className="text-[10px] flex items-start gap-2 py-0.5 border-b border-gray-50 last:border-0">
                <span className={`flex-shrink-0 ${severityColors[check.severity]}`}>
                  {severityIcons[check.severity]}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-gray-500">[{check.dimension}]</span>{' '}
                  <span className="text-gray-700">{check.item}</span>
                  {check.reference && <span className="text-gray-400 ml-1">({check.reference})</span>}
                  <div className="text-gray-500">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 结论文本 */}
      {showText && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <pre className="text-[10px] text-gray-600 whitespace-pre-wrap font-mono">
            {formatConclusionText(conclusion)}
          </pre>
        </div>
      )}
    </div>
  );
}
