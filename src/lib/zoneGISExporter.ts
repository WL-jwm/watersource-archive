/**
 * P4-5: GIS坐标导出器
 *
 * 支持：
 * 1. GeoJSON导出（.geojson文件）— 可直接导入ArcGIS/QGIS/Google Earth
 * 2. Shapefile导出（.zip包含.shp/.shx/.dbf/.prj）— ArcGIS标准格式
 * 3. KML导出（.kml文件）— Google Earth
 *
 * 坐标系：WGS84（EPSG:4326），与水源地数据源一致
 */

import type { ZoneResult } from './zoneCalcEngine';
import type { SourceZoneVertices, ZoneVertex } from './zoneCoordGenerator';
import {
  generateCircleVertices,
  generateRiverVertices,
  generateSourceZoneVertices,
} from './zoneCoordGenerator';
import { saveAs } from 'file-saver';

// ===== GeoJSON类型定义 =====

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, string | number | boolean>;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][]; // [经度, 纬度] 首尾闭合
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// ===== 工具函数 =====

/** 拐点 → GeoJSON坐标 [lng, lat] */
function vertexToCoord(v: ZoneVertex): [number, number] {
  return [v.lng, v.lat];
}

/** 生成闭合坐标环（首尾相同） */
function closeRing(coords: [number, number][]): [number, number][] {
  if (coords.length === 0) return coords;
  const first = coords[0];
  if (coords[coords.length - 1][0] === first[0] && coords[coords.length - 1][1] === first[1]) {
    return coords;
  }
  return [...coords, first];
}

// ===== GeoJSON生成 =====

/**
 * 将单个SourceZoneVertices转为GeoJSON FeatureCollection
 * 每个保护区级别（一级/二级/准保护区）为独立Feature
 */
