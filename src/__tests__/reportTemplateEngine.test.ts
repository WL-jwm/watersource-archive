import { describe, expect, it } from 'vitest';
import {
  getEffectiveChapters,
  getTemplateLabel,
  getTemplateDescription,
  getChapterLabel,
  getChapterDescription,
  ALL_CHAPTERS,
  TEMPLATE_CHAPTERS,
} from '../lib/reportTemplateEngine';

describe('reportTemplateEngine (S13.3)', () => {
  describe('TEMPLATE_CHAPTERS', () => {
    it('simple模板应包含核心章节', () => {
      const chapters = TEMPLATE_CHAPTERS.simple;
      expect(chapters).toContain('cover');
      expect(chapters).toContain('overview');
      expect(chapters).toContain('queryConclusion');
      expect(chapters).toContain('conclusion');
    });

    it('standard模板应包含风险矩阵和敏感目标', () => {
      const chapters = TEMPLATE_CHAPTERS.standard;
      expect(chapters).toContain('riskMatrix');
      expect(chapters).toContain('sensitive');
    });

    it('detailed模板应包含全部10个章节', () => {
      const chapters = TEMPLATE_CHAPTERS.detailed;
      expect(chapters.length).toBe(10);
      expect(chapters).toContain('proximity');
      expect(chapters).toContain('upstream');
      expect(chapters).toContain('density');
      expect(chapters).toContain('relationMatrix');
    });
  });

  describe('getEffectiveChapters', () => {
    it('默认使用模板预设', () => {
      const chapters = getEffectiveChapters({ template: 'standard' });
      expect(chapters).toEqual(TEMPLATE_CHAPTERS.standard);
    });

    it('自定义章节覆盖模板', () => {
      const chapters = getEffectiveChapters({
        template: 'standard',
        chapters: ['cover', 'conclusion'],
      });
      expect(chapters).toEqual(['cover', 'conclusion']);
    });

    it('includeCover=false时移除封面', () => {
      const chapters = getEffectiveChapters({ template: 'simple', includeCover: false });
      expect(chapters).not.toContain('cover');
    });
  });

  describe('ALL_CHAPTERS', () => {
    it('应包含10个章节配置', () => {
      expect(ALL_CHAPTERS.length).toBe(10);
    });

    it('每个章节应有id/label/description/defaultEnabled', () => {
      for (const c of ALL_CHAPTERS) {
        expect(c.id).toBeTruthy();
        expect(c.label).toBeTruthy();
        expect(c.description).toBeTruthy();
        expect(typeof c.defaultEnabled).toBe('boolean');
      }
    });
  });

  describe('工具函数', () => {
    it('getTemplateLabel应返回中文名称', () => {
      expect(getTemplateLabel('simple')).toBe('简洁模板');
      expect(getTemplateLabel('standard')).toBe('标准模板');
      expect(getTemplateLabel('detailed')).toBe('详细模板');
    });

    it('getTemplateDescription应返回描述', () => {
      expect(getTemplateDescription('simple')).toContain('核心结论');
      expect(getTemplateDescription('detailed')).toContain('全部');
    });

    it('getChapterLabel应返回中文标签', () => {
      expect(getChapterLabel('cover')).toBe('封面');
      expect(getChapterLabel('riskMatrix')).toBe('风险矩阵');
    });

    it('getChapterDescription应返回描述', () => {
      expect(getChapterDescription('riskMatrix')).toContain('风险分级');
    });
  });
});