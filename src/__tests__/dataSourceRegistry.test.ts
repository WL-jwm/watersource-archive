import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  type DataSourceMeta,
  type MergeStrategy,
  type ConflictResolution,
  dataSourceRegistry,
  createDataSourceMeta,
  mergeDataSources,
  calculateChecksum,
  generateDataSourceId,
  getDataSourceTypeLabel,
  getDataSourceTypeColor,
} from '@/lib/dataSourceRegistry';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 测试工具 =====

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'test_1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    subType: '湖库型',
    county: '平山县',
    status: '在用',
    dataVersion: 1,
    ...overrides,
  };
}

function makeMeta(overrides: Partial<DataSourceMeta> = {}): DataSourceMeta {
  return createDataSourceMeta({
    name: '测试数据源',
    type: 'static',
    ...overrides,
  });
}

// ===== 注册中心测试 =====

describe('DataSourceRegistry', () => {
  beforeEach(() => {
    // 注册中心是单例，内置适配器在构造时已注册
  });

  it('T01-注册中心包含四种内置适配器', () => {
    const types = dataSourceRegistry.getRegisteredTypes();
    expect(types).toContain('static');
    expect(types).toContain('file');
    expect(types).toContain('url');
    expect(types).toContain('manual');
    expect(types.length).toBe(4);
  });

  it('T02-获取静态数据源适配器', () => {
    const adapter = dataSourceRegistry.getAdapter('static');
    expect(adapter).toBeDefined();
    expect(adapter!.type).toBe('static');
  });

  it('T03-获取文件数据源适配器', () => {
    const adapter = dataSourceRegistry.getAdapter('file');
    expect(adapter).toBeDefined();
    expect(adapter!.type).toBe('file');
  });

  it('T04-获取URL数据源适配器', () => {
    const adapter = dataSourceRegistry.getAdapter('url');
    expect(adapter).toBeDefined();
    expect(adapter!.type).toBe('url');
  });

  it('T05-获取手动数据源适配器', () => {
    const adapter = dataSourceRegistry.getAdapter('manual');
    expect(adapter).toBeDefined();
    expect(adapter!.type).toBe('manual');
  });

  it('T06-所有适配器返回配置Schema', () => {
    const schemas = dataSourceRegistry.getAllConfigSchemas();
    expect(schemas.static).toBeDefined();
    expect(schemas.file).toBeDefined();
    expect(schemas.url).toBeDefined();
    expect(schemas.manual).toBeDefined();
    expect(Array.isArray(schemas.static)).toBe(true);
  });

  it('T07-静态适配器校验配置返回null', () => {
    const adapter = dataSourceRegistry.getAdapter('static')!;
    expect(adapter.validateConfig({})).toBeNull();
  });

  it('T08-文件适配器校验缺少文件', () => {
    const adapter = dataSourceRegistry.getAdapter('file')!;
    expect(adapter.validateConfig({})).toBe('未指定文件或数据内容');
  });

  it('T09-文件适配器校验缺少文件类型', () => {
    const adapter = dataSourceRegistry.getAdapter('file')!;
    expect(adapter.validateConfig({ jsonData: '[{}]' })).toBe('未指定文件类型');
  });

  it('T10-文件适配器校验完整配置', () => {
    const adapter = dataSourceRegistry.getAdapter('file')!;
    expect(adapter.validateConfig({ jsonData: '[]', fileType: 'json' })).toBeNull();
  });

  it('T11-URL适配器校验缺少URL', () => {
    const adapter = dataSourceRegistry.getAdapter('url')!;
    expect(adapter.validateConfig({})).toBe('未指定 URL 地址');
  });

  it('T12-URL适配器校验无效URL格式', () => {
    const adapter = dataSourceRegistry.getAdapter('url')!;
    expect(adapter.validateConfig({ url: 'not-a-url' })).toBe('URL 格式无效');
  });

  it('T13-URL适配器校验有效URL', () => {
    const adapter = dataSourceRegistry.getAdapter('url')!;
    expect(adapter.validateConfig({ url: 'https://example.com/api' })).toBeNull();
  });

  it('T14-手动适配器默认配置为空对象', () => {
    const adapter = dataSourceRegistry.getAdapter('manual')!;
    expect(adapter.getDefaultConfig()).toEqual({});
  });

  it('T15-静态适配器默认配置包含module字段', () => {
    const adapter = dataSourceRegistry.getAdapter('static')!;
    const config = adapter.getDefaultConfig();
    expect(config.module).toBe('hebeiWaterSources');
  });
});

