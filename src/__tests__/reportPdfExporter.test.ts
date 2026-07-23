import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveAs } from 'file-saver';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';

// Mock jspdf — 必须是构造函数
vi.mock('jspdf', () => {
  const mockDoc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setFillColor: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    rect: vi.fn(),
    addPage: vi.fn(),
    splitTextToSize: vi.fn().mockReturnValue(['line1']),
    output: vi.fn().mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' })),
  };
  return {
    jsPDF: vi.fn(function () { return mockDoc; }),
  };
});

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

import { jsPDF } from 'jspdf';
import { generatePdfReport } from '@/lib/reportPdfExporter';

function makeSource(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 's1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    subType: '湖库型',
    county: '平山县',
    status: '在用',
    population: 500000,
    river: '滹沱河',
    lng: 114.21,
    lat: 38.27,
    dataVersion: 1,
    ...overrides,
  };
}

function makeZoneResult(overrides: Partial<ZoneCalcRecord> = {}): ZoneCalcRecord {
  return {
    id: 'zr1',
    sourceId: 's1',
    sourceName: '岗南水库',
    zones: [
      {
        level: '一级',
        area: 0.5,
        radius: 300,
        method: '经验值法',
        formula: 'r = 300m',
        boundaryDescription: '以取水口为圆心300m',
        keyParams: 'K=10, I=0.001',
        standard: 'HJ 338-2018',
      },
      {
        level: '二级',
        area: 2.0,
        radius: 1000,
        method: '经验值法',
        formula: 'R = 1000m',
        boundaryDescription: '以取水口为圆心1000m',
        keyParams: 'K=10, I=0.001',
        standard: 'HJ 338-2018',
      },
    ],
    params: {
      sourceType: '地表水',
      swType: '湖库型',
    } as never,
    calculatedAt: '2024-01-15T10:00:00Z',
    warnings: [],
    ...overrides,
  };
}

describe('generatePdfReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T01-正常生成PDF报告', async () => {
    const results = [makeZoneResult()];
    const sources = [makeSource()];
    await generatePdfReport(results, sources);
    expect(vi.mocked(jsPDF)).toHaveBeenCalled();
    expect(vi.mocked(saveAs)).toHaveBeenCalled();
  });

  it('T02-空结果不生成报告', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await generatePdfReport([], []);
    expect(vi.mocked(jsPDF)).not.toHaveBeenCalled();
    expect(vi.mocked(saveAs)).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('T03-按城市筛选生成报告', async () => {
    const results = [
      makeZoneResult({ sourceId: 's1', sourceName: '岗南水库' }),
      makeZoneResult({ id: 'zr2', sourceId: 's2', sourceName: '陡河水库' }),
    ];
    const sources = [
      makeSource({ id: 's1', cityName: '石家庄市' }),
      makeSource({ id: 's2', name: '陡河水库', cityName: '唐山市' }),
    ];
    await generatePdfReport(results, sources, { cityNames: ['石家庄市'] });
    expect(vi.mocked(jsPDF)).toHaveBeenCalled();
    expect(vi.mocked(saveAs)).toHaveBeenCalled();
  });

  it('T04-自定义报告标题和编号', async () => {
    const results = [makeZoneResult()];
    const sources = [makeSource()];
    await generatePdfReport(results, sources, {
      title: '自定义标题',
      reportNumber: 'HB-2024-001',
      compileUnit: '编制单位',
      entrustUnit: '委托单位',
    });
    expect(vi.mocked(jsPDF)).toHaveBeenCalled();
    expect(vi.mocked(saveAs)).toHaveBeenCalled();
  });

  it('T05-多个水源地生成报告含分页', async () => {
    const results = [
      makeZoneResult({ sourceId: 's1', sourceName: '岗南水库' }),
      makeZoneResult({ id: 'zr2', sourceId: 's2', sourceName: '黄壁庄水库' }),
      makeZoneResult({ id: 'zr3', sourceId: 's3', sourceName: '西大洋水库' }),
    ];
    const sources = [
      makeSource({ id: 's1', name: '岗南水库' }),
      makeSource({ id: 's2', name: '黄壁庄水库' }),
      makeSource({ id: 's3', name: '西大洋水库', county: '唐县' }),
    ];
    await generatePdfReport(results, sources);
    const mockDoc = vi.mocked(jsPDF).mock.results[0].value;
    expect(mockDoc.addPage).toHaveBeenCalled();
    expect(vi.mocked(saveAs)).toHaveBeenCalled();
  });
});
