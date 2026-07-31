# S5 多水源地叠加计算 — 新增 P1 测试用例文档

> 本文档记录在 P0 用例基础上补充的 30 项 P1 级测试用例，覆盖 8 个测试分组。
> P1 用例聚焦：数值一致性、几何边界行为、数据字段健壮性、导出数据完整性、退化场景的预期行为验证。

---

## 公共测试数据

以下数据在全部 P1 用例中复用（与 P0 文档一致）：

```typescript
import * as turf from '@turf/turf';
import {
  generateCircleVertices,
  generateRiverVertices,
  generateLakeVertices,
  generateSourceZoneVertices,
  toLeafletLatLngs,
} from '@/lib/zoneCoordGenerator';
import type { WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { ZoneResult, CalcResult, CalcParams } from '@/lib/zoneCalcEngine';

// ── 水源地定义 ──

const sourceA: WaterSourceRecord = {
  id: 'src-A', cityName: '石家庄市', name: '水源地A',
  type: '地下水', subType: '孔隙水', county: '正定县',
  level: 'county', status: '在用', lng: 114.50, lat: 38.05,
};

const sourceB: WaterSourceRecord = {
  id: 'src-B', cityName: '石家庄市', name: '水源地B',
  type: '地下水', subType: '孔隙水', county: '正定县',
  level: 'county', status: '在用', lng: 114.505, lat: 38.05,
};

const sourceC: WaterSourceRecord = {
  id: 'src-C', cityName: '保定市', name: '水源地C',
  type: '地下水', subType: '岩溶水', county: '涞水县',
  level: 'county', status: '在用', lng: 115.50, lat: 39.50,
};

const sourceD: WaterSourceRecord = {
  id: 'src-D', cityName: '石家庄市', name: '水源地D',
  type: '地表水', subType: '河流型', county: '正定县',
  level: 'county', status: '在用', lng: 114.502, lat: 38.048,
};

// ── 保护区计算结果构造 ──

function makeZone(level: '一级' | '二级' | '准保护区', radius: number): ZoneResult {
  return {
    level, method: '经验值法', formula: `R=${radius}m`, radius,
    area: parseFloat(((Math.PI * radius * radius) / 1e6).toFixed(4)),
    boundaryDescription: `${level}保护区`, keyParams: 'test', standard: 'HJ 338-2018',
  };
}

function makeZoneRecord(source: WaterSourceRecord, r1: number, r2: number): ZoneCalcRecord {
  return {
    id: `calc-${source.id}`, sourceId: source.id, sourceName: source.name,
    params: { sourceType: '地下水', gwType: '孔隙水' },
    zones: [makeZone('一级', r1), makeZone('二级', r2), makeZone('准保护区', Math.round(r2 * 1.5))],
    calculatedAt: '2024-01-01T00:00:00', warnings: [],
  };
}

// 标准数据集
const recordA = makeZoneRecord(sourceA, 100, 1000);
const recordB = makeZoneRecord(sourceB, 50, 800);
const recordC = makeZoneRecord(sourceC, 200, 1500);

// ── 几何构建辅助 ──

function buildCirclePolygon(lng: number, lat: number, radius: number) {
  const vertices = generateCircleVertices(lng, lat, radius, 24);
  const ring = [...vertices.map(v => [v.lng, v.lat]), [vertices[0].lng, vertices[0].lat]];
  return turf.polygon([ring]);
}

function buildRiverPolygon(
  lng: number, lat: number,
  upstream: number, downstream: number, bankWidth: number,
  azimuth = 90,
) {
  const vertices = generateRiverVertices(lng, lat, upstream, downstream, bankWidth, azimuth);
  const ring = [...vertices.map(v => [v.lng, v.lat]), [vertices[0].lng, vertices[0].lat]];
  return turf.polygon([ring]);
}
```

---

## 一、几何构建（P1-G01 ~ P1-G05）

### P1-G01 — 自定义顶点数（非默认 24）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | `generateCircleVertices` 的 `vertexCount` 参数生效，不同顶点数生成正确步长和面积 |
| **前置条件** | sourceA 一级 R=100m |

**步骤：**

1. 调用 `generateCircleVertices(114.50, 38.05, 100, 36)`
2. 检查 `vertices.length === 36`
3. 检查方位角步长 = `360 / 36 = 10°`：
   - `vertices[0].azimuth === 0`
   - `vertices[1].azimuth === 10`
   - `vertices[35].azimuth === 350`
4. 用 vertices 构建 polygon：`ring = [...vertices.map(v => [v.lng, v.lat]), [vertices[0].lng, vertices[0].lat]]`
5. 调用 `turf.polygon([ring])` → `turf.area(polygon) / 1e6` 获取面积
6. 与 24 顶点版本的面积比较

**断言：**

```typescript
expect(vertices).toHaveLength(36);
expect(vertices[0].azimuth).toBe(0);
expect(vertices[1].azimuth).toBe(10);
expect(vertices[35].azimuth).toBe(350);
expect(Math.abs(area36 - area24)).toBeLessThan(0.0001); // km²
```

---

### P1-G02 — 方位角序列从正北顺时针递增

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 24 个顶点的方位角严格按 15° 步长从正北（0°）顺时针递增至 345° |
| **前置条件** | sourceA 一级 R=100m，默认 24 顶点 |

**步骤：**

1. 调用 `generateCircleVertices(114.50, 38.05, 100, 24)`
2. 遍历 vertices，对每个 i 检查 `vertices[i].azimuth === i * 15`
3. 检查 `vertices[0].azimuth === 0`（正北起始）
4. 检查 `vertices[6].azimuth === 90`（正东）
5. 检查 `vertices[12].azimuth === 180`（正南）
6. 检查 `vertices[18].azimuth === 270`（正西）

**断言：**

```typescript
for (let i = 0; i < 24; i++) {
  expect(vertices[i].azimuth).toBe(i * 15);
}
expect(vertices[0].azimuth).toBe(0);   // 正北
expect(vertices[6].azimuth).toBe(90);  // 正东
expect(vertices[12].azimuth).toBe(180); // 正南
expect(vertices[18].azimuth).toBe(270); // 正西
```

---

### P1-G03 — 坐标精度 6 位小数一致性

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 所有顶点坐标截断到 6 位小数后仍可正确闭合多边形 |
| **前置条件** | sourceA lng=114.50, lat=38.05, R=100m |

