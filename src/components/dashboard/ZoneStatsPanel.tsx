import React from 'react';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ZoneResult } from '@/lib/zoneCalcEngine';

const cityOrder = [
  '石家庄市', '唐山市', '秦皇岛市', '邯郸市', '邢台市',
  '保定市', '张家口市', '承德市', '沧州市', '廊坊市',
  '衡水市', '辛集市', '定州市',
];

const ZoneStatsPanel: React.FC<{
  zoneResults: ZoneCalcRecord[];
  sources: WaterSourceRecord[];
}> = ({ zoneResults, sources }) => {
  if (zoneResults.length === 0) {
    return (
      <div className="rounded-lg p-8 bg-white border border-gray-200 text-center">
        <div className="text-gray-400 mb-3">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500">暂无保护区计算数据</p>
        <p className="text-xs text-gray-400 mt-1">
          请先前往{' '}
          <a href="#/zone-calc" className="text-blue-600 hover:underline">保护区划分</a>{' '}
          页面进行计算
        </p>
      </div>
    );
  }

  const zs = zoneResults;
  const allZones: ZoneResult[] = zs.flatMap((z) => z.zones);
  const primaryZones = allZones.filter((z) => z.level === '一级');
  const secondaryZones = allZones.filter((z) => z.level === '二级');
  const quasiZones = allZones.filter((z) => z.level === '准保护区');
  const totalPrimaryArea = primaryZones.reduce((s, z) => s + z.area, 0);
  const totalSecondaryArea = secondaryZones.reduce((s, z) => s + z.area, 0);
  const totalQuasiArea = quasiZones.reduce((s, z) => s + z.area, 0);
  const methodCounts: Record<string, number> = {};
  allZones.forEach((z) => { methodCounts[z.method] = (methodCounts[z.method] || 0) + 1; });

  const nameToCity = new Map<string, string>();
  sources.forEach((s) => nameToCity.set(s.name, s.cityName));

  const cityZoneMap = new Map<string, {
    count: number; primaryArea: number; secondaryArea: number;
    totalArea: number; sources: string[];
  }>();
  zs.forEach((zr) => {
    const city = nameToCity.get(zr.sourceName) || '未知';
    const pArea = zr.zones.find((z) => z.level === '一级')?.area || 0;
    const sArea = zr.zones.find((z) => z.level === '二级')?.area || 0;
    const existing = cityZoneMap.get(city) || {
      count: 0, primaryArea: 0, secondaryArea: 0, totalArea: 0, sources: [],
    };
    existing.count++;
    existing.primaryArea += pArea;
    existing.secondaryArea += sArea;
    existing.totalArea += pArea + sArea;
    existing.sources.push(zr.sourceName);
    cityZoneMap.set(city, existing);
  });

  const cityZoneData = cityOrder
    .map((city) => cityZoneMap.get(city))
    .filter(Boolean) as any[];
  const maxCityZoneArea = Math.max(...cityZoneData.map((d) => d.totalArea), 1);

  const gwTypeMap = new Map<string, number>();
  zs.forEach((zr) => {
    const t = zr.params.gwType || zr.params.swType || '未分类';
    gwTypeMap.set(t, (gwTypeMap.get(t) || 0) + 1);
  });

  const totalZoneCount = zs.length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        已对 <b className="text-gray-700">{totalZoneCount}</b>{' '}
        个水源地完成保护区划分计算，覆盖 {cityZoneMap.size} 个城市
      </p>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '已计算水源地', value: totalZoneCount, sub: `覆盖${cityZoneMap.size}市`, color: 'text-blue-800' },
          { label: '一级保护区总面积', value: totalPrimaryArea.toFixed(1), sub: 'km²', color: 'text-blue-600' },
          { label: '二级保护区总面积', value: totalSecondaryArea.toFixed(1), sub: 'km²', color: 'text-green-600' },
          { label: '准保护区总面积', value: totalQuasiArea.toFixed(1), sub: 'km²', color: 'text-amber-600' },
          { label: '保护区总面积', value: (totalPrimaryArea + totalSecondaryArea + totalQuasiArea).toFixed(1), sub: 'km²', color: 'text-red-600' },
        ].map((card) => (
          <div key={card.label} className="rounded-lg p-3 bg-white border border-gray-200">
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</div>
            <div className="text-xs mt-1 text-gray-500">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 各市保护区面积柱状图 + 右侧分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg p-4 md:p-6 bg-white border border-gray-200">
          <h2 className="text-sm font-semibold mb-3">各市保护区面积分布（km²）</h2>
          <div className="space-y-1.5">
            {cityZoneData.map((d) => (
              <div key={d.cityName || '未知'} className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 truncate text-gray-500">{(d.cityName || '未知').replace('市', '')}</span>
                <div className="flex-1 h-4 rounded overflow-hidden bg-gray-100 flex">
                  <div className="h-full bg-blue-500 flex items-center justify-center text-[10px] text-white"
                    style={{ width: `${(d.primaryArea / maxCityZoneArea) * 100}%`, minWidth: d.primaryArea > 0 ? 2 : 0 }}>
                    {d.primaryArea > 0 ? d.primaryArea.toFixed(2) : ''}
                  </div>
                  <div className="h-full bg-green-500 flex items-center justify-center text-[10px] text-white"
                    style={{ width: `${(d.secondaryArea / maxCityZoneArea) * 100}%`, minWidth: d.secondaryArea > 0 ? 2 : 0 }}>
                    {d.secondaryArea > 0 ? d.secondaryArea.toFixed(2) : ''}
                  </div>
                </div>
                <span className="w-12 text-right font-bold shrink-0">{d.totalArea.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-500"></span>一级</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-500"></span>二级</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* 计算方法分布 */}
          <div className="rounded-lg p-4 bg-white border border-gray-200">
            <h2 className="text-sm font-semibold mb-3">计算方法分布</h2>
            <div className="space-y-2">
              {Object.entries(methodCounts).sort((a, b) => b[1] - a[1]).map(([method, count]) => (
                <div key={method} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{method}</span>
                  <div className="w-24 h-4 rounded overflow-hidden bg-gray-100">
                    <div className="h-full bg-accent-500 rounded"
                      style={{ width: `${(count / allZones.length) * 100}%` }}></div>
                  </div>
                  <span className="w-6 text-right font-bold shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 水源类型分布 */}
          <div className="rounded-lg p-4 bg-white border border-gray-200">
            <h2 className="text-sm font-semibold mb-3">水源类型分布</h2>
            <div className="space-y-1.5">
              {[...gwTypeMap.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{type}</span>
                  <div className="w-20 h-4 rounded overflow-hidden bg-gray-100">
                    <div className="h-full bg-violet-500 rounded"
                      style={{ width: `${(count / zs.length) * 100}%` }}></div>
                  </div>
                  <span className="w-6 text-right font-bold shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 保护区面积TOP10排名 */}
      <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
        <h2 className="text-sm font-semibold mb-3">保护区面积 TOP 10 水源地</h2>
        <div className="space-y-1.5">
          {[...zs]
            .sort((a, b) => {
              const aArea = a.zones.reduce((s, z) => s + z.area, 0);
              const bArea = b.zones.reduce((s, z) => s + z.area, 0);
              return bArea - aArea;
            })
            .slice(0, 10)
            .map((zr, i) => {
              const area = zr.zones.reduce((s, z) => s + z.area, 0);
              const maxArea = Math.max(...zs.map((z) => z.zones.reduce((s, zz) => s + zz.area, 0)));
              return (
                <div key={zr.id} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-right shrink-0 font-bold text-gray-400">{i + 1}</span>
                  <span className="w-32 shrink-0 truncate">{zr.sourceName}</span>
                  <div className="flex-1 h-4 rounded overflow-hidden bg-gray-100">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded"
                      style={{ width: `${(area / maxArea) * 100}%` }}></div>
                  </div>
                  <span className="w-16 text-right font-bold shrink-0">{area.toFixed(3)} km²</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* 各市保护区面积占比环形图 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 一级保护区面积占比 */}
        <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
          <h2 className="text-sm font-semibold mb-3">各市一级保护区面积占比</h2>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
              {(() => {
                const total = cityZoneData.reduce((s, d) => s + d.primaryArea, 0);
                let acc = 0;
                const colors = ['#2F5496', '#548235', '#BF8F00', '#0EA5E9', '#8B5CF6',
                  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
                const segments = cityZoneData.map((d, i) => {
                  const pct = (d.primaryArea / total) * 100;
                  const seg = { color: colors[i % colors.length], start: acc, end: acc + pct };
                  acc += pct;
                  return seg;
                });
                const gradient = segments
                  .map((s) => `${s.color} ${s.start}% ${s.end}%`)
                  .join(', ');
                return (
                  <>
                    <div className="rounded-full" style={{
                      width: 120, height: 120,
                      background: `conic-gradient(${gradient})`,
                    }}></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full flex items-center justify-center text-center bg-white"
                        style={{ width: 70, height: 70 }}>
                        <div>
                          <div className="text-sm font-bold">{total.toFixed(1)}</div>
                          <div className="text-[10px] text-gray-500">km²</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="flex-1 space-y-1">
              {cityZoneData.filter((d) => d.primaryArea > 0).map((d, i) => {
                const colors = ['#2F5496', '#548235', '#BF8F00', '#0EA5E9', '#8B5CF6',
                  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
                const total = cityZoneData.reduce((s, x) => s + x.primaryArea, 0);
                return (
                  <div key={d.cityName} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: colors[i % colors.length] }}></span>
                    <span className="flex-1 truncate">{d.cityName}</span>
                    <span className="font-bold">{d.primaryArea.toFixed(2)}</span>
                    <span className="text-gray-400 w-10 text-right">{((d.primaryArea / total) * 100).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 二级保护区面积占比 */}
        <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
          <h2 className="text-sm font-semibold mb-3">各市二级保护区面积占比</h2>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
              {(() => {
                const total = cityZoneData.reduce((s, d) => s + d.secondaryArea, 0);
                let acc = 0;
                const colors = ['#548235', '#2F5496', '#BF8F00', '#0EA5E9', '#8B5CF6',
                  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
                const segments = cityZoneData.map((d, i) => {
                  const pct = (d.secondaryArea / total) * 100;
                  const seg = { color: colors[i % colors.length], start: acc, end: acc + pct };
                  acc += pct;
                  return seg;
                });
                const gradient = segments
                  .map((s) => `${s.color} ${s.start}% ${s.end}%`)
                  .join(', ');
                return (
                  <>
                    <div className="rounded-full" style={{
                      width: 120, height: 120,
                      background: `conic-gradient(${gradient})`,
                    }}></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full flex items-center justify-center text-center bg-white"
                        style={{ width: 70, height: 70 }}>
                        <div>
                          <div className="text-sm font-bold">{total.toFixed(1)}</div>
                          <div className="text-[10px] text-gray-500">km²</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="flex-1 space-y-1">
              {cityZoneData.filter((d) => d.secondaryArea > 0).map((d, i) => {
                const colors = ['#548235', '#2F5496', '#BF8F00', '#0EA5E9', '#8B5CF6',
                  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
                const total = cityZoneData.reduce((s, x) => s + x.secondaryArea, 0);
                return (
                  <div key={d.cityName} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: colors[i % colors.length] }}></span>
                    <span className="flex-1 truncate">{d.cityName}</span>
                    <span className="font-bold">{d.secondaryArea.toFixed(2)}</span>
                    <span className="text-gray-400 w-10 text-right">{((d.secondaryArea / total) * 100).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 保护区明细表 */}
      <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
        <div className="p-4 pb-2">
          <h2 className="text-sm font-semibold">保护区计算结果明细</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-500">城市</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">水源地</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500">方法</th>
                <th className="px-3 py-2 text-center font-semibold text-blue-600">一级面积(km²)</th>
                <th className="px-3 py-2 text-center font-semibold text-green-600">二级面积(km²)</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500">总面积(km²)</th>
              </tr>
            </thead>
            <tbody>
              {zs.map((zr) => {
                const city = nameToCity.get(zr.sourceName) || '未知';
                const pArea = zr.zones.find((z) => z.level === '一级')?.area || 0;
                const sArea = zr.zones.find((z) => z.level === '二级')?.area || 0;
                const method = zr.zones[0]?.method || '-';
                return (
                  <tr key={zr.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">{city}</td>
                    <td className="px-3 py-2 font-medium">{zr.sourceName}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{method}</td>
                    <td className="px-3 py-2 text-center text-blue-600">{pArea.toFixed(3)}</td>
                    <td className="px-3 py-2 text-center text-green-600">{sArea.toFixed(3)}</td>
                    <td className="px-3 py-2 text-center font-bold">{(pArea + sArea).toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ZoneStatsPanel;
