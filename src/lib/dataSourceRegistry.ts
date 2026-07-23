/**
 * 数据源扩展框架 (Data Source Framework)
 *
 * 设计目标：
 * 1. 将水源地数据来源从硬编码改为可插拔适配器模式
 * 2. 支持多种数据源类型：静态内置 / 文件上传 / 远程URL / 手动录入
 * 3. 提供统一的加载、校验、合并流水线
 * 4. 支持数据源注册、启用/禁用、优先级排序
 * 5. 来源追踪：每条记录标记数据源ID
 *
 * 架构：
 *   DataSourceAdapter (接口)
 *     ├── StaticDataSource    (内置 TS 静态数据)
 *     ├── FileDataSource      (用户上传 Excel/CSV/JSON)
 *     ├── URLDataSource       (远程 URL JSON/API)
 *     └── ManualDataSource    (手动录入/IDB 已有数据)
 *   DataSourceRegistry (注册中心)
 *   DataSourceMerger  (合并引擎)
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 核心类型定义 =====

/** 数据源类型 */
export type DataSourceType = 'static' | 'file' | 'url' | 'manual';

/** 数据源状态 */
export type DataSourceStatus = 'idle' | 'loading' | 'ready' | 'error' | 'disabled';

/** 合并策略 */
export type MergeStrategy = 'replace' | 'merge-by-key' | 'append';

/** 冲突解决策略 */
export type ConflictResolution = 'latest-wins' | 'skip-duplicates' | 'source-priority';

/** 数据源元数据 */
export interface DataSourceMeta {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 数据源类型 */
  type: DataSourceType;
  /** 描述 */
  description?: string;
  /** 数据源优先级（数字越小优先级越高，用于冲突解决） */
  priority: number;
  /** 是否启用 */
  enabled: boolean;
  /** 合并策略 */
  mergeStrategy: MergeStrategy;
  /** 冲突解决策略 */
  conflictResolution: ConflictResolution;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
  /** 最后加载时间 */
  lastLoadedAt?: string;
  /** 记录数 */
  recordCount?: number;
  /** 数据校验和（用于变更检测） */
  checksum?: string;
  /** 状态 */
  status: DataSourceStatus;
  /** 错误信息 */
  error?: string;
  /** 数据源配置（类型特定参数） */
  config: Record<string, unknown>;
}

/** 数据源加载结果 */
export interface DataSourceLoadResult {
  /** 加载的记录 */
  records: WaterSourceRecord[];
  /** 元信息 */
  meta: {
    totalRecords: number;
    skippedRecords: number;
    warnings: string[];
    loadDuration: number;
  };
}

/** 数据源适配器接口 */
export interface DataSourceAdapter {
  /** 数据源类型 */
  readonly type: DataSourceType;

  /** 加载数据 */
  load(meta: DataSourceMeta): Promise<DataSourceLoadResult>;

  /** 校验数据源配置是否有效 */
  validateConfig(config: Record<string, unknown>): string | null;

  /** 获取数据源默认配置 */
  getDefaultConfig(): Record<string, unknown>;

  /** 获取配置描述（用于UI展示） */
  getConfigSchema(): DataSourceConfigField[];
}

/** 配置字段描述（用于动态生成UI表单） */
export interface DataSourceConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'file';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  defaultValue?: unknown;
  helpText?: string;
}

// ===== 内置适配器实现 =====

/**
 * 静态数据源适配器
 * 从项目内置的 TS 静态数据加载（河北省水源地数据）
 */
class StaticDataSourceAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'static';

  async load(meta: DataSourceMeta): Promise<DataSourceLoadResult> {
    const start = performance.now();
    const warnings: string[] = [];

    // 动态导入静态数据模块
    const [{ hebeiWaterSources }, { waterSourceGeo }] = await Promise.all([
      import('@/data/hebeiWaterSources'),
      import('@/data/waterSourceGeoData'),
    ]);

    // 构建 geo 索引
    const geoIndex = new Map<string, { lng: number; lat: number }>();
    for (const g of waterSourceGeo) {
      if (g?.city && g?.name && typeof g.lng === 'number' && typeof g.lat === 'number') {
        geoIndex.set(`${g.city}_${g.name}`, { lng: g.lng, lat: g.lat });
      }
    }

    const records: WaterSourceRecord[] = [];
    const DATA_VERSION = 1;

    for (const city of hebeiWaterSources) {
      const levels: Array<{
        level: 'municipal' | 'county' | 'township';
        data: Array<Record<string, unknown>>;
      }> = [
        { level: 'municipal', data: (city.municipal || []) as unknown as Array<Record<string, unknown>> },
        { level: 'county', data: (city.county || []) as unknown as Array<Record<string, unknown>> },
        { level: 'township', data: (city.township || []) as unknown as Array<Record<string, unknown>> },
      ];

      for (const { level, data } of levels) {
        for (const ws of data) {
          if (!ws || !ws.name) {
            warnings.push(`跳过无效记录: ${city.cityName} ${level} 级别存在空名称记录`);
            continue;
          }
          const id = `${city.cityName}_${level}_${ws.name}`.replace(/\s+/g, '_');
          const geo = geoIndex.get(`${city.cityName}_${ws.name}`);
          records.push({
            id,
            cityName: city.cityName,
            level,
            name: ws.name as string,
            type: (ws.type as '地表水' | '地下水') || '地下水',
            subType: ws.subType as string | undefined,
            county: (ws.county as string) || '',
            status: (ws.status as string) || '在用',
            remark: ws.remark as string | undefined,
            population: ws.population as number | undefined,
            river: ws.river as string | undefined,
            lng: geo?.lng,
            lat: geo?.lat,
            dataVersion: DATA_VERSION,
            dataSourceId: meta.id,
          } as WaterSourceRecord & { dataSourceId: string });
        }
      }
    }

    return {
      records,
      meta: {
        totalRecords: records.length,
        skippedRecords: 0,
        warnings,
        loadDuration: performance.now() - start,
      },
    };
  }

  validateConfig(): string | null {
    return null;
  }

  getDefaultConfig(): Record<string, unknown> {
    return { module: 'hebeiWaterSources' };
  }

  getConfigSchema(): DataSourceConfigField[] {
    return [
      {
        key: 'module',
        label: '数据模块',
        type: 'select',
        required: true,
        defaultValue: 'hebeiWaterSources',
        options: [
          { label: '河北省水源地数据库', value: 'hebeiWaterSources' },
        ],
        helpText: '内置的静态数据模块，随应用打包发布',
      },
    ];
  }
}

/**
 * 文件数据源适配器
 * 从用户上传的 Excel/CSV/JSON 文件加载数据
 */
class FileDataSourceAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'file';

  async load(meta: DataSourceMeta): Promise<DataSourceLoadResult> {
    const start = performance.now();
    const warnings: string[] = [];

    const fileObj = meta.config.file as File | undefined;
    const jsonData = meta.config.jsonData as string | undefined;
    const fileType = (meta.config.fileType as string) || 'json';

    if (!fileObj && !jsonData) {
      throw new Error('未指定文件或数据内容');
    }

    let records: WaterSourceRecord[] = [];

    if (fileType === 'json') {
      // JSON 格式：从 File 对象或直接字符串解析
      let data: unknown;
      if (fileObj) {
        const text = await fileObj.text();
        data = JSON.parse(text);
      } else {
        data = JSON.parse(jsonData!);
      }

      if (Array.isArray(data)) {
        records = (data as Array<Record<string, unknown>>).map((item, idx) => ({
          ...this.normalizeRecord(item, meta.id),
          id: (item.id as string) || `file_${meta.id}_${idx}`,
        }));
      } else if (
        data &&
        typeof data === 'object' &&
        'sources' in data &&
        Array.isArray((data as Record<string, unknown>).sources)
      ) {
        const sources = (data as Record<string, unknown>).sources as Array<Record<string, unknown>>;
        records = sources.map((item, idx) => ({
          ...this.normalizeRecord(item, meta.id),
          id: (item.id as string) || `file_${meta.id}_${idx}`,
        }));
      } else {
        warnings.push('JSON 文件格式不匹配：期望数组或 { sources: [...] } 结构');
      }
    } else if (fileType === 'xlsx' || fileType === 'csv') {
      // Excel/CSV 格式：通过 dataImportEngine 解析
      if (!fileObj) {
        throw new Error('Excel/CSV 需要提供 File 对象');
      }
      const { importFromFile } = await import('@/lib/dataImportEngine');
      const result = await importFromFile(fileObj);
      records = result.data.map((item, idx) => ({
        ...this.normalizeRecord(item as unknown as Record<string, unknown>, meta.id),
        id: `file_${meta.id}_${idx}`,
      }));
      warnings.push(...result.warnings.map((w) => `行${w.row}: ${w.message}`));
    }

    return {
      records,
      meta: {
        totalRecords: records.length,
        skippedRecords: 0,
        warnings,
        loadDuration: performance.now() - start,
      },
    };
  }

  private normalizeRecord(
    item: Record<string, unknown>,
    sourceId: string,
  ): WaterSourceRecord & { dataSourceId: string } {
    return {
      id: '',
      cityName: (item.cityName as string) || (item.city as string) || (item['市'] as string) || '未知',
      level: (item.level as 'municipal' | 'county' | 'township') || 'county',
      name: (item.name as string) || (item['名称'] as string) || '未命名',
      type: (item.type as '地表水' | '地下水') || '地下水',
      subType: item.subType as string | undefined,
      county: (item.county as string) || '',
      status: (item.status as string) || '在用',
      remark: item.remark as string | undefined,
      population: item.population as number | undefined,
      river: item.river as string | undefined,
      lng: item.lng as number | undefined,
      lat: item.lat as number | undefined,
      dataSourceId: sourceId,
    };
  }

  validateConfig(config: Record<string, unknown>): string | null {
    if (!config.file && !config.jsonData) return '未指定文件或数据内容';
    if (!config.fileType) return '未指定文件类型';
    return null;
  }

  getDefaultConfig(): Record<string, unknown> {
    return { fileType: 'json' };
  }

  getConfigSchema(): DataSourceConfigField[] {
    return [
      {
        key: 'file',
        label: '文件',
        type: 'file',
        required: false,
        placeholder: '选择 Excel/CSV/JSON 文件',
        helpText: '支持 .xlsx .csv .json 格式，或直接在下方粘贴 JSON 数据',
      },
      {
        key: 'jsonData',
        label: 'JSON 数据',
        type: 'textarea',
        required: false,
        placeholder: '[{"name":"水源地A","type":"地下水",...}]',
        helpText: '直接粘贴 JSON 数组格式的数据',
      },
      {
        key: 'fileType',
        label: '文件类型',
        type: 'select',
        required: true,
        defaultValue: 'json',
        options: [
          { label: 'JSON', value: 'json' },
          { label: 'Excel (.xlsx)', value: 'xlsx' },
          { label: 'CSV', value: 'csv' },
        ],
      },
    ];
  }
}