**步骤：**

1. 调用 `generateCircleVertices(114.50, 38.05, 100, 24)`
2. 遍历所有 vertex，检查 `v.lng` 和 `v.lat` 的小数位数 ≤ 6
3. 检查 `v.lng === Math.round(v.lng * 1e6) / 1e6`
4. 检查 `v.lat === Math.round(v.lat * 1e6) / 1e6`
5. 构建闭合 ring：首尾添加 `vertices[0]` 坐标
6. 检查 `ring[0]` 与 `ring[24]` 完全相等

**断言：**

```typescript
for (const v of vertices) {
  expect(v.lng).toBe(Math.round(v.lng * 1e6) / 1e6);
  expect(v.lat).toBe(Math.round(v.lat * 1e6) / 1e6);
}
expect(ring[0]).toEqual(ring[24]); // 闭合
```

---

### P1-G04 — 河流型方位角参数生效

| 项目 | 内容 |
|------| **优先级** | P1 |
| **验证目标** | `generateRiverVertices` 的 `riverAzimuth` 参数控制河流走向，0° 为南北向、90° 为东西向 |
| **前置条件** | 河流型保护区 upstream=2000m, downstream=1000m, bankWidth=200m |

**步骤：**

1. 调用 `generateRiverVertices(114.50, 38.05, 2000, 1000, 200, 0)` 获取南北向 vertices
2. 调用 `generateRiverVertices(114.50, 38.05, 2000, 1000, 200, 90)` 获取东西向 vertices
3. 检查两组 vertices 的坐标不同（至少一个 vertex 的 lng 或 lat 不同）
4. 对南北向（azimuth=0°）：
   - 取上游左岸点（vertices[0]），检查其纬度 < 38.05（上游在北侧，纬度更大... 实际上游方向 = -azimuth 方向，0° 时上游在北方）
   - 取下游右岸点（vertices[2]），检查其纬度 > 38.05 或 < 38.05（取决于上下游定义）
   - 关键：检查南北向的纵向（纬度）位移远大于横向（经度）位移
5. 对东西向（azimuth=90°）：
   - 检查横向（经度）位移远大于纵向（纬度）位移
6. 两组各构建 polygon，检查面积均 > 0

**断言：**

```typescript
// 两组坐标不同
expect(vertsNS[0].lng).not.toBe(vertsEW[0].lng);

// 南北向：纬度变化 > 经度变化
const nsLatRange = Math.max(...vertsNS.map(v => v.lat)) - Math.min(...vertsNS.map(v => v.lat));
const nsLngRange = Math.max(...vertsNS.map(v => v.lng)) - Math.min(...vertsNS.map(v => v.lng));
expect(nsLatRange).toBeGreaterThan(nsLngRange);

// 东西向：经度变化 > 纬度变化
const ewLngRange = Math.max(...vertsEW.map(v => v.lng)) - Math.min(...vertsEW.map(v => v.lng));
const ewLatRange = Math.max(...vertsEW.map(v => v.lat)) - Math.min(...vertsEW.map(v => v.lat));
expect(ewLngRange).toBeGreaterThan(ewLatRange);

// 面积均 > 0
expect(turf.area(polyNS)).toBeGreaterThan(0);
expect(turf.area(polyEW)).toBeGreaterThan(0);
```

---

### P1-G05 — 湖库型岸边取水生成半圆顶点

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | `generateLakeVertices` 岸边取水类型生成半圆（13 个顶点），方位角范围 90°~270°，面积约为全圆 50% |
| **前置条件** | 湖库型岸边取水，lng=114.50, lat=38.05, R=500m |

**步骤：**

1. 调用 `generateLakeVertices(114.50, 38.05, 500, '岸边', 24)`
2. 检查 `vertices.length === 13`（`Math.floor(24 / 2) + 1 = 13`）
3. 检查 `vertices[0].azimuth === 90`
4. 检查 `vertices[12].azimuth === 90 + 12 * 15 = 270`
5. 遍历所有 vertex，检查 `azimuth >= 90 && azimuth <= 270`
6. 构建 polygon，计算 `turf.area(polygon) / 1e6`
7. 计算全圆面积 `Math.PI * 500 * 500 / 1e6 = 0.7854 km²`
8. 检查半圆面积 ≈ 全圆面积的 50%（误差 ±5%）

**断言：**

```typescript
expect(vertices).toHaveLength(13);
expect(vertices[0].azimuth).toBe(90);
expect(vertices[12].azimuth).toBe(270);
for (const v of vertices) {
  expect(v.azimuth).toBeGreaterThanOrEqual(90);
  expect(v.azimuth).toBeLessThanOrEqual(270);
}
const ratio = halfCircleArea / fullCircleArea;
expect(ratio).toBeGreaterThan(0.45);
expect(ratio).toBeLessThan(0.55);
```

---

## 二、Union 叠加（P1-U01 ~ P1-U04）

### P1-U01 — 渐进 union（N 个多边形逐步合并）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 多个多边形逐步 union 时，每步结果正确，独立水源地加入后面积正确增加 |
| **前置条件** | 3 个水源地：A(114.50, 38.05) R=500m, B(114.505, 38.05) R=300m（距A约443m，有重叠）, C(115.50, 39.50) R=200m（距A约180km，独立） |

**步骤：**

1. 构建 polyA = `buildCirclePolygon(114.50, 38.05, 500)`
2. 构建 polyB = `buildCirclePolygon(114.505, 38.05, 300)`
3. 构建 polyC = `buildCirclePolygon(115.50, 39.50, 200)`
4. 计算 areaA, areaB, areaC = `turf.area(polyX) / 1e6`
5. 第一步 union：`temp1 = turf.union(polyA, polyB)`
6. 检查 `temp1 !== null`
7. 计算 areaAfterStep1 = `turf.area(temp1) / 1e6`
8. 检查 `areaAfterStep1 < areaA + areaB`（A-B 有重叠）
9. 第二步 union：`final = turf.union(temp1, polyC)`
10. 检查 `final !== null`
11. 计算 areaFinal = `turf.area(final) / 1e6`
12. 检查 `|areaFinal - (areaAfterStep1 + areaC)| < 0.001`（C 独立，无新重叠）
13. 检查 `areaFinal < areaA + areaB + areaC`（总体有重叠）

