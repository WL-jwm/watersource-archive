import type { WaterSourceReport, WaterSource, Well, ProtectionZone } from '@/types';

// 生成统计摘要
export function getReportStats(reports: WaterSourceReport[]) {
  const reportCount = reports.length;
  const sourceCount = reports.reduce((sum, r) => sum + r.waterSources.length, 0);
  const wellCount = reports.reduce(
    (sum, r) => sum + r.waterSources.reduce((s, ws) => s + ws.wells.length, 0),
    0,
  );
  const totalArea = reports.reduce(
    (sum, r) =>
      sum +
      r.waterSources.reduce(
        (s, ws) => s + ws.protectionZones.reduce((z, pz) => z + (pz.area || 0), 0),
        0,
      ),
    0,
  );
  const totalServicePop = reports.reduce(
    (sum, r) => sum + r.waterSources.reduce((s, ws) => s + ws.servicePopulation, 0),
    0,
  );
  const totalDailyYield = reports.reduce(
    (sum, r) => sum + r.waterSources.reduce((s, ws) => s + ws.dailyYield, 0),
    0,
  );
  const regions = [...new Set(reports.map((r) => r.region))];

  return {
    reportCount,
    sourceCount,
    wellCount,
    totalArea,
    totalServicePop,
    totalDailyYield,
    regions,
  };
}

// 数字格式化
export function formatNumber(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(2) + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return n.toLocaleString('zh-CN');
}

// 坐标格式化
export function formatCoord(lng: number, lat: number): string {
  const lngDir = lng >= 0 ? 'E' : 'W';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngD = Math.abs(lng);
  const latD = Math.abs(lat);
  return `${latD.toFixed(6)}${latDir}, ${lngD.toFixed(6)}${lngDir}`;
}

// 面积格式化
export function formatArea(km2: number): string {
  if (km2 < 0.01) return (km2 * 1000000).toFixed(0) + ' m2';
  if (km2 < 1) return (km2 * 100).toFixed(2) + ' ha';
  return km2.toFixed(2) + ' km2';
}

// 供水量格式化
export function formatYield(m3d: number): string {
  if (m3d >= 10000) return (m3d / 10000).toFixed(1) + '万m3/d';
  return m3d.toLocaleString('zh-CN') + ' m3/d';
}

// 标准指数颜色
export function getPiColor(pi: number): string {
  if (pi === 0) return 'text-text-tertiary';
  if (pi <= 0.4) return 'text-success';
  if (pi <= 0.7) return 'text-accent-500';
  if (pi <= 1.0) return 'text-warning';
  return 'text-danger';
}

// 标准指数进度条宽度
export function getPiWidth(pi: number): number {
  if (pi === 0) return 0;
  return Math.min((pi / 1.5) * 100, 100);
}

// 水质类别颜色
export function getClassColor(cls: string): string {
  switch (cls) {
    case 'I类':
      return 'badge-success';
    case 'II类':
      return 'badge-info';
    case 'III类':
      return 'badge-neutral';
    case 'IV类':
      return 'badge-warning';
    case 'V类':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

// 保护区级别样式
export function getZoneLevelClass(level: string): string {
  if (level.includes('一级')) return 'zone-level-1';
  if (level.includes('二级')) return 'zone-level-2';
  return 'zone-level-quasi';
}

// 风险等级颜色
export function getRiskColor(level: string): string {
  switch (level) {
    case '高风险':
      return 'badge-danger';
    case '中风险':
      return 'badge-warning';
    case '低风险':
      return 'badge-info';
    case '无风险':
      return 'badge-success';
    default:
      return 'badge-neutral';
  }
}

// 文件下载
export function downloadJSON(data: string, filename: string) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 文件读取
export function readJSONFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// 搜索过滤
export function searchReports(reports: WaterSourceReport[], query: string): WaterSourceReport[] {
  if (!query.trim()) return reports;
  const q = query.toLowerCase();
  return reports.filter((r) => {
    const fields = [
      r.reportName,
      r.region,
      r.entrustUnit,
      r.compileUnit,
      r.approvalDoc,
      ...r.waterSources.map((ws) => ws.name + ws.code + ws.location),
    ];
    return fields.some((f) => f.toLowerCase().includes(q));
  });
}

// 获取保护区总面积
export function getTotalZoneArea(source: WaterSource): number {
  return source.protectionZones.reduce((sum, z) => sum + z.area, 0);
}

// 获取保护区拐点总数
export function getTotalZonePoints(source: WaterSource): number {
  return source.protectionZones.reduce((sum, z) => sum + z.boundaryPoints.length, 0);
}

// 生成唯一ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
