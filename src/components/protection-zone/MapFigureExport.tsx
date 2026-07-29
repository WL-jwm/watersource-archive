/**
 * N3: 保护区图件自动生成
 *
 * 功能：
 * 1. 在新窗口中渲染 Leaflet 地图，叠加保护区多边形
 * 2. 自动添加标准图件要素：图例、比例尺、指北针、标题、图框
 * 3. 使用 html2canvas 捕获为 PNG 图片
 * 4. 支持 A4/A3 图幅和分辨率选择
 * 5. 可嵌入 Word 报告
 *
 * 依据：HJ 338-2018 对保护区图件的要求
 */

import { useToast } from '@/hooks/useToast';
import React, { useState } from 'react';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';

type FigureSize = 'A4-landscape' | 'A4-portrait' | 'A3-landscape';

const FIGURE_DIMENSIONS: Record<FigureSize, { w: number; h: number; label: string }> = {
  'A4-landscape': { w: 1123, h: 794, label: 'A4 横向 (297×210mm)' },
  'A4-portrait': { w: 794, h: 1123, label: 'A4 纵向 (210×297mm)' },
  'A3-landscape': { w: 1587, h: 1123, label: 'A3 横向 (420×297mm)' },
};

const ZONE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  一级: { fill: '#ef4444', stroke: '#dc2626', label: '一级保护区' },
  二级: { fill: '#f97316', stroke: '#ea580c', label: '二级保护区' },
  准保护区: { fill: '#eab308', stroke: '#ca8a04', label: '准保护区' },
};

interface MapFigureExportProps {
  zoneResults: ZoneCalcRecord[];
  sources: WaterSourceRecord[];
}

