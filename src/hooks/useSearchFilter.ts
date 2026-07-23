/**
 * useSearchFilter - 高级搜索筛选 Hook
 *
 * 封装 searchFilterEngine，提供：
 * - 防抖关键词输入
 * - 多维度筛选状态管理
 * - 排序状态管理
 * - 筛选预设加载/保存/删除
 * - 搜索建议
 * - 匹配高亮信息
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  type FilterCriteria,
  type SortCriteria,
  type FilterPreset,
  type FilterResult,
  advancedFilter,
  emptyCriteria,
  getSearchSuggestions,
  extractFilterOptions,
  loadFilterPresets,
  saveFilterPreset,
  deleteFilterPreset,
} from '@/lib/searchFilterEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

const DEBOUNCE_MS = 250;

export function useSearchFilter(sources: WaterSourceRecord[]) {
  // 原始关键词（即时更新）
  const [keywordInput, setKeywordInput] = useState('');
  // 防抖后的关键词（实际用于搜索）
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  // 筛选条件
  const [criteria, setCriteria] = useState<FilterCriteria>(emptyCriteria());
  // 排序条件
  const [sort, setSort] = useState<SortCriteria | undefined>(undefined);
  // 是否展开高级筛选面板
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 预设列表
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  // 搜索建议
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖关键词
  const handleKeywordChange = useCallback((value: string) => {
    setKeywordInput(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedKeyword(value.trim());
    }, DEBOUNCE_MS);
  }, []);

  // 防抖搜索建议
  useEffect(() => {
    if (!keywordInput.trim() || keywordInput.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      setSuggestions(getSearchSuggestions(sources, keywordInput.trim(), 6));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordInput, sources]);

  // 合并关键词到筛选条件
  const effectiveCriteria = useMemo<FilterCriteria>(() => {
    return { ...criteria, keyword: debouncedKeyword || undefined };
  }, [criteria, debouncedKeyword]);

  // 执行筛选
  const filterResult: FilterResult = useMemo(() => {
    return advancedFilter(sources, effectiveCriteria, sort);
  }, [sources, effectiveCriteria, sort]);

  // 筛选选项（从数据中提取）
  const filterOptions = useMemo(() => {
    return extractFilterOptions(sources);
  }, [sources]);

  // 加载预设
  useEffect(() => {
    setPresets(loadFilterPresets());
  }, []);

  // 切换数组筛选值（多选）
  const toggleArrayFilter = useCallback(
    (field: 'cities' | 'levels' | 'types' | 'statuses' | 'subTypes' | 'rivers', value: string) => {
      setCriteria((prev) => {
        const arr = prev[field];
        const exists = arr.includes(value);
        return {
          ...prev,
          [field]: exists ? arr.filter((v) => v !== value) : [...arr, value],
        };
      });
    },
    [],
  );

  // 设置数值筛选
  const setRangeFilter = useCallback(
    (field: 'populationMin' | 'populationMax', value: number | undefined) => {
      setCriteria((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // 设置坐标范围
  const setCoordRange = useCallback(
    (field: 'lngRange' | 'latRange', value: [number, number] | undefined) => {
      setCriteria((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // 切换布尔筛选
  const toggleBoolFilter = useCallback((field: 'hasCoordsOnly', value: boolean) => {
    setCriteria((prev) => ({ ...prev, [field]: value || undefined }));
  }, []);

  // 重置筛选
  const resetCriteria = useCallback(() => {
    setCriteria(emptyCriteria());
    setKeywordInput('');
    setDebouncedKeyword('');
    setSort(undefined);
  }, []);

  // 检查是否有活跃筛选
  const hasActiveFilter = useMemo(() => {
    return (
      criteria.cities.length > 0 ||
      criteria.levels.length > 0 ||
      criteria.types.length > 0 ||
      criteria.statuses.length > 0 ||
      criteria.subTypes.length > 0 ||
      criteria.rivers.length > 0 ||
      criteria.populationMin !== undefined ||
      criteria.populationMax !== undefined ||
      criteria.lngRange !== undefined ||
      criteria.latRange !== undefined ||
      criteria.hasCoordsOnly !== undefined ||
      debouncedKeyword !== ''
    );
  }, [criteria, debouncedKeyword]);

  // 保存当前筛选为预设
  const handleSavePreset = useCallback(
    (name: string) => {
      const preset: FilterPreset = {
        id: `preset_${Date.now()}`,
        name,
        criteria: { ...criteria, keyword: undefined },
        sortBy: sort,
        createdAt: new Date().toISOString(),
      };
      saveFilterPreset(preset);
      setPresets(loadFilterPresets());
    },
    [criteria, sort],
  );

  // 加载预设
  const handleLoadPreset = useCallback((preset: FilterPreset) => {
    setCriteria(preset.criteria);
    setSort(preset.sortBy);
    setKeywordInput('');
    setDebouncedKeyword('');
  }, []);

  // 删除预设
  const handleDeletePreset = useCallback((id: string) => {
    deleteFilterPreset(id);
    setPresets(loadFilterPresets());
  }, []);

  return {
    // 状态
    keywordInput,
    criteria,
    effectiveCriteria,
    sort,
    showAdvanced,
    presets,
    suggestions,
    filterResult,
    filterOptions,
    hasActiveFilter,

    // 操作
    setKeywordInput: handleKeywordChange,
    setCriteria,
    setSort,
    setShowAdvanced,
    toggleArrayFilter,
    setRangeFilter,
    setCoordRange,
    toggleBoolFilter,
    resetCriteria,
    handleSavePreset,
    handleLoadPreset,
    handleDeletePreset,
  };
}

export type UseSearchFilterReturn = ReturnType<typeof useSearchFilter>;
