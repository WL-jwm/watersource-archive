/**
 * N2: 水源地编码校验面板
 *
 * 功能：
 * - 批量展示所有水源地编码生成结果
 * - 高亮存在问题的记录
 * - 统计摘要（有效/无效/问题分布）
 * - 支持导出编码对照表
 */

import React, { useMemo, useState } from 'react';
import {
  batchValidateCodes,
  summarizeValidation,
  formatCodeForDisplay,
  type CodeValidationResult,
} from '@/lib/waterSourceCoder';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

interface CodeValidationPanelProps {
  open: boolean;
  sources: WaterSourceRecord[];
  onClose: () => void;
}

type FilterMode = 'all' | 'valid' | 'invalid';

const CodeValidationPanel: React.FC<CodeValidationPanelProps> = ({ open, sources, onClose }) => {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [searchText, setSearchText] = useState('');

  const results = useMemo(() => batchValidateCodes(sources), [sources]);
  const summary = useMemo(() => summarizeValidation(results), [results]);

  const filtered = useMemo(() => {
    let list = results;
    if (filter === 'valid') list = list.filter((r) => r.valid);
    if (filter === 'invalid') list = list.filter((r) => !r.valid);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.recordName.toLowerCase().includes(q) ||
          r.cityName.toLowerCase().includes(q) ||
          r.generatedCode.toLowerCase().includes(q),
      );
    }
    return list;
  }, [results, filter, searchText]);

  const handleExport = () => {
    const headers = ['序号', '水源地名称', '城市', '级别', '类型', '标准编码', '可读编码', '状态', '问题'];
    const rows = results.map((r, i) => [
      String(i + 1),
      r.recordName,
      r.cityName,
      r.level,
      r.type,
      r.generatedCode,
      r.displayCode,
      r.valid ? '有效' : '无效',
      r.issues.join('；'),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `水源地编码对照表_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  const levelLabel = (level: string) => {
    const map: Record<string, string> = { municipal: '市级', county: '县级', township: '镇级' };
    return map[level] || level;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">水源地编码校验</h3>
            <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
              SD + 行政区划(6) + 类型(1) + 级别(1) + 序号(3)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
            >
              导出对照表
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 统计摘要 */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{summary.total}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">总记录数</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{summary.valid}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">编码有效</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-500">{summary.invalid}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">存在问题</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">
                {summary.total > 0 ? ((summary.valid / summary.total) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">有效率</div>
            </div>
          </div>

          {/* 问题分布 */}
          {summary.invalid > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(summary.issueBreakdown).map(([issue, count]) => (
                <span
                  key={issue}
                  className="text-[10px] px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-full"
                >
                  {issue} ({count})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1">
            {([
              { value: 'all', label: `全部 (${summary.total})` },
              { value: 'valid', label: `有效 (${summary.valid})` },
              { value: 'invalid', label: `有问题 (${summary.invalid})` },
            ] as { value: FilterMode; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  filter === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索名称/城市/编码..."
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 数据表 */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              {results.length === 0 ? '暂无水源地数据' : '无匹配结果'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">水源地名称</th>
                  <th className="px-3 py-2 font-medium">城市</th>
                  <th className="px-3 py-2 font-medium">级别</th>
                  <th className="px-3 py-2 font-medium">类型</th>
                  <th className="px-3 py-2 font-medium">标准编码</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((r, idx) => (
                  <tr
                    key={r.recordId}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      !r.valid ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                    }`}
                  >
                    <td className="px-3 py-1.5 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100 font-medium">
                      {r.recordName}
                      {!r.valid && (
                        <div className="mt-0.5 text-[10px] text-red-500">
                          {r.issues.join('；')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{r.cityName}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{levelLabel(r.level)}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{r.type}</td>
                    <td className="px-3 py-1.5">
                      <code className={`px-1.5 py-0.5 rounded text-[11px] ${
                        r.valid
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                      }`}>
                        {r.displayCode}
                      </code>
                    </td>
                    <td className="px-3 py-1.5">
                      {r.valid ? (
                        <span className="inline-flex items-center gap-0.5 text-green-600">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          有效
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-red-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
                          </svg>
                          无效
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            编码规则：环办函〔2012〕519号《集中式饮用水水源地编码规则》
          </span>
          <span>共 {filtered.length} 条记录</span>
        </div>
      </div>
    </div>
  );
};

export default CodeValidationPanel;
