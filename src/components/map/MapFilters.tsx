/**
 * N6: MapView 拆分 — 地图筛选工具栏
 *
 * 包含级别筛选、类型筛选、城市筛选、保护区叠加开关、导出地图按钮
 */

import React from 'react';

export type FilterType = 'all' | 'municipal' | 'county' | 'township';
export type SourceTypeFilter = 'all' | '地表水' | '地下水';

export interface GeoSource {
  city: string;
  level: string;
  name: string;
  type: string;
  county: string;
  status: string;
  remark: string;
  lng: number;
  lat: number;
  population?: number;
  kind?: '井' | '保护区范围';
}

interface MapFiltersProps {
  filteredCount: number;
  totalCount: number;
  filter: FilterType;
  typeFilter: SourceTypeFilter;
  selectedCity: string;
  showZones: boolean;
  zoneCount: number;
  showActualZones: boolean;
  onToggleActualZones: () => void;
  exporting: boolean;
  cityList: string[];
  sources: GeoSource[];
  onFilterChange: (f: FilterType) => void;
  onTypeFilterChange: (t: SourceTypeFilter) => void;
  onCityChange: (c: string) => void;
  onToggleZones: () => void;
  onExport: () => void;
}

const levelConfig: Record<string, { color: string; label: string }> = {
  municipal: { color: '#2F5496', label: '市级' },
  county: { color: '#548235', label: '县级' },
  township: { color: '#BF8F00', label: '乡镇级' },
};

const MapFilters: React.FC<MapFiltersProps> = ({
  filteredCount,
  totalCount,
  filter,
  typeFilter,
  selectedCity,
  showZones,
  zoneCount,
  showActualZones,
  onToggleActualZones,
  exporting,
  cityList,
  sources,
  onFilterChange,
  onTypeFilterChange,
  onCityChange,
  onToggleZones,
  onExport,
}) => {
  return (
    <div className="px-4 py-3 bg-surface border-b border-border flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
      <h2 className="text-sm font-bold text-text-primary">GIS地图</h2>
      <span className="text-xs text-text-tertiary">
        {filteredCount} / {totalCount} 个水源地
      </span>

      <div className="flex items-center gap-2 ml-auto overflow-x-auto scrollbar-hide">
        {/* 级别筛选 */}
        {(['all', 'municipal', 'county', 'township'] as FilterType[]).map((f) => {
          const label = f === 'all' ? '全部' : levelConfig[f]?.label;
          const count =
            f === 'all' ? sources.length : sources.filter((s) => s.level === f).length;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                active
                  ? f === 'municipal'
                    ? 'bg-[#2F5496] text-white border-[#2F5496]'
                    : f === 'county'
                      ? 'bg-[#548235] text-white border-[#548235]'
                      : f === 'township'
                        ? 'bg-[#BF8F00] text-white border-[#BF8F00]'
                        : 'bg-accent-500 text-white border-accent-500'
                    : 'bg-surface text-text-secondary border-border hover:border-accent-300'
              }`}
            >
              {label}({count})
            </button>
          );
        })}

        <div className="w-px h-5 bg-border mx-1" />

        {/* 类型筛选 */}
        {(['all', '地表水', '地下水'] as SourceTypeFilter[]).map((t) => {
          const active = typeFilter === t;
          return (
            <button
              key={t}
              onClick={() => onTypeFilterChange(t)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                active
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-surface text-text-secondary border-border hover:border-primary-300'
              }`}
            >
              {t === 'all' ? '全部类型' : t}
            </button>
          );
        })}

        <div className="w-px h-5 bg-border mx-1" />

        {/* 城市筛选 */}
        <select
          value={selectedCity}
          onChange={(e) => onCityChange(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1 bg-surface text-text-primary"
        >
          {cityList.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? '全部城市' : c}
            </option>
          ))}
        </select>

        <div className="w-px h-5 bg-border mx-1" />

        {/* 保护区叠加开关 */}
        <button
          onClick={onToggleZones}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
            showZones
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-surface text-text-secondary border-border hover:border-red-300'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          保护区{showZones && zoneCount > 0 ? `(${zoneCount})` : ''}
        </button>

        {/* 实际保护区范围开关 */}
        <button
          onClick={onToggleActualZones}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
            showActualZones
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-surface text-text-secondary border-border hover:border-blue-300'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
            />
          </svg>
          实际范围
        </button>

        {/* 导出地图截图 */}
        <button
          onClick={onExport}
          disabled={exporting}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
            exporting
              ? 'bg-gray-300 text-gray-500 border-gray-300'
              : 'bg-surface text-text-secondary border-border hover:border-indigo-300'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {exporting ? '导出中...' : '导出地图'}
        </button>
      </div>
    </div>
  );
};

export default MapFilters;
