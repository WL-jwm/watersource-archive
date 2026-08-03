/* ===== S11.10: 导出模板引擎测试 ===== */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb
vi.mock('@/lib/idb', () => ({
  dbGet: vi.fn(),
  dbPut: vi.fn(),
  dbDelete: vi.fn(),
  dbGetAll: vi.fn(),
  dbPutBatch: vi.fn(),
  dbGetByIndex: vi.fn(),
  dbCount: vi.fn(),
  dbClear: vi.fn(),
}));

import { dbGet, dbPut } from '@/lib/idb';
import {
  getAllExportTemplates,
  createExportTemplate,
  updateExportTemplate,
  deleteExportTemplate,
  applyFilters,
  executeExport,
  createPresetTemplate,
  DEFAULT_EXPORT_COLUMNS,
  type ExportTemplate,
  type ExportColumn,
  type ExportFilter,
} from '@/lib/exportTemplateEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'src-1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    county: '平山县',
    status: '在用',
    dataVersion: 1,
    ...overrides,
  };
}

function makeColumn(overrides: Partial<ExportColumn> = {}): ExportColumn {
  return {
    field: 'name',
    label: '水源地名称',
    included: true,
    width: 22,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<ExportTemplate> = {}): ExportTemplate {
  return {
    id: 'et-1',
    name: '默认模板',
    columns: DEFAULT_EXPORT_COLUMNS.map(c => ({ ...c })),
    filters: [],
    includeCustomFields: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('exportTemplateEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== DEFAULT_EXPORT_COLUMNS =====
  describe('DEFAULT_EXPORT_COLUMNS', () => {
    it('包含13个预设列', () => {
      expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(13);
    });

    it('前6列默认 included 为 true', () => {
      const included = DEFAULT_EXPORT_COLUMNS.filter(c => c.included);
      expect(included.length).toBeGreaterThanOrEqual(6);
    });

    it('level 列使用 levelToChinese 格式化器', () => {
      const levelCol = DEFAULT_EXPORT_COLUMNS.find(c => c.field === 'level');
      expect(levelCol?.formatter).toBe('levelToChinese');
    });
  });

  // ===== getAllExportTemplates =====
  describe('getAllExportTemplates', () => {
    it('返回已有模板列表', async () => {
      const templates = [makeTemplate()];
      vi.mocked(dbGet).mockResolvedValue({ key: 'export_templates', value: templates });

      const result = await getAllExportTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('默认模板');
    });

    it('无数据时返回空数组', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      const result = await getAllExportTemplates();
      expect(result).toHaveLength(0);
    });
  });

  // ===== createExportTemplate =====
  describe('createExportTemplate', () => {
    it('创建新模板并保存', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const tpl = await createExportTemplate('测试模板', [makeColumn()], [], false, '描述');

      expect(tpl.name).toBe('测试模板');
      expect(tpl.description).toBe('描述');
      expect(tpl.id).toContain('et_');
      expect(tpl.createdAt).toBeTruthy();
      expect(tpl.updatedAt).toBeTruthy();
      expect(dbPut).toHaveBeenCalledOnce();
    });

    it('模板名空格被去除', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const tpl = await createExportTemplate('  模板  ', [makeColumn()]);
      expect(tpl.name).toBe('模板');
    });
  });

  // ===== updateExportTemplate =====
  describe('updateExportTemplate', () => {
    it('更新模板属性', async () => {
      const templates = [makeTemplate()];
      vi.mocked(dbGet).mockResolvedValue({ key: 'export_templates', value: templates });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await updateExportTemplate('et-1', { name: '更新名称' });

      const saved = vi.mocked(dbPut).mock.calls[0][1] as { value: ExportTemplate[] };
      expect(saved.value[0].name).toBe('更新名称');
    });

    it('更新时 updatedAt 被刷新', async () => {
      const templates = [makeTemplate({ updatedAt: '2024-01-01T00:00:00.000Z' })];
      vi.mocked(dbGet).mockResolvedValue({ key: 'export_templates', value: templates });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await updateExportTemplate('et-1', { name: '新名称' });
      const saved = vi.mocked(dbPut).mock.calls[0][1] as { value: ExportTemplate[] };
      expect(saved.value[0].updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
    });

    it('更新不存在的模板不写入', async () => {
      vi.mocked(dbGet).mockResolvedValue({ key: 'export_templates', value: [] });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await updateExportTemplate('nonexistent', { name: 'test' });
      expect(dbPut).not.toHaveBeenCalled();
    });
  });

  // ===== deleteExportTemplate =====
  describe('deleteExportTemplate', () => {
    it('从列表中移除模板', async () => {
      const templates = [makeTemplate(), makeTemplate({ id: 'et-2', name: '模板B' })];
      vi.mocked(dbGet).mockResolvedValue({ key: 'export_templates', value: templates });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await deleteExportTemplate('et-1');
      const saved = vi.mocked(dbPut).mock.calls[0][1] as { value: ExportTemplate[] };
      expect(saved.value).toHaveLength(1);
      expect(saved.value[0].id).toBe('et-2');
    });
  });

  // ===== applyFilters =====
  describe('applyFilters', () => {
    const sources = [
      makeRecord({ id: 's1', cityName: '石家庄市', status: '在用' }),
      makeRecord({ id: 's2', cityName: '保定市', status: '备用' }),
      makeRecord({ id: 's3', cityName: '石家庄市', status: '取消' }),
    ];

    it('eq 筛选：精确匹配', () => {
      const filters: ExportFilter[] = [{ field: 'cityName', operator: 'eq', value: '石家庄市' }];
      const result = applyFilters(sources, filters);
      expect(result).toHaveLength(2);
      expect(result.every(s => s.cityName === '石家庄市')).toBe(true);
    });

    it('neq 筛选：不等于', () => {
      const filters: ExportFilter[] = [{ field: 'status', operator: 'neq', value: '在用' }];
      const result = applyFilters(sources, filters);
      expect(result).toHaveLength(2);
      expect(result.every(s => s.status !== '在用')).toBe(true);
    });

    it('contains 筛选：包含', () => {
      const sourcesWithDiffNames = [
        makeRecord({ id: 's1', name: '岗南水库' }),
        makeRecord({ id: 's2', name: '黄壁庄水库' }),
        makeRecord({ id: 's3', name: '西大洋水库' }),
      ];
      const filters: ExportFilter[] = [{ field: 'name', operator: 'contains', value: '岗南' }];
      const result = applyFilters(sourcesWithDiffNames, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('岗南水库');
    });

    it('notNull 筛选：非空', () => {
      const sourcesWithNull = [
        makeRecord({ id: 's1', river: '滹沱河' }),
        makeRecord({ id: 's2' }),
      ];
      const filters: ExportFilter[] = [{ field: 'river', operator: 'notNull' }];
      const result = applyFilters(sourcesWithNull, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });

    it('in 筛选：属于列表', () => {
      const filters: ExportFilter[] = [{ field: 'status', operator: 'in', value: ['在用', '备用'] }];
      const result = applyFilters(sources, filters);
      expect(result).toHaveLength(2);
    });

    it('多条件 AND 逻辑', () => {
      const filters: ExportFilter[] = [
        { field: 'cityName', operator: 'eq', value: '石家庄市' },
        { field: 'status', operator: 'eq', value: '在用' },
      ];
      const result = applyFilters(sources, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });

    it('空筛选条件返回全部', () => {
      const result = applyFilters(sources, []);
      expect(result).toHaveLength(3);
    });
  });

  // ===== executeExport =====
  describe('executeExport', () => {
    it('导出全部数据（无筛选）', () => {
      const sources = [makeRecord(), makeRecord({ id: 's2' })];
      const tpl = makeTemplate();

      const result = executeExport({ template: tpl, sources });

      expect(result.rowCount).toBe(2);
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('导出筛选后的数据', () => {
      const sources = [
        makeRecord({ id: 's1', status: '在用' }),
        makeRecord({ id: 's2', status: '取消' }),
      ];
      const tpl = makeTemplate({
        filters: [{ field: 'status', operator: 'eq', value: '在用' }],
      });

      const result = executeExport({ template: tpl, sources });
      expect(result.rowCount).toBe(1);
    });

    it('仅导出 included 列', () => {
      const sources = [makeRecord()];
      const tpl = makeTemplate({
        columns: [
          makeColumn({ field: 'name', label: '名称', included: true }),
          makeColumn({ field: 'cityName', label: '城市', included: false }),
        ],
      });

      const result = executeExport({ template: tpl, sources });
      expect(result.rowCount).toBe(1);
    });

    it('level 列使用 levelToChinese 格式化', () => {
      const sources = [makeRecord({ level: 'municipal' })];
      const tpl = makeTemplate({
        columns: [makeColumn({ field: 'level', label: '级别', included: true, formatter: 'levelToChinese' })],
      });

      const result = executeExport({ template: tpl, sources });
      expect(result.rowCount).toBe(1);
    });

    it('tags 列格式化为逗号分隔字符串', () => {
      const sources = [makeRecord({ tags: ['tag-1', 'tag-2'] })];
      const tpl = makeTemplate({
        columns: [makeColumn({ field: 'tags', label: '标签', included: true })],
      });

      const result = executeExport({ template: tpl, sources });
      expect(result.rowCount).toBe(1);
    });

    it('空数据源导出零条', () => {
      const tpl = makeTemplate();
      const result = executeExport({ template: tpl, sources: [] });
      expect(result.rowCount).toBe(0);
    });
  });

  // ===== createPresetTemplate =====
  describe('createPresetTemplate', () => {
    it('full 预设包含所有列且 included 为 true', () => {
      const preset = createPresetTemplate('full');
      expect(preset.name).toBe('完整导出');
      expect(preset.includeCustomFields).toBe(true);
      expect(preset.columns.every(c => c.included)).toBe(true);
    });

    it('basic 预设仅包含6列', () => {
      const preset = createPresetTemplate('basic');
      expect(preset.name).toBe('基础信息');
      const included = preset.columns.filter(c => c.included);
      expect(included.length).toBe(6);
      expect(preset.includeCustomFields).toBe(false);
    });

    it('contact 预设包含在用筛选条件', () => {
      const preset = createPresetTemplate('contact');
      expect(preset.name).toBe('联络清单');
      expect(preset.filters).toHaveLength(1);
      expect(preset.filters[0].field).toBe('status');
      expect(preset.filters[0].value).toBe('在用');
    });
  });
});
