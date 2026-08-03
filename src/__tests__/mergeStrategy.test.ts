/* ===== S11.2: 合并策略测试 ===== */
import { describe, it, expect } from 'vitest';
import { createMergePlan, getStrategyLabel, getStrategyDescription } from '@/lib/mergeStrategy';
import { detectConflicts } from '@/lib/conflictDetector';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// 模拟 ID 生成函数
function mockGenId(cityName: string, level: string, name: string): string {
  return `${cityName}-${level}-${name}`.replace(/\s+/g, '_');
}

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'test-1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '黄壁庄水库',
    type: '地表水',
    county: '平山县',
    status: '在用',
    dataVersion: 1,
    ...overrides,
  };
}

// 有效的导入记录
const validImportRecords: Partial<WaterSourceRecord>[] = [
  { name: '水源A', cityName: '石家庄市', level: 'municipal', type: '地下水', county: '平山县', status: '在用' },
  { name: '水源B', cityName: '保定市', level: 'county', type: '地表水', county: '涞水县', status: '在用' },
  { name: '水源C', cityName: '唐山市', level: 'county', type: '地下水', county: '迁西县', status: '备用' },
];

describe('mergeStrategy', () => {
  // ===== skip 策略 =====
  describe('skip 策略', () => {
    it('冲突行应被跳过，非冲突行应新增', () => {
      const existing = [makeRecord({ name: '水源A', cityName: '石家庄市' })];
      const report = detectConflicts(validImportRecords, existing);
      const plan = createMergePlan(validImportRecords, report, 'skip', mockGenId);

      expect(plan.strategy).toBe('skip');
      expect(plan.addCount).toBe(2); // 水源B, 水源C
      expect(plan.skipCount).toBe(1); // 水源A 冲突
      expect(plan.updateCount).toBe(0);
    });

    it('跳过原因应包含冲突信息', () => {
      const existing = [makeRecord({ name: '水源A', cityName: '石家庄市' })];
      const report = detectConflicts(validImportRecords, existing);
      const plan = createMergePlan(validImportRecords, report, 'skip', mockGenId);

      const skipAction = plan.actions.find((a) => a.action === 'skip');
      expect(skipAction).toBeDefined();
      expect(skipAction?.skipReason).toContain('冲突');
    });

    it('无冲突时全部新增', () => {
      const report = detectConflicts(validImportRecords, []);
      const plan = createMergePlan(validImportRecords, report, 'skip', mockGenId);
      expect(plan.addCount).toBe(3);
      expect(plan.skipCount).toBe(0);
    });
  });

  // ===== overwrite 策略 =====
  describe('overwrite 策略', () => {
    it('冲突行应更新已有记录（保留原 ID）', () => {
      const existing = [makeRecord({ id: 'existing-1', name: '水源A', cityName: '石家庄市', status: '取消' })];
      const report = detectConflicts(validImportRecords, existing);
      const plan = createMergePlan(validImportRecords, report, 'overwrite', mockGenId);

      expect(plan.updateCount).toBe(1);
      expect(plan.addCount).toBe(2);
      expect(plan.skipCount).toBe(0);

      const updateAction = plan.actions.find((a) => a.action === 'update');
      expect(updateAction?.record?.id).toBe('existing-1'); // 保留原 ID
      expect(updateAction?.record?.status).toBe('在用'); // 使用新值
    });

    it('无冲突时全部新增', () => {
      const report = detectConflicts(validImportRecords, []);
      const plan = createMergePlan(validImportRecords, report, 'overwrite', mockGenId);
      expect(plan.addCount).toBe(3);
      expect(plan.updateCount).toBe(0);
    });
  });

  // ===== rename 策略 =====
  describe('rename 策略', () => {
    it('冲突行应自动重命名后新增', () => {
      const existing = [makeRecord({ name: '水源A', cityName: '石家庄市' })];
      const report = detectConflicts(validImportRecords, existing);
      const plan = createMergePlan(validImportRecords, report, 'rename', mockGenId);

      expect(plan.addCount).toBe(3); // 全部新增（重命名的也算新增）
      expect(plan.skipCount).toBe(0);
      expect(plan.updateCount).toBe(0);

      // 找到被重命名的记录
      const renamedAction = plan.actions.find((a) => a.originalName === '水源A');
      expect(renamedAction).toBeDefined();
      expect(renamedAction?.record?.name).toBe('水源A_2');
      expect(renamedAction?.action).toBe('add');
    });

    it('多个同名冲突应递增后缀', () => {
      const existing = [
        makeRecord({ name: '水源A', cityName: '石家庄市' }),
        makeRecord({ name: '水源A_2', cityName: '石家庄市', id: 'existing-2' }),
      ];
      const imports: Partial<WaterSourceRecord>[] = [
        { name: '水源A', cityName: '石家庄市', level: 'municipal', type: '地下水' },
        { name: '水源A', cityName: '石家庄市', level: 'municipal', type: '地表水' },
      ];
      const report = detectConflicts(imports, existing);
      const plan = createMergePlan(imports, report, 'rename', mockGenId);

      const renamedActions = plan.actions.filter((a) => a.originalName === '水源A');
      expect(renamedActions).toHaveLength(2);
      // 第一个冲突 → 水源A_3（因为 _2 已存在）
      // 第二个冲突 → 水源A_4
      const names = renamedActions.map((a) => a.record?.name);
      expect(names).toContain('水源A_3');
    });
  });

  // ===== 无效数据 =====
  describe('无效数据处理', () => {
    it('缺少必填字段的记录应被跳过', () => {
      const invalidRecords: Partial<WaterSourceRecord>[] = [
        { name: '缺少城市', level: 'municipal', type: '地下水' }, // 缺 cityName
        { cityName: '石家庄市', level: 'municipal', type: '地下水' }, // 缺 name
        { name: '完整', cityName: '石家庄市', level: 'municipal', type: '地下水' },
      ];
      const report = detectConflicts(invalidRecords, []);
      const plan = createMergePlan(invalidRecords, report, 'skip', mockGenId);

      expect(plan.addCount).toBe(1); // 只有"完整"通过
      expect(plan.skipCount).toBe(2);
    });

    it('跳过的无效数据应包含原因', () => {
      const invalidRecords: Partial<WaterSourceRecord>[] = [
        { name: '缺城市', level: 'municipal', type: '地下水' },
      ];
      const report = detectConflicts(invalidRecords, []);
      const plan = createMergePlan(invalidRecords, report, 'skip', mockGenId);

      const skipAction = plan.actions.find((a) => a.action === 'skip');
      expect(skipAction?.skipReason).toContain('必填字段');
    });
  });

  // ===== 辅助函数 =====
  describe('辅助函数', () => {
    it('getStrategyLabel 应返回中文标签', () => {
      expect(getStrategyLabel('skip')).toBe('跳过冲突');
      expect(getStrategyLabel('overwrite')).toBe('覆盖原数据');
      expect(getStrategyLabel('rename')).toBe('自动重命名');
    });

    it('getStrategyDescription 应返回描述', () => {
      expect(getStrategyDescription('skip')).toContain('保留');
      expect(getStrategyDescription('overwrite')).toContain('替换');
      expect(getStrategyDescription('rename')).toContain('后缀');
    });
  });

  // ===== 边界情况 =====
  describe('边界情况', () => {
    it('空导入列表应返回空计划', () => {
      const report = detectConflicts([], []);
      const plan = createMergePlan([], report, 'skip', mockGenId);
      expect(plan.actions).toHaveLength(0);
      expect(plan.addCount).toBe(0);
    });

    it('所有记录都冲突时应全部处理', () => {
      const existing = [
        makeRecord({ name: '水源A', cityName: '石家庄市' }),
        makeRecord({ name: '水源B', cityName: '保定市' }),
        makeRecord({ name: '水源C', cityName: '唐山市' }),
      ];
      const report = detectConflicts(validImportRecords, existing);
      const skipPlan = createMergePlan(validImportRecords, report, 'skip', mockGenId);
      expect(skipPlan.skipCount).toBe(3);
      expect(skipPlan.addCount).toBe(0);

      const overwritePlan = createMergePlan(validImportRecords, report, 'overwrite', mockGenId);
      expect(overwritePlan.updateCount).toBe(3);
      expect(overwritePlan.addCount).toBe(0);

      const renamePlan = createMergePlan(validImportRecords, report, 'rename', mockGenId);
      expect(renamePlan.addCount).toBe(3);
    });
  });
});