**断言：**

```typescript
expect(temp1).not.toBeNull();
expect(areaAfterStep1).toBeLessThan(areaA + areaB);
expect(final).not.toBeNull();
expect(Math.abs(areaFinal - (areaAfterStep1 + areaC))).toBeLessThan(0.001);
expect(areaFinal).toBeLessThan(areaA + areaB + areaC);
```

---

### P1-U02 — 两个完全相同的多边形 union

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 两个完全相同的圆形 union 后面积等于单个圆面积，overlapArea 等于圆面积 |
| **前置条件** | 两个完全相同的圆 (114.50, 38.05) R=100m |

**步骤：**

1. 构建 polyA = `buildCirclePolygon(114.50, 38.05, 100)`
2. 构建 polyB = `buildCirclePolygon(114.50, 38.05, 100)`（与 polyA 完全相同）
3. 计算 areaA = `turf.area(polyA) / 1e6`
4. 调用 `turf.union(polyA, polyB)`
5. 计算 unionArea = `turf.area(unionResult) / 1e6`
6. 计算 overlapArea = `2 * areaA - unionArea`
7. 检查 `unionArea ≈ areaA`（误差 < 0.001 km²）
8. 检查 `overlapArea ≈ areaA`（误差 < 0.001 km²）

**断言：**

```typescript
expect(Math.abs(unionArea - areaA)).toBeLessThan(0.001);
expect(Math.abs(overlapArea - areaA)).toBeLessThan(0.001);
```

---

### P1-U03 — union 面积单调递增性

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 逐步加入新多边形时，union 面积单调不减（每次加入只会增加或保持面积） |
| **前置条件** | 5 个水源地：A(114.50, 38.05) R=800m, B(114.503, 38.05) R=500m, C(114.50, 38.053) R=600m, D(114.52, 38.07) R=300m, E(114.501, 38.051) R=200m |

**步骤：**

1. 构建 polyA~polyE
2. 逐步 union，记录每次合并后的面积：
   - `area_1 = turf.area(polyA) / 1e6`
   - `temp = turf.union(polyA, polyB)` → `area_2 = turf.area(temp) / 1e6`
   - `temp = turf.union(temp, polyC)` → `area_3 = turf.area(temp) / 1e6`
   - `temp = turf.union(temp, polyD)` → `area_4 = turf.area(temp) / 1e6`
   - `temp = turf.union(temp, polyE)` → `area_5 = turf.area(temp) / 1e6`
3. 检查序列满足：`area_{i+1} >= area_i - 0.001`（每次加入新多边形，union 面积不减）
4. 计算 sumArea = areaA + areaB + areaC + areaD + areaE
5. 检查 `area_5 <= sumArea + 0.001`（不超过简单相加）

**断言：**

```typescript
const areas = [area_1, area_2, area_3, area_4, area_5];
for (let i = 0; i < 4; i++) {
  expect(areas[i + 1]).toBeGreaterThanOrEqual(areas[i] - 0.001);
}
expect(area_5).toBeLessThanOrEqual(sumArea + 0.001);
```

---

### P1-U04 — union 结果几何有效性验证

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | union 返回的 GeoJSON Feature 结构完整，geometry 类型合法，坐标环闭合 |
| **前置条件** | sourceA R=500m + sourceB R=300m，部分重叠 |

**步骤：**

1. 构建 polyA = `buildCirclePolygon(114.50, 38.05, 500)`
2. 构建 polyB = `buildCirclePolygon(114.505, 38.05, 300)`
3. 调用 `turf.union(polyA, polyB)` 获取 unionResult
4. 检查 `unionResult.type === 'Feature'`
5. 检查 `unionResult.geometry.type` 为 `'Polygon'` 或 `'MultiPolygon'`
6. 若为 Polygon：
   - 检查 `geometry.coordinates` 是数组
   - 取外环 `coordinates[0]`，检查首尾闭合：`ring[0][0] === ring[ring.length-1][0] && ring[0][1] === ring[ring.length-1][1]`
7. 若为 MultiPolygon：
   - 检查 `geometry.coordinates` 是数组
   - 遍历每个 polygon，检查外环首尾闭合
8. 调用 `turf.area(unionResult)`，检查面积 > 0

**断言：**

```typescript
expect(unionResult.type).toBe('Feature');
expect(['Polygon', 'MultiPolygon']).toContain(unionResult.geometry.type);
// 闭合检查
const rings = unionResult.geometry.type === 'Polygon'
  ? [unionResult.geometry.coordinates[0]]
  : unionResult.geometry.coordinates.map(p => p[0]);
for (const ring of rings) {
  expect(ring[0]).toEqual(ring[ring.length - 1]);
}
expect(turf.area(unionResult)).toBeGreaterThan(0);
```

---

## 三、两两重叠检测（P1-P01 ~ P1-P04）

### P1-P01 — 重叠检测的对称性（A∩B === B∩A）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | `turf.intersect(polyA, polyB)` 与 `turf.intersect(polyB, polyA)` 的面积相等 |
| **前置条件** | sourceA R=500m + sourceB R=300m，部分重叠 |

**步骤：**

1. 构建 polyA = `buildCirclePolygon(114.50, 38.05, 500)`
2. 构建 polyB = `buildCirclePolygon(114.505, 38.05, 300)`
3. 调用 `turf.intersect(polyA, polyB)` 获取 intersectAB
4. 调用 `turf.intersect(polyB, polyA)` 获取 intersectBA
5. 检查 intersectAB 和 intersectBA 均不为 null
6. 计算 areaAB = `turf.area(intersectAB) / 1e6`
7. 计算 areaBA = `turf.area(intersectBA) / 1e6`
8. 检查 `|areaAB - areaBA| < 0.0001`

**断言：**

```typescript
expect(intersectAB).not.toBeNull();
expect(intersectBA).not.toBeNull();
expect(Math.abs(areaAB - areaBA)).toBeLessThan(0.0001);
```

---

### P1-P02 — 重叠对列表按面积降序排列

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | overlaps 数组按 overlapArea 降序排列，最大重叠排在最前 |
| **前置条件** | 4 个水源地 A/B/C/D，产生 3 个有重叠对：A-B, A-C, B-C |

