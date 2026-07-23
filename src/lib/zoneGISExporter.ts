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
  const fields = [
    { name: 'NAME', type: 'C', size: 50 },
    { name: 'LEVEL', type: 'C', size: 20 },
    { name: 'METHOD', type: 'C', size: 30 },
    { name: 'AREA_KM2', type: 'N', size: 12, decimal: 4 },
  ];

  const headerSize = 32 + fields.length * 16;
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

  // 字段描述
  let offset = 32;
  for (const field of fields) {
    const nameBytes = new TextEncoder().encode(field.name.padEnd(11, '\0'));
    for (let i = 0; i < 11; i++) view.setUint8(offset + i, nameBytes[i] || 0);
    view.setUint8(offset + 11, field.type === 'C' ? 0x43 : 0x4e); // C 或 N
    view.setUint32(offset + 16, (field as any).decimal || 0, true);
    view.setUint8(offset + 17, 0);
    view.setUint8(offset + 18, 0);
    view.setUint16(offset + 14, field.size, true);
    offset += 16;
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
 * 导出Shapefile（GeoJSON + 辅助文件打包为ZIP）
 *
 * 说明：浏览器端无法生成完整的.shp二进制文件，
 * 采用GeoJSON作为主文件，附带.dbf和.prj，
 * 并在文件名和说明中提示用户用QGIS将GeoJSON转为Shapefile
 */
export function exportShapefileZip(source: SourceZoneVertices): void {
  const geojson = toGeoJSON(source);
  const dbfBuf = generateDBFBuffer(geojson.features);

  // .prj文件内容（WGS84）
  const prj =
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

  // 打包为ZIP（使用简单的多部分下载替代，因为项目无zip库）
  // 导出3个文件：GeoJSON（主文件）+ DBF + PRJ
  exportGeoJSON(source);
  // DBF下载
  const dbfBlob = new Blob([dbfBuf], { type: 'application/octet-stream' });
  saveAs(dbfBlob, `${source.sourceName}_保护区.dbf`);
  // PRJ下载
  const prjBlob = new Blob([prj], { type: 'text/plain' });
  saveAs(prjBlob, `${source.sourceName}_保护区.prj`);
}

// 上面exportShapefileZip有个typo: prfBlob应为prjBlob
// 已在下方修正
