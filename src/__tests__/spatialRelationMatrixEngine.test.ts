/* ===== S12.6: 空间关联矩阵引擎测试 ===== */
import { describe, expect, it } from 'vitest';
import {
  buildRelationMatrix,
  summarizeRelations,
  toMatrixExportRows,
  buildMatrixSummaryText,
  riskLevelText,
  type RelationProject,
  type RelationSource,
} from '@/lib/spatialRelationMatrixEngine';

function makeProject(overrides: Partial<RelationProject> = {}): RelationProject {
  return {
    id: 'p1',
    name: '项目A',
    lng: 114.0,
    lat: 38.0,
    ...overrides,
  };
}

function makeSource(overrides: Partial<RelationSource> = {}): RelationSource {
  return {
    id: 's1',
    name: '岗南水库',
    lng: 114.0,
    lat: 38.0,
    zoneLevel: '二级',
    zoneRadiusM: 500,
    ...overrides,
  };
}

describe('spatialRelationMatrixEngine', () => {
  // ===== buildRelationMatrix =====
  describe('buildRelationMatrix', () => {
    it('构建完整关联矩阵', () => {
      const result = buildRelationMatrix(
        [makeProject(), makeProject({ id: 'p2', name: '项目B', lng: 114.5, lat: 38.2 })],
        [makeSource()],
      );
      expect(result.cells).toHaveLength(2);
      expect(result.projects).toHaveLength(2);
      expect(result.sources).toHaveLength(1);
    });

    it('项目在保护区内标记 isInZone', () => {
      const result = buildRelationMatrix(
        [makeProject()], // 与水源地同点，在500m保护区内
        [makeSource()],
      );
      expect(result.cells[0].isInZone).toBe(true);
      expect(result.cells[0].risk).toBe('red'); // 二级保护区重叠 → 红
    });

    it('项目远离保护区为绿色', () => {
      const result = buildRelationMatrix(
        [makeProject({ lng: 116, lat: 39 })],
        [makeSource()],
      );
      expect(result.cells[0].risk).toBe('green');
      expect(result.cells[0].isInZone).toBe(false);
    });

    it('计算距离与方位', () => {
      const result = buildRelationMatrix(
        [makeProject()],
        [makeSource({ lng: 114.0, lat: 38.1 })], // 正北
      );
      expect(result.cells[0].bearingLabel).toBe('正北');
      expect(result.cells[0].distanceM).toBeGreaterThan(0);
    });

    it('significantCells 仅包含非绿色关联', () => {
      const result = buildRelationMatrix(
        [makeProject(), makeProject({ id: 'p2', lng: 116, lat: 39 })],
        [makeSource()],
      );
      expect(result.significantCells.every((c) => c.risk !== 'green')).toBe(true);
    });
  });

  // ===== summarizeRelations =====
  describe('summarizeRelations', () => {
    it('统计各风险等级数量', () => {
      const cells = [
        { projectId: 'p1', projectName: 'A', sourceId: 's1', sourceName: 'S1', sourceZoneLevel: '二级', distanceM: 0, bearingDeg: 0, bearingLabel: '北', isInZone: true, zoneEdgeDistanceM: -100, risk: 'red' as const, riskReason: 'r' },
        { projectId: 'p2', projectName: 'B', sourceId: 's2', sourceName: 'S2', sourceZoneLevel: '准保护区', distanceM: 0, bearingDeg: 0, bearingLabel: '北', isInZone: false, zoneEdgeDistanceM: 100, risk: 'yellow' as const, riskReason: 'y' },
        { projectId: 'p3', projectName: 'C', sourceId: 's3', sourceName: 'S3', sourceZoneLevel: '二级', distanceM: 5000, bearingDeg: 0, bearingLabel: '北', isInZone: false, zoneEdgeDistanceM: 4500, risk: 'green' as const, riskReason: 'g' },
      ];
      const summary = summarizeRelations(cells, []);
      expect(summary.totalRelations).toBe(3);
      expect(summary.redCount).toBe(1);
      expect(summary.yellowCount).toBe(1);
      expect(summary.greenCount).toBe(1);
      expect(summary.involvedPairs).toBe(1);
    });

    it('识别红线风险项目', () => {
      const cells = [
        { projectId: 'p1', projectName: '红线项目', sourceId: 's1', sourceName: 'S1', sourceZoneLevel: '一级', distanceM: 0, bearingDeg: 0, bearingLabel: '北', isInZone: true, zoneEdgeDistanceM: -10, risk: 'red' as const, riskReason: 'r' },
        { projectId: 'p2', projectName: '安全项目', sourceId: 's2', sourceName: 'S2', sourceZoneLevel: '二级', distanceM: 9000, bearingDeg: 0, bearingLabel: '北', isInZone: false, zoneEdgeDistanceM: 8500, risk: 'green' as const, riskReason: 'g' },
      ];
      const projects = [
        { id: 'p1', name: '红线项目', lng: 0, lat: 0 },
        { id: 'p2', name: '安全项目', lng: 0, lat: 0 },
      ];
      const summary = summarizeRelations(cells, projects);
      expect(summary.redProjects).toEqual(['红线项目']);
    });

    it('识别受影响水源地（去重）', () => {
      const cells = [
        { projectId: 'p1', projectName: 'A', sourceId: 's1', sourceName: '岗南', sourceZoneLevel: '一级', distanceM: 0, bearingDeg: 0, bearingLabel: '北', isInZone: true, zoneEdgeDistanceM: 0, risk: 'red' as const, riskReason: 'r' },
        { projectId: 'p2', projectName: 'B', sourceId: 's1', sourceName: '岗南', sourceZoneLevel: '一级', distanceM: 100, bearingDeg: 0, bearingLabel: '北', isInZone: false, zoneEdgeDistanceM: 100, risk: 'yellow' as const, riskReason: 'y' },
      ];
      const summary = summarizeRelations(cells, []);
      expect(summary.affectedSources).toEqual(['岗南']); // 去重
    });
  });

  // ===== toMatrixExportRows =====
  describe('toMatrixExportRows', () => {
    it('转换为可导出表格行', () => {
      const result = buildRelationMatrix([makeProject()], [makeSource()]);
      const rows = toMatrixExportRows(result.cells);
      expect(rows).toHaveLength(1);
      expect(rows[0]['项目名称']).toBe('项目A');
      expect(rows[0]['水源地名称']).toBe('岗南水库');
      expect(rows[0]['风险等级']).toBe('红线');
      expect(rows[0]['是否在保护区内']).toBe('是');
    });
  });

  // ===== buildMatrixSummaryText =====
  describe('buildMatrixSummaryText', () => {
    it('生成汇总文本', () => {
      const result = buildRelationMatrix([makeProject()], [makeSource()]);
      const text = buildMatrixSummaryText(result);
      expect(text).toContain('关联');
      expect(text).toContain('红线');
    });
  });

  // ===== riskLevelText =====
  describe('riskLevelText', () => {
    it('风险等级中文', () => {
      expect(riskLevelText('red')).toBe('红线');
      expect(riskLevelText('yellow')).toBe('黄线');
      expect(riskLevelText('green')).toBe('绿线');
    });
  });
});
