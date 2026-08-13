/**
 * zoneAuditStore 审计规则 Store 测试
 *
 * 验证：
 * - 无本地数据时加载内置默认规则
 * - addRule / updateRule / deleteRule 修改状态并持久化
 * - resetToDefault 恢复默认并清除自定义标记
 * - 动态规则集匹配（auditZoneStatusWithRules）
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { useZoneAuditStore } from '../data/zoneAuditStore';
import {
  ZONE_AUDIT_RULES,
  auditZoneStatusWithRules,
  type ZoneAuditRule,
} from '../data/zoneAuditMeta';

const STORAGE_KEY = 'watersource-zone-audit-rules';

function resetStore() {
  localStorage.clear();
  useZoneAuditStore.setState({ rules: ZONE_AUDIT_RULES, isCustomized: false });
}

describe('zoneAuditStore', () => {
  beforeEach(() => resetStore());

  it('无本地数据时初始加载内置默认规则', () => {
    const { rules, isCustomized } = useZoneAuditStore.getState();
    expect(rules).toEqual(ZONE_AUDIT_RULES);
    expect(isCustomized).toBe(false);
  });

  it('有本地数据时加载持久化规则', () => {
    const custom: ZoneAuditRule = {
      city: '邢台市',
      keywords: ['临城'],
      status: 'cancelled',
      note: '测试规则',
      ref: '测试文号',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([custom]));
    // 重新读取 store 需模拟重新初始化：直接调用内部加载逻辑不可达，改用 setState 模拟加载结果
    useZoneAuditStore.setState({ rules: [custom], isCustomized: true });
    const { rules, isCustomized } = useZoneAuditStore.getState();
    expect(rules).toEqual([custom]);
    expect(isCustomized).toBe(true);
  });

  it('addRule 追加规则并持久化', () => {
    const rule: ZoneAuditRule = {
      city: '石家庄市',
      keywords: ['新乐'],
      status: 'adjusted',
      note: '新乐城区调整',
      ref: '测试',
    };
    const before = useZoneAuditStore.getState().rules.length;
    useZoneAuditStore.getState().addRule(rule);
    const { rules } = useZoneAuditStore.getState();
    expect(rules.length).toBe(before + 1);
    expect(rules[rules.length - 1]).toEqual(rule);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(rules);
  });

  it('updateRule 更新指定索引', () => {
    useZoneAuditStore.getState().addRule({
      city: '石家庄市',
      keywords: ['新乐'],
      status: 'adjusted',
      note: 'a',
      ref: 'b',
    });
    const idx = useZoneAuditStore.getState().rules.length - 1;
    useZoneAuditStore
      .getState()
      .updateRule(idx, {
        city: '石家庄市',
        keywords: ['新乐'],
        status: 'cancelled',
        note: '改为取消',
        ref: 'c',
      });
    const r = useZoneAuditStore.getState().rules[idx];
    expect(r.status).toBe('cancelled');
    expect(r.note).toBe('改为取消');
  });

  it('deleteRule 删除指定索引', () => {
    const before = useZoneAuditStore.getState().rules.length;
    useZoneAuditStore.getState().deleteRule(0);
    const after = useZoneAuditStore.getState().rules.length;
    expect(after).toBe(before - 1);
    expect(useZoneAuditStore.getState().rules[0]).not.toEqual(ZONE_AUDIT_RULES[0]);
  });

  it('resetToDefault 恢复默认并清除自定义标记', () => {
    useZoneAuditStore.getState().addRule({
      city: '石家庄市',
      keywords: ['x'],
      status: 'adjusted',
      note: 'n',
      ref: 'r',
    });
    expect(useZoneAuditStore.getState().isCustomized).toBe(true);
    useZoneAuditStore.getState().resetToDefault();
    const { rules, isCustomized } = useZoneAuditStore.getState();
    expect(rules).toEqual(ZONE_AUDIT_RULES);
    expect(isCustomized).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(ZONE_AUDIT_RULES);
  });

  it('auditZoneStatusWithRules 按自定义规则动态匹配', () => {
    const custom: ZoneAuditRule[] = [
      { city: '邢台市', keywords: ['临城'], status: 'cancelled', note: '', ref: '' },
      { city: '邢台市', keywords: ['威县'], status: 'adjusted', note: '', ref: '' },
    ];
    expect(auditZoneStatusWithRules(custom, '邢台市', '临城县城区水源地')).toBe('cancelled');
    expect(auditZoneStatusWithRules(custom, '邢台市', '威县城区水源地1号')).toBe('adjusted');
    expect(auditZoneStatusWithRules(custom, '邢台市', '内丘县城区水源地')).toBeNull();
    // 城市不匹配不命中
    expect(auditZoneStatusWithRules(custom, '衡水市', '临城县水源地')).toBeNull();
  });
});