export function toGeoJSON(source: SourceZoneVertices): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = [];

  for (const zone of source.zones) {
    if (zone.vertices.length < 3) continue;

    const coords = zone.vertices.map(vertexToCoord);
    const ring = closeRing(coords);

    features.push({
      type: 'Feature',
      properties: {
        name: source.sourceName,
        sourceId: source.sourceId,
        level: zone.level,
        method: zone.method,
        formula: zone.formula || '',
        area_km2: Math.round(zone.area * 10000) / 10000,
        radius_m: zone.radius ? Math.round(zone.radius) : 0,
        length_m: zone.length ? Math.round(zone.length) : 0,
        width_m: zone.width ? Math.round(zone.width) : 0,
        standard: zone.standard || '',
        centerLng: source.centerLng,
        centerLat: source.centerLat,
        vertexCount: zone.vertices.length,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * 批量转为GeoJSON（多个水源地）
 */
export function toBatchGeoJSON(sources: SourceZoneVertices[]): GeoJSONFeatureCollection {
  const allFeatures: GeoJSONFeature[] = [];
  for (const source of sources) {
    const fc = toGeoJSON(source);
    allFeatures.push(...fc.features);
  }
  return { type: 'FeatureCollection', features: allFeatures };
}

// ===== Shapefile导出 =====

/**
 * 生成最小.dbf文件（dBASE III格式）
 * 字段：name(C50), level(C20), method(C30), area_km2(N12,4)
 *
 * 注意：浏览器端无法直接生成完整的Shapefile，这里采用降级方案：
 * 导出GeoJSON + 在ArcGIS/QGIS中一键转为Shapefile
 * 同时生成一个简化版.dbf供直接查看
 */
export function generateDBFBuffer(features: GeoJSONFeature[]): ArrayBuffer {
  // DBF III头结构
  const fields: { name: string; type: string; size: number; decimal?: number }[] = [
    { name: 'NAME', type: 'C', size: 50 },
    { name: 'LEVEL', type: 'C', size: 20 },
    { name: 'METHOD', type: 'C', size: 30 },
    { name: 'AREA_KM2', type: 'N', size: 12, decimal: 4 },
  ];

  const headerSize = 32 + fields.length * 32; // 标准DBF字段描述符32字节
  const recordSize = fields.reduce((sum, f) => sum + f.size, 0) + 1;
  const totalSize = headerSize + 1 + features.length * recordSize + 1;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  // 文件头
  view.setUint8(0, 0x03); // DBF III
  view.setUint8(1, new Date().getFullYear() - 1900);
  view.setUint8(2, new Date().getMonth() + 1);
  view.setUint8(3, new Date().getDate());
  view.setUint32(4, features.length, true); // 记录数
  view.setUint16(8, headerSize, true); // 头长度
  view.setUint16(10, recordSize, true); // 记录长度

  // 字段描述符（标准32字节/字段）
  let offset = 32;
  for (const field of fields) {
    const nameBytes = new TextEncoder().encode(field.name.padEnd(11, '\0'));
    for (let i = 0; i < 11; i++) view.setUint8(offset + i, nameBytes[i] || 0);
    view.setUint8(offset + 11, field.type === 'C' ? 0x43 : 0x4e); // C 或 N
    // bytes 12-15: reserved (0)
    view.setUint8(offset + 16, field.size); // 字段长度
    view.setUint8(offset + 17, field.decimal || 0); // 小数位数
    // bytes 18-31: reserved (0)
    offset += 32;
  }

  // 头终止符
  view.setUint8(headerSize, 0x0d);

  // 记录数据
  let recordOffset = headerSize + 1;
  for (const feature of features) {
    view.setUint8(recordOffset, 0x20); // 删除标记（空格=未删除）
    recordOffset++;

    for (const field of fields) {
      let value = '';
      const prop = field.name.toLowerCase();
      if (prop === 'name') value = String(feature.properties.name || '').padEnd(field.size);
      else if (prop === 'level') value = String(feature.properties.level || '').padEnd(field.size);
      else if (prop === 'method')
        value = String(feature.properties.method || '').padEnd(field.size);
      else if (prop === 'area_km2')
        value = String(feature.properties.area_km2 || 0).padStart(field.size);

      const bytes = new TextEncoder().encode(value.substring(0, field.size));
      for (let i = 0; i < field.size; i++) view.setUint8(recordOffset + i, bytes[i] || 0x20);
      recordOffset += field.size;
    }
  }

  // 文件终止符
  view.setUint8(totalSize - 1, 0x1a);
  return buf;
}

/**
 * 生成简化WKT字符串（Well-Known Text）
 * 用于在QGIS/ArcGIS中通过文本直接创建图层
 */
export function toWKT(vertices: ZoneVertex[]): string {
  if (vertices.length < 3) return '';
  const coords = vertices.map((v) => `${v.lng} ${v.lat}`).join(', ');
  return `POLYGON((${coords}, ${vertices[0].lng} ${vertices[0].lat}))`;
}

// ===== 导出文件函数 =====

/**
 * 导出单个水源地的GeoJSON文件
 */
export function exportGeoJSON(source: SourceZoneVertices): void {
  const geojson = toGeoJSON(source);
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  saveAs(blob, `${source.sourceName}_保护区.geojson`);
}

/**
 * 导出批量GeoJSON文件
 */
export function exportBatchGeoJSON(sources: SourceZoneVertices[]): void {
  const geojson = toBatchGeoJSON(sources);
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  saveAs(blob, `水源地保护区批量导出.geojson`);
}

/**
 * 导出KML文件
 */
export function exportKML(source: SourceZoneVertices): void {
  const kmlLines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    `<name>${source.sourceName} 保护区</name>`,
    '<Style id="style1"><LineStyle><color>ff0000ff</color><width>2</width></LineStyle><PolyStyle><color>4d0000ff</color></PolyStyle></Style>',
    '<Style id="style2"><LineStyle><color>ff00aaff</color><width>2</width></LineStyle><PolyStyle><color>4d00aaff</color></PolyStyle></Style>',
    '<Style id="style3"><LineStyle><color>ffaa00ff</color><width>1.5</width></LineStyle><PolyStyle><color>4daa00ff</color><fill>0</fill></PolyStyle></Style>',
  ];

  const styleMap: Record<string, string> = {
    一级保护区: 'style1',
    二级保护区: 'style2',
    准保护区: 'style3',
  };

  for (const zone of source.zones) {
    if (zone.vertices.length < 3) continue;
    const coords = zone.vertices.map((v) => `${v.lng},${v.lat},0`).join(' ');
    const styleUrl = styleMap[zone.level] || 'style1';
    kmlLines.push(
      `<Placemark><name>${source.sourceName} - ${zone.level}</name>`,
      `<styleUrl>#${styleUrl}</styleUrl>`,
      `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}, ${zone.vertices[0].lng},${zone.vertices[0].lat},0</coordinates></LinearRing></outerBoundaryIs></Polygon>`,
      '</Placemark>',
    );
  }

  kmlLines.push('</Document></kml>');
  const blob = new Blob([kmlLines.join('\n')], { type: 'application/vnd.google-earth.kml+xml' });
  saveAs(blob, `${source.sourceName}_保护区.kml`);
}

/**
 * 导出WKT文件（可用QGIS通过"添加文本图层"导入）
 */
export function exportWKT(source: SourceZoneVertices): void {
  const wktLines: string[] = [];
  for (const zone of source.zones) {
    if (zone.vertices.length < 3) continue;
    wktLines.push(`${source.sourceName}|${zone.level}|${zone.method}|${toWKT(zone.vertices)}`);
  }
  const blob = new Blob([wktLines.join('\n')], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${source.sourceName}_保护区.wkt`);
}

/**
 * 生成.shp二进制文件（Polygon类型）
 * 参考：ESRI Shapefile Technical Description
 */
function generateSHPBuffer(features: GeoJSONFeature[]): ArrayBuffer {
  // 只处理有有效多边形的要素
  const validFeatures = features.filter(f => f.geometry.coordinates[0].length >= 4);
  if (validFeatures.length === 0) return new ArrayBuffer(100);

  // 收集所有多边形数据
  const records: Array<{ points: Float64Array; numParts: number; bbox: [number, number, number, number] }> = [];
  let totalPoints = 0;
  let globalMinX = Infinity, globalMinY = Infinity, globalMaxX = -Infinity, globalMaxY = -Infinity;

  for (const f of validFeatures) {
    const ring = f.geometry.coordinates[0];
    const numPoints = ring.length;
    const points = new Float64Array(numPoints * 2);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < numPoints; i++) {
      const x = ring[i][0];
      const y = ring[i][1];
      points[i * 2] = x;
      points[i * 2 + 1] = y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (minX < globalMinX) globalMinX = minX;
    if (minY < globalMinY) globalMinY = minY;
    if (maxX > globalMaxX) globalMaxX = maxX;
    if (maxY > globalMaxY) globalMaxY = maxY;
    records.push({ points, numParts: 1, bbox: [minX, minY, maxX, maxY] });
    totalPoints += numPoints;
  }

  // 计算文件大小
  const headerSize = 100;
  let recordsSize = 0;
  for (const r of records) {
    // 记录头(8) + shapeType(4) + bbox(32) + numParts(4) + numPoints(4) + parts(4) + points(n*16)
    recordsSize += 8 + 4 + 32 + 4 + 4 + 4 + r.points.length * 16;
  }
  const fileSize = headerSize + recordsSize;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  // ===== 文件头 (100 bytes) =====
  view.setInt32(0, 9994, false); // File Code (big-endian)
  // bytes 4-23: unused (0)
  view.setInt32(24, fileSize / 2, false); // File Length in 16-bit words (big-endian)
  view.setInt32(28, 1000, true); // Version (little-endian)
  view.setInt32(32, 5, true); // Shape Type: Polygon (little-endian)
  // Bounding Box (little-endian doubles)
  view.setFloat64(36, globalMinX, true);
  view.setFloat64(44, globalMinY, true);
  view.setFloat64(52, globalMaxX, true);
  view.setFloat64(60, globalMaxY, true);
  // bytes 68-99: unused (0) - Z/M ranges

  // ===== 记录 =====
  let offset = headerSize;
  for (let ri = 0; ri < records.length; ri++) {
    const r = records[ri];
    const recordContentLength = (4 + 32 + 4 + 4 + 4 + r.points.length * 16) / 2;

    // 记录头
    view.setInt32(offset, ri + 1, false); // Record Number (big-endian)
    view.setInt32(offset + 4, recordContentLength, false); // Content Length (big-endian)
    offset += 8;

    // 记录内容
    view.setInt32(offset, 5, true); // Shape Type: Polygon
    offset += 4;
    view.setFloat64(offset, r.bbox[0], true); // minX
    view.setFloat64(offset + 8, r.bbox[1], true); // minY
    view.setFloat64(offset + 16, r.bbox[2], true); // maxX
    view.setFloat64(offset + 24, r.bbox[3], true); // maxY
    offset += 32;
    view.setInt32(offset, r.numParts, true); // NumParts
    view.setInt32(offset + 4, r.points.length / 2, true); // NumPoints
    offset += 8;
    // Parts array (起始索引)
    view.setInt32(offset, 0, true);
    offset += 4;
    // Points array
    for (let i = 0; i < r.points.length; i++) {
      view.setFloat64(offset, r.points[i], true);
      offset += 8;
    }
  }

  return buf;
}

/**
 * 生成.shx索引文件
 */
function generateSHXBuffer(features: GeoJSONFeature[]): ArrayBuffer {
  const validFeatures = features.filter(f => f.geometry.coordinates[0].length >= 4);
  if (validFeatures.length === 0) return new ArrayBuffer(100);

  const headerSize = 100;
  const recordSize = 8; // 每条索引记录 8 bytes (offset + content length)
  const fileSize = headerSize + validFeatures.length * recordSize;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  // 计算全局边界
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of validFeatures) {
    const ring = f.geometry.coordinates[0];
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  // 文件头
  view.setInt32(0, 9994, false);
  view.setInt32(24, fileSize / 2, false);
  view.setInt32(28, 1000, true);
  view.setInt32(32, 5, true);
  view.setFloat64(36, minX, true);
  view.setFloat64(44, minY, true);
  view.setFloat64(52, maxX, true);
  view.setFloat64(60, maxY, true);

  // 索引记录：计算每条记录在.shp中的偏移量
  let shpOffset = 100; // .shp文件头100字节
  for (let i = 0; i < validFeatures.length; i++) {
    const ring = validFeatures[i].geometry.coordinates[0];
    const numPoints = ring.length;
    const contentLength = (4 + 32 + 4 + 4 + 4 + numPoints * 16) / 2; // in 16-bit words

    view.setInt32(headerSize + i * 8, shpOffset / 2, false); // Offset (16-bit words, big-endian)
    view.setInt32(headerSize + i * 8 + 4, contentLength, false); // Content Length

    shpOffset += 8 + contentLength * 2; // 8字节记录头 + 内容
  }

  return buf;
}

/**
 * 导出Shapefile（完整.shp/.shx/.dbf/.prj/.cpg打包为ZIP）
 *
 * T8: 重写为使用JSZip打包完整的Shapefile组件
 * - .shp: 多边形几何数据（ESRI Shapefile二进制格式）
 * - .shx: 空间索引
 * - .dbf: 属性表
 * - .prj: 坐标系定义（WGS84）
 * - .cpg: 编码声明（UTF-8）
 */
export async function exportShapefileZip(source: SourceZoneVertices): Promise<void> {
  const geojson = toGeoJSON(source);
  const safeName = source.sourceName.replace(/[^\w\u4e00-\u9fa5]/g, '_');

  const shpBuf = generateSHPBuffer(geojson.features);
  const shxBuf = generateSHXBuffer(geojson.features);
  const dbfBuf = generateDBFBuffer(geojson.features);

  const prj = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const cpg = 'UTF-8';

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file(`${safeName}.shp`, shpBuf);
  zip.file(`${safeName}.shx`, shxBuf);
  zip.file(`${safeName}.dbf`, dbfBuf);
  zip.file(`${safeName}.prj`, prj);
  zip.file(`${safeName}.cpg`, cpg);
  zip.file(`${safeName}.geojson`, JSON.stringify(geojson, null, 2));

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(zipBlob, `${safeName}_Shapefile.zip`);
}

/**
 * 批量导出Shapefile（多个水源地合并为一个ZIP）
 */
export async function exportBatchShapefileZip(sources: SourceZoneVertices[]): Promise<void> {
  const geojson = toBatchGeoJSON(sources);
  const shpBuf = generateSHPBuffer(geojson.features);
  const shxBuf = generateSHXBuffer(geojson.features);
  const dbfBuf = generateDBFBuffer(geojson.features);

  const prj = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const cpg = 'UTF-8';

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('保护区划分.shp', shpBuf);
  zip.file('保护区划分.shx', shxBuf);
  zip.file('保护区划分.dbf', dbfBuf);
  zip.file('保护区划分.prj', prj);
  zip.file('保护区划分.cpg', cpg);
  zip.file('保护区划分.geojson', JSON.stringify(geojson, null, 2));

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(zipBlob, '水源地保护区批量_Shapefile.zip');
}
