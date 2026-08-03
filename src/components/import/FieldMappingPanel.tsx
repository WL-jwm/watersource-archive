/* ===== S11.1: 字段映射面板 =====
 * 拖拽/下拉映射源列名 → 目标字段
 * 支持自动检测 + 手动修正
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  detectFieldMapping,
  TEMPLATE_COLUMNS,
  levelToChinese,
  type FieldMappingResult,
  type FieldMappingItem,
} from '@/lib/importTemplate';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

interface FieldMappingPanelProps {
  /** 检测到的源列名列表 */
  sourceColumns: string[];
  /** 已有的映射结果（用于恢复状态） */
  initialMapping?: FieldMappingResult | null;
  /** 映射确认回调 */
  onConfirm: (mapping: FieldMappingItem[]) => void;
  /** 取消 */
  onCancel: () => void;
}

/** 可映射的目标字段列表 */
const TARGET_FIELDS = TEMPLATE_COLUMNS.map((c) => ({
  field: c.field,
  label: c.header,
  required: c.required,
}));

const FieldMappingPanel: React.FC<FieldMappingPanelProps> = ({
  sourceColumns,
  initialMapping,
  onConfirm,
  onCancel,
}) => {
  // 初始化映射结果
  const initialResult = useMemo(() => {
    if (initialMapping) return initialMapping;
    return detectFieldMapping(sourceColumns);
  }, [sourceColumns, initialMapping]);

  const [mappings, setMappings] = useState<FieldMappingItem[]>(initialResult.mappings);

  // 更新单条映射
  const handleMappingChange = useCallback((index: number, targetField: string | null) => {
    setMappings((prev) => {
      const next = [...prev];
      const field = targetField ? (targetField as keyof WaterSourceRecord) : null;

      // 如果目标字段已被其他列映射，清除旧映射
      if (field) {
        for (let i = 0; i < next.length; i++) {
          if (i !== index && next[i].targetField === field) {
            next[i] = { ...next[i], targetField: null, confidence: 0, matchType: 'none', manual: false };
          }
        }
      }

      next[index] = {
        ...next[index],
        targetField: field,
        confidence: field ? 1.0 : 0,
        matchType: field ? 'exact' : 'none',
        manual: true,
      };
      return next;
    });
  }, []);

  // 重新自动检测
  const handleAutoDetect = useCallback(() => {
    const result = detectFieldMapping(sourceColumns);
    setMappings(result.mappings);
  }, [sourceColumns]);

  // 清除所有映射
  const handleClearAll = useCallback(() => {
    setMappings((prev) =>
      prev.map((m) => ({ ...m, targetField: null, confidence: 0, matchType: 'none', manual: false })),
    );
  }, []);

  // 统计
  const stats = useMemo(() => {
    const mapped = mappings.filter((m) => m.targetField !== null);
    const mappedFields = new Set(mapped.map((m) => m.targetField));
    const missingRequired = TARGET_FIELDS.filter(
      (f) => f.required && !mappedFields.has(f.field),
    );
    return {
      mappedCount: mapped.length,
      unmappedCount: mappings.length - mapped.length,
      missingRequired,
      canConfirm: missingRequired.length === 0,
    };
  }, [mappings]);

  // 置信度颜色
  const getConfidenceColor = (item: FieldMappingItem): string => {
    if (!item.targetField) return 'text-gray-400';
    if (item.manual) return 'text-blue-600';
    if (item.confidence >= 1.0) return 'text-green-600';
    if (item.confidence >= 0.7) return 'text-amber-600';
    return 'text-orange-600';
  };

  // 匹配类型标签
  const getMatchLabel = (item: FieldMappingItem): string => {
    if (!item.targetField) return '';
    if (item.manual) return '手动';
    switch (item.matchType) {
      case 'exact': return '精确';
      case 'fuzzy': return '模糊';
      case 'pinyin': return '拼音';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* 头部统计 */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600">已映射: {stats.mappedCount}</span>
          <span className="text-gray-400">未映射: {stats.unmappedCount}</span>
          {stats.missingRequired.length > 0 && (
            <span className="text-red-500">
              缺失必填: {stats.missingRequired.map((f) => f.label).join('、')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoDetect}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
          >
            重新检测
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded border border-gray-200"
          >
            清除全部
          </button>
        </div>
      </div>

      {/* 映射表格 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600 w-1/3">源列名</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 w-1/3">目标字段</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 w-1/6">匹配方式</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 w-1/6">置信度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mappings.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className="font-medium text-gray-800">{item.sourceColumn}</span>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={item.targetField || ''}
                    onChange={(e) => handleMappingChange(index, e.target.value || null)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">— 不导入 —</option>
                    {TARGET_FIELDS.map((tf) => (
                      <option key={tf.field} value={tf.field}>
                        {tf.label}
                        {tf.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <span className="text-xs text-gray-500">{getMatchLabel(item)}</span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium ${getConfidenceColor(item)}`}>
                    {item.targetField ? `${Math.round(item.confidence * 100)}%` : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 必填字段提示 */}
      <div className="text-xs text-gray-400">
        <span className="text-red-500">*</span> 标记为必填字段，至少需要映射全部必填字段才能继续
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded border border-gray-300"
        >
          取消
        </button>
        <button
          onClick={() => onConfirm(mappings)}
          disabled={!stats.canConfirm}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          确认映射
        </button>
      </div>
    </div>
  );
};

export default FieldMappingPanel;
