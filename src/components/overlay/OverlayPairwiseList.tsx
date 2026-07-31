/**
 * S5.3: 多水源地叠加分析 — 两两重叠列表
 *
 * 展示水源地之间的两两重叠检测结果
 */

import React, { useMemo, useState } from 'react';
import type { OverlayResult, PairwiseOverlap } from '@/lib/multiSourceOverlayEngine';

interface OverlayPairwiseListProps {
  result: OverlayResult;
}

type SortField = 'overlapArea' | 'overlapRatio' | 'sourceAName';
type SortDir = 'asc' | 'desc';

const OverlayPairwiseList: React.FC<OverlayPairwiseListProps> = ({ result }) => {
  const [sortField, setSortField] = useState<SortField>('overlapArea');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterNonZero, setFilterNonZero] = useState(false);

  const sortedOverlaps = useMemo(() => {
    let list = [...result.overlaps];

    if (filterLevel !== 'all') {
      list = list.filter((o) => o.level === filterLevel);
    }
    if (filterNonZero) {
      list = list.filter((o) => o.overlapArea > 0);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'overlapArea') {
        cmp = a.overlapArea - b.overlapArea;
      } else if (sortField === 'overlapRatio') {
        cmp = a.overlapRatio - b.overlapRatio;
      } else {
        cmp = a.sourceAName.localeCompare(b.sourceAName, 'zh-CN');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [result.overlaps, sortField, sortDir, filterLevel, filterNonZero]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const levels = useMemo(() => {
    const set = new Set(result.overlaps.map((o) => o.level));
    return Array.from(set);
  }, [result.overlaps]);

  if (result.overlaps.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-surface-border p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-2">两两重叠检测</h3>
        <p className="text-xs text-text-tertiary text-center py-4">
          仅有 1 个水源地，无两两重叠检测数据
        </p>
      </div>
    );
  }

  const SortHeader: React.FC<{ field: SortField; label: string; align?: string }> = ({
    field,
    label,
    align = 'left',
  }) => (
    <th
      onClick={() => handleSort(field)}
      className={`py-1.5 px-2 text-text-tertiary font-medium cursor-pointer hover:text-text-primary select-none ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortField === field && (
          <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="bg-surface rounded-lg border border-surface-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          两两重叠检测（{result.overlaps.length} 对）
        </h3>
        <div className="flex items-center gap-2">
          {levels.length > 1 && (
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="text-xs border border-surface-border rounded px-2 py-1 bg-surface"
            >
              <option value="all">全部级别</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={filterNonZero}
              onChange={(e) => setFilterNonZero(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            仅显示有重叠
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-border">
              <SortHeader field="sourceAName" label="水源地A" />
              <th className="text-left py-1.5 px-2 text-text-tertiary font-medium">水源地B</th>
              <th className="text-left py-1.5 px-2 text-text-tertiary font-medium">级别</th>
              <SortHeader field="overlapArea" label="重叠面积(km²)" align="right" />
              <SortHeader field="overlapRatio" label="重叠比例" align="right" />
            </tr>
          </thead>
          <tbody>
            {sortedOverlaps.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-text-tertiary">
                  无匹配数据
                </td>
              </tr>
            ) : (
              sortedOverlaps.map((o: PairwiseOverlap, i: number) => (
                <tr
                  key={`${o.sourceAId}-${o.sourceBId}-${o.level}-${i}`}
                  className="border-b border-surface-border last:border-b-0 hover:bg-surface-tertiary"
                >
                  <td className="py-1.5 px-2 text-text-primary">{o.sourceAName}</td>
                  <td className="py-1.5 px-2 text-text-primary">{o.sourceBName}</td>
                  <td className="py-1.5 px-2 text-text-secondary">{o.level}</td>
                  <td className={`text-right py-1.5 px-2 ${o.overlapArea > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {o.overlapArea.toFixed(4)}
                  </td>
                  <td className={`text-right py-1.5 px-2 ${o.overlapRatio > 0.1 ? 'text-red-600' : 'text-text-secondary'}`}>
                    {(o.overlapRatio * 100).toFixed(2)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OverlayPairwiseList;
