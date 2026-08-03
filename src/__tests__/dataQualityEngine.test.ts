/* ===== S11.3: 数据质量评分引擎测试 ===== */
import { describe, it, expect } from 'vitest';
import {
  scoreCompleteness,
  scoreAll,
  getGradeColor,
  getScoreColor,
} from '@/lib/dataQualityEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'test-1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '测试水源地',
    type: '地下水',
    county: '平山县',
    status: '在用',
    dataVersion: 1,
    ...overrides,
  };
}

describe('dataQualityEngine', () => {
  // ===== scoreCompleteness =====
  describe('scoreCompleteness', () => {
    it('满数据应得 100 分', () => {
      const record = makeRecord({
        subType: '孔隙水',
        population: 50000,
        river: '滹沱河',
        lng: 114.5,
        lat: 38.2,
        remark: '备注信息',
      });
      const report = scoreCompleteness(record);
      expect(report.total).toBe(100);
      expect(report.grade).toBe('A');
      expect(report.missingFields).toHaveLength(0);
    });

    it('默认记录（含 county+status）应得 70 分', () => {
      const record = makeRecord();
      const report = scoreCompleteness(record);
      expect(report.total).toBe(70); // 60 必填 + 5 county + 5 status
      expect(report.grade).toBe('C');
      expect(report.missingFields.length).toBeGreaterThan(0);
    });

    it('空名称应扣 15 分', () => {
      const record = makeRecord({ name: '' });
      const report = scoreCompleteness(record);
      expect(report.total).toBe(55); // 70 - 15
      expect(report.missingFields).toContain('水源地名称');
    });

    it('缺少坐标应扣 10 分', () => {
      const record = makeRecord({
        subType: '孔隙水',
        population: 50000,
        river: '滹沱河',
        county: '平山县',
        status: '在用',
        remark: '备注',
      });
      const report = scoreCompleteness(record);
      expect(report.total).toBe(90); // 100 - 10 (坐标)
      expect(report.missingFields).toContain('经度');
      expect(report.missingFields).toContain('纬度');
    });

    it('undefined 字段应标记为缺失', () => {
      const record = makeRecord({ population: undefined, river: undefined });
      const report = scoreCompleteness(record);
      expect(report.missingFields).toContain('服务人口');
      expect(report.missingFields).toContain('河流');
    });

    it('空字符串应标记为缺失', () => {
      const record = makeRecord({ remark: '', subType: '' });
      const report = scoreCompleteness(record);
      expect(report.missingFields).toContain('备注');
      expect(report.missingFields).toContain('细分类型');
    });

    it('population=0 应标记为缺失', () => {
      const record = makeRecord({ population: 0 });
      const report = scoreCompleteness(record);
      expect(report.missingFields).toContain('服务人口');
    });

    it('字段数量应为 12', () => {
      const report = scoreCompleteness(makeRecord());
      expect(report.fields).toHaveLength(12);
    });
  });

  // ===== 评级 =====
  describe('评级', () => {
    it('90+ 应为 A', () => {
      const record = makeRecord({ subType: 'x', population: 1, river: 'x', lng: 1, lat: 1, remark: 'x' });
      expect(scoreCompleteness(record).grade).toBe('A');
    });
    it('80-89 应为 B', () => {
      const record = makeRecord({ subType: 'x', population: 1, river: 'x' }); // 70+5+5+5=85 → B
      expect(scoreCompleteness(record).grade).toBe('B');
    });
    it('70-79 应为 C', () => {
      const record = makeRecord({ subType: 'x' }); // 70+5=75 → C
      expect(scoreCompleteness(record).grade).toBe('C');
    });
    it('60-69 应为 D', () => {
      const record = makeRecord({ county: undefined, status: '' });
      expect(scoreCompleteness(record).grade).toBe('D');
    });
    it('<60 应为 F', () => {
      const record = makeRecord({ name: '', cityName: '', county: undefined, status: '' });
      const report = scoreCompleteness(record);
      expect(report.grade).toBe('F');
    });
  });

  // ===== scoreAll =====
  describe('scoreAll', () => {
    it('空列表应返回零统计', () => {
      const stats = scoreAll([]);
      expect(stats.total).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.distribution).toHaveLength(0);
    });

    it('应正确计算平均分', () => {
      const records = [
        makeRecord({ id: 'r1', name: 'A', subType: 'x', population: 1, river: 'x', lng: 1, lat: 1, remark: 'x' }), // 100
        makeRecord({ id: 'r2', name: 'B' }), // 70 (60+county5+status5)
      ];
      const stats = scoreAll(records);
      expect(stats.average).toBe(85);
      expect(stats.max).toBe(100);
      expect(stats.min).toBe(70);
    });

    it('分布应正确分组', () => {
      const records = [
        makeRecord({ id: 'r1', subType: 'x', population: 1, river: 'x', lng: 1, lat: 1, remark: 'x' }), // 100 → 90-100
        makeRecord({ id: 'r2', county: undefined, status: '' }), // 60 → 60-69
      ];
      const stats = scoreAll(records);
      expect(stats.distribution).toHaveLength(5);
      const r1 = stats.distribution.find((d) => d.range === '90-100');
      expect(r1?.count).toBe(1);
      const r2 = stats.distribution.find((d) => d.range === '60-69');
      expect(r2?.count).toBe(1);
    });

    it('低分 Top10 应按分数升序', () => {
      const records = Array.from({ length: 15 }, (_, i) =>
        makeRecord({ id: `r${i}`, name: `水源${i}` }),
      );
      const stats = scoreAll(records);
      expect(stats.lowScoreTop10).toHaveLength(10);
      for (let i = 1; i < stats.lowScoreTop10.length; i++) {
        expect(stats.lowScoreTop10[i].score).toBeGreaterThanOrEqual(stats.lowScoreTop10[i - 1].score);
      }
    });

    it('按城市分组应正确聚合', () => {
      const records = [
        makeRecord({ id: 'r1', cityName: '石家庄市', subType: 'x' }),
        makeRecord({ id: 'r2', cityName: '石家庄市' }),
        makeRecord({ id: 'r3', cityName: '保定市', subType: 'x', population: 1, river: 'x' }),
      ];
      const stats = scoreAll(records);
      const sjz = stats.byCity.find((c) => c.cityName === '石家庄市');
      expect(sjz?.count).toBe(2);
      const bd = stats.byCity.find((c) => c.cityName === '保定市');
      expect(bd?.count).toBe(1);
    });

    it('按级别分组应正确聚合', () => {
      const records = [
        makeRecord({ id: 'r1', level: 'municipal' as const, subType: 'x' }),
        makeRecord({ id: 'r2', level: 'county' as const }),
        makeRecord({ id: 'r3', level: 'county' as const, subType: 'x' }),
      ];
      const stats = scoreAll(records);
      const county = stats.byLevel.find((l) => l.level === '县级');
      expect(county?.count).toBe(2);
    });
  });

  // ===== 辅助函数 =====
  describe('辅助函数', () => {
    it('getGradeColor 应返回对应颜色', () => {
      expect(getGradeColor('A')).toContain('green');
      expect(getGradeColor('F')).toContain('red');
    });

    it('getScoreColor 应返回对应颜色', () => {
      expect(getScoreColor(95)).toContain('green');
      expect(getScoreColor(50)).toContain('red');
    });
  });
});
