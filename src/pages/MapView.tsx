import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import 'leaflet/dist/leaflet.css';
import { useWaterSourceStore, WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';
import { CalcResult } from '@/lib/zoneCalcEngine';
import { MapDrawController, type DrawTool } from '@/lib/mapDrawTools';
import MapToolbar from '@/components/MapToolbar';

// Leaflet图标修复（webpack/vite默认marker图标路径问题）
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface GeoSource {
  city: string;
  level: string;
  name: string;
  type: string;
  county: string;
  status: string;
  remark: string;
  lng: number;
  lat: number;
  population?: number;
}

const levelConfig: Record<string, { color: string; label: string; bgColor: string }> = {
  municipal: { color: '#2F5496', label: '市级', bgColor: '#D6E4F0' },
  county: { color: '#548235', label: '县级', bgColor: '#E2EFDA' },
  township: { color: '#BF8F00', label: '乡镇级', bgColor: '#FFF2CC' },
};

type FilterType = 'all' | 'municipal' | 'county' | 'township';
type SourceTypeFilter = 'all' | '地表水' | '地下水';

const MapView: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [typeFilter, setTypeFilter] = useState<SourceTypeFilter>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [hoveredSource, setHoveredSource] = useState<GeoSource | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [exporting, setExporting] = useState(false);

  // 地图绘制工具
  const drawControllerRef = useRef<MapDrawController | null>(null);
  const drawLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeTool, setActiveTool] = useState<DrawTool>('none');
  const [featureCount, setFeatureCount] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);

  const {
    loaded,
    sources: storeSources,
    zoneResults,
    initDB,
    loadZoneResults,
  } = useWaterSourceStore();
  const wsStats = useWaterSourceStore((s) => s.getStats());

  useEffect(() => {
    initDB();
  }, []);
  useEffect(() => {
    if (loaded && zoneResults.length === 0) loadZoneResults();
  }, [loaded]);

  const sources = useMemo((): GeoSource[] => {
    if (!loaded) return [];
    return storeSources
      .filter((s) => s.lng != null && s.lat != null)
      .map((s) => ({
        city: s.cityName,
        level: s.level,
        name: s.name,
        type: s.type,
        county: s.county,
        status: s.status,
        remark: s.remark || '',
        lng: s.lng!,
        lat: s.lat!,
        population: s.population,
      }));
  }, [loaded, storeSources]);

  // 城市列表
  const cityList = useMemo(() => {
    const cities = new Set(storeSources.map((s) => s.cityName));
    return ['all', ...Array.from(cities).sort((a, b) => a.localeCompare(b, 'zh'))];
  }, [loaded, storeSources]);

  // 过滤后的数据
  const filtered = useMemo(() => {
    return sources.filter((s) => {
      if (filter !== 'all' && s.level !== filter) return false;
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (selectedCity !== 'all' && s.city !== selectedCity) return false;
      return true;
    });
  }, [sources, filter, typeFilter, selectedCity]);

  // 初始化地图
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [38.5, 115.5],
      zoom: 7,
      minZoom: 6,
      maxZoom: 14,
      zoomControl: false,
    });

    // 高德瓦片底图（crossOrigin用于html2canvas截图支持）
    const tileLayer = L.tileLayer(
      'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      {
        subdomains: ['1', '2', '3', '4'],
        attribution: '&copy; 高德地图',
        maxZoom: 18,
        crossOrigin: true,
      },
    ).addTo(map);
    tileLayerRef.current = tileLayer;

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    zoneLayerRef.current = L.layerGroup().addTo(map);
    drawLayerRef.current = L.layerGroup().addTo(map);

    // 初始化绘制控制器
    drawControllerRef.current = new MapDrawController(
      map,
      drawLayerRef.current,
      () => {
        if (drawControllerRef.current) {
          setFeatureCount(drawControllerRef.current.getFeatures().length);
          setIsDrawing(drawControllerRef.current.isDrawing());
        }
      },
    );

    setMapReady(true);

    return () => {
      if (drawControllerRef.current) {
        drawControllerRef.current.destroy();
        drawControllerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 更新标记点
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const lg = layerGroupRef.current;
    lg.clearLayers();

    filtered.forEach((s, idx) => {
      const cfg = levelConfig[s.level] || levelConfig.township;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: s.level === 'municipal' ? 8 : s.level === 'county' ? 6 : 4,
        fillColor: cfg.color,
        fillOpacity: 0.7,
        color: '#fff',
        weight: s.status === '取消' ? 0.5 : 1.5,
        opacity: s.status === '取消' ? 0.3 : 0.9,
        className: s.status === '取消' ? 'cancelled-source' : '',
      });

      const statusTag = s.status === '取消' ? ' [已取消]' : s.status === '备用' ? ' [备用]' : '';
      const popupContent = `
        <div style="font-family:system-ui;min-width:220px;font-size:13px">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#333">${s.name}${statusTag}</div>
          <div style="color:#666;line-height:1.8">
            <div><b>级别：</b><span style="color:${cfg.color};font-weight:600">${cfg.label}</span></div>
            <div><b>城市：</b>${s.city}</div>
            <div><b>县区：</b>${s.county}</div>
            <div><b>类型：</b>${s.type}</div>
            ${s.population != null ? `<div><b>供水人口：</b><span style="color:#059669;font-weight:600">${s.population}万人</span></div>` : ''}
            ${s.remark ? `<div><b>备注：</b>${s.remark}</div>` : ''}
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;gap:6px">
            <a href="#/zone-calc?source=${encodeURIComponent(s.name)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;font-size:12px;border-radius:4px;background:#2563eb;color:#fff;text-decoration:none;white-space:nowrap">前往计算</a>
            <a href="#/analysis?lng=${s.lng}&lat=${s.lat}&name=${encodeURIComponent(s.name)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;font-size:12px;border-radius:4px;background:#f59e0b;color:#fff;text-decoration:none;white-space:nowrap">项目分析</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'ws-popup',
        maxWidth: 300,
      });

      marker.on('mouseover', () => setHoveredSource(s));
      marker.on('mouseout', () => setHoveredSource(null));

      lg.addLayer(marker);
    });
  }, [filtered, mapReady]);

  // 更新保护区圈层
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
    const metersToLat = (m: number) => m / 111320; // 1°纬度 ≈ 111320m
    const metersToLng = (m: number, lat: number) => m / (111320 * Math.cos((lat * Math.PI) / 180));

    // 为有计算结果的水源地绘制保护区圈
    zoneResults.forEach((zr) => {
      // 查找坐标
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

      const isRiverType = zr.params.swType === '河流型' || zr.params.sourceType === '地表水';

      // 按级别绘制圈层（先画大圈再画小圈）
      const sortedZones = [...zr.zones].sort((a, b) => {
        const order = { 准保护区: 0, 二级: 1, 一级: 2 };
        return (order[b.level] || 0) - (order[a.level] || 0);
      });

      sortedZones.forEach((zone) => {
        const zoneColor =
          zone.level === '一级' ? '#DC2626' : zone.level === '二级' ? '#F97316' : '#EAB308';
        const zoneWeight = zone.level === '一级' ? 2.5 : zone.level === '二级' ? 2 : 1.5;
        const zoneOpacity = zone.level === '一级' ? 0.6 : 0.4;

        if (zone.length && zone.width) {
          // ---- 河流型：绘制矩形（上游长度 × 两岸宽度）----
          // HJ 338-2018: 一级保护区取水口上游+下游+两岸宽度
          const upRatio = 0.8; // 上游占80%，下游占20%
          const upstream = zone.length * upRatio;
          const downstream = zone.length * (1 - upRatio);
          const halfWidth = zone.width / 2;
          const [lng, lat] = coords!;

          // 四角坐标（假设河流大致南北走向，取水口为中心）
          const dlat_up = metersToLat(upstream);
          const dlat_down = metersToLat(downstream);
          const dlng = metersToLng(halfWidth, lat);

          const polygon = L.polygon(
            [
              [lat + dlat_up, lng - dlng], // 上游左
              [lat + dlat_up, lng + dlng], // 上游右
              [lat - dlat_down, lng + dlng], // 下游右
              [lat - dlat_down, lng - dlng], // 下游左
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
          // ---- 地下水/湖库型：绘制圆形或扇形 ----
          // 如果有水力梯度且为二级保护区，绘制下游方向延伸的扇形
          const I = zr.params.hydraulicGradient;
          const showFan = I && I > 0 && zone.level === '二级' && zone.method === '解析法';

          if (showFan) {
            // 扇形：上游收缩，下游扩展
            const r = zone.radius;
            const fanSpread = 60; // 扇形张角(度)，单侧
            const upstreamShrink = 0.6; // 上游半径收缩比
            const downstreamExpand = 1.4; // 下游半径扩展比
            const rUp = r * upstreamShrink;
            const rDown = r * downstreamExpand;

            // 计算扇形多边形（假设水流方向为方位角flowAngle）
            // HJ 338-2018默认：无明确流向时用正北
            const flowAngle = 0; // 正北（度），后续可从参数获取
            const flowRad = (flowAngle * Math.PI) / 180;
            const steps = 24;

            // 上游弧线（收缩圆弧）
            const fanPoints: Array<[number, number]> = [];
            for (let i = -fanSpread; i <= fanSpread; i += (fanSpread * 2) / steps) {
              const angle = ((flowAngle + 180 + i) * Math.PI) / 180;
              const lat = coords[1] + metersToLat(rUp) * Math.cos(angle - flowRad);
              const lng = coords[0] + metersToLng(rUp, coords[1]) * Math.sin(angle - flowRad);
              fanPoints.push([lat, lng]);
            }
            // 下游弧线（扩展圆弧，反向）
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
            // 标准圆形
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
          // ---- 其他类型：绘制默认圆形 ----
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
  }, [showZones, zoneResults, storeSources, mapReady]);

  // 聚焦到选中城市
  useEffect(() => {
    if (!mapInstanceRef.current || selectedCity === 'all') return;
    const citySources = filtered.filter((s) => s.city === selectedCity);
    if (citySources.length === 0) return;
    const bounds = L.latLngBounds(citySources.map((s) => [s.lat, s.lng] as [number, number]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [selectedCity]);

  // 绘制工具操作
  const handleToolChange = useCallback((tool: DrawTool) => {
    if (drawControllerRef.current) {
      drawControllerRef.current.setTool(tool);
      setActiveTool(tool);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (drawControllerRef.current) {
      drawControllerRef.current.undoLast();
    }
  }, []);

  const handleClearDraw = useCallback(() => {
    if (drawControllerRef.current) {
      drawControllerRef.current.clearAll();
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* 地图工具栏 */}
      <MapToolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        onUndo={handleUndo}
        onClear={handleClearDraw}
        featureCount={featureCount}
        isDrawing={isDrawing}
      />

      {/* 顶部工具栏 - 移动端横向滚动 */}
      <div className="px-4 py-3 bg-surface border-b border-border flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
        <h2 className="text-sm font-bold text-text-primary">GIS地图</h2>
        <span className="text-xs text-text-tertiary">
          {filtered.length} / {sources.length} 个水源地
        </span>

        <div className="flex items-center gap-2 ml-auto overflow-x-auto scrollbar-hide">
          {/* 级别筛选 */}
          {(['all', 'municipal', 'county', 'township'] as FilterType[]).map((f) => {
            const label = f === 'all' ? '全部' : levelConfig[f]?.label;
            const count =
              f === 'all' ? sources.length : sources.filter((s) => s.level === f).length;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  active
                    ? f === 'municipal'
                      ? 'bg-[#2F5496] text-white border-[#2F5496]'
                      : f === 'county'
                        ? 'bg-[#548235] text-white border-[#548235]'
                        : f === 'township'
                          ? 'bg-[#BF8F00] text-white border-[#BF8F00]'
                          : 'bg-accent-500 text-white border-accent-500'
                    : 'bg-surface text-text-secondary border-border hover:border-accent-300'
                }`}
              >
                {label}({count})
              </button>
            );
          })}

          <div className="w-px h-5 bg-border mx-1" />

          {/* 类型筛选 */}
          {(['all', '地表水', '地下水'] as SourceTypeFilter[]).map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  active
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-surface text-text-secondary border-border hover:border-primary-300'
                }`}
              >
                {t === 'all' ? '全部类型' : t}
              </button>
            );
          })}

          <div className="w-px h-5 bg-border mx-1" />

          {/* 城市筛选 */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-surface text-text-primary"
          >
            {cityList.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? '全部城市' : c}
              </option>
            ))}
          </select>

          <div className="w-px h-5 bg-border mx-1" />

          {/* 保护区叠加开关 */}
          <button
            onClick={() => setShowZones((v) => !v)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
              showZones
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-surface text-text-secondary border-border hover:border-red-300'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            保护区{showZones && zoneResults.length > 0 ? `(${zoneResults.length})` : ''}
          </button>

          {/* 导出地图截图 */}
          <button
            onClick={async () => {
              if (!mapRef.current || exporting) return;
              setExporting(true);
              try {
                // P4-14: 截图前强制重载瓦片确保crossOrigin生效
                if (tileLayerRef.current) {
                  (
                    tileLayerRef.current as unknown as { eachLayer: (fn: () => void) => void }
                  ).eachLayer(() => {});
                  // 强制重新加载可见瓦片
                  const map = mapInstanceRef.current;
                  if (map) {
                    map.eachLayer((layer: any) => {
                      if (layer instanceof L.TileLayer) {
                        layer.redraw();
                      }
                    });
                    // 等待瓦片重新加载
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                  }
                }
                // P4-14: 瓦片跨域截图方案
                // 方案1: 直接html2canvas（瓦片已配置crossOrigin=true时有效）
                let canvas: HTMLCanvasElement;
                try {
                  canvas = await html2canvas(mapRef.current, {
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: '#f0f4f8',
                    scale: 2,
                    logging: false,
                    imageTimeout: 5000,
                  });
                  // 验证canvas是否被污染（toDataURL会抛异常）
                  canvas.toDataURL('image/png');
                } catch (corsErr) {
                  // 方案2: allowTaint模式（canvas会被污染，无法toDataURL，但可用toBlob导出）
                  console.warn('[截图] CORS模式失败，回退到allowTaint模式');
                  canvas = await html2canvas(mapRef.current, {
                    useCORS: false,
                    allowTaint: true,
                    backgroundColor: '#f0f4f8',
                    scale: 2,
                    logging: false,
                    imageTimeout: 5000,
                  });
                }
                // 导出：优先toDataURL，失败则用toBlob
                try {
                  const link = document.createElement('a');
                  link.download = `水源地保护区地图_${new Date().toISOString().slice(0, 10)}.png`;
                  link.href = canvas.toDataURL('image/png');
                  link.click();
                } catch (taintErr) {
                  // canvas被污染，使用toBlob替代
                  console.warn('[截图] canvas被污染，使用toBlob导出');
                  canvas.toBlob((blob) => {
                    if (!blob) {
                      alert('地图导出失败');
                      return;
                    }
                    const link = document.createElement('a');
                    link.download = `水源地保护区地图_${new Date().toISOString().slice(0, 10)}.png`;
                    link.href = URL.createObjectURL(blob);
                    link.click();
                    URL.revokeObjectURL(link.href);
                  }, 'image/png');
                }
              } catch (err) {
                console.error('地图导出失败:', err);
                alert('地图导出失败：' + (err as Error).message);
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
              exporting
                ? 'bg-gray-300 text-gray-500 border-gray-300'
                : 'bg-surface text-text-secondary border-border hover:border-indigo-300'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {exporting ? '导出中...' : '导出地图'}
          </button>
        </div>
      </div>

      {/* 地图主体 */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* 悬浮提示 */}
        {hoveredSource && (
          <div className="absolute top-3 left-3 z-[1000] bg-surface/95 backdrop-blur border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none">
            <div className="text-sm font-bold text-text-primary">{hoveredSource.name}</div>
            <div className="text-xs text-text-tertiary">
              {hoveredSource.city} · {levelConfig[hoveredSource.level]?.label} ·{' '}
              {hoveredSource.county}
            </div>
          </div>
        )}

        {/* 图例 - 移动端可折叠 */}
        <div
          className={`absolute bottom-4 left-4 z-[1000] bg-surface/95 backdrop-blur border border-border rounded-lg shadow-lg transition-all duration-200 ${legendCollapsed ? 'p-2' : 'p-3'}`}
        >
          <button
            onClick={() => setLegendCollapsed((v) => !v)}
            className="flex items-center justify-between w-full"
          >
            <span className="text-[10px] font-semibold text-text-tertiary">图例</span>
            <svg
              className={`w-3 h-3 text-text-tertiary transition-transform ${legendCollapsed ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {!legendCollapsed && (
            <div className="space-y-1.5 mt-2">
              {Object.entries(levelConfig).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="text-xs text-text-secondary">{cfg.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full border border-white shadow-sm opacity-30"
                  style={{ backgroundColor: '#888' }}
                />
                <span className="text-xs text-text-tertiary">已取消</span>
              </div>
              {showZones && (
                <>
                  <div className="w-full h-px bg-border my-1" />
                  <div className="text-[10px] font-semibold text-text-tertiary">保护区</div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full border-2"
                      style={{ borderColor: '#DC2626', backgroundColor: '#DC262620' }}
                    />
                    <span className="text-xs text-text-secondary">一级保护区</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full border-2"
                      style={{ borderColor: '#F97316', backgroundColor: '#F9731620' }}
                    />
                    <span className="text-xs text-text-secondary">二级保护区</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-2.5 border-2"
                      style={{
                        borderColor: '#DC2626',
                        backgroundColor: '#DC262620',
                        borderRadius: '2px',
                      }}
                    />
                    <span className="text-xs text-text-secondary">河流型(矩形)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-2.5 border-2"
                      style={{
                        borderColor: '#F97316',
                        backgroundColor: '#F9731620',
                        clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
                      }}
                    />
                    <span className="text-xs text-text-secondary">扇形(解析法)</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="absolute bottom-4 right-4 z-[1000] bg-surface/95 backdrop-blur border border-border rounded-lg p-3 shadow-lg hidden sm:block">
          <div className="text-[10px] font-semibold text-text-tertiary mb-1">河北省水源地</div>
          <div className="text-lg font-bold text-accent-500">{wsStats.total}</div>
          <div className="text-[10px] text-text-quaternary">
            市级{wsStats.totalMunicipal} · 县级{wsStats.totalCounty} · 乡镇{wsStats.totalTownship}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