**步骤：**

1. 构造 4 个水源地：A(114.50, 38.05) R=500m, B(114.503, 38.05) R=400m, C(114.50, 38.052) R=300m, D(116.00, 39.00) R=200m
2. 执行完整的 `detectPairwiseOverlaps([polyA, polyB, polyC, polyD], ['一级'])`
3. 获取 overlaps 数组
4. 检查 `overlaps.length === 3`（A-B, A-C, B-C 有重叠，D 独立）
5. 检查 `overlaps[0].overlapArea >= overlaps[1].overlapArea`
6. 检查 `overlaps[1].overlapArea >= overlaps[2].overlapArea`

**断言：**

```typescript
expect(overlaps).toHaveLength(3);
expect(overlaps[0].overlapArea).toBeGreaterThanOrEqual(overlaps[1].overlapArea);
expect(overlaps[1].overlapArea).toBeGreaterThanOrEqual(overlaps[2].overlapArea);
```

---

### P1-P03 — 重叠区域几何有效性

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | intersect 返回的几何是有效 Polygon，坐标环闭合，点数 ≥ 4，坐标在双方 bbox 范围内 |
| **前置条件** | sourceA R=500m + sourceB R=300m，部分重叠 |

**步骤：**

1. 构建 polyA = `buildCirclePolygon(114.50, 38.05, 500)`
2. 构建 polyB = `buildCirclePolygon(114.505, 38.05, 300)`
3. 调用 `turf.intersect(polyA, polyB)`
4. 检查 intersect 结果的 `type === 'Feature'`
5. 检查 `geometry.type` 为 `'Polygon'`
6. 取外环 `geometry.coordinates[0]`
7. 检查首尾闭合：`ring[0]` 与 `ring[ring.length - 1]` 坐标相等
8. 检查 `ring.length >= 4`（最小多边形 = 三角形 + 闭合点）
9. 计算 polyA 的 bbox：`turf.bbox(polyA)` → `[minLngA, minLatA, maxLngA, maxLatA]`
10. 计算 polyB 的 bbox：`turf.bbox(polyB)`
11. 计算交集 bbox 范围：`[Math.max(minLngA, minLngB), Math.max(minLatA, minLatB), Math.min(maxLngA, maxLngB), Math.min(maxLatA, maxLatB)]`
12. 遍历 intersect 外环所有坐标，检查每个 `[lng, lat]` 在交集 bbox 范围内

**断言：**

```typescript
expect(intersect.type).toBe('Feature');
expect(intersect.geometry.type).toBe('Polygon');
const ring = intersect.geometry.coordinates[0];
expect(ring[0]).toEqual(ring[ring.length - 1]); // 闭合
expect(ring.length).toBeGreaterThanOrEqual(4);
for (const [lng, lat] of ring) {
  expect(lng).toBeGreaterThanOrEqual(intersectBboxMinLng);
  expect(lng).toBeLessThanOrEqual(intersectBboxMaxLng);
  expect(lat).toBeGreaterThanOrEqual(intersectBboxMinLat);
  expect(lat).toBeLessThanOrEqual(intersectBboxMaxLat);
}
```

---

### P1-P04 — 过滤阈值边界（overlapArea 恰好等于阈值）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | overlapArea 在过滤阈值（0.0001 km²）附近时，引擎正确决定过滤或保留 |
| **前置条件** | 两圆 A(114.50, 38.05) R=100m, B 距 A 约 199.5m R=100m（圆心距略小于 R1+R2=200m，极小重叠） |

**步骤：**

1. 计算 latRad = `38.05 * Math.PI / 180`
2. 计算 B 的经度：`lngB = 114.50 + 199.5 / (111320 * Math.cos(latRad))`
3. 构建 polyA = `buildCirclePolygon(114.50, 38.05, 100)`
4. 构建 polyB = `buildCirclePolygon(lngB, 38.05, 100)`
5. 调用 `turf.intersect(polyA, polyB)`
6. 若 intersect 不为 null：
   - 计算 overlapArea = `turf.area(intersect) / 1e6`
   - 检查 `overlapArea < 0.001`（极小重叠）
7. 若 `overlapArea < 0.0001`：检查该对被引擎过滤到 overlaps 之外
8. 若 `overlapArea >= 0.0001`：检查该对保留在 overlaps 中

**断言：**

```typescript
if (intersect) {
  const overlapArea = turf.area(intersect) / 1e6;
  expect(overlapArea).toBeLessThan(0.001);
  // 阈值过滤行为
  if (overlapArea < 0.0001) {
    expect(overlaps.find(o => o.sourceAId === 'src-A' && o.sourceBId === 'src-B')).toBeUndefined();
  } else {
    expect(overlaps.find(o => o.sourceAId === 'src-A' && o.sourceBId === 'src-B')).toBeDefined();
  }
}
```

---

## 五、异常输入与边界（P1-A01 ~ P1-A04）

### P1-A01 — 极大半径（超过河北省范围）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | R=50000m（50km）时不崩溃，面积计算正确，warnings 提示半径偏大 |
| **前置条件** | 构造 R=50000m 的圆形保护区 |

**步骤：**

1. 调用 `generateCircleVertices(114.50, 38.05, 50000, 24)`
2. 检查 vertices 生成成功（不抛出异常）
3. 构建 polygon，计算 area = `turf.area(polygon) / 1e6`
4. 检查 `area ≈ Math.PI * 50000 * 50000 / 1e6 = 7853.98 km²`（误差 < 1 km²）
5. 构造 zoneRecord：`{ zones: [{ level: '一级', radius: 50000, area: 7853.98, ... }] }`
6. 调用 `runOverlayAnalysis([sourceA], [largeRecord], { sourceIds: ['src-A'], levels: ['一级'], ... })`
7. 检查不抛出异常
8. 检查 `result.levels[0].unionArea > 0`
9. 检查 warnings 包含"半径异常偏大"提示

**断言：**

```typescript
expect(vertices.length).toBe(24);
expect(Math.abs(area - 7853.98)).toBeLessThan(1);
expect(result.levels[0].unionArea).toBeGreaterThan(0);
expect(result.warnings.some(w => w.includes('半径异常偏大'))).toBe(true);
```

---

