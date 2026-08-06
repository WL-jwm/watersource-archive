/* ===== S12.12: 空间数据导入引擎 =====
 * 解析 GeoJSON / KML / CSV 三种空间数据格式，
 * 统一输出为空间要素（点/多边形），并可转换为
 * 查询源、项目输入、敏感目标等平台内部结构。
 * 纯函数设计：字符串 → 结构化要素，便于单测。
 */

import Papa from 'papaparse';

// ===== 类型定义 =====

export type SpatialFormat = 'geojson' | 'kml' | 'csv';

export interface SpatialFeature {
  id: string;
  name: string;
  /** 要素类型：点或面 */
  kind: 'point' | 'polygon';
  /** 点要素坐标 */
  lng?: number;
  lat?: number;
  /** 面要素坐标环 [ [lng,lat], ... ]（已闭合） */
  ring?: Array<[number, number]>;
  /** 属性（从源数据提取，如 name/type/category 等） */
  properties: Record<string, string | number | boolean>;
}

export interface SpatialImportResult {
  format: SpatialFormat;
  features: SpatialFeature[];
  /** 无法解析的要素数 */
  skipped: number;
  /** 解析警告 */
  warnings: string[];
}

// ===== GeoJSON 解析 =====

/**
 * 解析 GeoJSON 文本，提取 Point / MultiPoint / Polygon / MultiPolygon 要素
 */
export function parseGeoJSON(text: string): SpatialFeature[] {
  const features: SpatialFeature[] = [];
  const obj = JSON.parse(text);

  const collect = (feat: unknown, index: number): void => {
    const f = feat as {
      type?: string;
      properties?: Record<string, string | number | boolean>;
      geometry?: { type?: string; coordinates?: unknown };
    };
    if (!f || f.type !== 'Feature' || !f.geometry) return;
    const props = f.properties ?? {};
    const name = String(props.name ?? props.Name ?? `要素${index + 1}`);
    const { type, coordinates } = f.geometry;

    if (type === 'Point' && Array.isArray(coordinates)) {
      const [lng, lat] = coordinates as number[];
      features.push({
        id: `geo-${index}`,
        name,
        kind: 'point',
        lng,
        lat,
        properties: props,
      });
    } else if (type === 'Polygon' && Array.isArray(coordinates)) {
      const ring = (coordinates as number[][][])[0];
      if (ring && ring.length >= 3) {
        features.push({
          id: `geo-${index}`,
          name,
          kind: 'polygon',
          ring: closeRing(ring.map((c) => [c[0], c[1]])),
          properties: props,
        });
      }
    }
  };

  if (obj && obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    obj.features.forEach(collect);
  } else if (obj && obj.type === 'Feature') {
    collect(obj, 0);
  } else if (obj && obj.type === 'Point') {
    collect({ type: 'Feature', geometry: obj, properties: {} }, 0);
  }

  return features;
}

