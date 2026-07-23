import { describe, it, expect } from 'vitest';
import {
  generateReportNumber,
  type ReportChapter,
  type ReportTemplate,
  type ReportConfig,
} from '@/lib/zoneReportGenerator';

describe('generateReportNumber', () => {
  it('T01-基本编号格式', () => {
    const num = generateReportNumber(2024, 1);
    expect(num).toBe('HJ-2024-001');
  });

  it('T02-序号补零3位', () => {
    expect(generateReportNumber(2024, 5)).toBe('HJ-2024-005');
    expect(generateReportNumber(2024, 42)).toBe('HJ-2024-042');
    expect(generateReportNumber(2024, 123)).toBe('HJ-2024-123');
  });

  it('T03-序号超过999不截断', () => {
    expect(generateReportNumber(2024, 1000)).toBe('HJ-2024-1000');
  });

  it('T04-带城市代码', () => {
    expect(generateReportNumber(2024, 1, '130100')).toBe('HJ-2024-001-130100');
  });

  it('T05-不同年份', () => {
    expect(generateReportNumber(2023, 10)).toBe('HJ-2023-010');
    expect(generateReportNumber(2025, 99)).toBe('HJ-2025-099');
  });
});

describe('ReportChapter 类型', () => {
  it('T06-章节类型包含所有预期值', () => {
    const chapters: ReportChapter[] = [
      'cover', 'overview', 'sourceList', 'calcDetail',
      'vertices', 'sensitivity', 'summary', 'compliance',
    ];
    expect(chapters.length).toBe(8);
  });
});

describe('ReportTemplate 类型', () => {
  it('T07-模板类型包含三种', () => {
    const templates: ReportTemplate[] = ['simple', 'standard', 'detailed'];
    expect(templates.length).toBe(3);
  });
});

describe('ReportConfig 接口', () => {
  it('T08-完整配置对象', () => {
    const config: ReportConfig = {
      chapters: ['cover', 'overview', 'summary'],
      template: 'standard',
      reportNumber: 'HJ-2024-001',
      compileUnit: '测试单位',
      entrustUnit: '委托单位',
      reviewer: '审核人',
      compiler: '编制人',
      cityNames: ['石家庄市'],
      includeVertices: true,
      vertexCount: 32,
      title: '测试报告',
      imageUrls: ['data:image/png;base64,xxx'],
    };
    expect(config.chapters!.length).toBe(3);
    expect(config.template).toBe('standard');
    expect(config.reportNumber).toBe('HJ-2024-001');
  });

  it('T09-空配置对象', () => {
    const config: ReportConfig = {};
    expect(config.chapters).toBeUndefined();
    expect(config.template).toBeUndefined();
  });
});