### P1-A02 — 坐标在河北省边界

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 河北省最南端和最北端的坐标正常工作，union 返回 MultiPolygon |
| **前置条件** | sourceSouth: lng=114.30, lat=36.00, R=100m；sourceNorth: lng=117.00, lat=42.50, R=200m |

**步骤：**

1. 调用 `generateCircleVertices(114.30, 36.00, 100, 24)` 获取南方 vertices
2. 调用 `generateCircleVertices(117.00, 42.50, 200, 24)` 获取北方 vertices
3. 检查两组 vertices 均生成成功
4. 构建 polySouth 和 polyNorth
5. 调用 `turf.union(polySouth, polyNorth)`
6. 检查 union 结果不为 null
7. 检查 `unionResult.geometry.type === 'MultiPolygon'`（远距离 → 多面体）
8. 计算 unionArea = `turf.area(unionResult) / 1e6`
9. 计算 sumArea = areaSouth + areaNorth
10. 检查 `|unionArea - sumArea| < 0.001`（不重叠则相等）

**断言：**

```typescript
expect(vertsSouth.length).toBe(24);
expect(vertsNorth.length).toBe(24);
expect(unionResult).not.toBeNull();
expect(unionResult.geometry.type).toBe('MultiPolygon');
expect(Math.abs(unionArea - sumArea)).toBeLessThan(0.001);
```

---

### P1-A03 — WaterSourceRecord 的 optional 字段缺失

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 水源地只有必填字段（无 subType/population/river/remark）时引擎正常工作 |
| **前置条件** | 构造最小 WaterSourceRecord |

**步骤：**

1. 构造最小 sourceA：`{ id: 'src-A', cityName: '石家庄市', name: '水源地A', type: '地下水', county: '正定县', level: 'county', status: '在用', lng: 114.50, lat: 38.05 }`（无 subType, population, river, remark）
2. 构造对应的 recordA（有 zones 和 area）
3. 调用 `runOverlayAnalysis([sourceA], [recordA], { sourceIds: ['src-A'], levels: ['一级'], ... })`
4. 检查不抛出异常
5. 检查 `result.sourceCount === 1`
6. 检查 `result.summary.cities` 包含 '石家庄市'

**断言：**

```typescript
expect(result.sourceCount).toBe(1);
expect(result.summary.cities).toContain('石家庄市');
```

---

### P1-A04 — CalcParams 的 sourceType 为"地表水"但 zone 是圆形

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 引擎按 ZoneResult 字段（radius/length/riverExt/lakeExt）选择生成方式，不依赖 params.sourceType |
| **前置条件** | 构造 params.sourceType = '地表水'，但 zones[0] 有 radius 无 length/width/riverExt/lakeExt |

**步骤：**

1. 构造混合 record：`{ params: { sourceType: '地表水' }, zones: [{ level: '一级', method: '经验值法', formula: 'R=300m', radius: 300, area: 0.2827, boundaryDescription: 'test', keyParams: 'test', standard: 'HJ 338-2018' }] }`
2. 调用 `generateSourceZoneVertices('src-A', '水源地A', 114.50, 38.05, zones, 24)`
3. 检查引擎走 `zone.radius` 分支（圆形），而非河流/湖库分支
4. 检查 `result.zones[0].vertices.length === 24`（圆形顶点数）
5. 构建 polygon，检查面积 > 0
6. 检查面积 ≈ `Math.PI * 300 * 300 / 1e6 = 0.2827 km²`

**断言：**

```typescript
expect(result.zones[0].vertices.length).toBe(24); // 走圆形分支
expect(turf.area(polygon) / 1e6).toBeCloseTo(0.2827, 2);
```

---

## 七、导出功能（P1-X01 ~ P1-X03）

### P1-X01 — Excel Sheet3 各水源地面积表数据完整

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | Sheet3 行数 = 水源地数，字段完整，数值与输入一致 |
| **前置条件** | sourceA + sourceB + sourceC，3 个级别，执行完整叠加分析 |

**步骤：**

1. 执行 `runOverlayAnalysis([sourceA, sourceB, sourceC], [recordA, recordB, recordC], { sourceIds: ['src-A','src-B','src-C'], levels: ['一级','二级','准保护区'], analysisName: '测试' })`
2. mock `import('xlsx')`，捕获 `XLSX.utils.json_to_sheet` 的第 3 次调用输入（Sheet3）
3. 检查数据行数 = 3
4. 检查每行包含字段：`水源地名称`、`城市`、`类型`、`一级面积`、`二级面积`、`准保护区面积`
5. 检查第 1 行 `水源地名称 === '水源地A'`
6. 检查第 1 行 `城市 === '石家庄市'`
7. 检查第 1 行 `一级面积 === recordA.zones.find(z => z.level === '一级').area`
8. 检查第 2 行 `水源地名称 === '水源地B'`
9. 检查第 3 行 `水源地名称 === '水源地C'`，`城市 === '保定市'`

**断言：**

```typescript
expect(sheet3Data).toHaveLength(3);
expect(sheet3Data[0].水源地名称).toBe('水源地A');
expect(sheet3Data[0].城市).toBe('石家庄市');
expect(sheet3Data[0].一级面积).toBe(recordA.zones.find(z => z.level === '一级')!.area);
expect(sheet3Data[2].城市).toBe('保定市');
```

---

### P1-X02 — GeoJSON 导出坐标有效性

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 导出的 GeoJSON 格式正确，坐标为 [lng, lat]，全部在河北省范围内 |
| **前置条件** | sourceA + sourceB，levels=['一级']，有重叠 |

**步骤：**

1. 执行叠加分析获取 result
2. 提取 `result.levels[0].unionGeometry`
3. 检查 `unionGeometry.type === 'FeatureCollection'`
4. 检查 `unionGeometry.features` 数组非空
5. 遍历每个 feature 的 `geometry.coordinates`
6. 提取所有坐标点 `[lng, lat]`
7. 检查每个 `lng` ∈ [113, 120]（河北省经度范围）
8. 检查每个 `lat` ∈ [35, 43]（河北省纬度范围）

**断言：**

