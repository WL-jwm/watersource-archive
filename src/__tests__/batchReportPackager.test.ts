/**
 * T4: batchReportPackager 测试补全
 *
 * 测试范围：
 * 1. groupByCity 按城市分组（正常/空/未知城市/排序）
 * 2. generateBatchReportsV2 进度回调（步骤数/百分比/城市名）
 * 3. ZIP 模式 vs 非ZIP 模式
 * 4. 格式选择（word/pdf/both）
 * 5. 城市筛选
 * 6. 汇总报告生成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  groupByCity,
  generateBatchReportsV2,
  type BatchReportOptions,
  type BatchProgress,
} from '@/lib/batchReportPackager';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== Mock 外部依赖 =====

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('docx', () => {
  function MockCtor(this: any, opts: any) { this.__opts = opts; }
  return {
    Packer: { toBlob: vi.fn().mockResolvedValue(new Blob(['doc'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })) },
    Document: MockCtor,
    Paragraph: MockCtor,
    TextRun: MockCtor,
    Table: MockCtor,
    TableRow: MockCtor,
    TableCell: MockCtor,
    WidthType: { PERCENTAGE: 'pct' },
    AlignmentType: { CENTER: 'center', LEFT: 'left' },
    HeadingLevel: { HEADING_1: 'h1' },
    BorderStyle: { SINGLE: 'single' },
    TableLayoutType: { FIXED: 'fixed' },
    VerticalAlign: { CENTER: 'center' },
    ShadingType: { CLEAR: 'clear' },
  };
});

vi.mock('@/lib/zoneReportGenerator', () => ({
  generateZoneReport: vi.fn().mockResolvedValue(new Blob(['word'], { type: 'application/octet-stream' })),
  generateBatchReports: vi.fn(),
}));

vi.mock('@/lib/reportPdfExporter', () => ({
  generatePdfReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('jszip', () => {
  function JSZip(this: any) {
    this.folder = vi.fn().mockReturnValue({ file: vi.fn() });
    this.generateAsync = vi.fn().mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }));
  }
  return { default: JSZip };
});

vi.mock('jspdf', () => {
  function jsPDF(this: any) {
    this.setFontSize = vi.fn();
    this.setFont = vi.fn();
    this.text = vi.fn();
    this.addPage = vi.fn();
    this.output = vi.fn().mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' }));
  }
  return { jsPDF };
});

// ===== 测试数据 =====

function makeSource(id: string, name: string, cityName: string): WaterSourceRecord {
  return {
    id,
    name,
    cityName,
    cityCode: '130000',
    type: '地下水',
    subType: '孔隙潜水',
    code: `130000-${id}`,
    lng: 114.5,
    lat: 38.0,
    supplyCapacity: '10000',
    supplyPopulation: '50000',
    level: 'county',
    county: '测试县',
    status: '在用',
    wells: [],
    hydrogeology: {} as any,
    waterQuality: {} as any,
    protectionZone: {} as any,
    pollution: {} as any,
  } as WaterSourceRecord;
}

function makeZoneRecord(id: string, sourceId: string, sourceName: string, sourceType: string = '地下水'): ZoneCalcRecord {
  return {
    id,
    sourceId,
    sourceName,
    calculatedAt: '2024-06-01T10:00:00Z',
    params: {
      sourceType,
      gwType: '孔隙潜水',
      permeability: '5',
      aquiferThickness: '20',
      transmissivity: '100',
    } as any,
    zones: [
      { level: '一级', radius: 50, area: 0.00785, method: '经验值法', formula: 'R=50m', keyParams: '经验值', vertices: [] },
      { level: '二级', radius: 500, area: 0.785, method: '经验值法', formula: 'R=500m', keyParams: '经验值', vertices: [] },
      { level: '准保护区', radius: 1000, area: 3.14, method: '经验值法', formula: 'R=1000m', keyParams: '经验值', vertices: [] },
    ] as any,
  } as ZoneCalcRecord;
}

const mockSources: WaterSourceRecord[] = [
  makeSource('s1', '水源地A', '石家庄市'),
  makeSource('s2', '水源地B', '石家庄市'),
  makeSource('s3', '水源地C', '保定市'),
  makeSource('s4', '水源地D', '唐山市'),
];

const mockResults: ZoneCalcRecord[] = [
  makeZoneRecord('r1', 's1', '水源地A'),
  makeZoneRecord('r2', 's2', '水源地B'),
  makeZoneRecord('r3', 's3', '水源地C'),
  makeZoneRecord('r4', 's4', '水源地D', '地表水'),
];

// ===== 测试 =====

describe('groupByCity', () => {
  it('T01-正常按城市分组', () => {
    const groups = groupByCity(mockResults, mockSources);
    expect(groups.size).toBe(3);
    expect(groups.get('石家庄市')?.length).toBe(2);
    expect(groups.get('保定市')?.length).toBe(1);
    expect(groups.get('唐山市')?.length).toBe(1);
  });

  it('T02-空数组返回空Map', () => {
    const groups = groupByCity([], mockSources);
    expect(groups.size).toBe(0);
  });

  it('T03-未知城市归入未知分组', () => {
    const unknownResult = makeZoneRecord('r5', 's999', '未知水源地');
    const groups = groupByCity([unknownResult], mockSources);
    expect(groups.get('未知')?.length).toBe(1);
  });

  it('T04-按城市名拼音排序', () => {
    const groups = groupByCity(mockResults, mockSources);
    const cities = Array.from(groups.keys());
    // localeCompare('zh') 排序：保定市 < 石家庄市 < 唐山市
    expect(cities).toEqual(['保定市', '石家庄市', '唐山市']);
  });

  it('T05-通过sourceName匹配水源地', () => {
    const resultWithoutSourceId = makeZoneRecord('r6', 'nonexistent', '水源地A');
    const groups = groupByCity([resultWithoutSourceId], mockSources);
    // 水源地A在mockSources中cityName为石家庄市
    expect(groups.get('石家庄市')?.length).toBe(1);
  });
});

describe('generateBatchReportsV2 - 进度回调', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T06-ZIP模式进度回调正确步骤数', async () => {
    const progressCalls: BatchProgress[] = [];
    const options: BatchReportOptions = {
      format: 'word',
      zipOutput: true,
      includeSummary: true,
      onProgress: (p) => progressCalls.push(p),
    };

    await generateBatchReportsV2(mockResults, mockSources, options);

    // 4城市 * 1格式(word) + 1汇总 = 5步
    // 最后还有ZIP打包的100%回调
    expect(progressCalls.length).toBeGreaterThanOrEqual(5);
    expect(progressCalls[0].cityName).toBe('保定市');
    expect(progressCalls[progressCalls.length - 1].percent).toBe(100);
  });

  it('T07-both格式步骤翻倍', async () => {
    const progressCalls: BatchProgress[] = [];
    const options: BatchReportOptions = {
      format: 'both',
      zipOutput: true,
      includeSummary: true,
      onProgress: (p) => progressCalls.push(p),
    };

    await generateBatchReportsV2(mockResults, mockSources, options);

    // 4城市 * 2格式 = 8步（+汇总9步），ZIP压缩还有额外回调
    expect(progressCalls.length).toBeGreaterThanOrEqual(8);
  });

  it('T08-百分比递增', async () => {
    const progressCalls: BatchProgress[] = [];
    const options: BatchReportOptions = {
      format: 'word',
      zipOutput: true,
      includeSummary: false,
      onProgress: (p) => progressCalls.push(p),
    };

    await generateBatchReportsV2(mockResults, mockSources, options);

    // 验证百分比非递减
    for (let i = 1; i < progressCalls.length; i++) {
      expect(progressCalls[i].percent).toBeGreaterThanOrEqual(progressCalls[i - 1].percent);
    }
  });

  it('T09-城市筛选生效', async () => {
    const progressCalls: BatchProgress[] = [];
    const options: BatchReportOptions = {
      format: 'word',
      zipOutput: true,
      includeSummary: false,
      cityNames: ['石家庄市'],
      onProgress: (p) => progressCalls.push(p),
    };

    await generateBatchReportsV2(mockResults, mockSources, options);

    // 只处理石家庄市（1个城市）
    const cityNames = progressCalls.map(p => p.cityName).filter(n => n);
    expect(cityNames).toEqual(['石家庄市']);
  });

  it('T10-无匹配城市时不报错', async () => {
    const options: BatchReportOptions = {
      format: 'word',
      zipOutput: true,
      cityNames: ['不存在城市'],
    };

    // 不应抛出异常
    await expect(generateBatchReportsV2(mockResults, mockSources, options)).resolves.toBeUndefined();
  });

  it('T11-非ZIP模式调用saveAs', async () => {
    const { saveAs } = await import('file-saver');
    const options: BatchReportOptions = {
      format: 'word',
      zipOutput: false,
      includeSummary: true,
    };

    await generateBatchReportsV2(mockResults, mockSources, options);

    // 非ZIP模式下，每个城市生成报告 + 汇总报告，都应调用saveAs
    // generateZoneReport 内部会调用 saveAs
    // 汇总报告也会调用 saveAs
    expect(vi.mocked(saveAs)).toHaveBeenCalled();
  });

  it('T12-PDF格式调用generatePdfReport', async () => {
    const { generatePdfReport } = await import('@/lib/reportPdfExporter');
    const options: BatchReportOptions = {
      format: 'pdf',
      zipOutput: false,
      includeSummary: false,
    };

    await generateBatchReportsV2(mockResults, mockSources, options);

    expect(vi.mocked(generatePdfReport)).toHaveBeenCalled();
  });
});
