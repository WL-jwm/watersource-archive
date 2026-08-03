/* ===== S11.2: 冲突预览面板 =====
 * 展示导入数据与已有数据的冲突明细
 * 支持单行/批量策略选择
 */

import React, { useState, useMemo } from 'react';
import {
  type ConflictReport,
  type ConflictItem,
  getConflictTypeLabel,
  getConflictTypeColor,
} from '@/lib/conflictDetector';
import {
  type MergeStrategy,
  getStrategyLabel,
  getStrategyDescription,
} from '@/lib/mergeStrategy';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

interface ConflictPreviewPanelProps {
  report: ConflictReport;
  strategy: MergeStrategy;
  onStrategyChange: (strategy: MergeStrategy) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConflictPreviewPanel: React.FC<ConflictPreviewPanelProps> = ({
  report,
  strategy,
  onStrategyChange,
  onConfirm,
  onCancel,
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const strategies: MergeStrategy[] = ['skip', 'overwrite', 'rename'];

  return (
    <div className="space-y-4">
      {/* 冲突统计 */}
      <div className="flex gap-3 text-sm flex-wrap">
        <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full">
          冲突 {report.conflictCount} 条
        </span>
        <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">
          新增 {report.newCount} 条
        </span>
        {report.byType.id > 0 && (
          <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full">
            ID 匹配 {report.byType.id} 条
          </span>
        )}
        {report.byType.name_city > 0 && (
          <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full">
            名称+城市 {report.byType.name_city} 条
          </span>
        )}
      </div>

      {/* 策略选择 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-700 mb-3">选择冲突处理策略</p>
        <div className="flex gap-3">
          {strategies.map((s) => (
            <label
              key={s}
              className={`flex-1 p-3 border rounded-lg cursor-pointer transition-colors ${
                strategy === s
                  ? 'border-blue-400 bg-white shadow-sm'
                  : 'border-gray-200 bg-white/50 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="merge-strategy"
                value={s}
                checked={strategy === s}
                onChange={(e) => onStrategyChange(e.target.value as MergeStrategy)}
                className="hidden"
              />
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-4 h-4 rounded-full border-2 ${
                    strategy === s ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  }`}
                />
                <span className="text-sm font-medium text-gray-700">{getStrategyLabel(s)}</span>
              </div>
              <p className="text-xs text-gray-400 ml-6">{getStrategyDescription(s)}</p>
            </label>
          ))}
        </div>
      </div>

      {/* 冲突明细表格 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-gray-600 w-16">行号</th>
              <th className="px-3 py-2 text-left text-gray-600">导入名称</th>
              <th className="px-3 py-2 text-left text-gray-600">已有名称</th>
              <th className="px-3 py-2 text-left text-gray-600">匹配类型</th>
              <th className="px-3 py-2 text-left text-gray-600">字段差异</th>
              <th className="px-3 py-2 text-center text-gray-600 w-10">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.conflicts.map((conflict, idx) => (
              <React.Fragment key={idx}>
                <tr className={`hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-3 py-2 text-gray-400 text-xs">{conflict.rowNum}</td>
                  <td className="px-3 py-2 text-gray-800 font-medium">
                    {conflict.existingRecord.name}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {conflict.existingRecord.name}
                    <span className="text-gray-400 text-xs ml-1">
                      ({conflict.existingRecord.cityName})
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConflictTypeColor(conflict.type)}`}>
                      {getConflictTypeLabel(conflict.type)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {conflict.fieldDiffs.length > 0
                      ? `${conflict.fieldDiffs.length} 个字段不同`
                      : '完全相同'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {conflict.fieldDiffs.length > 0 && (
                      <button
                        onClick={() => toggleExpand(idx)}
                        className="text-blue-500 hover:text-blue-600 text-xs"
                      >
                        {expandedRows.has(idx) ? '收起' : '展开'}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedRows.has(idx) && conflict.fieldDiffs.length > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-6 py-3">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {conflict.fieldDiffs.map((diff, di) => (
                          <div key={di} className="flex flex-col gap-1 p-2 bg-white rounded border border-gray-100">
                            <span className="font-medium text-gray-600">{diff.field}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-red-500 line-through">
                                {String(diff.existingValue || '—')}
                              </span>
                              <span className="text-gray-300">→</span>
                              <span className="text-green-600">
                                {String(diff.importValue || '—')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded border border-gray-300"
        >
          返回
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
        >
          确认并继续
        </button>
      </div>
    </div>
  );
};

export default ConflictPreviewPanel;
