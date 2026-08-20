/**
 * 天地图（国家地理信息公共服务平台）底图配置
 * 影像底图 + 影像注记，Web Mercator（w）瓦片
 *
 * 应用开启了「安全密钥(sk)」校验，瓦片请求必须同时携带：
 *   - tk：应用 Key（浏览器端）
 *   - sk：安全密钥
 * 缺少 sk 会返回 301020「安全核验sk码错误或丢失」
 *
 * 申请自 https://console.tianditu.gov.cn/（应用「水源地空间档案平台」，域名白名单为空=无限制）
 */
export const TIANDITU_TK = '67c060c641ad6ca82b8c3d450b4ac64b';
export const TIANDITU_SK = 'ced796b7c2d0e4f4512056c9699ec0c8';

/** 天地图瓦片子域 */
export const TIANDITU_SUBDOMAINS = ['0', '1', '2', '3', '4', '5', '6', '7'];

/** 天地图最大缩放级别（影像支持到 18） */
export const TIANDITU_MAX_ZOOM = 18;

/** 生成天地图 WMTS 瓦片 URL（含 tk + sk 安全校验）
 * layer: img=影像底图, cia=影像注记(地名标注)
 */
export function tiandituUrl(layer: 'img' | 'cia'): string {
  return `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_TK}&sk=${TIANDITU_SK}`;
}
