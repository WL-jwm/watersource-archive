/**
 * S5.3: 多水源地叠加分析 — 水源地选择器
 *
 * 支持多选水源地、选择保护区级别、设置分析名称
 */

import React, { useMemo, useState } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import type { ZoneLevel } from '@/lib/multiSourceOverlayEngine';
import { useToast } from '@/hooks/useToast';

const LEVELS: ZoneLevel[] = ['一级', '二级', '准保护区'];

interface OverlaySourceSelectorProps {
  selectedSourceIds: string[];
  selectedLevels: ZoneLevel[];
  analysisName: string;
  onSourceIdsChange: (ids: string[]) => void;
  onLevelsChange: (levels: ZoneLevel[]) => void;
  onAnalysisNameChange: (name: string) => void;
  onRun: () => void;
  calculating: boolean;
}

const OverlaySourceSelector: React.FC<OverlaySourceSelectorProps> = ({
  selectedSourceIds,
  selectedLevels,
  analysisName,
  onSourceIdsChange,
  onLevelsChange,
  onAnalysisNameChange,
  onRun,
  calculating,
}) => {
  const { sources, zoneResults } = useWaterSourceStore();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  // 只有有计算结果的水源地才能参与叠加
  const sourcesWithResults = useMemo(() => {
    const sourceIdsWithResults = new Set(zoneResults.map((r) => r.sourceId));
    return sources.filter((s) => sourceIdsWithResults.has(s.id));
  }, [sources, zoneResults]);

  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return sourcesWithResults;
    const q = searchQuery.toLowerCase();
    return sourcesWithResults.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.cityName.toLowerCase().includes(q) ||
        s.county.toLowerCase().includes(q),
    );
  }, [sourcesWithResults, searchQuery]);

  const handleSourceToggle = (id: string) => {
    if (selectedSourceIds.includes(id)) {
      onSourceIdsChange(selectedSourceIds.filter((s) => s !== id));
    } else {
      onSourceIdsChange([...selectedSourceIds, id]);
    }
  };

  const handleLevelToggle = (level: ZoneLevel) => {
    if (selectedLevels.includes(level)) {
      onLevelsChange(selectedLevels.filter((l) => l !== level));
    } else {
      onLevelsChange([...selectedLevels, level]);
    }
  };

  const handleSelectAll = () => {
    if (selectedSourceIds.length === filteredSources.length) {
      onSourceIdsChange([]);
    } else {
      onSourceIdsChange(filteredSources.map((s) => s.id));
    }
  };

  const handleRun = () => {
    if (selectedSourceIds.length < 2) {
      toast.warning('请至少选择 2 个水源地进行叠加分析');
      return;
    }
    if (selectedLevels.length === 0) {
      toast.warning('请至少选择一个保护区级别');
      return;
    }
    onRun();
  };

  return (
    <div className="bg-surface rounded-lg border border-surface-border p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">叠加分析设置</h3>

        {/* 分析名称 */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">分析名称</label>
          <input
            type="text"
            value={analysisName}
            onChange={(e) => onAnalysisNameChange(e.target.value)}
            placeholder="如：石家庄市多水源地一级保护区叠加"
            className="w-full px-3 py-1.5 text-sm border border-surface-border rounded-md bg-surface focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 保护区级别选择 */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">保护区级别</label>
          <div className="flex gap-2">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => handleLevelToggle(level)}
                className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                  selectedLevels.includes(level)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-surface text-text-secondary border-surface-border hover:border-blue-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 水源地选择 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-text-secondary">
            选择水源地（{selectedSourceIds.length}/{filteredSources.length}）
          </label>
          <button
            onClick={handleSelectAll}
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            {selectedSourceIds.length === filteredSources.length ? '取消全选' : '全选'}
          </button>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索水源地名称、城市或区县..."
          className="w-full px-3 py-1.5 text-sm border border-surface-border rounded-md bg-surface mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="max-h-64 overflow-y-auto border border-surface-border rounded-md">
          {filteredSources.length === 0 ? (
            <div className="px-3 py-4 text-xs text-text-tertiary text-center">
              没有已计算保护区的水源地
            </div>
          ) : (
            filteredSources.map((source) => {
              const zoneResult = zoneResults.find((r) => r.sourceId === source.id);
              const zoneLevels = zoneResult?.zones.map((z) => z.level) ?? [];
              const hasAllSelectedLevels = selectedLevels.every((l) => zoneLevels.includes(l));

              return (
                <label
                  key={source.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-surface-tertiary cursor-pointer border-b border-surface-border last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedSourceIds.includes(source.id)}
                    onChange={() => handleSourceToggle(source.id)}
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{source.name}</div>
                    <div className="text-xs text-text-tertiary">
                      {source.cityName} · {source.county} · {source.type}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {zoneLevels.map((l) => (
                      <span
                        key={l}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          selectedLevels.includes(l as ZoneLevel)
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                  {!hasAllSelectedLevels && selectedLevels.length > 0 && (
                    <span className="text-[10px] text-amber-500" title="该水源地缺少所选级别的保护区">
                      ⚠
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* 执行按钮 */}
      <button
        onClick={handleRun}
        disabled={calculating}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {calculating ? '计算中...' : '执行叠加分析'}
      </button>
    </div>
  );
};

export default OverlaySourceSelector;
