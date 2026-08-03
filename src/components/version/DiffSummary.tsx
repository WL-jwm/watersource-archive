/* ===== S11.5: Diff 统计摘要条 =====
 * 顶部统计：新增/删除/修改/未变计数 + 点击筛选
 */

import React from 'react';
import type { VersionDiff } from '@/lib/dataVersionEngine';

export type DiffFilter = 'all' | 'added' | 'removed' | 'modified' | 'unchanged';

interface DiffSummaryProps {
  diff: VersionDiff;
  filter: DiffFilter;
  onFilterChange: (filter: DiffFilter) => void;
}

const DiffSummary: React.FC<DiffSummaryProps> = ({ diff, filter, onFilterChange }) => {
  const items: { key: DiffFilter; label: string; count: number; color: string; bgColor: string }[] = [
    { key: 'all', label: '全部', count: diff.added.length + diff.removed.length + diff.modified.length + diff.unchanged, color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200' },
    { key: 'added', label: '新增', count: diff.added.length, color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
    { key: 'removed', label: '删除', count: diff.removed.length, color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
    { key: 'modified', label: '修改', count: diff.modified.length, color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
    { key: 'unchanged', label: '未变', count: diff.unchanged, color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200' },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {items.map((item) => {
        const isActive = filter === item.key;
        const isDisabled = item.count === 0 && item.key !== 'all';
        return (
          <button
            key={item.key}
            onClick={() => !isDisabled && onFilterChange(item.key)}
            disabled={isDisabled}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              isActive
                ? `${item.bgColor} ${item.color} font-bold ring-2 ring-offset-1 ring-blue-300`
                : isDisabled
                  ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {item.label}
            <span className="ml-1.5 font-bold">{item.count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DiffSummary;
