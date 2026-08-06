import { describe, it, expect } from 'vitest';
import {
  parseGeoJSON,
  parseKML,
  parseSpatialCSV,
  parseSpatialData,
  featureToQuerySource,
  featureToSensitiveTarget,
} from '../lib/spatialDataImportEngine';

describe('spatialDataImportEngine (S12.12)', () => {
  describe('parseGeoJSON', () => {
    it('应解析FeatureCollection中的点要素', () => {
      const geojson = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: '水源A' },
            geometry: { type: 'Point', coordinates: [114.5, 38.1] },
          },
        ],
      });
      const features = parseGeoJSON(geojson);
      expect(features.length).toBe(1);
      expect(features[0].kind).toBe('point');
      expect(features[0].lng).toBe(114.5);
      expect(features[0].lat).toBe(38.1);
      expect(features[0].name).toBe('水源A');
    });

    it('应解析Polygon要素为闭合环', () => {
      const geojson = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: '保护区' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [114, 38],
                  [114.1, 38],
                  [114.1, 38.1],
                  [114, 38],
                ],
              ],
            },
          },
        ],
      });
      const features = parseGeoJSON(geojson);
      expect(features.length).toBe(1);
      expect(features[0].kind).toBe('polygon');
      expect(features[0].ring!.length).toBe(4);
      // 已闭合：首尾相同
      const r = features[0].ring!;
      expect(r[0][0]).toBe(r[r.length - 1][0]);
    });

    it('应解析单个Feature对象', () => {
      const geojson = JSON.stringify({
        type: 'Feature',
        properties: { name: '单点' },
        geometry: { type: 'Point', coordinates: [110, 30] },
      });
      const features = parseGeoJSON(geojson);
      expect(features.length).toBe(1);
      expect(features[0].name).toBe('单点');
    });
  });

  describe('parseKML', () => {
    it('应解析Placemark中的点坐标', () => {
      const kml = `<?xml version="1.0"?>
<kml><Document>
  <Placemark>
    <name>水库A</name>
    <Point><coordinates>114.5,38.1,0</coordinates></Point>
  </Placemark>
</Document></kml>`;
      const features = parseKML(kml);
      expect(features.length).toBe(1);
      expect(features[0].kind).toBe('point');
      expect(features[0].name).toBe('水库A');
      expect(features[0].lng).toBe(114.5);
      expect(features[0].lat).toBe(38.1);
    });

    it('应解析Polygon的坐标环', () => {
      const kml = `<?xml version="1.0"?>
<kml><Document>
  <Placemark>
    <name>保护区B</name>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>
        114,38 114.1,38 114.1,38.1 114,38
      </coordinates></LinearRing></outerBoundaryIs>
    </Polygon>
  </Placemark>
</Document></kml>`;
      const features = parseKML(kml);
      expect(features.length).toBe(1);
      expect(features[0].kind).toBe('polygon');
      expect(features[0].ring!.length).toBeGreaterThanOrEqual(4);
    });

    it('应解码XML实体', () => {
      const kml = `<Placemark><name>A&amp;B</name><Point><coordinates>1,2,0</coordinates></Point></Placemark>`;
      const features = parseKML(kml);
      expect(features[0].name).toBe('A&B');
    });
  });

  describe('parseSpatialCSV', () => {
    it('应自动检测经度纬度列名', () => {
      const csv = `name,经度,纬度,type
水源C,114.5,38.1,水库
水源D,115.0,38.5,地下水`;
      const features = parseSpatialCSV(csv);
      expect(features.length).toBe(2);
      expect(features[0].name).toBe('水源C');
      expect(features[0].lng).toBe(114.5);
      expect(features[0].lat).toBe(38.1);
      expect(features[0].properties.type).toBe('水库');
    });

    it('应支持英文列名lng/lat', () => {
      const csv = `name,lng,lat
水源E,113,39`;
      const features = parseSpatialCSV(csv);
      expect(features.length).toBe(1);
      expect(features[0].lng).toBe(113);
    });

    it('缺少经纬度列时返回空', () => {
      const csv = `name,desc
水源,描述`;
      const features = parseSpatialCSV(csv);
      expect(features.length).toBe(0);
    });
  });

  describe('parseSpatialData 统一入口', () => {
    it('geojson格式正确', () => {
      const result = parseSpatialData('{"type":"Feature","geometry":{"type":"Point","coordinates":[1,2]},"properties":{}}', 'geojson');
      expect(result.format).toBe('geojson');
      expect(result.features.length).toBe(1);
    });

    it('解析失败时返回警告', () => {
      const result = parseSpatialData('{invalid json', 'geojson');
      expect(result.features.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('featureToQuerySource / featureToSensitiveTarget', () => {
    it('要素转查询源', () => {
      const f = parseSpatialCSV('name,lng,lat,level,zoneRadiusM\n水,114,38,二级,1000')[0];
      const src = featureToQuerySource(f);
      expect(src.name).toBe('水');
      expect(src.level).toBe('二级');
      expect(src.zoneRadiusM).toBe(1000);
    });

    it('要素转敏感目标', () => {
      const f = parseSpatialCSV('name,lng,lat,category\n学校,114,38,school')[0];
      const t = featureToSensitiveTarget(f);
      expect(t.name).toBe('学校');
      expect(t.category).toBe('school');
    });
  });
});
