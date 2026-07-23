import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  parseExcelToRecords,
  parseCsvToRecords,
  exportToExcel,
  exportToCsv,
  downloadTemplate,
  validateAndConvert,
} from '@/lib/dataExchange';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// Mock file-saver
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

function makeExcelBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return buffer as ArrayBuffer;
}

describe('dataExchange - 数据交换', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseExcelToRecords', () => {
    it('T01-正常解析Excel数据', () => {
      const rows = [
        {
          '水源地名称': '岗南水库',
          '城市': '石家庄市',
          '级别': '市级',
          '水源类型': '地表水',
          '细分类型': '湖库型',
          '县区': '平山县',
          '状态': '在用',
          '服务人口': 500000,
          '河流': '滹沱河',
          '经度': 114.21,
          '纬度': 38.27,
        },
      ];
      const buffer = makeExcelBuffer(rows);
      const result = parseExcelToRecords(buffer);
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.records[0].name).toBe('岗南水库');
      expect(result.records[0].level).toBe('municipal');
    });

    it('T02-多行数据解析', () => {
      const rows = [
        { '水源地名称': '水库A', '城市': '石家庄市', '级别': '市级', '水源类型': '地表水', '经度': 114.0, '纬度': 38.0 },
        { '水源地名称': '水库B', '城市': '唐山市', '级别': '县级', '水源类型': '地下水', '经度': 118.0, '纬度': 39.5 },
        { '水源地名称': '水库C', '城市': '保定市', '级别': '乡镇级', '水源类型': '地下水', '经度': 115.0, '纬度': 39.0 },
      ];
      const buffer = makeExcelBuffer(rows);
      const result = parseExcelToRecords(buffer);
      expect(result.imported).toBe(3);
      expect(result.records[2].level).toBe('township');
    });

    it('T03-必填字段缺失跳过', () => {
      const rows = [
        { '水源地名称': '缺少城市', '级别': '市级', '水源类型': '地表水' },
        { '水源地名称': '正常水库', '城市': '石家庄市', '级别': '市级', '水源类型': '地表水', '经度': 114.0, '纬度': 38.0 },
      ];
      const buffer = makeExcelBuffer(rows);
      const result = parseExcelToRecords(buffer);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('T04-无效级别报错', () => {
      const rows = [
        { '水源地名称': '测试', '城市': '石家庄市', '级别': '省级', '水源类型': '地表水', '经度': 114.0, '纬度': 38.0 },
      ];
      const buffer = makeExcelBuffer(rows);
      const result = parseExcelToRecords(buffer);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors.some((e) => e.message.includes('无效级别'))).toBe(true);
    });

    it('T05-无效坐标范围报错', () => {
      const rows = [
        { '水源地名称': '测试', '城市': '石家庄市', '级别': '市级', '水源类型': '地表水', '经度': 200, '纬度': 38.0 },
      ];
      const buffer = makeExcelBuffer(rows);
      const result = parseExcelToRecords(buffer);
      expect(result.skipped).toBe(1);
      expect(result.errors.some((e) => e.message.includes('无效经度'))).toBe(true);
    });

    it('T06-空数据行返回空结果', () => {
      // 创建只有表头没有数据的 Excel
      const ws = XLSX.utils.aoa_to_sheet([['水源地名称', '城市', '级别', '水源类型']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const result = parseExcelToRecords(buffer);
      expect(result.imported).toBe(0);
      expect(result.records).toHaveLength(0);
    });
  });

  describe('parseCsvToRecords', () => {
    it('T07-解析CSV数据', () => {
      const csv = '水源地名称,城市,级别,水源类型,经度,纬度\n岗南水库,石家庄市,市级,地表水,114.21,38.27\n';
      const result = parseCsvToRecords(csv);
      expect(result.imported).toBe(1);
      expect(result.records[0].name).toBe('岗南水库');
    });

    it('T08-CSV多行解析', () => {
      const csv = '水源地名称,城市,级别,水源类型,经度,纬度\n水库A,石家庄市,市级,地表水,114.0,38.0\n水库B,唐山市,县级,地下水,118.0,39.5\n';
      const result = parseCsvToRecords(csv);
      expect(result.imported).toBe(2);
    });
  });

  describe('exportToExcel', () => {
    it('T09-导出Excel调用saveAs', () => {
      const sources = [makeSource(), makeSource({ id: 's2', name: '黄壁庄水库' })];
      exportToExcel(sources);
      expect(vi.mocked(saveAs)).toHaveBeenCalled();
    });

    it('T10-导出空列表仍调用saveAs', () => {
      exportToExcel([]);
      expect(vi.mocked(saveAs)).toHaveBeenCalled();
    });
  });

  describe('exportToCsv', () => {
    it('T11-导出CSV调用saveAs', () => {
      const sources = [makeSource()];
      exportToCsv(sources);
      expect(vi.mocked(saveAs)).toHaveBeenCalled();
    });
  });

  describe('downloadTemplate', () => {
    it('T12-下载模板调用saveAs', () => {
      downloadTemplate();
      expect(vi.mocked(saveAs)).toHaveBeenCalled();
    });
  });

  describe('validateAndConvert', () => {
    it('T13-地下水类型验证通过', () => {
      const rows = [
        { '水源地名称': '地下水测试', '城市': '石家庄市', '级别': '县级', '水源类型': '地下水', '经度': 114.0, '纬度': 38.0 },
      ];
      const result = validateAndConvert(rows);
      expect(result.imported).toBe(1);
      expect(result.records[0].type).toBe('地下水');
    });

    it('T14-级别映射正确', () => {
      const rows = [
        { '水源地名称': 'A', '城市': '石家庄市', '级别': '市级', '水源类型': '地表水', '经度': 114.0, '纬度': 38.0 },
        { '水源地名称': 'B', '城市': '石家庄市', '级别': '县级', '水源类型': '地表水', '经度': 114.0, '纬度': 38.0 },
        { '水源地名称': 'C', '城市': '石家庄市', '级别': '乡镇级', '水源类型': '地表水', '经度': 114.0, '纬度': 38.0 },
      ];
      const result = validateAndConvert(rows);
      expect(result.records[0].level).toBe('municipal');
      expect(result.records[1].level).toBe('county');
      expect(result.records[2].level).toBe('township');
    });
  });
});
