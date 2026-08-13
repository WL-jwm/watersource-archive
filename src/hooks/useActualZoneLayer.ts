/**
 * 实际保护区边界图层 Hook
 *
 * 渲染 KMZ 导入的全省水源地"实际划定保护区范围"多边形边界
 * （区别于 useZoneLayer 的计算圈层）。
 *
 * 数据来源：public/zone-boundaries/<城市>.json（按需 fetch）
 * - 按当前筛选城市懒加载对应城市的边界数据
 * - selectedCity 为 'all' 时加载全部城市
 * - 模块级缓存避免重复请求
 */

import { useEffect, type RefObject } from 'react';
import L from 'leaflet';

/** 单个保护区边界要素 */
export interface ZoneBoundary {
  /** 水源地名称 */
  name: string;
  /** 保护区级别（一级保护区/二级保护区/准保护区 等） */
  level: string;
  /** 多边形顶点环 [[lng, lat], ...] */
  ring: Array<[number, number]>;
}

/** 与数据文件对应的全部城市 */
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

/** 各级别样式（实际边界用蓝绿色系，与计算圈层红色系区分） */
const LEVEL_STYLE: Record<string, { color: string; fill: string }> = {
  一级保护区: { color: '#2563EB', fill: '#2563EB' },
  二级保护区: { color: '#10B981', fill: '#10B981' },
  准保护区: { color: '#7C3AED', fill: '#7C3AED' },
  核心区: { color: '#DC2626', fill: '#DC2626' },
  缓冲区: { color: '#F59E0B', fill: '#F59E0B' },
};
const DEFAULT_STYLE = { color: '#6B7280', fill: '#6B7280' };

/** 城市数据缓存 */
const cache = new Map<string, ZoneBoundary[]>();

async function loadCity(city: string): Promise<ZoneBoundary[]> {
  const hit = cache.get(city);
  if (hit) return hit;
  try {
    const res = await fetch(`/zone-boundaries/${encodeURIComponent(city)}.json`);
    if (!res.ok) return [];
    const data = (await res.json()) as ZoneBoundary[];
    cache.set(city, data);
    return data;
  } catch {
    return [];
  }
}

export function useActualZoneLayer(
  mapInstanceRef: RefObject<L.Map | null>,
  layerRef: RefObject<L.LayerGroup | null>,
  enabled: boolean,
  selectedCity: string,
  mapReady: boolean,
) {
  useEffect(() => {
    if (!mapInstanceRef.current || !layerRef.current) return;
    const lg = layerRef.current;
    lg.clearLayers();

    if (!enabled || !mapReady) return;

    const cities = selectedCity === 'all' ? ALL_CITIES : [selectedCity];
    let cancelled = false;

    void (async () => {
      for (const city of cities) {
        if (cancelled) return;
        const bounds = await loadCity(city);
        if (cancelled) continue;
        for (const b of bounds) {
          if (cancelled) return;
          const style = LEVEL_STYLE[b.level] ?? DEFAULT_STYLE;
          const latlngs = b.ring.map((p) => [p[1], p[0]] as [number, number]);
          const poly = L.polygon(latlngs, {
            color: style.color,
            weight: 2,
            fillColor: style.fill,
            fillOpacity: 0.25,
          });
          poly.bindPopup(
            `<div style="font-family:system-ui;min-width:180px;font-size:13px">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#333">${b.name}</div>
              <div style="color:#666"><b>级别：</b><span style="color:${style.color};font-weight:600">${b.level}</span></div>
            </div>`,
          );
          lg.addLayer(poly);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, selectedCity, mapReady, mapInstanceRef, layerRef]);
}
