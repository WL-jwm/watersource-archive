/**
 * AdvancedSearchPanel - 高级搜索筛选面板
 *
 * 功能：
 * 1. 搜索输入框 + 拼音搜索建议下拉
 * 2. 多选筛选标签（城市/级别/类型/状态/子类型/河流）
 * 3. 排序下拉
 * 4. 筛选预设管理（保存/加载/删除）
 * 5. 筛选统计展示
 * 6. 高亮匹配文本渲染
 */

import { useState, useRef, useEffect } from 'react';
import { type UseSearchFilterReturn } from '@/hooks/useSearchFilter';
import { getHighlightSegments } from '@/lib/searchFilterEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

interface AdvancedSearchPanelProps {
  search: UseSearchFilterReturn;
  onRecordClick?: (record: WaterSourceRecord) => void;
}

const LEVEL_LABELS: Record<string, string> = {
  provincial: '省级',
  municipal: '市级',
  county: '县级',
};

const SORT_OPTIONS = [
  { value: '', label: '默认排序' },
  { value: 'name:asc', label: '名称 ↑' },
  { value: 'name:desc', label: '名称 ↓' },
  { value: 'cityName:asc', label: '城市 ↑' },
  { value: 'cityName:desc', label: '城市 ↓' },
  { value: 'population:desc', label: '人口 ↓' },
  { value: 'population:asc', label: '人口 ↑' },
];

/** 多选标签组 */
function MultiSelectChips({
  label,
  options,
  selected,
  onToggle,
  labels,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  labels?: Record<string, string>;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {labels?.[opt] || opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 高亮文本渲染 */
function HighlightedText({
  text,
  match,
}: {
  text: string;
  match?: { field: string; start: number; length: number };
}) {
  const segments = getHighlightSegments(text, match);
  return (
    <span>
      {segments.map((seg, i) => (
        <span
          key={i}
          className={seg.highlighted ? 'bg-yellow-200 rounded px-0.5' : ''}
        >
          {seg.text}
        </span>
      ))}
    </span>
  );
}

export default function AdvancedSearchPanel({ search }: AdvancedSearchPanelProps) {
  const {
    keywordInput,
    setKeywordInput,
    criteria,
    toggleArrayFilter,
    filterOptions,
    filterResult,
    sort,
    setSort,
    showAdvanced,
    setShowAdvanced,
    hasActiveFilter,
    resetCriteria,
    suggestions,
    presets,
    handleSavePreset,
    handleLoadPreset,
    handleDeletePreset,
  } = search;

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetName, setPresetName] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭建议
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sortValue = sort ? `${sort.field}:${sort.direction}` : '';

  const handleSortChange = (value: string) => {
    if (!value) {
      setSort(undefined);
    } else {
      const [field, direction] = value.split(':') as [string, 'asc' | 'desc'];
      setSort({ field: field as never, direction });
    }
  };

  const handleSavePresetClick = () => {
    if (presetName.trim()) {
      handleSavePreset(presetName.trim());
      setPresetName('');
    }
  };

  return (
    <div className="rounded-lg p-3 bg-white border border-gray-200 space-y-3">
      {/* 搜索框 + 建议下拉 */}
      <div ref={searchRef} className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="搜索名称/县区/河流/拼音首字母..."
              value={keywordInput}
              onChange={(e) => {
                setKeywordInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 w-full pl-7"
            />
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {keywordInput && (
              <button
                onClick={() => {
                  setKeywordInput('');
                  setShowSuggestions(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* 高级筛选切换 */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`text-xs px-2 py-1.5 rounded border transition-colors flex items-center gap-1 ${
              showAdvanced || hasActiveFilter
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            筛选
            {hasActiveFilter && (
              <span className="bg-blue-600 text-white text-[10px] rounded-full px-1.5 leading-4">
                活跃
              </span>
            )}
          </button>

          {/* 排序 */}
          <select
            value={sortValue}
            onChange={(e) => handleSortChange(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 预设管理 */}
          <div className="relative">
            <button
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              className="text-xs px-2 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              预设 ▾
            </button>
            {showPresetMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-56 p-2 space-y-2">
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="预设名称..."
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 flex-1"
                  />
                  <button
                    onClick={handleSavePresetClick}
                    disabled={!presetName.trim()}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    保存
                  </button>
                </div>
                {presets.length > 0 && (
                  <div className="border-t border-gray-100 pt-1 space-y-1 max-h-40 overflow-y-auto">
                    {presets.map((p) => (
                      <div key={p.id} className="flex items-center gap-1 text-xs">
                        <button
                          onClick={() => {
                            handleLoadPreset(p);
                            setShowPresetMenu(false);
                          }}
                          className="flex-1 text-left px-2 py-1 rounded hover:bg-gray-50 truncate"
                        >
                          {p.name}
                        </button>
                        <button
                          onClick={() => handleDeletePreset(p.id)}
                          className="text-red-400 hover:text-red-600 px-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {presets.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-2">暂无预设</div>
                )}
              </div>
            )}
          </div>

          {hasActiveFilter && (
            <button
              onClick={resetCriteria}
              className="text-xs px-2 py-1.5 rounded text-red-500 hover:bg-red-50"
            >
              清除
            </button>
          )}
        </div>

        {/* 搜索建议下拉 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-w-xs">
            {suggestions.map((sug) => (
              <button
                key={sug}
                onClick={() => {
                  setKeywordInput(sug);
                  setShowSuggestions(false);
                }}
                className="block w-full text-left text-xs px-3 py-1.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                {sug}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 高级筛选面板 */}
      {showAdvanced && (
        <div className="border-t border-gray-100 pt-2 space-y-2">
          <MultiSelectChips
            label="城市"
            options={filterOptions.cities}
            selected={criteria.cities}
            onToggle={(v) => toggleArrayFilter('cities', v)}
          />
          <MultiSelectChips
            label="级别"
            options={filterOptions.levels}
            selected={criteria.levels}
            onToggle={(v) => toggleArrayFilter('levels', v)}
            labels={LEVEL_LABELS}
          />
          <MultiSelectChips
            label="类型"
            options={filterOptions.types}
            selected={criteria.types}
            onToggle={(v) => toggleArrayFilter('types', v)}
          />
          <MultiSelectChips
            label="状态"
            options={filterOptions.statuses}
            selected={criteria.statuses}
            onToggle={(v) => toggleArrayFilter('statuses', v)}
          />
          {filterOptions.subTypes.length > 0 && (
            <MultiSelectChips
              label="子类型"
              options={filterOptions.subTypes}
              selected={criteria.subTypes}
              onToggle={(v) => toggleArrayFilter('subTypes', v)}
            />
          )}
          {filterOptions.rivers.length > 0 && (
            <MultiSelectChips
              label="河流"
              options={filterOptions.rivers}
              selected={criteria.rivers}
              onToggle={(v) => toggleArrayFilter('rivers', v)}
            />
          )}
        </div>
      )}

      {/* 筛选统计 */}
      <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-2">
        <span>
          筛选结果：<span className="font-semibold text-gray-700">{filterResult.stats.filtered}</span> 条
        </span>
        {filterResult.stats.filtered !== filterResult.stats.total && (
          <span>/ 共 {filterResult.stats.total} 条</span>
        )}
        {filterResult.stats.filtered > 0 && (
          <>
            <span className="text-gray-300">|</span>
            {(Object.entries(filterResult.stats.byCity) as [string, number][])
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([city, count]) => (
                <span key={city}>
                  {city} {count}
                </span>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

/** 导出高亮文本组件供列表项使用 */
export { HighlightedText };