/**
 * URL 数据源适配器
 * 从远程 URL 加载 JSON 数据（API 接口或静态 JSON 文件）
 */
class URLDataSourceAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'url';

  async load(meta: DataSourceMeta): Promise<DataSourceLoadResult> {
    const start = performance.now();
    const warnings: string[] = [];

    const url = meta.config.url as string;
    const headers = (meta.config.headers as Record<string, string>) || {};
    const dataPath = (meta.config.dataPath as string) || 'data';

    if (!url) {
      throw new Error('未指定 URL 地址');
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    // 支持嵌套路径取值 (如 "result.list")
    let data: unknown[] = [];
    if (Array.isArray(json)) {
      data = json;
    } else {
      const pathParts = dataPath.split('.');
      let current: unknown = json;
      for (const part of pathParts) {
        if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          warnings.push(`数据路径 "${dataPath}" 未找到匹配字段`);
          break;
        }
      }
      if (Array.isArray(current)) {
        data = current;
      } else {
        warnings.push(`路径 "${dataPath}" 的值不是数组`);
      }
    }

    const records: WaterSourceRecord[] = data.map((item, idx) => {
      const r = item as Record<string, unknown>;
      return {
        id: (r.id as string) || `url_${meta.id}_${idx}`,
        cityName: (r.cityName as string) || (r.city as string) || '未知',
        level: (r.level as 'municipal' | 'county' | 'township') || 'county',
        name: (r.name as string) || '未命名',
        type: (r.type as '地表水' | '地下水') || '地下水',
        subType: r.subType as string | undefined,
        county: (r.county as string) || '',
        status: (r.status as string) || '在用',
        remark: r.remark as string | undefined,
        lng: r.lng as number | undefined,
        lat: r.lat as number | undefined,
        dataSourceId: meta.id,
      } as WaterSourceRecord & { dataSourceId: string };
    });

    return {
      records,
      meta: {
        totalRecords: records.length,
        skippedRecords: 0,
        warnings,
        loadDuration: performance.now() - start,
      },
    };
  }

  validateConfig(config: Record<string, unknown>): string | null {
    if (!config.url) return '未指定 URL 地址';
    try {
      new URL(config.url as string);
    } catch {
      return 'URL 格式无效';
    }
    return null;
  }

  getDefaultConfig(): Record<string, unknown> {
    return { dataPath: 'data', headers: {} };
  }

  getConfigSchema(): DataSourceConfigField[] {
    return [
      {
        key: 'url',
        label: 'URL 地址',
        type: 'text',
        required: true,
        placeholder: 'https://example.com/api/water-sources',
        helpText: '返回 JSON 格式的 API 接口或静态文件 URL',
      },
      {
        key: 'dataPath',
        label: '数据路径',
        type: 'text',
        required: false,
        defaultValue: 'data',
        placeholder: 'data 或 result.list',
        helpText: 'JSON 中数据数组的路径，用点号分隔。若返回值本身就是数组则留空',
      },
      {
        key: 'headers',
        label: '请求头 (JSON)',
        type: 'textarea',
        required: false,
        placeholder: '{"Authorization": "Bearer xxx"}',
        helpText: '自定义 HTTP 请求头，JSON 格式',
      },
    ];
  }
}

