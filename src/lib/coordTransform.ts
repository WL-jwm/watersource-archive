/**
 * N1: 坐标格式转换工具
 *
 * 支持三种格式互转：
 * 1. 小数度（Decimal Degrees）: 114.523456
 * 2. 度分秒（DMS）: 114°31'24.442"E
 * 3. 高斯-克吕格投影（GK）: 需指定中央子午线
 *
 * 依据：GB/T 18341-2021《大地坐标系统基本要求》
 * CGCS2000 椭球参数：长半轴 a=6378137m，扁率 f=1/298.257222101
 */

// ===== CGCS2000 椭球参数 =====
const A = 6378137.0; // 长半轴
const F = 1 / 298.257222101; // 扁率
const E2 = 2 * F - F * F; // 第一偏心率平方
const EP2 = E2 / (1 - E2); // 第二偏心率平方

export type CoordFormat = 'decimal' | 'dms' | 'gk';

export interface CoordFormatOption {
  value: CoordFormat;
  label: string;
  description: string;
}

export const COORD_FORMAT_OPTIONS: CoordFormatOption[] = [
  { value: 'decimal', label: '小数度', description: '114.523456°' },
  { value: 'dms', label: '度分秒', description: '114°31\'24.442"' },
  { value: 'gk', label: '高斯-克吕格', description: 'X=3901234.567 Y=38512345.678（3°带）' },
];

/**
 * 小数度 → 度分秒字符串
 * @param decimal 小数度（如 114.523456）
 * @param isLng true=经度(东经E)，false=纬度(北纬N)
 * @returns 如 114°31'24.442"E
 */
export function decimalToDMS(decimal: number, isLng: boolean): string {
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = ((minFloat - m) * 60).toFixed(3);
  const hemi = isLng ? 'E' : 'N';
  return `${d}°${m}'${s}"${hemi}`;
}

/**
 * 小数度 → 度分秒（结构化）
 */
export function decimalToDMSParts(decimal: number): { d: number; m: number; s: number } {
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = parseFloat(((minFloat - m) * 60).toFixed(3));
  return { d, m, s };
}

/**
 * 高斯-克吕格正算（CGCS2000 椭球）
 * 将经纬度（小数度）转换为高斯-克吕格平面坐标（3°带）
 *
 * @param lng 经度（度）
 * @param lat 纬度（度）
 * @param centralMeridian 中央子午线经度（度），如 114、117、120
 * @returns { x: 北坐标(m), y: 东坐标(m，含带号前缀) }
 */
export function decimalToGK(
  lng: number,
  lat: number,
  centralMeridian: number,
): { x: number; y: number; zone: number } {
  const radLat = (lat * Math.PI) / 180;
  const radLng = (lng * Math.PI) / 180;
  const radCM = (centralMeridian * Math.PI) / 180;

  // 经差（弧度）
  const l = radLng - radCM;

  // 子午线弧长 X
  const N = A / Math.sqrt(1 - E2 * Math.sin(radLat) * Math.sin(radLat));
  const T = Math.tan(radLat) * Math.tan(radLat);
  const C = EP2 * Math.cos(radLat) * Math.cos(radLat);
  const A1 = A * (1 - E2);
  const A2 = A1 + A * E2;
  const A3 = A2 + A * E2;
  const A4 = A3 + A * E2;

  // 子午线弧长计算（展开到 e^8 项）
  const M =
    A1 * radLat -
    (A2 - A1) * 0.5 * Math.sin(2 * radLat) +
    (A3 - A2) * 0.25 * Math.sin(4 * radLat) -
    (A4 - A3) / 6 * Math.sin(6 * radLat);

  // 高斯-克吕格正算公式
  const x = M + N * Math.tan(radLat) * (l * l / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(l, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Math.pow(l, 6) / 720);

  const y = N * (l + (1 + T + C) * Math.pow(l, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Math.pow(l, 5) / 120);

  // 带号（3°带）
  const zone = Math.round(centralMeridian / 3);

  // 东坐标加 500km 偏移并加带号前缀
  const yWithZone = zone * 1000000 + y + 500000;

  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(yWithZone * 1000) / 1000,
    zone,
  };
}

/**
 * 根据经度自动选择 3°带中央子午线
 * 河北省范围：中央子午线 114°/117°/120°
 */
export function autoCentralMeridian(lng: number): number {
  return Math.round(lng / 3) * 3;
}

/**
 * 格式化坐标显示
 */
export function formatCoord(
  lng: number,
  lat: number,
  format: CoordFormat,
  centralMeridian?: number,
): { lng: string; lat: string } {
  switch (format) {
    case 'decimal':
      return {
        lng: lng.toFixed(6) + '°',
        lat: lat.toFixed(6) + '°',
      };
    case 'dms':
      return {
        lng: decimalToDMS(lng, true),
        lat: decimalToDMS(lat, false),
      };
    case 'gk': {
      const cm = centralMeridian ?? autoCentralMeridian(lng);
      const gk = decimalToGK(lng, lat, cm);
      return {
        lng: `Y=${gk.y.toFixed(3)}`,
        lat: `X=${gk.x.toFixed(3)}`,
      };
    }
  }
}

/**
 * 获取格式表头
 */
export function getCoordHeaders(format: CoordFormat): { lngHeader: string; latHeader: string } {
  switch (format) {
    case 'decimal':
      return { lngHeader: '东经 (°)', latHeader: '北纬 (°)' };
    case 'dms':
      return { lngHeader: '东经 (°′″)', latHeader: '北纬 (°′″)' };
    case 'gk':
      return { lngHeader: 'Y 坐标 (m)', latHeader: 'X 坐标 (m)' };
  }
}