```typescript
expect(unionGeometry.type).toBe('FeatureCollection');
expect(unionGeometry.features.length).toBeGreaterThan(0);
for (const feature of unionGeometry.features) {
  const coords = feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates[0]
    : feature.geometry.coordinates.flatMap(p => p[0]);
  for (const [lng, lat] of coords) {
    expect(lng).toBeGreaterThanOrEqual(113);
    expect(lng).toBeLessThanOrEqual(120);
    expect(lat).toBeGreaterThanOrEqual(35);
    expect(lat).toBeLessThanOrEqual(43);
  }
}
```

---

### P1-X03 — Excel 列宽配置合理

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 每个 Sheet 的 `!cols` 配置存在且列宽合理 |
| **前置条件** | 同 P1-X01 |

**步骤：**

1. 捕获 3 个 Sheet 的 ws 对象
2. 对每个 ws 检查 `ws['!cols']` 存在且为数组
3. 遍历每列配置，检查 `col.wch > 0`
4. 检查水源地名称列的 `wch >= 20`（中文名称需要宽度）
5. 检查面积数值列的 `wch >= 12`

**断言：**

```typescript
for (const ws of [ws1, ws2, ws3]) {
  expect(ws['!cols']).toBeDefined();
  expect(Array.isArray(ws['!cols'])).toBe(true);
  for (const col of ws['!cols']) {
    expect(col.wch).toBeGreaterThan(0);
  }
}
// 名称列宽 >= 20
expect(ws3['!cols'][0].wch).toBeGreaterThanOrEqual(20);
```

---

## 九、数据完整性与损坏（P1-D01 ~ P1-D04）

### P1-D01 — area 与 radius 不一致

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 引擎以 radius 生成的几何面积为准，zone.area 不参与叠加计算 |
| **前置条件** | 构造 zoneRecord，radius=100m（理论面积 0.0314 km²），但 area=0.5 |

**步骤：**

1. 构造不一致的 record：`{ zones: [{ level: '一级', method: '经验值法', formula: 'R=100m', radius: 100, area: 0.5, boundaryDescription: 'test', keyParams: 'test', standard: 'HJ 338-2018' }] }`
2. 调用 `generateSourceZoneVertices('src-A', '水源地A', 114.50, 38.05, zones, 24)`
3. 检查引擎按 radius 生成 24 个顶点
4. 构建 polygon，计算 turfArea = `turf.area(polygon) / 1e6`
5. 检查 `turfArea ≈ 0.0314`（按 radius 计算），而非 0.5
6. 调用 `runOverlayAnalysis([sourceA], [inconsistentRecord], { sourceIds: ['src-A'], levels: ['一级'], ... })`
7. 检查 `result.levels[0].unionArea` 基于 turfArea 而非 zone.area
8. 检查 warnings 提示"面积(0.5)与半径(100m)计算值(0.0314)不一致"

**断言：**

```typescript
expect(result.zones[0].vertices.length).toBe(24);
expect(Math.abs(turfArea - 0.0314)).toBeLessThan(0.001);
expect(Math.abs(result.levels[0].unionArea - turfArea)).toBeLessThan(0.001);
expect(result.warnings.some(w => w.includes('不一致'))).toBe(true);
```

---

### P1-D02 — method 字段为非标准值

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | method 为非标准值时不影响几何计算和叠加结果 |
| **前置条件** | 构造 zone.method = '未知方法' |

**步骤：**

1. 构造异常 method 的 record：`{ zones: [{ ...makeZone('一级', 100), method: '未知方法' as any }] }`
2. 调用 `runOverlayAnalysis([sourceA], [badMethodRecord], { sourceIds: ['src-A'], levels: ['一级'], ... })`
3. 检查不抛出异常
4. 检查 `result.levels[0].unionArea > 0`
5. 检查 warnings 不包含 method 相关的错误

**断言：**

```typescript
expect(result.levels[0].unionArea).toBeGreaterThan(0);
expect(result.warnings.some(w => w.includes('method'))).toBe(false);
```

---

### P1-D03 — standard 字段缺失

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | standard 为空字符串时不影响引擎和导出 |
| **前置条件** | 构造 zone.standard = '' |

**步骤：**

1. 构造无 standard 的 record：`{ zones: [{ ...makeZone('一级', 100), standard: '' }] }`
2. 调用 `runOverlayAnalysis([sourceA], [noStdRecord], { sourceIds: ['src-A'], levels: ['一级'], ... })`
3. 检查不抛出异常
4. 检查 `result.levels[0].unionArea > 0`
5. 调用导出函数（mock xlsx）
6. 检查导出不崩溃

**断言：**

```typescript
expect(result.levels[0].unionArea).toBeGreaterThan(0);
// 导出不崩溃
expect(() => handleExportExcel(result)).not.toThrow();
```

---

### P1-D04 — calculatedAt 格式异常

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | calculatedAt 为非日期字符串时不导致崩溃 |
| **前置条件** | 构造 zoneRecord.calculatedAt = 'not-a-date' |

**步骤：**

1. 构造异常日期的 record：`{ ...recordA, calculatedAt: 'not-a-date' }`
2. 调用 `runOverlayAnalysis([sourceA], [badDateRecord], { sourceIds: ['src-A'], levels: ['一级'], ... })`
3. 检查不抛出异常
4. 检查 `result.createdAt` 是有效 ISO 字符串（引擎用当前时间覆盖或保留原始值）
5. 调用导出函数，检查日期列不崩溃

**断言：**

```typescript
expect(() => runOverlayAnalysis(...)).not.toThrow();
expect(result.createdAt).toBeTruthy();
expect(() => handleExportExcel(result)).not.toThrow();
```

---

## 十、几何退化与拓扑（P1-T01 ~ P1-T04）

### P1-T01 — 极窄矩形保护区（河流型 width=1m）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 极窄河流矩形（bankWidth=1m）构建成功，面积合理，叠加不崩溃 |
| **前置条件** | 河流型保护区 upstream=5000m, downstream=1000m, bankWidth=1m |

**步骤：**

1. 调用 `generateRiverVertices(114.50, 38.05, 5000, 1000, 1, 90)`
2. 检查 `vertices.length === 8`
3. 构建 polygon
4. 计算 area = `turf.area(polygon) / 1e6`
5. 检查 area ≈ `(5000 + 1000) * 2 / 1e6 = 0.012 km²`（长 6000m × 宽 2m）
6. 构建圆形 polyCircle = `buildCirclePolygon(114.50, 38.05, 500)`
7. 调用 `turf.intersect(polyNarrow, polyCircle)`
8. 检查不崩溃

