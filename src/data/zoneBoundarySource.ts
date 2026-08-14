/**
 * 保护区边界数据统一加载源
 *
 * - 离线 file:// 协议：使用内联数据模块（zoneBoundaryInlineData），
 *   避免 fetch 本地 JSON 被浏览器安全策略拦截，实现"拷贝即用"的离线单机版。
 * - http/https 部署：仍走 fetch 按需加载静态 JSON。
 * - 模块级缓存避免重复加载。
 */

import type { ZoneBoundary } from '@/hooks/useActualZoneLayer';

/** 与数据文件对应的全部城市 */
export const ALL_BOUNDARY_CITIES = [
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

const cache = new Map<string, ZoneBoundary[]>();

/** 是否运行在 file:// 协议（离线单机模式） */
export function isOfflineFileMode(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

/**
 * 加载指定城市的边界数据。
 * @param city 城市名（如 '石家庄市'）
 */
export async function loadCityBoundaries(city: string): Promise<ZoneBoundary[]> {
  const hit = cache.get(city);
  if (hit) return hit;
  let data: ZoneBoundary[] = [];
  if (isOfflineFileMode()) {
    // 离线单机：用内联数据（避免 fetch 本地 JSON 被拦截）
    const mod = await import('./zoneBoundaryInlineData');
    data = mod.ZONE_BOUNDARY_INLINE[city] ?? [];
  } else {
    try {
      const res = await fetch(`/zone-boundaries/${encodeURIComponent(city)}.json`);
      if (res.ok) {
        data = (await res.json()) as ZoneBoundary[];
      }
    } catch {
      data = [];
    }
  }
  cache.set(city, data);
  return data;
}