/**
 * 手动数据源适配器
 * 代表用户在应用内手动录入的数据（已存在于 IDB 中）
 */
class ManualDataSourceAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'manual';

  async load(meta: DataSourceMeta): Promise<DataSourceLoadResult> {
    const start = performance.now();
    // 手动数据源的记录已在 IDB 中，不需要额外加载
    // 返回空数组，合并引擎会跳过它但保留 IDB 中已有的记录
    return {
      records: [],
      meta: {
        totalRecords: 0,
        skippedRecords: 0,
        warnings: [],
        loadDuration: performance.now() - start,
      },
    };
  }

  validateConfig(): string | null {
    return null;
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  getConfigSchema(): DataSourceConfigField[] {
    return [
      {
        key: '_info',
        label: '说明',
        type: 'text',
        required: false,
        helpText: '手动数据源代表用户在应用内直接录入或编辑的水源地记录，数据存储在本地 IndexedDB 中',
      },
    ];
  }
}

// ===== 数据源注册中心 =====

class DataSourceRegistry {
  private adapters = new Map<DataSourceType, DataSourceAdapter>();
  private listeners = new Set<() => void>();

  constructor() {
    // 注册内置适配器
    this.register('static', new StaticDataSourceAdapter());
    this.register('file', new FileDataSourceAdapter());
    this.register('url', new URLDataSourceAdapter());
    this.register('manual', new ManualDataSourceAdapter());
  }

  /** 注册数据源适配器 */
  register(type: DataSourceType, adapter: DataSourceAdapter): void {
    this.adapters.set(type, adapter);
    this.notifyListeners();
  }

  /** 获取适配器 */
  getAdapter(type: DataSourceType): DataSourceAdapter | undefined {
    return this.adapters.get(type);
  }

  /** 获取所有已注册的类型 */
  getRegisteredTypes(): DataSourceType[] {
    return Array.from(this.adapters.keys());
  }

  /** 获取所有适配器的配置 Schema */
  getAllConfigSchemas(): Record<DataSourceType, DataSourceConfigField[]> {
    const result = {} as Record<DataSourceType, DataSourceConfigField[]>;
    for (const [type, adapter] of this.adapters) {
      result[type] = adapter.getConfigSchema();
    }
    return result;
  }

  /** 监听注册变化 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

// 单例注册中心
export const dataSourceRegistry = new DataSourceRegistry();

// ===== 数据源合并引擎 =====

export interface MergeOptions {
  /** 合并策略 */
  strategy: MergeStrategy;
  /** 冲突解决 */
  conflictResolution: ConflictResolution;
  /** 优先级排序（按 DataSourceMeta.priority 升序） */
  priorityOrder?: boolean;
}

export interface MergeResult {
  /** 合并后的记录 */
  records: WaterSourceRecord[];
  /** 统计信息 */
  stats: {
    totalInput: number;
    totalOutput: number;
    duplicates: number;
    conflicts: number;
    bySource: Record<string, number>;
  };
  /** 警告 */
  warnings: string[];
}

/**
 * 合并多个数据源的记录
 *
 * 策略说明：
 * - replace: 用新数据完全替换旧数据（按数据源优先级，低优先级先加载）
 * - merge-by-key: 按 id 去重合并，冲突时按 conflictResolution 处理
 * - append: 简单追加，不去重（可能产生重复 id）
 */
