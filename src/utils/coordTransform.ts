/**
 * 坐标系统一转换工具（P8.14 坐标偏移治理）
 *
 * 背景：平台历史数据（统一点位库/资料包/归档）源于高德地址解析，实为 GCJ-02（火星坐标），
 * 而天地图底图为 CGCS2000（≈WGS-84）。同一组坐标在高德底图上正确、在天地图上偏移 ~530m。
 *
 * 约定（本版本起）：
 *  - 数据存储统一为 WGS-84（国际标准，与天地图/CGCS2000 差异厘米级可忽略）
 *  - 渲染层按当前底图转换：高德底图 → wgs2gcj；天地图底图 → 原样（WGS-84）
 *  - 地图选点统一存 WGS-84（高德底图选点 gcj2wgs，天地图选点原样）
 */

/** 中国范围粗略判断（GCJ 偏移仅作用于国内） */
function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

/** WGS-84 → GCJ-02（火星坐标） */
export function wgs2gcj(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  const a = 6378245.0;
  const ee = 0.006693421622965943;
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return [lng + dLng, lat + dLat];
}

/** GCJ-02 → WGS-84（火星坐标转回标准坐标，近似一阶） */
export function gcj2wgs(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  const [glng, glat] = wgs2gcj(lng, lat);
  return [2 * lng - glng, 2 * lat - glat];
}

/** GCJ-02 → WGS-84（迭代精化版，误差 < 0.5m，推荐用于精确井位） */
export function gcj2wgsExact(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  let wlng = lng;
  let wlat = lat;
  for (let i = 0; i < 3; i++) {
    const [glng, glat] = wgs2gcj(wlng, wlat);
    // 不动点迭代：目标 gcj G = W + 偏移(W)，故 W_new = G - 偏移(W_cur)
    // （偏移在当前迭代值 wlng 处计算，而非初始值，否则迭代向 G 漂移不收敛）
    wlng = lng - (glng - wlng);
    wlat = lat - (glat - wlat);
  }
  return [wlng, wlat];
}

/** 点位对象转换（就地返回新数组） */
export function wgs2gcjPoint(p: { lng: number; lat: number }): { lng: number; lat: number } {
  const [lng, lat] = wgs2gcj(p.lng, p.lat);
  return { lng, lat };
}

export function gcj2wgsPoint(p: { lng: number; lat: number }): { lng: number; lat: number } {
  const [lng, lat] = gcj2wgs(p.lng, p.lat);
  return { lng, lat };
}
