/**
 * 天地图（国家地理信息公共服务平台）底图配置
 * 影像底图 + 影像注记，Web Mercator（w）瓦片
 * tk 密钥申请自 https://console.tianditu.gov.cn/
 */
export const TIANDITU_TK = 'ced796b7c2d0e4f4512056c9699ec0c8';

/** 天地图瓦片子域 */
export const TIANDITU_SUBDOMAINS = ['0', '1', '2', '3', '4', '5', '6', '7'];

/** 天地图最大缩放级别（影像支持到 18） */
export const TIANDITU_MAX_ZOOM = 18;

/** 生成天地图 WMTS 瓦片 URL
 * layer: img=影像底图, cia=影像注记(地名标注)
 */
export function tiandituUrl(layer: 'img' | 'cia'): string {
  return `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_TK}`;
}