function closeRing(coords: Array<[number, number]>): Array<[number, number]> {
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

// ===== KML 解析 =====

/**
 * 解析 KML 文本，提取 Placemark 的点坐标与多边形环
 */
export function parseKML(text: string): SpatialFeature[] {
  const features: SpatialFeature[] = [];

  // 提取所有 <Placemark>...</Placemark>
  const placemarkRe = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let m: RegExpExecArray | null;
  let index = 0;
  while ((m = placemarkRe.exec(text)) !== null) {
    const body = m[1];
    const nameMatch = /<name>([\s\S]*?)<\/name>/.exec(body);
    const name = nameMatch ? decodeEntities(nameMatch[1].trim()) : `要素${index + 1}`;

    // 点坐标
    const pointMatch = /<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(body);
    if (pointMatch) {
      const coord = parseCoord(pointMatch[1].trim());
      if (coord) {
        features.push({
          id: `kml-${index}`,
          name,
          kind: 'point',
          lng: coord[0],
          lat: coord[1],
          properties: { name },
        });
        index++;
        continue;
      }
    }

    // 多边形环
    const polygonMatch = /<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(body);
    if (polygonMatch) {
      const ring = polygonMatch[1]
        .trim()
        .split(/\s+/)
        .map((t) => parseCoord(t))
        .filter((c): c is [number, number] => c !== null);
      if (ring.length >= 3) {
        features.push({
          id: `kml-${index}`,
          name,
          kind: 'polygon',
          ring: closeRing(ring),
          properties: { name },
        });
        index++;
      }
    }

    index++;
  }

  return features;
}

/** 解析 "lng,lat[,alt]" 坐标串 */
function parseCoord(text: string): [number, number] | null {
  const parts = text.split(',');
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  if (isNaN(lng) || isNaN(lat)) return null;
  return [lng, lat];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

// ===== CSV 解析 =====

export interface CsvSpatialOptions {
  /** 经度列名（默认自动检测） */
  lngColumn?: string;
  /** 纬度列名 */
  latColumn?: string;
  /** 名称列名（默认 name） */
  nameColumn?: string;
  /** 类型列名（可选） */
  typeColumn?: string;
}

/** 常见经度/纬度列名 */
const LNG_KEYS = ['lng', 'lon', 'longitude', '经度', '东经', 'x'];
const LAT_KEYS = ['lat', 'latitude', '纬度', '北纬', 'y'];
const NAME_KEYS = ['name', '名称', '水源地', '项目', 'point', 'label'];
const TYPE_KEYS = ['type', '类型', 'category', '类别'];

/**
 * 解析带经纬度列的 CSV 文本为点要素
 */
export function parseSpatialCSV(text: string, options: CsvSpatialOptions = {}): SpatialFeature[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const features: SpatialFeature[] = [];

  if (rows.length === 0) return features;

  const cols = Object.keys(rows[0] ?? {}).map((c) => c.trim().toLowerCase());

  const findCol = (keys: string[], explicit?: string): string | undefined => {
    if (explicit) {
      const hit = cols.find((c) => c === explicit.toLowerCase());
      if (hit) return hit;
    }
    return cols.find((c) => keys.some((k) => c === k || c.includes(k)));
  };

  const lngCol = findCol(LNG_KEYS, options.lngColumn);
  const latCol = findCol(LAT_KEYS, options.latColumn);
  const nameCol = findCol(NAME_KEYS, options.nameColumn);
  const typeCol = findCol(TYPE_KEYS, options.typeColumn);

  if (!lngCol || !latCol) return features;

  rows.forEach((row, i) => {
    const lng = parseFloat(row[lngCol] ?? '');
    const lat = parseFloat(row[latCol] ?? '');
    if (isNaN(lng) || isNaN(lat)) return;

    const name = nameCol ? (row[nameCol] ?? '').trim() : '';
    const props: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== undefined && v !== null && v !== '') props[k] = v;
    }
    const type = typeCol ? (row[typeCol] ?? '').trim() : '';

    features.push({
      id: `csv-${i}`,
      name: name || `点要素${i + 1}`,
      kind: 'point',
      lng,
      lat,
      properties: { ...props, ...(type ? { type } : {}) },
    });
  });

  return features;
}

// ===== 统一入口 =====

/**
 * 根据格式解析空间数据文本
 */
export function parseSpatialData(
  text: string,
  format: SpatialFormat,
  options?: CsvSpatialOptions,
): SpatialImportResult {
  const warnings: string[] = [];
  let features: SpatialFeature[] = [];

  try {
    if (format === 'geojson') {
      features = parseGeoJSON(text);
    } else if (format === 'kml') {
      features = parseKML(text);
    } else {
      features = parseSpatialCSV(text, options);
    }
  } catch (err) {
    warnings.push(`解析失败：${(err as Error).message}`);
    features = [];
  }

  return { format, features, skipped: 0, warnings };
}

// ===== 转平台结构 =====

/**
 * 要素 → 查询源（水源地）
 */
export function featureToQuerySource(f: SpatialFeature): {
  id: string;
  name: string;
  lng: number;
  lat: number;
  level: string;
  zoneRadiusM: number;
} {
  const props = f.properties;
  const level = String(props.zoneLevel ?? props.level ?? '二级');
  const radius = Number(props.zoneRadiusM ?? props.radiusM ?? 500);
  return {
    id: f.id,
    name: f.name,
    lng: f.lng ?? f.ring?.[0]?.[0] ?? 0,
    lat: f.lat ?? f.ring?.[0]?.[1] ?? 0,
    level,
    zoneRadiusM: isNaN(radius) ? 500 : radius,
  };
}

/**
 * 要素 → 敏感目标
 */
export function featureToSensitiveTarget(f: SpatialFeature): {
  id: string;
  name: string;
  lng: number;
  lat: number;
  category: string;
  scale?: string;
} {
  const props = f.properties;
  return {
    id: f.id,
    name: f.name,
    lng: f.lng ?? 0,
    lat: f.lat ?? 0,
    category: String(props.category ?? props.type ?? 'other'),
    scale: props.scale ? String(props.scale) : undefined,
  };
}
