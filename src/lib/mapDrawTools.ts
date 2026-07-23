/**
 * 地图绘制与测量工具引擎 (Map Draw & Measure Tools)
 *
 * 功能：
 * 1. 绘制工具：点/线/面/圆 — 使用 Leaflet 原生 API，无额外依赖
 * 2. 测量工具：距离测量（Haversine）/ 面积测量（Shoelace 公式）
 * 3. 绘制图层管理：撤销最后一笔/清空全部
 * 4. 自定义标注：带标签的标记点
 *
 * 设计理念：不引入 leaflet-draw 等重量级依赖，
 * 通过 Leaflet 原生 map.on('click') / map.on('mousemove') 实现。
 */

import L from 'leaflet';

// ===== 类型定义 =====

export type DrawTool = 'none' | 'point' | 'line' | 'polygon' | 'circle' | 'measure-distance' | 'measure-area';

export interface DrawnFeature {
  id: string;
  type: 'point' | 'line' | 'polygon' | 'circle';
  layer: L.Layer;
  label?: string;
  measurement?: string;
}

export interface MapToolsState {
  activeTool: DrawTool;
  features: DrawnFeature[];
  isDrawing: boolean;
  currentPoints: L.LatLng[];
  previewLayer: L.Layer | null;
}

// ===== 工具函数 =====

/** Haversine 公式计算两点间距离（米） */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 多段线总长度（米） */
export function polylineDistance(points: L.LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng,
    );
  }
  return total;
}

