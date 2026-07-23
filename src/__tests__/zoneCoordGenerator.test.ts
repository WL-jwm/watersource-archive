/**
 * P3-20: 拐点坐标生成器单元测试
 * 覆盖: 圆形拐点生成 + 河流型矩形拐点 + KML/Leaflet/Excel格式输出
 */
import { describe, it, expect } from 'vitest';
import {
  generateCircleVertices,
  generateRiverVertices,
  generateSourceZoneVertices,
  toKMLCoordinates,
  toLeafletLatLngs,
  toExcelRows,
} from '@/lib/zoneCoordGenerator';

// ===== 圆形拐点生成（参数顺序: lng, lat, radius, count）=====
describe('generateCircleVertices', () => {
  it('24个拐点-默认', () => {
    const vertices = generateCircleVertices(115.0, 38.0, 1000, 24);
    expect(vertices).toHaveLength(24);
  });

  it('拐点应按方位角顺序排列', () => {
    const vertices = generateCircleVertices(115.0, 38.0, 1000, 24);
    // 方位角从0°开始，步长15°
    expect(vertices[0].azimuth).toBe(0);
    expect(vertices[1].azimuth).toBe(15);
    expect(vertices[23].azimuth).toBe(345);
  });

  it('半径越大-拐点离中心越远', () => {
    const v100 = generateCircleVertices(115.0, 38.0, 100, 24);
    const v1000 = generateCircleVertices(115.0, 38.0, 1000, 24);
    const dist100 = Math.sqrt((v100[0].lng - 115.0) ** 2 + (v100[0].lat - 38.0) ** 2);
    const dist1000 = Math.sqrt((v1000[0].lng - 115.0) ** 2 + (v1000[0].lat - 38.0) ** 2);
    expect(dist1000).toBeGreaterThan(dist100);
  });

  it('自定义拐点数', () => {
    const v8 = generateCircleVertices(115.0, 38.0, 500, 8);
    expect(v8).toHaveLength(8);
  });

  it('正北方向拐点应在中心正上方', () => {
    const vertices = generateCircleVertices(115.0, 38.0, 1000, 24);
    const north = vertices[0]; // 方位角0°=正北
    expect(north.lng).toBeCloseTo(115.0, 4); // 经度不变
    expect(north.lat).toBeGreaterThan(38.0); // 纬度增大
  });

  it('正东方向拐点应在中心正右方', () => {
    const vertices = generateCircleVertices(115.0, 38.0, 1000, 24);
    const east = vertices[6]; // 方位角90°=正东
    expect(east.lng).toBeGreaterThan(115.0); // 经度增大
    expect(east.lat).toBeCloseTo(38.0, 4); // 纬度不变
  });
});

// ===== 河流型矩形拐点（参数: lng, lat, length, width, azimuth）=====
describe('generateRiverVertices', () => {
  it('应返回8个拐点', () => {
    const vertices = generateRiverVertices(115.0, 38.0, 5000, 300, 50, 90);
    expect(vertices).toHaveLength(8);
  });

  it('方位角90°(自西向东)时-矩形沿东西方向', () => {
    const vertices = generateRiverVertices(115.0, 38.0, 1000, 200, 50, 90);
    // 东西方向: 经度有变化, 纬度变化较小(仅两岸宽度)
    const lngs = vertices.map((v) => v.lng);
    const lats = vertices.map((v) => v.lat);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    const latRange = Math.max(...lats) - Math.min(...lats);
    expect(lngRange).toBeGreaterThan(latRange); // 长度方向(东西)应大于宽度方向(南北)
  });

  it('方位角0°(自南向北)时-矩形沿南北方向', () => {
    const vertices = generateRiverVertices(115.0, 38.0, 1000, 200, 50, 0);
    // 南北方向: 纬度变化大
    const lngs = vertices.map((v) => v.lng);
    const lats = vertices.map((v) => v.lat);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    const latRange = Math.max(...lats) - Math.min(...lats);
    expect(latRange).toBeGreaterThan(lngRange);
  });
});

// ===== 水源地拐点批量生成 =====
describe('generateSourceZoneVertices', () => {
  it('圆形保护区应能生成拐点', () => {
    const result = generateSourceZoneVertices('ws_001', '测试', 115.0, 38.0, [
      {
        level: '一级',
        method: '经验值法',
        formula: 'R=300',
        radius: 300,
        area: 0.28,
        boundaryDescription: 'test',
        keyParams: 'R=300',
        standard: 'HJ 338-2018',
      },
      {
        level: '二级',
        method: '经验值法',
        formula: 'R=1000',
        radius: 1000,
        area: 3.14,
        boundaryDescription: 'test',
        keyParams: 'R=1000',
        standard: 'HJ 338-2018',
      },
    ]);
    expect(result.sourceName).toBe('测试');
    expect(result.zones).toHaveLength(2);
    expect(result.zones[0].vertices.length).toBeGreaterThan(0);
  });

  it('河流型保护区拐点为8个', () => {
    const result = generateSourceZoneVertices('ws_002', '河流测试', 115.0, 38.0, [
      {
        level: '一级',
        method: '经验值法',
        formula: '5kmx50m',
        length: 5000,
        width: 50,
        area: 0.53,
        boundaryDescription: 'test',
        keyParams: 'test',
        standard: 'HJ 338-2018',
      },
    ]);
    // 无 riverExt 时回退到旧逻辑，8个点
    expect(result.zones[0].vertices).toHaveLength(8);
  });
});

// ===== 格式转换 =====
describe('格式转换', () => {
  const vertices = generateCircleVertices(115.0, 38.0, 1000, 4);

  it('KML坐标格式应包含经纬度', () => {
    const kml = toKMLCoordinates(vertices);
    expect(kml).toContain('38.');
    expect(kml).toContain('115.');
  });

  it('Leaflet LatLngs格式', () => {
    const ll = toLeafletLatLngs(vertices);
    expect(ll).toHaveLength(4);
    ll.forEach((p) => {
      expect(p).toHaveLength(2);
    });
  });

  it('Excel行格式', () => {
    const vertices = generateCircleVertices(115.0, 38.0, 500, 4);
    const rows = toExcelRows([
      {
        sourceName: '测试',
        sourceId: 'ws_001',
        centerLng: 115.0,
        centerLat: 38.0,
        zones: [
          {
            level: '一级',
            method: '经验值法',
            formula: 'test',
            radius: 500,
            area: 0.08,
            boundaryDescription: 'test',
            keyParams: 'test',
            standard: 'HJ 338-2018',
            vertices: vertices,
            centerLng: 115.0,
            centerLat: 38.0,
          },
        ],
      },
    ]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('sourceName');
    expect(rows[0]).toHaveProperty('level');
    expect(rows[0]).toHaveProperty('lng');
    expect(rows[0]).toHaveProperty('lat');
  });
});