**断言：**

```typescript
expect(vertices).toHaveLength(8);
expect(area).toBeCloseTo(0.012, 2);
expect(() => turf.intersect(polyNarrow, polyCircle)).not.toThrow();
```

---

### P1-T02 — 两个圆心完全重合的保护区

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 圆心完全重合时 intersect = 小圆，union = 大圆 |
| **前置条件** | sourceA 和 sourceB 的 lng/lat 完全相同 (114.50, 38.05)，R_A=500m, R_B=300m |

**步骤：**

1. 构建 polyA = `buildCirclePolygon(114.50, 38.05, 500)`
2. 构建 polyB = `buildCirclePolygon(114.50, 38.05, 300)`
3. 计算 areaA, areaB
4. 调用 `turf.intersect(polyA, polyB)`
5. 检查 intersect 不为 null
6. 计算 overlapArea = `turf.area(intersect) / 1e6`
7. 检查 `overlapArea ≈ areaB`（小圆完全在大圆内，误差 < 0.001）
8. 调用 `turf.union(polyA, polyB)`
9. 计算 unionArea = `turf.area(unionResult) / 1e6`
10. 检查 `unionArea ≈ areaA`（大圆面积，误差 < 0.001）

**断言：**

```typescript
expect(intersect).not.toBeNull();
expect(Math.abs(overlapArea - areaB)).toBeLessThan(0.001);
expect(Math.abs(unionArea - areaA)).toBeLessThan(0.001);
```

---

### P1-T03 — 三个嵌套保护区（同心圆 R=100/300/500）

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 三个同心圆 union = 最大圆，每对 intersect = 较小圆 |
| **前置条件** | 三个水源地圆心相同 (114.50, 38.05)，R 分别为 100m/300m/500m |

**步骤：**

1. 构建 polyA(R=100), polyB(R=300), polyC(R=500)
2. 计算 areaA, areaB, areaC
3. 逐步 union：`temp = turf.union(polyA, polyB)` → `final = turf.union(temp, polyC)`
4. 计算 unionArea = `turf.area(final) / 1e6`
5. 检查 `unionArea ≈ areaC`（最大圆，误差 < 0.001）
6. 对每对执行 intersect：
   - A∩B：检查 overlapArea ≈ areaA
   - A∩C：检查 overlapArea ≈ areaA
   - B∩C：检查 overlapArea ≈ areaB

**断言：**

```typescript
expect(Math.abs(unionArea - areaC)).toBeLessThan(0.001);
expect(Math.abs(overlapAB - areaA)).toBeLessThan(0.001);
expect(Math.abs(overlapAC - areaA)).toBeLessThan(0.001);
expect(Math.abs(overlapBC - areaB)).toBeLessThan(0.001);
```

---

### P1-T04 — 共享顶点的两个多边形

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 共享一条边的两个正方形 intersect 面积 ≈ 0，union 正确合并为大多边形 |
| **前置条件** | 构造两个正方形共享一条边 |

**步骤：**

1. 定义 baseLng=114.50, baseLat=38.05，每单位偏移 ≈ 0.001°
2. 构造 polyA 坐标：`[[114.500, 38.050], [114.502, 38.050], [114.502, 38.052], [114.500, 38.052], [114.500, 38.050]]`
3. 构造 polyB 坐标（共享边 x=114.502）：`[[114.502, 38.050], [114.504, 38.050], [114.504, 38.052], [114.502, 38.052], [114.502, 38.050]]`
4. 构建 `polyA = turf.polygon([coordsA])`，`polyB = turf.polygon([coordsB])`
5. 调用 `turf.intersect(polyA, polyB)`
6. 检查 intersect 为 null 或面积 < 0.0001（共享边无面积交集）
7. 调用 `turf.union(polyA, polyB)`
8. 计算 unionArea = `turf.area(unionResult) / 1e6`
9. 计算 sumArea = areaA + areaB
10. 检查 `|unionArea - sumArea| < 0.001`（无重叠则相等）
11. 检查 union 结果为单个 Polygon（合并后是 4×2 矩形）

**断言：**

```typescript
// intersect 面积 ≈ 0
if (intersect) {
  expect(turf.area(intersect) / 1e6).toBeLessThan(0.0001);
}
// union 正确合并
expect(Math.abs(unionArea - sumArea)).toBeLessThan(0.001);
expect(unionResult.geometry.type).toBe('Polygon'); // 合并为单个矩形
```

---

## 十三、导出异常（P1-E01 ~ P1-E02）

### P1-E01 — overlaps 为空时 Excel Sheet2 导出空表

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 无重叠对时 Sheet2 导出空表（仅表头），Sheet1/Sheet3 正常，不崩溃 |
| **前置条件** | 仅 1 个水源地，无重叠对 |

**步骤：**

1. 执行 `runOverlayAnalysis([sourceA], [recordA], { sourceIds: ['src-A'], levels: ['一级'], analysisName: '单水源地' })`
2. 检查 `result.overlaps.length === 0`
3. 调用导出函数（mock xlsx）
4. 捕获 Sheet2 的 `json_to_sheet` 输入
5. 检查 Sheet2 数据为空数组 `[]` 或仅含表头
6. 检查 Sheet1 和 Sheet3 数据正常（非空）
7. 检查不抛出异常
8. 检查 `toast.success` 被调用

**断言：**

```typescript
expect(result.overlaps).toHaveLength(0);
expect(sheet2Data).toHaveLength(0); // 空表
expect(sheet1Data.length).toBeGreaterThan(0); // Sheet1 正常
expect(sheet3Data.length).toBeGreaterThan(0); // Sheet3 正常
expect(toast.success).toHaveBeenCalled();
```

---

### P1-E02 — 水源地缺少某级别时 Sheet3 对应列为空

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **验证目标** | 水源地缺少准保护区时，Sheet3 该行的准保护区面积为空或 0，不崩溃 |
| **前置条件** | sourceA 只有一级和二级（无准保护区），sourceB 有全部三个级别 |

**步骤：**

