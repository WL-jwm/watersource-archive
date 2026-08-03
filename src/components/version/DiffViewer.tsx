/* ===== S11.5: Diff 三列对比视图 =====
 * 字段名 | 旧值 | 新值，变更字段高亮（红删绿增）
 * 支持展开/折叠未变更字段
 */

import React, { useState } from 'react';
import type { VersionDiff, FieldDiff } from '@/lib/dataVersionEngine';
import DiffSummary, { type DiffFilter } from './DiffSummary';

interface DiffViewerProps {
  diff: VersionDiff;
}

/** 字段中文标签映射 */
const FIELD_LABELS: Record<string, string> = {
  name: '水源地名称',
  cityName: '城市',
  level: '级别',
  type: '水源类型',
  subType: '细分类型',
  county: '县区',
  status: '状态',
  population: '服务人口',
  river: '河流',
  lng: '经度',
  lat: '纬度',
  remark: '备注',
};

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

function formatValue(val: unknown): string {
  if (val === undefined || val === null) return '(空)';
  if (typeof val === 'string' && val.trim() === '') return '(空)';
  return String(val);
}

const DiffViewer: React.FC<DiffViewerProps> = ({ diff }) => {
  const [filter, setFilter] = useState<DiffFilter>('all');
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 空 diff
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
    return (
      <div className="space-y-4">
        <DiffSummary diff={diff} filter={filter} onFilterChange={setFilter} />
        <div className="text-center py-8 text-gray-400 text-sm">
          当前数据与此版本完全一致，无差异
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DiffSummary diff={diff} filter={filter} onFilterChange={setFilter} />

      {/* 新增记录 */}
      {(filter === 'all' || filter === 'added') && diff.added.length > 0 && (
        <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-green-50 border-b border-green-200 text-sm font-medium text-green-800">
            <span className="text-green-600 mr-1">+</span> 新增记录 ({diff.added.length})
          </div>
          <div className="divide-y divide-green-50">
            {diff.added.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-600 font-bold">+</span>
                  <span className="text-sm font-medium text-gray-800">{item.name}</span>
                  <span className="text-xs text-gray-400">
                    {formatValue((item.data as Record<string, unknown>).type)} /{' '}
                    {formatValue((item.data as Record<string, unknown>).county)}
                  </span>
                </div>
                {expandedRecords.has('added-' + item.id) && (
                  <div className="mt-2 ml-6 grid grid-cols-2 gap-1 text-xs">
                    {Object.entries(item.data)
                      .filter(([k]) => k !== 'id' && k !== 'dataVersion')
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-1">
                          <span className="text-gray-400">{getFieldLabel(k)}:</span>
                          <span className="text-green-700 font-medium">{formatValue(v)}</span>
                        </div>
                      ))}
                  </div>
                )}
                <button
                  onClick={() => toggleExpand('added-' + item.id)}
                  className="ml-6 mt-1 text-xs text-blue-500 hover:text-blue-600"
                >
                  {expandedRecords.has('added-' + item.id) ? '收起' : '展开详情'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 删除记录 */}
      {(filter === 'all' || filter === 'removed') && diff.removed.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm font-medium text-red-800">
            <span className="text-red-600 mr-1">-</span> 删除记录 ({diff.removed.length})
          </div>
          <div className="divide-y divide-red-50">
            {diff.removed.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-600 font-bold">-</span>
                  <span className="text-sm font-medium text-gray-800 line-through">{item.name}</span>
                  <span className="text-xs text-gray-400">
                    {formatValue((item.data as Record<string, unknown>).status)}
                  </span>
                </div>
                {expandedRecords.has('removed-' + item.id) && (
                  <div className="mt-2 ml-6 grid grid-cols-2 gap-1 text-xs">
                    {Object.entries(item.data)
                      .filter(([k]) => k !== 'id' && k !== 'dataVersion')
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-1">
                          <span className="text-gray-400">{getFieldLabel(k)}:</span>
                          <span className="text-red-500">{formatValue(v)}</span>
                        </div>
                      ))}
                  </div>
                )}
                <button
                  onClick={() => toggleExpand('removed-' + item.id)}
                  className="ml-6 mt-1 text-xs text-blue-500 hover:text-blue-600"
                >
                  {expandedRecords.has('removed-' + item.id) ? '收起' : '展开详情'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 修改记录 — 三列对比 */}
      {(filter === 'all' || filter === 'modified') && diff.modified.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm font-medium text-amber-800">
            <span className="text-amber-600 mr-1">~</span> 修改记录 ({diff.modified.length})
          </div>
          <div className="divide-y divide-amber-50">
            {diff.modified.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="text-sm font-medium text-gray-800 mb-2">{item.name}</div>
                {/* 三列表头 */}
                <div className="grid grid-cols-12 gap-2 text-xs mb-1 px-2">
                  <div className="col-span-3 text-gray-400 font-medium">字段</div>
                  <div className="col-span-4 text-red-400 font-medium">旧值</div>
                  <div className="col-span-1 text-center text-gray-300">→</div>
                  <div className="col-span-4 text-green-500 font-medium">新值</div>
                </div>
                {/* 字段行 */}
                <div className="space-y-1">
                  {item.changes.map((c: FieldDiff, i: number) => (
                    <div key={i} className="grid grid-cols-12 gap-2 text-xs px-2 py-1 rounded hover:bg-amber-50/50">
                      <div className="col-span-3 text-gray-600 font-medium">{getFieldLabel(c.field)}</div>
                      <div className="col-span-4 text-red-500 line-through bg-red-50/50 px-2 py-0.5 rounded">
                        {formatValue(c.oldValue)}
                      </div>
                      <div className="col-span-1 text-center text-gray-300 self-center">→</div>
                      <div className="col-span-4 text-green-700 bg-green-50/50 px-2 py-0.5 rounded font-medium">
                        {formatValue(c.newValue)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 未变记录 */}
      {filter === 'unchanged' && (
        <div className="text-center py-8 text-gray-400 text-sm">
          {diff.unchanged > 0
            ? `${diff.unchanged} 条记录未发生变化`
            : '没有未变化的记录'}
        </div>
      )}
    </div>
  );
};

export default DiffViewer;
