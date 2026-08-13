/**
 * zoneAuditMeta 审计元数据测试
 *
 * 验证已取消/已调整保护区规则的匹配逻辑与数据完整性：
 * - 规则城市均在支持的城市列表中
 * - 关键词非空
 * - 已取消/已调整清单与比对结论一致
 */

import { describe, it, expect } from 'vitest';
import { auditZoneStatus, ZONE_AUDIT_RULES, MISSING_ZONES } from '../data/zoneAuditMeta';

const SUPPORTED_CITIES = [
  '石家庄市',
  '唐山市',
  '秦皇岛市',
  '邯郸市',
  '邢台市',
  '保定市',
  '张家口市',
  '承德市',
  '沧州市',
  '廊坊市',
  '衡水市',
  '辛集市',
  '定州市',
];

describe('zoneAuditMeta 审计规则完整性', () => {
  it('审计规则城市均为支持的城市', () => {
    for (const rule of ZONE_AUDIT_RULES) {
      expect(SUPPORTED_CITIES, `${rule.city} 应在支持城市列表`).toContain(rule.city);
    }
  });

  it('审计规则关键词非空且状态合法', () => {
    for (const rule of ZONE_AUDIT_RULES) {
      expect(rule.keywords.length).toBeGreaterThan(0);
      expect(rule.keywords.every((k) => k.length > 0)).toBe(true);
      expect(['cancelled', 'adjusted']).toContain(rule.status);
      expect(rule.note.length).toBeGreaterThan(0);
      expect(rule.ref.length).toBeGreaterThan(0);
    }
  });

  it('已取消保护区：满城/南大港/定州经开区命中 cancelled', () => {
    expect(auditZoneStatus('保定市', '满城区县城集中式饮用水水源地1#')).toBe('cancelled');
    expect(auditZoneStatus('沧州市', '南大港产业园区水厂2#')).toBe('cancelled');
    expect(auditZoneStatus('定州市', '定州经济开发区应急备用饮用水水源地')).toBe('cancelled');
  });

  it('已调整保护区：羊角铺/陡河/桃林口/腰站堡/泊头/栾城命中 adjusted', () => {
    expect(auditZoneStatus('邯郸市', '羊角铺')).toBe('adjusted');
    expect(auditZoneStatus('唐山市', '陡河水库水源地')).toBe('adjusted');
    expect(auditZoneStatus('秦皇岛市', '桃林口水库水域')).toBe('adjusted');
    expect(auditZoneStatus('张家口市', '腰站堡水源地')).toBe('adjusted');
    expect(auditZoneStatus('沧州市', '泊头')).toBe('adjusted');
    expect(auditZoneStatus('石家庄市', '栾城区水源井保护区')).toBe('adjusted');
  });

  it('未命中规则的城市/名称返回 null', () => {
    expect(auditZoneStatus('衡水市', '迎宾水厂1#井水源')).toBeNull();
    expect(auditZoneStatus('廊坊市', '香河县城区水源地1号井')).toBeNull();
    // 关键词跨城市不误伤：'满城'仅保定命中，其他城市含满城字样不受影响
    expect(auditZoneStatus('衡水市', '满城县水源地')).toBeNull();
  });

  it('MISSING_ZONES 清单非空且字段完整', () => {
    expect(MISSING_ZONES.length).toBeGreaterThan(0);
    for (const m of MISSING_ZONES) {
      expect(m.city.length).toBeGreaterThan(0);
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.ref.length).toBeGreaterThan(0);
    }
  });
});