const MapFigureExport: React.FC<MapFigureExportProps> = ({ zoneResults, sources }) => {
  const toast = useToast();
  const [selectedSource, setSelectedSource] = useState('');
  const [figureSize, setFigureSize] = useState<FigureSize>('A4-landscape');
  const [resolution, setResolution] = useState(2); // 2x = ~300dpi
  const [generating, setGenerating] = useState(false);

  // 有坐标信息的水源地（用于图件生成）
  const sourcesWithCoords = zoneResults
    .map((zr) => {
      const source = sources.find((s) => s.name === zr.sourceName);
      if (!source || source.lng == null || source.lat == null) return null;
      return { zr, source };
    })
    .filter(Boolean) as { zr: ZoneCalcRecord; source: WaterSourceRecord }[];

  if (sourcesWithCoords.length === 0) return null;

  const handleGenerate = async () => {
    const target = sourcesWithCoords.find((s) => s.zr.sourceName === selectedSource) || sourcesWithCoords[0];
    if (!target) return;

    setGenerating(true);

    try {
      const { zr, source } = target;
      const sv = generateSourceZoneVertices(zr.sourceId, zr.sourceName, source.lng!, source.lat!, zr.zones);

      // 收集所有拐点用于计算地图范围
      const allPoints: { lng: number; lat: number }[] = [];
      for (const zone of sv.zones) {
        for (const v of zone.vertices) {
          allPoints.push({ lng: v.lng, lat: v.lat });
        }
      }

      if (allPoints.length === 0) {
        toast.warning('该水源地无拐点坐标数据');
        return;
      }

      // 计算边界
      const lats = allPoints.map((p) => p.lat);
      const lngs = allPoints.map((p) => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // 扩展边界 20% 作为边距
      const latPad = (maxLat - minLat) * 0.2 || 0.01;
      const lngPad = (maxLng - minLng) * 0.2 || 0.01;

      const dims = FIGURE_DIMENSIONS[figureSize];
      const mapW = Math.floor(dims.w * 0.75); // 地图区域占图幅 75%
      const mapH = Math.floor(dims.h * 0.75);

      // 生成保护区多边形 GeoJSON
      const zonesGeoJSON = sv.zones
        .filter((z) => z.vertices.length > 0)
        .map((z) => ({
          type: 'Feature' as const,
          properties: { level: z.level, color: ZONE_COLORS[z.level] },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[...z.vertices.map((v) => [v.lng, v.lat]), [z.vertices[0].lng, z.vertices[0].lat]]],
          },
        }));

      // 比例尺计算：地图宽度对应的实际距离
      const centerLat = (minLat + maxLat) / 2;
      const mapWidthDeg = maxLng - minLng + 2 * lngPad;
      const mapWidthMeters = mapWidthDeg * 111320 * Math.cos((centerLat * Math.PI) / 180);
      const scaleMeters = Math.round(mapWidthMeters / 4 / 100) * 100; // 比例尺长度取整

      // 打开预览窗口
      const previewWindow = window.open('', '_blank', `width=${dims.w + 40},height=${dims.h + 80}`);
      if (!previewWindow) {
        toast.warning('请允许弹出窗口以生成图件');
        return;
      }

      // 构建预览页面
      const zonesScript = JSON.stringify(zonesGeoJSON);
      const legendItems = sv.zones
        .filter((z) => z.vertices.length > 0)
        .map((z) => {
          const c = ZONE_COLORS[z.level];
          return `<div class="legend-item"><span class="legend-color" style="background:${c.fill};border:1px solid ${c.stroke};"></span><span>${c.label}</span></div>`;
        })
        .join('');

      // 计算比例尺文本
      const scaleText = scaleMeters >= 1000 ? `${(scaleMeters / 1000).toFixed(1)} km` : `${scaleMeters} m`;

      previewWindow.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>保护区图件 — ${zr.sourceName}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "微软雅黑", sans-serif; background: #f0f0f0; }
  .toolbar { padding: 10px 20px; background: #333; color: #fff; display: flex; align-items: center; gap: 12px; }
  .toolbar button { padding: 6px 16px; font-size: 13px; cursor: pointer; border: none; border-radius: 4px; background: #3b82f6; color: #fff; }
  .toolbar button:hover { background: #2563eb; }
  .toolbar span { font-size: 12px; opacity: 0.8; }

  .figure-container {
    width: ${dims.w}px; height: ${dims.h}px; margin: 20px auto;
    background: #fff; border: 2px solid #333; position: relative;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  }
  .figure-title {
    position: absolute; top: 0; left: 0; right: 0; height: 50px;
    display: flex; align-items: center; justify-content: center;
    border-bottom: 1px solid #999; z-index: 1000;
    background: #fff;
  }
  .figure-title h1 { font-size: 18px; font-weight: bold; color: #222; }
  .figure-title .subtitle { font-size: 11px; color: #666; margin-left: 12px; }

  .map-area {
    position: absolute; top: 50px; left: 0; right: 0; bottom: 60px;
  }
  #map { width: 100%; height: 100%; }

  .legend-box {
    position: absolute; bottom: 70px; right: 15px; z-index: 1000;
    background: rgba(255,255,255,0.95); border: 1px solid #999;
    padding: 8px 12px; border-radius: 4px; font-size: 11px;
  }
  .legend-box .legend-title { font-weight: bold; margin-bottom: 4px; font-size: 11px; }
  .legend-item { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
  .legend-color { display: inline-block; width: 16px; height: 12px; border-radius: 2px; }

  .scale-bar {
    position: absolute; bottom: 70px; left: 15px; z-index: 1000;
    background: rgba(255,255,255,0.95); border: 1px solid #999;
    padding: 4px 10px; border-radius: 4px; font-size: 10px;
  }
  .scale-bar .bar {
    display: inline-block; width: 80px; height: 6px;
    background: linear-gradient(to right, #333 50%, #fff 50%);
    background-size: 20px 6px; border: 1px solid #333;
    vertical-align: middle; margin: 0 6px;
  }

  .north-arrow {
    position: absolute; top: 60px; right: 15px; z-index: 1000;
    width: 40px; height: 50px; text-align: center;
  }
  .north-arrow svg { width: 30px; height: 40px; }
  .north-arrow .label { font-size: 10px; font-weight: bold; color: #333; }

  .figure-footer {
    position: absolute; bottom: 0; left: 0; right: 0; height: 60px;
    border-top: 1px solid #999; padding: 6px 20px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: #666; z-index: 1000; background: #fff;
  }
  .figure-footer .info-item { margin-right: 20px; }
  .figure-footer .info-item strong { color: #333; }
</style>
</head>
<body>
<div class="toolbar">
  <span>图件预览 — ${zr.sourceName}</span>
  <button onclick="exportPNG()">导出 PNG</button>
  <span style="margin-left:auto;">${dims.label} | 分辨率 ${resolution}x</span>
</div>

<div class="figure-container" id="figureContainer">
  <!-- 标题栏 -->
  <div class="figure-title">
    <h1>${zr.sourceName} 饮用水水源保护区划分图</h1>
    <span class="subtitle">${zr.zones[0]?.method || ''} | ${new Date().toLocaleDateString('zh-CN')}</span>
  </div>

  <!-- 地图区域 -->
  <div class="map-area">
    <div id="map"></div>
  </div>

  <!-- 指北针 -->
  <div class="north-arrow">
    <svg viewBox="0 0 30 40">
      <polygon points="15,2 22,30 15,24 8,30" fill="#dc2626" stroke="#333" stroke-width="0.5"/>
      <polygon points="15,38 8,30 15,24 22,30" fill="#fff" stroke="#333" stroke-width="0.5"/>
    </svg>
    <div class="label">N</div>
  </div>

  <!-- 图例 -->
  <div class="legend-box">
    <div class="legend-title">图例</div>
    ${legendItems}
    <div class="legend-item"><span class="legend-color" style="background:#3b82f6;border-radius:50%;width:10px;height:10px;border:1px solid #1d4ed8;"></span><span>水源地位置</span></div>
  </div>

  <!-- 比例尺 -->
  <div class="scale-bar">
    <span>0</span>
    <span class="bar"></span>
    <span>${scaleText}</span>
  </div>

  <!-- 底部信息栏 -->
  <div class="figure-footer">
    <div>
      <span class="info-item"><strong>水源地名称：</strong>${zr.sourceName}</span>
      <span class="info-item"><strong>所在区域：</strong>${source.cityName || ''} ${source.county || ''}</span>
      <span class="info-item"><strong>水源类型：</strong>${zr.params.sourceType === '地下水' ? '地下水' + (zr.params.gwType ? '（' + zr.params.gwType + '）' : '') : '地表水'}</span>
    </div>
    <div>
      <span class="info-item"><strong>坐标系：</strong>WGS84 / CGCS2000</span>
      <span class="info-item">依据 HJ 338-2018</span>
    </div>
  </div>
</div>

<script>
  // 初始化地图
  var map = L.map('map', { zoomControl: true, attributionControl: false });
  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    maxZoom: 18,
    crossOrigin: true
  }).addTo(map);

  // 添加水源地标记
  L.circleMarker([${source.lat}, ${source.lng}], {
    radius: 6, color: '#1d4ed8', fillColor: '#3b82f6',
    fillOpacity: 1, weight: 2
  }).addTo(map).bindTooltip('${zr.sourceName}', { permanent: true, direction: 'top', offset: [0, -8] });

  // 添加保护区多边形
  var zones = ${zonesScript};
  zones.forEach(function(feature) {
    var coords = feature.geometry.coordinates[0].map(function(c) { return [c[1], c[0]]; });
    var color = feature.properties.color;
    L.polygon(coords, {
      color: color.stroke, weight: 2, fillColor: color.fill, fillOpacity: 0.3
    }).addTo(map).bindTooltip(feature.properties.level, { sticky: true });
  });

  // 自适应视野
  map.fitBounds([[${minLat - latPad}, ${minLng - lngPad}], [${maxLat + latPad}, ${maxLng + lngPad}]], { padding: [30, 30] });

  // 导出PNG
  function exportPNG() {
    var container = document.getElementById('figureContainer');
    html2canvas(container, {
      scale: ${resolution},
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff'
    }).then(function(canvas) {
      var link = document.createElement('a');
      link.download = '${zr.sourceName}_保护区图件.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(function(err) {
      console.error('导出失败:', err);
      // 降级：使用 allowTaint
      html2canvas(container, { scale: ${resolution}, allowTaint: true, logging: false }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = '${zr.sourceName}_保护区图件.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    });
  }
</script>
</body>
</html>`);
      previewWindow.document.close();
    } catch (err) {
      console.error('[图件生成] 失败:', err);
      toast.error('图件生成失败: ' + (err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div>
          <h3 className="text-sm font-semibold">保护区图件生成</h3>
          <p className="text-[10px] text-gray-500">自动生成含图例/比例尺/指北针/标题的标准保护区范围图</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 水源地选择 */}
        <div>
          <label className="text-[10px] font-medium text-gray-600 block mb-1">选择水源地</label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="">-- 选择水源地 --</option>
            {sourcesWithCoords.map(({ zr, source }) => (
              <option key={zr.id} value={zr.sourceName}>
                {zr.sourceName}（{source.cityName || ''}）
              </option>
            ))}
          </select>
        </div>

        {/* 图幅大小 */}
        <div>
          <label className="text-[10px] font-medium text-gray-600 block mb-1">图幅大小</label>
          <select
            value={figureSize}
            onChange={(e) => setFigureSize(e.target.value as FigureSize)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            {Object.entries(FIGURE_DIMENSIONS).map(([key, dims]) => (
              <option key={key} value={key}>{dims.label}</option>
            ))}
          </select>
        </div>

        {/* 分辨率 */}
        <div>
          <label className="text-[10px] font-medium text-gray-600 block mb-1">输出分辨率</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(Number(e.target.value))}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value={1}>标准 (1x, ~96dpi)</option>
            <option value={2}>高清 (2x, ~192dpi)</option>
            <option value={3}>打印 (3x, ~288dpi)</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              生成中...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              生成图件
            </>
          )}
        </button>
      </div>

      <div className="text-[10px] text-gray-400 bg-gray-50 rounded p-2">
        图件包含：保护区多边形（一级/二级/准保护区分色）、水源地标记、图例、比例尺、指北针、标题、底部信息栏（水源地名称/所在区域/水源类型/坐标系/技术依据）。导出为 PNG 图片，可直接插入 Word 报告。
      </div>
    </div>
  );
};

export default MapFigureExport;