1. 构造 recordA_partial：`{ zones: [makeZone('一级', 100), makeZone('二级', 1000)] }`（无准保护区）
2. 构造 recordB_full：`{ zones: [makeZone('一级', 50), makeZone('二级', 800), makeZone('准保护区', 1200)] }`
3. 执行 `runOverlayAnalysis([sourceA, sourceB], [recordA_partial, recordB_full], { sourceIds: ['src-A','src-B'], levels: ['一级','二级','准保护区'], analysisName: '测试' })`
4. 调用导出函数（mock xlsx）
5. 捕获 Sheet3 数据
6. 检查 sourceA 行的 `准保护区面积` 为空字符串、0 或 undefined
7. 检查 sourceB 行的 `准保护区面积` 为正常数值（> 0）
8. 检查不抛出异常

**断言：**

```typescript
const rowA = sheet3Data.find(r => r.水源地名称 === '水源地A');
const rowB = sheet3Data.find(r => r.水源地名称 === '水源地B');
expect(!rowA.准保护区面积 || rowA.准保护区面积 === 0 || rowA.准保护区面积 === '').toBe(true);
expect(rowB.准保护区面积).toBeGreaterThan(0);
```

---

## 附录：新增 P1 用例索引

| 编号 | 分组 | 测试名称 | 核心验证目标 |
|------|------|---------|------------|
| P1-G01 | 几何构建 | 自定义顶点数（非默认 24） | vertexCount 参数生效，面积精度提升 |
| P1-G02 | 几何构建 | 方位角序列从正北顺时针递增 | 24 点方位角严格 15° 步长 |
| P1-G03 | 几何构建 | 坐标精度 6 位小数一致性 | 截断后仍闭合 |
| P1-G04 | 几何构建 | 河流型方位角参数生效 | azimuth 控制走向，南北/东西向验证 |
| P1-G05 | 几何构建 | 湖库型岸边取水生成半圆顶点 | 13 点半圆，方位角 90°~270° |
| P1-U01 | Union 叠加 | 渐进 union（N 个多边形逐步合并） | 每步正确，独立源正确增加 |
| P1-U02 | Union 叠加 | 两个完全相同的多边形 union | union = 原始，overlap = 全部 |
| P1-U03 | Union 叠加 | union 面积单调递增性 | 逐步加入面积不减 |
| P1-U04 | Union 叠加 | union 结果几何有效性验证 | GeoJSON 结构完整，环闭合 |
| P1-P01 | 两两重叠检测 | 重叠检测的对称性 | A∩B === B∩A |
| P1-P02 | 两两重叠检测 | 重叠对列表按面积降序排列 | 排序正确 |
| P1-P03 | 两两重叠检测 | 重叠区域几何有效性 | 有效 Polygon，坐标在 bbox 内 |
| P1-P04 | 两两重叠检测 | 过滤阈值边界 | 阈值附近正确过滤/保留 |
| P1-A01 | 异常输入与边界 | 极大半径（超过河北省范围） | 不崩溃，warnings 提示 |
| P1-A02 | 异常输入与边界 | 坐标在河北省边界 | 边界坐标正常，MultiPolygon |
| P1-A03 | 异常输入与边界 | WaterSourceRecord 的 optional 字段缺失 | 不依赖 optional 字段 |
| P1-A04 | 异常输入与边界 | sourceType 与 zone 类型不匹配 | 按 ZoneResult 字段选择生成方式 |
| P1-X01 | 导出功能 | Excel Sheet3 各水源地面积表数据完整 | 行数/字段/数值一致 |
| P1-X02 | 导出功能 | GeoJSON 导出坐标有效性 | [lng, lat] 格式，河北省范围 |
| P1-X03 | 导出功能 | Excel 列宽配置合理 | !cols 存在，关键列宽合理 |
| P1-D01 | 数据完整性与损坏 | area 与 radius 不一致 | 以 radius 几何为准 |
| P1-D02 | 数据完整性与损坏 | method 字段为非标准值 | 不影响计算 |
| P1-D03 | 数据完整性与损坏 | standard 字段缺失 | 不影响引擎和导出 |
| P1-D04 | 数据完整性与损坏 | calculatedAt 格式异常 | 不崩溃 |
| P1-T01 | 几何退化与拓扑 | 极窄矩形保护区（width=1m） | 构建成功，叠加不崩溃 |
| P1-T02 | 几何退化与拓扑 | 两个圆心完全重合的保护区 | intersect = 小圆，union = 大圆 |
| P1-T03 | 几何退化与拓扑 | 三个嵌套保护区（同心圆） | union = 最大圆，intersect = 较小圆 |
| P1-T04 | 几何退化与拓扑 | 共享顶点的两个多边形 | intersect ≈ 0，union 合并 |
| P1-E01 | 导出异常 | overlaps 为空时 Sheet2 导出空表 | 空表不崩溃，其他 Sheet 正常 |
| P1-E02 | 导出异常 | 水源地缺少某级别时 Sheet3 对应列为空 | 缺失列空/0，不崩溃 |

---

## 统计总览

| 测试组 | P0 | 新增 P1 | 已有 P1 | P1 小计 | 总计 |
|--------|----|---------|---------|---------|---------|
| 一、几何构建 | 8 | 5 | 0 | 5 | 13 |
| 二、Union 叠加 | 9 | 4 | 0 | 4 | 13 |
| 三、两两重叠检测 | 10 | 4 | 0 | 4 | 14 |
| 四、面积统计与汇总 | 3 | 0 | 5 | 5 | 8 |
| 五、异常输入与边界 | 8 | 4 | 0 | 4 | 12 |
| 六、OverlayStore | 3 | 0 | 3 | 3 | 6 |
| 七、导出功能 | 2 | 3 | 0 | 3 | 5 |
| 八、集成与回归 | 2 | 0 | 2 | 2 | 4 |
| 九、数据完整性与损坏 | 6 | 4 | 0 | 4 | 10 |
| 十、几何退化与拓扑 | 6 | 4 | 0 | 4 | 10 |
| 十一、数值精度 | 2 | 0 | 3 | 3 | 5 |
| 十二、并发与状态 | 2 | 0 | 3 | 3 | 5 |
| 十三、导出异常 | 1 | 2 | 0 | 2 | 3 |
| 十四、混合类型 | 2 | 0 | 1 | 1 | 3 |
| **合计** | **66** | **30** | **17** | **47** | **119** |