// ===== 元数据创建测试 =====

describe('createDataSourceMeta', () => {
  it('T16-创建静态数据源元数据', () => {
    const meta = createDataSourceMeta({ name: '内置数据', type: 'static' });
    expect(meta.id).toMatch(/^ds_/);
    expect(meta.name).toBe('内置数据');
    expect(meta.type).toBe('static');
    expect(meta.enabled).toBe(true);
    expect(meta.priority).toBe(100);
    expect(meta.mergeStrategy).toBe('merge-by-key');
    expect(meta.conflictResolution).toBe('latest-wins');
    expect(meta.status).toBe('idle');
    expect(meta.config).toEqual({ module: 'hebeiWaterSources' });
  });

  it('T17-创建URL数据源并自定义优先级', () => {
    const meta = createDataSourceMeta({
      name: 'API数据',
      type: 'url',
      priority: 5,
      config: { url: 'https://api.example.com/data' },
    });
    expect(meta.priority).toBe(5);
    expect(meta.config.url).toBe('https://api.example.com/data');
  });

  it('T18-创建手动数据源', () => {
    const meta = createDataSourceMeta({
      name: '手动录入',
      type: 'manual',
    });
    expect(meta.type).toBe('manual');
    expect(meta.config).toEqual({});
  });

  it('T19-使用自定义ID创建', () => {
    const meta = createDataSourceMeta({
      id: 'custom_id_123',
      name: '自定义',
      type: 'file',
    });
    expect(meta.id).toBe('custom_id_123');
  });
});

// ===== 合并引擎测试 =====

