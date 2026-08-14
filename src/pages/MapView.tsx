/**
 * N6: MapView 重构 — 使用拆分子组件
 *
 * 拆分内容：
 * - MapFilters: 筛选工具栏（级别/类型/城市/保护区/导出）
 * - MapLegend: 图例组件（可折叠）
 * - useZoneLayer: 保护区圈层渲染 Hook
 * - useMapExport: 地图截图导出 Hook
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { WaterSourceRecord, useWaterSourceStore } from '@/stores/waterSourceStore';
import { MapDrawController, type DrawTool } from '@/lib/mapDrawTools';
import MapToolbar from '@/components/MapToolbar';
import SpatialQueryPanel from '@/components/map/SpatialQueryPanel';
import type { QuerySource } from '@/lib/spatialQueryEngine';
import MapFilters, { type FilterType, type SourceTypeFilter, type GeoSource } from '@/components/map/MapFilters';
import MapLegend from '@/components/map/MapLegend';
import { useZoneLayer } from '@/hooks/useZoneLayer';
import { useActualZoneLayer } from '@/hooks/useActualZoneLayer';
import { useMapExport } from '@/hooks/useMapExport';

// P7: Leaflet图标修复 — 使用本地资源替代CDN
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const levelConfig: Record<string, { color: string; label: string }> = {
  municipal: { color: '#2F5496', label: '市级' },
  county: { color: '#548235', label: '县级' },
  township: { color: '#BF8F00', label: '乡镇级' },
};

const MapView: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const actualZoneLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [typeFilter, setTypeFilter] = useState<SourceTypeFilter>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [hoveredSource, setHoveredSource] = useState<GeoSource | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [showActualZones, setShowActualZones] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [baseLayer, setBaseLayer] = useState<'standard' | 'satellite'>('standard');
  const satelliteLayersRef = useRef<L.Layer[]>([]);
  // 管理页跳转定位的目标水源地名称
  const focusNameRef = useRef<string | null>(null);
  // 聚焦定位时跳过自动 fitBounds，避免覆盖定位视图
  const skipFitRef = useRef(false);
  const prevFilterKeyRef = useRef('all|all|all');

  // 地图绘制工具
  const drawControllerRef = useRef<MapDrawController | null>(null);
  const drawLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeTool, setActiveTool] = useState<DrawTool>('none');
  const [featureCount, setFeatureCount] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);

  // S12.9: 空间查询模式
  const queryModeRef = useRef(false);
  const [queryMode, setQueryMode] = useState(false);
  const [queryPoint, setQueryPoint] = useState<{ lng: number; lat: number } | null>(null);

  const { exporting, exportMap } = useMapExport(mapRef, mapInstanceRef, tileLayerRef);

  const {
    loaded,
    sources: storeSources,
    zoneResults,
    initDB,
    loadZoneResults,
  } = useWaterSourceStore();
  const wsStats = useWaterSourceStore((s) => s.getStats());
  const [searchParams] = useSearchParams();
  const focusName = searchParams.get('focus');

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

  const cityList = useMemo(() => {
    const cities = new Set(storeSources.map((s) => s.cityName));
    return ['all', ...Array.from(cities).sort((a, b) => a.localeCompare(b, 'zh'))];
  }, [loaded, storeSources]);

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
    actualZoneLayerRef.current = L.layerGroup().addTo(map);
    drawLayerRef.current = L.layerGroup().addTo(map);

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

    // S12.9: 空间查询模式 - 地图点击取点
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (queryModeRef.current) {
        setQueryPoint({ lng: e.latlng.lng, lat: e.latlng.lat });
      }
    });

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

    filtered.forEach((s) => {
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

      marker.bindPopup(popupContent, { className: 'ws-popup', maxWidth: 300 });
      marker.on('mouseover', () => setHoveredSource(s));
      marker.on('mouseout', () => setHoveredSource(null));
      // 管理页跳转定位：若当前渲染的水源地即聚焦目标，自动弹出信息窗
      if (focusNameRef.current && s.name === focusNameRef.current) {
        marker.openPopup();
      }
      lg.addLayer(marker);
    });
  }, [filtered, mapReady]);

  // N6: 保护区圈层渲染（提取为独立 Hook）
  useZoneLayer(mapInstanceRef, zoneLayerRef, showZones, zoneResults, storeSources, mapReady);

  // 实际保护区边界图层（KMZ 导入的真实范围）
  useActualZoneLayer(mapInstanceRef, actualZoneLayerRef, showActualZones, selectedCity, mapReady);

  // 筛选联动居中：切换级别/类型/城市时，地图自动 fitBounds 到筛选结果范围
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    if (skipFitRef.current) return; // 聚焦定位场景跳过，避免覆盖定位视图
    const key = `${filter}|${typeFilter}|${selectedCity}`;
    if (prevFilterKeyRef.current === key) return;
    prevFilterKeyRef.current = key;
    if (filter === 'all' && typeFilter === 'all' && selectedCity === 'all') {
      // 恢复全省视图
      mapInstanceRef.current.fitBounds(
        L.latLngBounds([
          [35.5, 113.5],
          [43.5, 120.5],
        ] as [[number, number], [number, number]]),
        { padding: [30, 30], animate: true },
      );
      return;
    }
    if (filtered.length === 0) return;
    const bounds = L.latLngBounds(filtered.map((s) => [s.lat, s.lng] as [number, number]));
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 11, animate: true });
    }
  }, [filter, typeFilter, selectedCity, filtered, mapReady]);

  // 管理页跳转定位：根据 URL 的 focus 参数定位到指定水源地并放大
  useEffect(() => {
    focusNameRef.current = focusName;
    if (!mapReady || !focusName) return;
    const target = storeSources.find((s) => s.name === focusName && s.lng != null && s.lat != null);
    if (!target) return;
    // 同步筛选，确保目标水源地可见
    skipFitRef.current = true;
    setSelectedCity(target.cityName);
    setFilter('all');
    setTypeFilter('all');
    mapInstanceRef.current?.setView([target.lat!, target.lng!], 12, { animate: true });
    const t = window.setTimeout(() => {
      skipFitRef.current = false;
    }, 1200);
    return () => window.clearTimeout(t);
  }, [mapReady, focusName, storeSources]);

  const handleToolChange = useCallback((tool: DrawTool) => {
    if (drawControllerRef.current) {
      drawControllerRef.current.setTool(tool);
      setActiveTool(tool);
    }
  }, []);

  const handleUndo = useCallback(() => {
    drawControllerRef.current?.undoLast();
  }, []);

  const handleClearDraw = useCallback(() => {
    drawControllerRef.current?.clearAll();
  }, []);

  // 底图切换：标准高德 / 卫星影像（卫星附带注记层）
  const switchBaseLayer = useCallback((mode: 'standard' | 'satellite') => {
    const map = mapInstanceRef.current;
    const tl = tileLayerRef.current;
    if (!map || !tl) return;
    setBaseLayer(mode);
    // 移除旧的卫星注记层
    satelliteLayersRef.current.forEach((l) => map.removeLayer(l));
    satelliteLayersRef.current = [];
    if (mode === 'standard') {
      tl.setUrl(
        'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      );
    } else {
      tl.setUrl('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}');
      const anno = L.tileLayer(
        'https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
        {
          subdomains: ['1', '2', '3', '4'],
          maxZoom: 18,
          crossOrigin: true,
        },
      ).addTo(map);
      satelliteLayersRef.current.push(anno);
    }
    tl.redraw();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <MapToolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        onUndo={handleUndo}
        onClear={handleClearDraw}
        featureCount={featureCount}
        isDrawing={isDrawing}
      />

      <MapFilters
        filteredCount={filtered.length}
        totalCount={sources.length}
        filter={filter}
        typeFilter={typeFilter}
        selectedCity={selectedCity}
        showZones={showZones}
        zoneCount={zoneResults.length}
        exporting={exporting}
        cityList={cityList}
        sources={sources}
        onFilterChange={setFilter}
        onTypeFilterChange={setTypeFilter}
        onCityChange={setSelectedCity}
        onToggleZones={() => setShowZones((v) => !v)}
        onToggleActualZones={() => setShowActualZones((v) => !v)}
        showActualZones={showActualZones}
        onExport={exportMap}
      />

      {/* 地图主体 */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* 底图切换 */}
        <div className="absolute right-2 top-14 z-[1000] flex rounded-lg overflow-hidden border border-border shadow bg-surface text-xs">
          {(['standard', 'satellite'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchBaseLayer(m)}
              className={`px-2.5 py-1.5 transition-colors ${
                baseLayer === m
                  ? 'bg-accent-500 text-white font-medium'
                  : 'bg-surface text-text-secondary hover:bg-gray-100'
              }`}
              title={m === 'standard' ? '标准地图' : '卫星影像'}
            >
              {m === 'standard' ? '标准' : '卫星'}
            </button>
          ))}
        </div>

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

        <MapLegend
          collapsed={legendCollapsed}
          showZones={showZones}
          showActualZones={showActualZones}
          onToggle={() => setLegendCollapsed((v) => !v)}
        />

        {/* 统计卡片 */}
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
