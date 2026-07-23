/* ===== 行政区划总览页面 ===== */
import React, { useState, useMemo } from 'react';
import { hebeiDivisions, getAllDistricts, getDistrictTypeLabel } from '@/data/hebeiDivisions';

import { useDivisionStore } from '@/stores/divisionStore';
import type { DistrictDivision } from '@/types/division';

// 县区类型对应的样式
function typeBadgeStyle(type: string): string {
  switch (type) {
    case '市辖区':
      return 'bg-blue-100 text-blue-700';
    case '县级市':
      return 'bg-amber-100 text-amber-700';
    case '县':
      return 'bg-gray-100 text-gray-600';
    case '自治县':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

// 乡镇类型图标
function townshipIcon(name: string): string {
  if (name.includes('街道')) return 'J';
  if (name.includes('镇')) return 'Z';
  if (name.includes('民族')) return 'M';
  return 'X';
}

const DivisionOverview: React.FC = () => {
  const { selection, selectCity, selectDistrict, selectTownship, togglePanel } = useDivisionStore();
  const [searchQuery, setSearchQuery] = useState('');
  // P2-1: 懒加载乡镇数据（370KB）
  const [townshipState, setTownshipState] = React.useState<{
    data: Record<
      string,
      Array<{
        name: string;
        code: string;
        type?: string;
        level?: string;
        parentCode?: string;
        cityCode?: string;
        districtCode?: string;
      }>
    >;
    stats: { total: number; byCity: Record<string, number> };
  } | null>(null);
  React.useEffect(() => {
    import('@/data/hebeiTownships').then((m) => {
      setTownshipState({ data: m.townshipData, stats: m.townshipStats });
    });
  }, []);

  const townshipData = townshipState?.data || {};
  const townshipStats = townshipState?.stats || { total: 0, byCity: {} };

  const [selectedCityIdx, setSelectedCityIdx] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictDivision | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // 按类型统计
  const typeStats = useMemo(() => {
    const districts = getAllDistricts();
    const stats: Record<string, number> = {};
    for (const d of districts) {
      stats[d.type] = (stats[d.type] || 0) + 1;
    }
    return stats;
  }, []);

  // 过滤后的市列表
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return hebeiDivisions.cities;
    const q = searchQuery.toLowerCase();
    return hebeiDivisions.cities.filter(
      (c) =>
        c.name.includes(q) ||
        c.districts.some((d) => d.name.includes(q)) ||
        c.districts.some((d) => (townshipData[d.name] || []).some((t) => t.name.includes(q))),
    );
  }, [searchQuery]);

  // 当前选中市的乡镇统计
  const cityTownshipCount = useMemo(() => {
    if (selectedCityIdx === null) return 0;
    const city = hebeiDivisions.cities[selectedCityIdx];
    let count = 0;
    for (const d of city.districts) {
      count += (townshipData[d.name] || []).length;
    }
    return count;
  }, [selectedCityIdx]);

  // 当前选中区县的乡镇列表
  const currentTownships = useMemo(() => {
    if (!selectedDistrict) return [];
    return townshipData[selectedDistrict.name] || [];
  }, [selectedDistrict]);

  // 全省搜索结果
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const results: { city: string; district: string; township?: string; type: string }[] = [];
    for (const city of hebeiDivisions.cities) {
      for (const d of city.districts) {
        if (d.name.toLowerCase().includes(q)) {
          results.push({ city: city.name, district: d.name, type: 'district' });
        }
        const townships = townshipData[d.name] || [];
        for (const t of townships) {
          if (t.name.toLowerCase().includes(q)) {
            results.push({ city: city.name, district: d.name, township: t.name, type: 'township' });
          }
        }
      }
    }
    return results.slice(0, 50); // 限制50条
  }, [searchQuery]);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">河北省行政区划</h1>
          <p className="text-sm text-text-secondary mt-1">
            数据截至2025年12月31日 | 来源：河北省民政厅
          </p>
        </div>
        <button
          onClick={togglePanel}
          className="px-3 py-2 bg-accent-500 text-white text-sm rounded-lg hover:bg-accent-600 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          快速选择
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="设区市" value={hebeiDivisions.cities.length} color="bg-blue-500" />
        <StatCard label="市辖区" value={typeStats['市辖区'] || 0} color="bg-cyan-500" />
        <StatCard label="县级市" value={typeStats['县级市'] || 0} color="bg-amber-500" />
        <StatCard
          label="县"
          value={(typeStats['县'] || 0) + (typeStats['自治县'] || 0)}
          color="bg-gray-500"
        />
        <StatCard label="乡镇街道" value={townshipStats.total} color="bg-green-500" />
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索市/区/县/乡镇/街道..."
          className="input pl-10 w-full"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* 搜索结果 */}
      {searchResults && searchResults.length > 0 && (
        <div className="bg-surface rounded-lg border border-surface-border overflow-hidden">
          <div className="px-4 py-2 bg-surface-secondary border-b border-surface-border">
            <span className="text-xs text-text-secondary">
              找到 {searchResults.length} 条结果
              {searchResults.length >= 50 && ' (仅显示前50条)'}
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-surface-border">
            {searchResults.map((r, i) => (
              <div
                key={i}
                className="px-4 py-2 text-xs hover:bg-surface-tertiary transition-colors"
              >
                <span className="text-text-secondary">{r.city}</span>
                <span className="mx-1.5 text-text-quaternary">/</span>
                <span className="font-medium text-text-primary">{r.district}</span>
                {r.township && (
                  <>
                    <span className="mx-1.5 text-text-quaternary">/</span>
                    <span className="text-accent-600">{r.township}</span>
                  </>
                )}
                <span className="ml-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${r.type === 'district' ? 'badge-info' : 'badge-success'}`}
                  >
                    {r.type === 'district' ? '县区' : '乡镇'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 主内容区：市列表 + 区县/乡镇详情 */}
      <div className="flex gap-4">
        {/* 左侧：市列表 */}
        <div className="w-64 shrink-0 space-y-1">
          <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider px-2 py-1">
            地级市 ({filteredCities.length})
          </div>
          <div className="space-y-0.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredCities.map((city, idx) => {
              const realIdx = hebeiDivisions.cities.indexOf(city);
              return (
                <button
                  key={city.code}
                  onClick={() => {
                    setSelectedCityIdx(realIdx);
                    setSelectedDistrict(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCityIdx === realIdx
                      ? 'bg-accent-500 text-white font-semibold'
                      : 'hover:bg-surface-tertiary text-text-primary'
                  }`}
                >
                  <div className="font-medium">{city.name}</div>
                  <div
                    className={`text-[10px] mt-0.5 ${selectedCityIdx === realIdx ? 'text-white/70' : 'text-text-tertiary'}`}
                  >
                    {city.districts.length}个县区
                    <span className="mx-1">/</span>
                    {(townshipStats.byCity as Record<string, number>)[city.name] || 0}个乡镇
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧：区县列表 */}
        <div className="flex-1 min-w-0">
          {selectedCityIdx === null ? (
            <div className="flex items-center justify-center h-64 text-sm text-text-tertiary">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-3 text-text-quaternary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                请从左侧选择一个地级市
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 市信息 */}
              <div className="bg-surface rounded-lg border border-surface-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">
                      {hebeiDivisions.cities[selectedCityIdx].name}
                    </h2>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      代码: {hebeiDivisions.cities[selectedCityIdx].code} |{' '}
                      {hebeiDivisions.cities[selectedCityIdx].districts.length}个县区 |{' '}
                      {cityTownshipCount}个乡镇
                    </p>
                  </div>
                </div>
              </div>

              {/* 区县网格 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-tertiary">县级行政区划</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {hebeiDivisions.cities[selectedCityIdx].districts.map((district) => {
                    const twCount = (townshipData[district.name] || []).length;
                    const isSelected = selectedDistrict?.code === district.code;
                    return (
                      <button
                        key={district.code}
                        onClick={() => setSelectedDistrict(isSelected ? null : district)}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-accent-500 bg-accent-50 shadow-sm'
                            : 'border-surface-border hover:border-accent-300 hover:bg-surface-secondary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-text-primary">
                            {district.name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${typeBadgeStyle(district.type)}`}
                          >
                            {district.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-text-tertiary mt-1">
                          {district.code} | {twCount}个乡镇
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 乡镇列表（展开的区县） */}
              {selectedDistrict && (
                <div className="bg-surface rounded-lg border border-accent-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-accent-50 border-b border-accent-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-accent-700">
                      {selectedDistrict.name} -- 乡级行政区划
                    </span>
                    <span className="text-xs text-accent-500 font-bold">
                      {currentTownships.length}个
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-secondary sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-text-tertiary font-medium w-12">
                            序号
                          </th>
                          <th className="text-left px-3 py-2 text-text-tertiary font-medium">
                            名称
                          </th>
                          <th className="text-left px-3 py-2 text-text-tertiary font-medium w-20">
                            类型
                          </th>
                          <th className="text-left px-3 py-2 text-text-tertiary font-medium w-24">
                            代码
                          </th>
                          <th className="text-right px-3 py-2 text-text-tertiary font-medium w-16">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {currentTownships.map((tw, idx) => (
                          <tr key={tw.code} className="hover:bg-surface-tertiary transition-colors">
                            <td className="px-3 py-2 text-text-tertiary">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-text-primary">{tw.name}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  tw.name.includes('街道')
                                    ? 'bg-blue-100 text-blue-700'
                                    : tw.name.includes('镇')
                                      ? 'bg-amber-100 text-amber-700'
                                      : tw.name.includes('民族')
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {tw.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-text-tertiary font-mono">{tw.code}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => {
                                  const city = hebeiDivisions.cities[selectedCityIdx];
                                  selectCity(city.code, city.name);
                                  selectDistrict(selectedDistrict.code, selectedDistrict.name);
                                  selectTownship(tw.code, tw.name);
                                  togglePanel();
                                }}
                                className="text-accent-500 hover:text-accent-600 text-[10px] font-medium"
                              >
                                选用
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 统计卡片组件
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface rounded-lg border border-surface-border p-3 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white text-lg font-bold`}
      >
        {value > 999 ? `${(value / 1000).toFixed(1)}k` : value}
      </div>
      <div>
        <div className="text-lg font-bold text-text-primary">{value.toLocaleString()}</div>
        <div className="text-[10px] text-text-tertiary">{label}</div>
      </div>
    </div>
  );
}

export default DivisionOverview;
