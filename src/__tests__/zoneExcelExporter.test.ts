import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { exportZoneExcel, type ExcelExportOptions } from '@/lib/zoneExcelExporter';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';

// Mock XLSX 和 file-saver
vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    json_to_sheet: vi.fn(() => ({ '!cols': [] })),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => new ArrayBuffer(100)),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

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

describe('exportZoneExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T01-正常导出调用XLSX方法', () => {
    const results = [makeZoneResult()];
    const sources = [makeSource()];
    exportZoneExcel(results, sources);
    expect(vi.mocked(XLSX.utils.book_new)).toHaveBeenCalled();
    expect(vi.mocked(XLSX.utils.json_to_sheet)).toHaveBeenCalled();
    expect(vi.mocked(XLSX.utils.book_append_sheet)).toHaveBeenCalled();
  });

  it('T02-空结果不导出', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    exportZoneExcel([], []);
    expect(vi.mocked(XLSX.utils.book_new)).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('T03-按城市筛选', () => {
    const results = [
      makeZoneResult({ sourceId: 's1', sourceName: '岗南水库' }),
      makeZoneResult({ id: 'zr2', sourceId: 's2', sourceName: '陡河水库' }),
    ];
    const sources = [
      makeSource({ id: 's1', cityName: '石家庄市' }),
      makeSource({ id: 's2', name: '陡河水库', cityName: '唐山市' }),
    ];
    const options: ExcelExportOptions = { cityNames: ['石家庄市'] };
    exportZoneExcel(results, sources, options);
    expect(vi.mocked(XLSX.utils.json_to_sheet)).toHaveBeenCalled();
  });

  it('T04-includeVertices选项', () => {
    const results = [makeZoneResult()];
    const sources = [makeSource()];
    exportZoneExcel(results, sources, { includeVertices: false });
    expect(vi.mocked(XLSX.utils.book_new)).toHaveBeenCalled();
  });

  it('T05-调用saveAs导出文件', () => {
    const results = [makeZoneResult()];
    const sources = [makeSource()];
    exportZoneExcel(results, sources);
    expect(vi.mocked(saveAs)).toHaveBeenCalled();
  });
});
