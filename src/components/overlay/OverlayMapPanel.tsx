/**
 * S5.3: 多水源地叠加分析 — 地图可视化面板
 *
 * 使用 Leaflet 展示叠加分析结果，包括各水源地保护区边界和合并区域
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { OverlayResult } from '@/lib/multiSourceOverlayEngine';

interface OverlayMapPanelProps {
  result: OverlayResult;
}

const LEVEL_STYLES: Record<string, { color: string; fillColor: string; fillOpacity: number }> = {
  一级: { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.15 },
  二级: { color: '#d97706', fillColor: '#f59e0b', fillOpacity: 0.1 },
  准保护区: { color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.08 },
};

const OVERLAP_STYLES = {
  color: '#7c3aed',
  fillColor: '#8b5cf6',
  fillOpacity: 0.3,
};

const OverlayMapPanel: React.FC<OverlayMapPanelProps> = ({ result }) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [38.0428, 114.5149], // 河北省中心
      zoom: 7,
      layers: [
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 18,
        }),
      ],
    });

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 更新地图图层
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const bounds: L.LatLngBounds | null = null;
    let validBounds = L.latLngBounds([]);

    result.levels.forEach((lv) => {
      const style = LEVEL_STYLES[lv.level] ?? LEVEL_STYLES['一级'];

      // 绘制各水源地保护区
      lv.sourceGeometries.forEach((sg) => {
        try {
          const geo = sg.geometry as GeoJSON.Feature;
          const layer = L.geoJSON(geo, {
            style: { ...style, weight: 1.5 },
            onEachFeature: (_feature, lyr) => {
              lyr.bindTooltip(
                `${sg.sourceName} - ${lv.level}<br/>面积: ${sg.area.toFixed(4)} km²`,
                { sticky: true },
              );
            },
          });
          layer.addTo(layerGroup);
          try {
            validBounds.extend(layer.getBounds());
          } catch {
            // skip invalid bounds
          }
        } catch {
          // skip invalid geometry
        }
      });

      // 绘制合并区域边界（粗线）
      if (lv.unionGeometry && (lv.unionGeometry as GeoJSON.FeatureCollection).features?.length > 0) {
        try {
          const unionLayer = L.geoJSON(lv.unionGeometry, {
            style: { ...style, weight: 3, fillOpacity: 0 },
            onEachFeature: (_feature, lyr) => {
              lyr.bindTooltip(
                `${lv.level} 合并区域<br/>合并面积: ${lv.unionArea.toFixed(4)} km²`,
                { sticky: true },
              );
            },
          });
          unionLayer.addTo(layerGroup);
        } catch {
          // skip
        }
      }
    });

    // 绘制重叠区域
    result.overlaps
      .filter((o) => o.overlapArea > 0 && o.intersectionGeometry)
      .forEach((o) => {
        try {
          const layer = L.geoJSON(o.intersectionGeometry as GeoJSON.Feature, {
            style: { ...OVERLAP_STYLES, weight: 2, dashArray: '5,5' },
            onEachFeature: (_feature, lyr) => {
              lyr.bindTooltip(
                `重叠区域<br/>${o.sourceAName} ∩ ${o.sourceBName}<br/>${o.level}<br/>重叠面积: ${o.overlapArea.toFixed(4)} km²`,
                { sticky: true },
              );
            },
          });
          layer.addTo(layerGroup);
          try {
            validBounds.extend(layer.getBounds());
          } catch {
            // skip
          }
        } catch {
          // skip
        }
      });

    // 自适应缩放到所有图层
    if (validBounds.isValid()) {
      mapRef.current.fitBounds(validBounds, { padding: [30, 30] });
    }

    void bounds;
  }, [result]);

  return (
    <div className="bg-surface rounded-lg border border-surface-border overflow-hidden">
      <div className="px-4 py-2 border-b border-surface-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">叠加结果地图</h3>
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(LEVEL_STYLES).map(([level, style]) => (
            <span key={level} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-sm border"
                style={{ borderColor: style.color, backgroundColor: style.fillColor }}
              />
              {level}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm border-2 border-dashed"
              style={{ borderColor: OVERLAP_STYLES.color, backgroundColor: OVERLAP_STYLES.fillColor }}
            />
            重叠区
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[480px]" />
    </div>
  );
};

export default OverlayMapPanel;
