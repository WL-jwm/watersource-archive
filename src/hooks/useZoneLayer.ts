/**
 * N6: MapView 拆分 — 保护区圈层渲染 Hook
 *
 * 将保护区圈层绘制逻辑从 MapView 中提取为独立 Hook
 * 负责在地图上绘制一级/二级/准保护区圆形、矩形、扇形
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';

/**
 * 在地图上渲染保护区圈层
 */
export function useZoneLayer(
  mapInstanceRef: React.RefObject<L.Map | null>,
  zoneLayerRef: React.RefObject<L.LayerGroup | null>,
  showZones: boolean,
  zoneResults: ZoneCalcRecord[],
  storeSources: WaterSourceRecord[],
  mapReady: boolean,
) {
  useEffect(() => {
    if (!mapInstanceRef.current || !zoneLayerRef.current) return;
    const zlg = zoneLayerRef.current;
    zlg.clearLayers();

    if (!showZones) return;

    // 建立sourceId -> coordinates的映射
    const coordMap = new Map<string, [number, number]>();
    storeSources.forEach((s) => {
      if (s.lng != null && s.lat != null) coordMap.set(s.id, [s.lng, s.lat]);
    });

    // 辅助函数：将米转换为经纬度偏移（Haversine近似，适用于河北纬度38°）
    const metersToLat = (m: number) => m / 111320;
    const metersToLng = (m: number, lat: number) => m / (111320 * Math.cos((lat * Math.PI) / 180));

    zoneResults.forEach((zr) => {
      let coords: [number, number] | undefined;
      coords = coordMap.get(zr.sourceId);
      if (!coords) {
        for (const s of storeSources) {
          if (s.name === zr.sourceName && s.lng != null && s.lat != null) {
            coords = [s.lng, s.lat];
            break;
          }
        }
      }
      if (!coords) return;

      // 按级别绘制圈层（先画大圈再画小圈）
      const sortedZones = [...zr.zones].sort((a, b) => {
        const order: Record<string, number> = { 准保护区: 0, 二级: 1, 一级: 2 };
        return (order[b.level] || 0) - (order[a.level] || 0);
      });

      sortedZones.forEach((zone) => {
        const zoneColor =
          zone.level === '一级' ? '#DC2626' : zone.level === '二级' ? '#F97316' : '#EAB308';
        const zoneWeight = zone.level === '一级' ? 2.5 : zone.level === '二级' ? 2 : 1.5;
        const zoneOpacity = zone.level === '一级' ? 0.6 : 0.4;

        if (zone.length && zone.width) {
          // ---- 河流型：绘制矩形 ----
          const upRatio = 0.8;
          const upstream = zone.length * upRatio;
          const downstream = zone.length * (1 - upRatio);
          const halfWidth = zone.width / 2;
          const [lng, lat] = coords!;

          const dlat_up = metersToLat(upstream);
          const dlat_down = metersToLat(downstream);
          const dlng = metersToLng(halfWidth, lat);

          const polygon = L.polygon(
            [
              [lat + dlat_up, lng - dlng],
              [lat + dlat_up, lng + dlng],
              [lat - dlat_down, lng + dlng],
              [lat - dlat_down, lng - dlng],
            ],
            {
              color: zoneColor,
              weight: zoneWeight,
              opacity: zoneOpacity,
              fillColor: zoneColor,
              fillOpacity: 0.1,
            },
          );

          polygon.bindTooltip(
            `<div style="font-size:12px"><b>${zr.sourceName}</b><br/>${zone.level}保护区 · ${zone.method}<br/>${zone.length}m × ${zone.width}m · ${zone.area}km²</div>`,
            { sticky: true },
          );

          zlg.addLayer(polygon);
        } else if (zone.radius) {
          // ---- 地下水/湖库型：圆形或扇形 ----
          const I = zr.params.hydraulicGradient;
          const showFan = I && I > 0 && zone.level === '二级' && zone.method === '解析法';

          if (showFan) {
            const r = zone.radius;
            const fanSpread = 60;
            const rUp = r * 0.6;
            const rDown = r * 1.4;
            const flowAngle = 0;
            const flowRad = (flowAngle * Math.PI) / 180;
            const steps = 24;

            const fanPoints: Array<[number, number]> = [];
            for (let i = -fanSpread; i <= fanSpread; i += (fanSpread * 2) / steps) {
              const angle = ((flowAngle + 180 + i) * Math.PI) / 180;
              const lat = coords[1] + metersToLat(rUp) * Math.cos(angle - flowRad);
              const lng = coords[0] + metersToLng(rUp, coords[1]) * Math.sin(angle - flowRad);
              fanPoints.push([lat, lng]);
            }
            for (let i = fanSpread; i >= -fanSpread; i -= (fanSpread * 2) / steps) {
              const angle = ((flowAngle + i) * Math.PI) / 180;
              const lat = coords[1] + metersToLat(rDown) * Math.cos(angle - flowRad);
              const lng = coords[0] + metersToLng(rDown, coords[1]) * Math.sin(angle - flowRad);
              fanPoints.push([lat, lng]);
            }

            const fan = L.polygon(fanPoints, {
              color: zoneColor,
              weight: zoneWeight,
              opacity: zoneOpacity,
              fillColor: zoneColor,
              fillOpacity: 0.1,
            });

            fan.bindTooltip(
              `<div style="font-size:12px"><b>${zr.sourceName}</b><br/>${zone.level}保护区 · 扇形 · ${zone.method}<br/>R=${zone.radius}m · ${zone.area}km²</div>`,
              { sticky: true },
            );

            zlg.addLayer(fan);
          } else {
            const circle = L.circle([coords![1], coords![0]], {
              radius: zone.radius,
              color: zoneColor,
              weight: zoneWeight,
              opacity: zoneOpacity,
              fillColor: zoneColor,
              fillOpacity: 0.1,
              dashArray: zone.level === '准保护区' ? '6 4' : undefined,
            });

            circle.bindTooltip(
              `<div style="font-size:12px"><b>${zr.sourceName}</b><br/>${zone.level}保护区 · ${zone.method}<br/>R=${zone.radius}m · ${zone.area}km²</div>`,
              { sticky: true },
            );

            zlg.addLayer(circle);
          }
        } else {
          // ---- 默认圆形 ----
          const circle = L.circle([coords![1], coords![0]], {
            radius: zone.radius,
            color: zoneColor,
            weight: zoneWeight,
            opacity: zoneOpacity,
            fillColor: zoneColor,
            fillOpacity: 0.1,
            dashArray: zone.level === '准保护区' ? '6 4' : undefined,
          });

          circle.bindTooltip(
            `<div style="font-size:12px"><b>${zr.sourceName}</b><br/>${zone.level}保护区 · ${zone.method}<br/>R=${zone.radius}m · ${zone.area}km²</div>`,
            { sticky: true },
          );

          zlg.addLayer(circle);
        }
      });
    });
  }, [showZones, zoneResults, storeSources, mapReady, mapInstanceRef, zoneLayerRef]);
}