export function mergeDataSources(
  sources: Array<{ meta: DataSourceMeta; records: WaterSourceRecord[] }>,
  options: MergeOptions,
): MergeResult {
  const warnings: string[] = [];
  const bySource: Record<string, number> = {};
  let duplicates = 0;
  let conflicts = 0;

  // 按优先级排序
  const sorted = options.priorityOrder
    ? [...sources].sort((a, b) => a.meta.priority - b.meta.priority)
    : sources;

  if (options.strategy === 'append') {
    // 简单追加
    const allRecords: WaterSourceRecord[] = [];
    for (const { meta, records } of sorted) {
      bySource[meta.id] = records.length;
      allRecords.push(...records);
    }
    return {
      records: allRecords,
      stats: {
        totalInput: allRecords.length,
        totalOutput: allRecords.length,
        duplicates: 0,
        conflicts: 0,
        bySource,
      },
      warnings,
    };
  }

  if (options.strategy === 'replace') {
    // 替换策略：按优先级从低到高加载，高优先级覆盖低优先级
    const recordMap = new Map<string, WaterSourceRecord>();
    for (const { meta, records } of sorted) {
      bySource[meta.id] = records.length;
      for (const record of records) {
        if (recordMap.has(record.id)) {
          conflicts++;
          warnings.push(`记录 "${record.name}" (${record.id}) 被数据源 "${meta.name}" 覆盖`);
        }
        recordMap.set(record.id, record);
      }
    }
    return {
      records: Array.from(recordMap.values()),
      stats: {
        totalInput: sorted.reduce((sum, s) => sum + s.records.length, 0),
        totalOutput: recordMap.size,
        duplicates: 0,
        conflicts,
        bySource,
      },
      warnings,
    };
  }

  // merge-by-key（默认）
  const recordMap = new Map<string, WaterSourceRecord>();
  for (const { meta, records } of sorted) {
    bySource[meta.id] = records.length;
    for (const record of records) {
      const existing = recordMap.get(record.id);
      if (existing) {
        duplicates++;
        if (options.conflictResolution === 'skip-duplicates') {
          // 跳过重复
          continue;
        } else if (options.conflictResolution === 'latest-wins') {
          // 比较时间戳或优先级
          const existingTime = existing.dataVersion || 0;
          const newTime = record.dataVersion || 0;
          if (newTime >= existingTime) {
            recordMap.set(record.id, record);
          }
        } else if (options.conflictResolution === 'source-priority') {
          // 高优先级数据源（priority 值更小）覆盖
          // 由于已按 priority 排序，后来的优先级更低，不覆盖
          continue;
        }
      } else {
        recordMap.set(record.id, record);
      }
    }
  }

  return {
    records: Array.from(recordMap.values()),
    stats: {
      totalInput: sorted.reduce((sum, s) => sum + s.records.length, 0),
      totalOutput: recordMap.size,
      duplicates,
      conflicts: 0,
      bySource,
    },
    warnings,
  };
}

// ===== 工具函数 =====

/** 生成数据源 ID */
export function generateDataSourceId(): string {
  return `ds_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建数据源元数据 */
export function createDataSourceMeta(
  partial: Partial<DataSourceMeta> & { name: string; type: DataSourceType },
): DataSourceMeta {
  const adapter = dataSourceRegistry.getAdapter(partial.type);
  const now = new Date().toISOString();
  return {
    id: partial.id || generateDataSourceId(),
    name: partial.name,
    type: partial.type,
    description: partial.description || '',
    priority: partial.priority ?? 100,
    enabled: partial.enabled ?? true,
    mergeStrategy: partial.mergeStrategy || 'merge-by-key',
    conflictResolution: partial.conflictResolution || 'latest-wins',
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    status: partial.status || 'idle',
    config: partial.config || adapter?.getDefaultConfig() || {},
  };
}

/** 计算数据校验和（简单版） */
export function calculateChecksum(records: WaterSourceRecord[]): string {
  const str = records
    .map((r) => `${r.id}:${r.name}:${r.type}:${r.status}`)
    .sort()
    .join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `cs_${Math.abs(hash).toString(36)}`;
}

/** 获取数据源类型中文名称 */
export function getDataSourceTypeLabel(type: DataSourceType): string {
  const labels: Record<DataSourceType, string> = {
    static: '内置静态数据',
    file: '文件上传',
    url: '远程URL',
    manual: '手动录入',
  };
  return labels[type];
}

/** 获取数据源类型图标颜色（Tailwind 类名） */
export function getDataSourceTypeColor(type: DataSourceType): string {
  const colors: Record<DataSourceType, string> = {
    static: 'bg-blue-100 text-blue-700',
    file: 'bg-green-100 text-green-700',
    url: 'bg-purple-100 text-purple-700',
    manual: 'bg-amber-100 text-amber-700',
  };
  return colors[type];
}
