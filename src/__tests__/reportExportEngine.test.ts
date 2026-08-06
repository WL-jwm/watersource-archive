import { describe, it, expect } from 'vitest';
import { reportToHtml } from '../lib/reportExportEngine';
import type { SpatialReport } from '../lib/spatialAnalysisReportEngine';

describe('reportExportEngine (S13.4)', () => {
  const sampleReport: SpatialReport = {
    title: '测试报告',
    projectName: '测试项目',
    createdAt: Date.now(),
    sections: [
      {
        heading: '一、分析概述',
        paragraphs: ['分析对象：测试项目。', '坐标：114.5°E, 38.1°N。'],
        table: {
          headers: ['指标', '值'],
          rows: [['风险等级', '红线'], ['保护区内', '是']],
        },
      },
      {
        heading: '二、综合结论',
        paragraphs: ['建议重新选址。'],
      },
    ],
    conclusion: '综合风险较高，建议重新选址。',
  };

  describe('reportToHtml', () => {
    it('应生成包含标题的 HTML', () => {
      const html = reportToHtml(sampleReport);
      expect(html).toContain('测试报告');
      expect(html).toContain('<h1>');
      expect(html).toContain('</html>');
    });

    it('应包含章节内容', () => {
      const html = reportToHtml(sampleReport);
      expect(html).toContain('一、分析概述');
      expect(html).toContain('分析对象：测试项目');
    });

    it('应包含表格', () => {
      const html = reportToHtml(sampleReport);
      expect(html).toContain('<table>');
      expect(html).toContain('风险等级');
      expect(html).toContain('红线');
    });

    it('应包含结论区域', () => {
      const html = reportToHtml(sampleReport);
      expect(html).toContain('综合结论');
      expect(html).toContain('综合风险较高');
    });

    it('应转义 HTML 特殊字符', () => {
      const reportWithSpecial: SpatialReport = {
        ...sampleReport,
        projectName: '项目<A&B>',
        sections: [
          {
            heading: '测试',
            paragraphs: ['风险"高" & 复杂'],
          },
        ],
        conclusion: '结论<OK>',
      };
      const html = reportToHtml(reportWithSpecial);
      expect(html).toContain('&lt;A&amp;B&gt;');
      expect(html).toContain('&quot;高&quot;');
      expect(html).toContain('&amp;');
      expect(html).not.toContain('<A&B>');
    });
  });
});