/**
 * T7: GIS导出下拉菜单（从 ProtectionZoneCalc 拆分）
 */

import { useToast } from '@/hooks/useToast';
import React from 'react';

import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';

interface GisExportMenuProps {
  zoneResults: ZoneCalcRecord[];
  sources: WaterSourceRecord[];
}

const GisExportMenu: React.FC<GisExportMenuProps> = ({ zoneResults, sources }) => {
  if (zoneResults.length === 0) return null;

  const prepareGisExport = () => {
    return zoneResults
      .map((zr) => {
        const source = sources.find((s) => s.name === zr.sourceName);
        const lng = source?.lng;
        const lat = source?.lat;
        if (lng == null || lat == null) return null;
        return generateSourceZoneVertices(zr.sourceId, zr.sourceName, lng, lat, zr.zones);
      })
      .filter(Boolean) as ReturnType<typeof generateSourceZoneVertices>[];
  };

  const toast = useToast();
  const handleExport = async (type: 'geojson' | 'kml' | 'wkt' | 'shp') => {
    const items = prepareGisExport();
    if (items.length === 0) {
      toast.warning('无已保存的计算结果');
      return;
    }
    const gis = await import('@/lib/zoneGISExporter');
    switch (type) {
      case 'geojson':
        gis.exportBatchGeoJSON(items);
        break;
      case 'kml':
        items.forEach((item) => gis.exportKML(item));
        break;
      case 'wkt':
        items.forEach((item) => gis.exportWKT(item));
        break;
      case 'shp':
        gis.exportBatchShapefileZip(items);
        break;
    }
  };

  return (
    <div className="relative group inline-block">
      <button className="text-xs px-2 py-1 rounded border border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        GIS导出
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className="absolute right-0 top-full mt-1 bg-white border border-purple-200 rounded-lg shadow-lg py-1 w-44 z-30 hidden group-hover:block">
        <button
          onClick={() => handleExport('geojson')}
          className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
        >
          <span className="text-green-500">●</span> GeoJSON（QGIS/ArcGIS通用）
        </button>
        <button
          onClick={() => handleExport('kml')}
          className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
        >
          <span className="text-blue-500">●</span> KML（Google Earth）
        </button>
        <button
          onClick={() => handleExport('wkt')}
          className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
        >
          <span className="text-amber-500">●</span> WKT（文本图层）
        </button>
        <button
          onClick={() => handleExport('shp')}
          className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
        >
          <span className="text-purple-500">●</span> Shapefile（.shp/.shx/.dbf ZIP）
        </button>
        <div className="border-t border-purple-100 my-1" />
        <div className="px-3 py-1.5 text-[9px] text-gray-400 leading-tight">
          导出所有已保存计算结果的保护区坐标
          <br />
          坐标系：WGS84（EPSG:4326）
        </div>
      </div>
    </div>
  );
};

export default GisExportMenu;