/** Shoelace 公式计算多边形面积（平方米），基于经纬度转平面近似 */
export function polygonArea(points: L.LatLng[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  const R = 6371000; // 地球半径（米）

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const lat1 = (points[i].lat * Math.PI) / 180;
    const lat2 = (points[j].lat * Math.PI) / 180;
    const dLng = ((points[j].lng - points[i].lng) * Math.PI) / 180;
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs((area * R * R) / 2);
  return area;
}

/** 格式化距离显示 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(1)} m`;
  return `${(meters / 1000).toFixed(3)} km`;
}

/** 格式化面积显示 */
export function formatArea(sqMeters: number): string {
  if (sqMeters < 1000000) return `${sqMeters.toFixed(1)} m²`;
  return `${(sqMeters / 1000000).toFixed(4)} km²`;
}

// ===== 绘制工具控制器 =====

export class MapDrawController {
  private map: L.Map;
  private activeTool: DrawTool = 'none';
  private features: DrawnFeature[] = [];
  private currentPoints: L.LatLng[] = [];
  private previewLayer: L.LayerGroup;
  private drawLayer: L.LayerGroup;
  private clickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private moveHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private dblClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private onStateChange?: () => void;

  constructor(map: L.Map, drawLayer: L.LayerGroup, onStateChange?: () => void) {
    this.map = map;
    this.drawLayer = drawLayer;
    this.previewLayer = L.layerGroup().addTo(map);
    this.onStateChange = onStateChange;
  }

  getActiveTool(): DrawTool {
    return this.activeTool;
  }

  getFeatures(): DrawnFeature[] {
    return [...this.features];
  }

  isDrawing(): boolean {
    return this.currentPoints.length > 0;
  }

  /** 设置当前激活的工具 */
  setTool(tool: DrawTool): void {
    // 如果切换工具时有未完成的绘制，取消它
    if (this.currentPoints.length > 0 && tool !== this.activeTool) {
      this.cancelDrawing();
    }

    this.activeTool = tool;

    // 移除旧的事件监听
    this.removeHandlers();

    if (tool === 'none') {
      this.map.getContainer().style.cursor = '';
      this.notifyChange();
      return;
    }

    // 设置鼠标样式
    this.map.getContainer().style.cursor = 'crosshair';

    // 添加新的事件监听
    if (tool === 'point') {
      this.clickHandler = (e: L.LeafletMouseEvent) => this.handlePointClick(e);
      this.map.on('click', this.clickHandler);
    } else if (tool === 'line' || tool === 'measure-distance') {
      this.clickHandler = (e: L.LeafletMouseEvent) => this.handleLineClick(e);
      this.moveHandler = (e: L.LeafletMouseEvent) => this.handleLineMove(e);
      this.dblClickHandler = () => this.finishLine();
      this.map.on('click', this.clickHandler);
      this.map.on('mousemove', this.moveHandler);
      this.map.on('dblclick', this.dblClickHandler);
    } else if (tool === 'polygon' || tool === 'measure-area') {
      this.clickHandler = (e: L.LeafletMouseEvent) => this.handlePolygonClick(e);
      this.moveHandler = (e: L.LeafletMouseEvent) => this.handlePolygonMove(e);
      this.dblClickHandler = () => this.finishPolygon();
      this.map.on('click', this.clickHandler);
      this.map.on('mousemove', this.moveHandler);
      this.map.on('dblclick', this.dblClickHandler);
    } else if (tool === 'circle') {
      this.clickHandler = (e: L.LeafletMouseEvent) => this.handleCircleClick(e);
      this.moveHandler = (e: L.LeafletMouseEvent) => this.handleCircleMove(e);
      this.map.on('click', this.clickHandler);
      this.map.on('mousemove', this.moveHandler);
    }

    this.notifyChange();
  }

  /** 处理点绘制点击 */
  private handlePointClick(e: L.LeafletMouseEvent): void {
    const id = `point_${Date.now()}`;
    const marker = L.circleMarker(e.latlng, {
      radius: 6,
      fillColor: '#DC2626',
      fillOpacity: 0.8,
      color: '#fff',
      weight: 2,
    });

    const label = `标注 ${this.features.filter((f) => f.type === 'point').length + 1}`;
    marker.bindTooltip(label, { permanent: true, direction: 'top', offset: L.point(0, -8) });
    marker.addTo(this.drawLayer);

    this.features.push({ id, type: 'point', layer: marker, label });
    this.notifyChange();
  }

  /** 处理线/距离测量点击 */
  private handleLineClick(e: L.LeafletMouseEvent): void {
    this.currentPoints.push(e.latlng);
    this.updateLinePreview();
  }

  private handleLineMove(e: L.LeafletMouseEvent): void {
    if (this.currentPoints.length === 0) return;
    this.updateLinePreview(e.latlng);
  }

  private updateLinePreview(mouseLatLng?: L.LatLng): void {
    this.previewLayer.clearLayers();
    if (this.currentPoints.length === 0) return;

    const points = mouseLatLng
      ? [...this.currentPoints, mouseLatLng]
      : this.currentPoints;

    // 绘制预览线
    const isMeasure = this.activeTool === 'measure-distance';
    const color = isMeasure ? '#2563EB' : '#DC2626';
    L.polyline(points, {
      color,
      weight: 2,
      dashArray: '6 4',
      opacity: 0.7,
    }).addTo(this.previewLayer);

    // 距离测量：显示累计距离标签
    if (isMeasure && points.length >= 2) {
      const dist = polylineDistance(points);
      const lastPoint = points[points.length - 1];
      L.marker(lastPoint, {
        icon: L.divIcon({
          className: 'measure-label',
          html: `<div style="background:#2563EB;color:white;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap;">${formatDistance(dist)}</div>`,
          iconSize: [80, 20],
          iconAnchor: [40, -8],
        }),
      }).addTo(this.previewLayer);
    }

    // 绘制顶点标记
    this.currentPoints.forEach((pt, i) => {
      L.circleMarker(pt, {
        radius: 4,
        fillColor: color,
        fillOpacity: 1,
        color: '#fff',
        weight: 1.5,
      }).addTo(this.previewLayer);
    });
  }

  private finishLine(): void {
    if (this.currentPoints.length < 2) {
      this.cancelDrawing();
      return;
    }

    const id = `${this.activeTool}_${Date.now()}`;
    const isMeasure = this.activeTool === 'measure-distance';
    const color = isMeasure ? '#2563EB' : '#DC2626';
    const points = [...this.currentPoints];

    const line = L.polyline(points, {
      color,
      weight: isMeasure ? 3 : 2,
      opacity: 0.8,
    });
    line.addTo(this.drawLayer);

    let measurement: string | undefined;
    let label: string | undefined;

    if (isMeasure) {
      const dist = polylineDistance(points);
      measurement = formatDistance(dist);
      label = `距离: ${measurement}`;
      // 在线段中点显示距离标签
      const midIdx = Math.floor(points.length / 2);
      const midPoint = points[midIdx];
      L.marker(midPoint, {
        icon: L.divIcon({
          className: 'measure-label',
          html: `<div style="background:#2563EB;color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;">${measurement}</div>`,
          iconSize: [100, 22],
          iconAnchor: [50, -12],
        }),
      }).addTo(this.drawLayer);
    } else {
      label = `线段 ${this.features.filter((f) => f.type === 'line').length + 1}`;
      line.bindTooltip(label, { direction: 'top' });
    }

    this.features.push({ id, type: 'line', layer: line, label, measurement });
    this.cancelDrawing();
  }

  /** 处理多边形/面积测量点击 */
  private handlePolygonClick(e: L.LeafletMouseEvent): void {
    this.currentPoints.push(e.latlng);
    this.updatePolygonPreview();
  }

  private handlePolygonMove(e: L.LeafletMouseEvent): void {
    if (this.currentPoints.length === 0) return;
    this.updatePolygonPreview(e.latlng);
  }

  private updatePolygonPreview(mouseLatLng?: L.LatLng): void {
    this.previewLayer.clearLayers();
    if (this.currentPoints.length === 0) return;

    const points = mouseLatLng ? [...this.currentPoints, mouseLatLng] : this.currentPoints;
    const isMeasure = this.activeTool === 'measure-area';
    const color = isMeasure ? '#059669' : '#7C3AED';

    // 绘制预览多边形
    if (points.length >= 2) {
      L.polyline(points, {
        color,
        weight: 2,
        dashArray: '6 4',
        opacity: 0.7,
      }).addTo(this.previewLayer);

      // 如果有3个以上点，闭合显示
      if (points.length >= 3) {
        L.polygon(points, {
          color,
          fillColor: color,
          fillOpacity: 0.1,
          weight: 1,
          dashArray: '4 4',
        }).addTo(this.previewLayer);
      }
    }

    // 面积测量：显示当前面积
    if (isMeasure && points.length >= 3) {
      const area = polygonArea(points);
      const lastPoint = points[points.length - 1];
      L.marker(lastPoint, {
        icon: L.divIcon({
          className: 'measure-label',
          html: `<div style="background:#059669;color:white;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap;">${formatArea(area)}</div>`,
          iconSize: [100, 20],
          iconAnchor: [50, -8],
        }),
      }).addTo(this.previewLayer);
    }

    // 顶点标记
    this.currentPoints.forEach((pt) => {
      L.circleMarker(pt, {
        radius: 4,
        fillColor: color,
        fillOpacity: 1,
        color: '#fff',
        weight: 1.5,
      }).addTo(this.previewLayer);
    });
  }

  private finishPolygon(): void {
    if (this.currentPoints.length < 3) {
      this.cancelDrawing();
      return;
    }

    const id = `${this.activeTool}_${Date.now()}`;
    const isMeasure = this.activeTool === 'measure-area';
    const color = isMeasure ? '#059669' : '#7C3AED';
    const points = [...this.currentPoints];

    const polygon = L.polygon(points, {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.15,
    });
    polygon.addTo(this.drawLayer);

    let measurement: string | undefined;
    let label: string | undefined;

    if (isMeasure) {
      const area = polygonArea(points);
      measurement = formatArea(area);
      label = `面积: ${measurement}`;

      // 在质心显示面积标签
      const centroid = points.reduce(
        (acc, pt) => ({
          lat: acc.lat + pt.lat / points.length,
          lng: acc.lng + pt.lng / points.length,
        }),
        { lat: 0, lng: 0 },
      );
      L.marker(centroid as L.LatLngExpression, {
        icon: L.divIcon({
          className: 'measure-label',
          html: `<div style="background:#059669;color:white;padding:3px 10px;border-radius:4px;font-size:13px;font-weight:600;white-space:nowrap;">${measurement}</div>`,
          iconSize: [120, 24],
          iconAnchor: [60, -12],
        }),
      }).addTo(this.drawLayer);
    } else {
      label = `多边形 ${this.features.filter((f) => f.type === 'polygon').length + 1}`;
      polygon.bindTooltip(label, { direction: 'center' });
    }

    this.features.push({ id, type: 'polygon', layer: polygon, label, measurement });
    this.cancelDrawing();
  }

  /** 处理圆形绘制点击 */
  private handleCircleClick(e: L.LeafletMouseEvent): void {
    if (this.currentPoints.length === 0) {
      this.currentPoints.push(e.latlng);
      this.updateCirclePreview(e.latlng);
    } else {
      // 第二次点击：确定半径，完成绘制
      const center = this.currentPoints[0];
      const radius = haversineDistance(center.lat, center.lng, e.latlng.lat, e.latlng.lng);

      const id = `circle_${Date.now()}`;
      const circle = L.circle(center as L.LatLngExpression, {
        radius,
        color: '#DC2626',
        weight: 2,
        fillColor: '#DC2626',
        fillOpacity: 0.1,
      });
      circle.addTo(this.drawLayer);

      const measurement = `r=${formatDistance(radius)}`;
      const label = `圆形 ${this.features.filter((f) => f.type === 'circle').length + 1} (${measurement})`;
      circle.bindTooltip(label, { direction: 'top' });

      this.features.push({ id, type: 'circle', layer: circle, label, measurement });
      this.cancelDrawing();
    }
  }

  private handleCircleMove(e: L.LeafletMouseEvent): void {
    if (this.currentPoints.length !== 1) return;
    this.updateCirclePreview(e.latlng);
  }

  private updateCirclePreview(mouseLatLng?: L.LatLng): void {
    this.previewLayer.clearLayers();
    if (this.currentPoints.length !== 1) return;

    const center = this.currentPoints[0];
    const currentLatLng = mouseLatLng || center;
    const radius = haversineDistance(center.lat, center.lng, currentLatLng.lat, currentLatLng.lng);

    // 预览圆
    L.circle(center, {
      radius,
      color: '#DC2626',
      weight: 2,
      dashArray: '6 4',
      fillColor: '#DC2626',
      fillOpacity: 0.05,
    }).addTo(this.previewLayer);

    // 中心点
    L.circleMarker(center, {
      radius: 4,
      fillColor: '#DC2626',
      fillOpacity: 1,
      color: '#fff',
      weight: 1.5,
    }).addTo(this.previewLayer);

    // 半径标签
    L.marker(currentLatLng, {
      icon: L.divIcon({
        className: 'measure-label',
        html: `<div style="background:#DC2626;color:white;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap;">r=${formatDistance(radius)}</div>`,
        iconSize: [80, 20],
        iconAnchor: [40, -8],
      }),
    }).addTo(this.previewLayer);
  }

  /** 取消当前绘制 */
  cancelDrawing(): void {
    this.currentPoints = [];
    this.previewLayer.clearLayers();
    this.notifyChange();
  }

  /** 撤销最后一个绘制 */
  undoLast(): void {
    const last = this.features.pop();
    if (last) {
      this.drawLayer.removeLayer(last.layer);
      this.notifyChange();
    }
  }

  /** 清空所有绘制 */
  clearAll(): void {
    this.features.forEach((f) => this.drawLayer.removeLayer(f.layer));
    this.features = [];
    this.previewLayer.clearLayers();
    this.currentPoints = [];
    this.notifyChange();
  }

  private removeHandlers(): void {
    if (this.clickHandler) {
      this.map.off('click', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.moveHandler) {
      this.map.off('mousemove', this.moveHandler);
      this.moveHandler = null;
    }
    if (this.dblClickHandler) {
      this.map.off('dblclick', this.dblClickHandler);
      this.dblClickHandler = null;
    }
  }

  private notifyChange(): void {
    if (this.onStateChange) this.onStateChange();
  }

  /** 销毁控制器 */
  destroy(): void {
    this.removeHandlers();
    this.cancelDrawing();
    this.clearAll();
    this.map.removeLayer(this.previewLayer);
    this.map.getContainer().style.cursor = '';
  }
}