describe('mergeDataSources', () => {
  const source1: WaterSourceRecord[] = [
    makeRecord({ id: 'r1', name: '水源地A' }),
    makeRecord({ id: 'r2', name: '水源地B' }),
  ];
  const source2: WaterSourceRecord[] = [
    makeRecord({ id: 'r2', name: '水源地B(更新)', dataVersion: 2 }),
    makeRecord({ id: 'r3', name: '水源地C' }),
  ];

  it('T20-append策略-简单追加不去重', () => {
    const result = mergeDataSources(
      [
        { meta: makeMeta({ id: 's1' }), records: source1 },
        { meta: makeMeta({ id: 's2' }), records: source2 },
      ],
      { strategy: 'append', conflictResolution: 'skip-duplicates' },
    );
    expect(result.records.length).toBe(4);
    expect(result.stats.totalInput).toBe(4);
    expect(result.stats.totalOutput).toBe(4);
    expect(result.stats.duplicates).toBe(0);
  });

  it('T21-replace策略-高优先级覆盖低优先级', () => {
    const result = mergeDataSources(
      [
        { meta: makeMeta({ id: 's1', priority: 10 }), records: source1 },
        { meta: makeMeta({ id: 's2', priority: 5 }), records: source2 },
      ],
      { strategy: 'replace', conflictResolution: 'latest-wins', priorityOrder: true },
    );
    // priorityOrder 升序排列: priority 5 先加载, priority 10 后加载覆盖
    // r1 只在 s1 中, r2 被 s1 覆盖为原始版本, r3 来自 s2
    expect(result.records.length).toBe(3);
    const r2 = result.records.find((r) => r.id === 'r2');
    expect(r2?.name).toBe('水源地B');
    expect(result.stats.conflicts).toBe(1);
  });

  it('T22-merge-by-key策略-skip-duplicates', () => {
    const result = mergeDataSources(
      [
        { meta: makeMeta({ id: 's1' }), records: source1 },
        { meta: makeMeta({ id: 's2' }), records: source2 },
      ],
      { strategy: 'merge-by-key', conflictResolution: 'skip-duplicates' },
    );
    expect(result.records.length).toBe(3);
    const r2 = result.records.find((r) => r.id === 'r2');
    // skip-duplicates: 先加载的保留，后加载的跳过
    expect(r2?.name).toBe('水源地B');
    expect(result.stats.duplicates).toBe(1);
  });

  it('T23-merge-by-key策略-latest-wins', () => {
    const result = mergeDataSources(
      [
        { meta: makeMeta({ id: 's1' }), records: source1 },
        { meta: makeMeta({ id: 's2' }), records: source2 },
      ],
      { strategy: 'merge-by-key', conflictResolution: 'latest-wins' },
    );
    expect(result.records.length).toBe(3);
    const r2 = result.records.find((r) => r.id === 'r2');
    // latest-wins: dataVersion 2 > 1, 使用 source2 的版本
    expect(r2?.name).toBe('水源地B(更新)');
  });

  it('T24-merge-by-key策略-source-priority', () => {
    const result = mergeDataSources(
      [
        { meta: makeMeta({ id: 's1', priority: 10 }), records: source1 },
        { meta: makeMeta({ id: 's2', priority: 20 }), records: source2 },
      ],
      { strategy: 'merge-by-key', conflictResolution: 'source-priority', priorityOrder: true },
    );
    expect(result.records.length).toBe(3);
    const r2 = result.records.find((r) => r.id === 'r2');
    // source-priority: 优先级高(priority值小)的先加载，后来的不覆盖
    expect(r2?.name).toBe('水源地B');
  });

  it('T25-空数据源列表', () => {
    const result = mergeDataSources([], { strategy: 'merge-by-key', conflictResolution: 'latest-wins' });
    expect(result.records.length).toBe(0);
    expect(result.stats.totalInput).toBe(0);
  });

  it('T26-单数据源无冲突', () => {
    const result = mergeDataSources(
      [{ meta: makeMeta({ id: 's1' }), records: source1 }],
      { strategy: 'merge-by-key', conflictResolution: 'latest-wins' },
    );
    expect(result.records.length).toBe(2);
    expect(result.stats.duplicates).toBe(0);
    expect(result.stats.bySource.s1).toBe(2);
  });

  it('T27-三数据源合并统计', () => {
    const source3: WaterSourceRecord[] = [
      makeRecord({ id: 'r3', name: '水源地C(更新)', dataVersion: 3 }),
      makeRecord({ id: 'r4', name: '水源地D' }),
    ];
    const result = mergeDataSources(
      [
        { meta: makeMeta({ id: 's1' }), records: source1 },
        { meta: makeMeta({ id: 's2' }), records: source2 },
        { meta: makeMeta({ id: 's3' }), records: source3 },
      ],
      { strategy: 'merge-by-key', conflictResolution: 'latest-wins' },
    );
    expect(result.records.length).toBe(4);
    expect(result.stats.totalInput).toBe(6);
    expect(result.stats.duplicates).toBe(2); // r2 和 r3 各重复一次
    expect(result.stats.bySource.s1).toBe(2);
    expect(result.stats.bySource.s2).toBe(2);
    expect(result.stats.bySource.s3).toBe(2);
  });

  it('T28-replace策略生成冲突警告', () => {
    const result = mergeDataSources(
      [
        { meta: makeMeta({ id: 's1', name: '数据源A' }), records: source1 },
        { meta: makeMeta({ id: 's2', name: '数据源B' }), records: source2 },
      ],
      { strategy: 'replace', conflictResolution: 'latest-wins', priorityOrder: true },
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('覆盖');
  });
});

// ===== 工具函数测试 =====

describe('Utility Functions', () => {
  it('T29-generateDataSourceId生成唯一ID', () => {
    const id1 = generateDataSourceId();
    const id2 = generateDataSourceId();
    expect(id1).toMatch(/^ds_/);
    expect(id2).toMatch(/^ds_/);
    expect(id1).not.toBe(id2);
  });

  it('T30-calculateChecksum相同数据相同结果', () => {
    const records = [makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' })];
    const cs1 = calculateChecksum(records);
    const cs2 = calculateChecksum([...records].reverse()); // 顺序不影响（内部排序）
    expect(cs1).toBe(cs2);
  });

  it('T31-calculateChecksum不同数据不同结果', () => {
    const records1 = [makeRecord({ id: 'r1' })];
    const records2 = [makeRecord({ id: 'r2' })];
    expect(calculateChecksum(records1)).not.toBe(calculateChecksum(records2));
  });

  it('T32-calculateChecksum空数组', () => {
    const cs = calculateChecksum([]);
    expect(cs).toMatch(/^cs_/);
  });

  it('T33-getDataSourceTypeLabel返回正确标签', () => {
    expect(getDataSourceTypeLabel('static')).toBe('内置静态数据');
    expect(getDataSourceTypeLabel('file')).toBe('文件上传');
    expect(getDataSourceTypeLabel('url')).toBe('远程URL');
    expect(getDataSourceTypeLabel('manual')).toBe('手动录入');
  });

  it('T34-getDataSourceTypeColor返回Tailwind类名', () => {
    expect(getDataSourceTypeColor('static')).toContain('bg-blue');
    expect(getDataSourceTypeColor('file')).toContain('bg-green');
    expect(getDataSourceTypeColor('url')).toContain('bg-purple');
    expect(getDataSourceTypeColor('manual')).toContain('bg-amber');
  });
});

// ===== 适配器加载测试 =====

describe('StaticDataSourceAdapter.load', () => {
  it('T35-加载静态数据源返回记录', async () => {
    const adapter = dataSourceRegistry.getAdapter('static')!;
    const meta = createDataSourceMeta({
      id: 'test_static',
      name: '测试静态',
      type: 'static',
    });
    const result = await adapter.load(meta);
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.meta.totalRecords).toBe(result.records.length);
    expect(result.meta.loadDuration).toBeGreaterThanOrEqual(0);
    // 每条记录应包含 dataSourceId
    expect(result.records[0]).toHaveProperty('dataSourceId', 'test_static');
  });

  it('T36-静态数据源包含河北省城市', async () => {
    const adapter = dataSourceRegistry.getAdapter('static')!;
    const meta = createDataSourceMeta({ name: '测试', type: 'static' });
    const result = await adapter.load(meta);
    const cities = new Set(result.records.map((r) => r.cityName));
    expect(cities.has('石家庄市')).toBe(true);
    expect(cities.has('唐山市')).toBe(true);
  });
});

describe('ManualDataSourceAdapter.load', () => {
  it('T37-手动数据源返回空记录', async () => {
    const adapter = dataSourceRegistry.getAdapter('manual')!;
    const meta = createDataSourceMeta({ name: '测试', type: 'manual' });
    const result = await adapter.load(meta);
    expect(result.records.length).toBe(0);
    expect(result.meta.totalRecords).toBe(0);
  });
});

describe('URLDataSourceAdapter.validateConfig', () => {
  it('T38-URL适配器接受HTTPS URL', () => {
    const adapter = dataSourceRegistry.getAdapter('url')!;
    expect(adapter.validateConfig({ url: 'https://api.example.com/data' })).toBeNull();
  });

  it('T39-URL适配器接受HTTP URL', () => {
    const adapter = dataSourceRegistry.getAdapter('url')!;
    expect(adapter.validateConfig({ url: 'http://localhost:3000/data' })).toBeNull();
  });

  it('T40-URL适配器拒绝非URL字符串', () => {
    const adapter = dataSourceRegistry.getAdapter('url')!;
    expect(adapter.validateConfig({ url: 'just-text' })).toBe('URL 格式无效');
  });

  it('T41-URL适配器默认配置包含dataPath', () => {
    const adapter = dataSourceRegistry.getAdapter('url')!;
    const config = adapter.getDefaultConfig();
    expect(config.dataPath).toBe('data');
    expect(config.headers).toEqual({});
  });
});
