/**
 * 实际保护区边界数据完整性测试
 *
 * 验证 public/zone-boundaries/ 下的全省水源地保护区范围数据文件：
 * - 结构合法（name/level/ring 字段齐全）
 * - 坐标在河北合理范围内且环闭合
 * - 级别为已知值
 * - 各城市要素数与 index.json 一致
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(__dirname, '../../public/zone-boundaries');

const VALID_LEVELS = [
  '一级保护区',
  '二级保护区',
  '准保护区',
  '核心区',
  '缓冲区',
];

function loadCity(city: string): Array<{ name: string; level: string; ring: number[][] }> {
  const file = path.join(DATA_DIR, `${city}.json`);
  expect(fs.existsSync(file), `${city}.json 应存在`).toBe(true);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

describe('zone-boundaries 数据完整性', () => {
  const ALL_CITIES = [
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

  it('每个城市数据文件存在且非空', () => {
    for (const city of ALL_CITIES) {
      const data = loadCity(city);
      expect(data.length, `${city} 应有边界要素`).toBeGreaterThan(0);
    }
  });

  it('index.json 计数与各城市文件一致', () => {
    const indexFile = path.join(DATA_DIR, 'index.json');
    expect(fs.existsSync(indexFile)).toBe(true);
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8')) as Record<string, number>;
    for (const city of ALL_CITIES) {
      const data = loadCity(city);
      expect(index[city], `${city} index 计数`).toBe(data.length);
    }
  });

  it('要素结构合法且坐标为合理河北范围', { timeout: 60000 }, () => {
    // 全省 1262 要素逐环点断言，数据量大，放宽超时
    for (const city of ALL_CITIES) {
      const data = loadCity(city);
      for (const feat of data) {
        expect(typeof feat.name, `${city} name`).toBe('string');
        expect(feat.name.length).toBeGreaterThan(0);
        expect(VALID_LEVELS, `${city}:${feat.name} level`).toContain(feat.level);
        expect(Array.isArray(feat.ring)).toBe(true);
        expect(feat.ring.length, `${city}:${feat.name} 环点数`).toBeGreaterThanOrEqual(3);
        for (const [lng, lat] of feat.ring) {
          expect(lng, `${feat.name} lng`).toBeGreaterThan(113);
          expect(lng).toBeLessThan(121);
          expect(lat, `${feat.name} lat`).toBeGreaterThan(36);
          expect(lat).toBeLessThan(43);
        }
      }
    }
  });

  it('多边形环闭合（首尾坐标一致）', () => {
    for (const city of ALL_CITIES) {
      const data = loadCity(city);
      for (const feat of data) {
        const first = feat.ring[0];
        const last = feat.ring[feat.ring.length - 1];
        expect(first[0], `${feat.name} 首尾lng`).toBeCloseTo(last[0], 4);
        expect(first[1], `${feat.name} 首尾lat`).toBeCloseTo(last[1], 4);
      }
    }
  });

  it('全省边界要素总数与预期一致（>1000）', () => {
    let total = 0;
    for (const city of ALL_CITIES) total += loadCity(city).length;
    expect(total).toBeGreaterThan(1000);
    expect(total).toBeLessThan(2000);
  });
});
