import React, { useMemo, useEffect } from 'react';
import { useWaterSourceStore, ZoneCalcRecord } from '@/stores/waterSourceStore';
import { ZoneResult } from '@/lib/zoneCalcEngine';
import { batchGenerateCodes, summarizeCodes } from '@/lib/waterSourceCoder';

const cityOrder = [
  '石家庄市',
  '唐山市',
  '秦皇岛市',
  '邯郸市',
  '邢台市',
  '保定市',
  '张家口市',
  '承德市',
  '沧州市',
  '廊坊市',
  '衡水市',
  '辛集市',
  '定州市',
];

const cityArea: Record<string, number> = {
  石家庄市: 15848,
  唐山市: 14324,
  秦皇岛市: 7802,
  邯郸市: 12066,
  邢台市: 12400,
  保定市: 22113,
  张家口市: 36357,
  承德市: 39512,
  沧州市: 14056,
  廊坊市: 6429,
  衡水市: 8815,
  辛集市: 960,
  定州市: 1283,
};

const Dashboard: React.FC = () => {
  const { loaded, sources, zoneResults, initDB, loadZoneResults } = useWaterSourceStore();
  const wsStats = useWaterSourceStore((s) => s.getStats());

  useEffect(() => {
    initDB();
  }, []);
  useEffect(() => {
    if (loaded && zoneResults.length === 0) loadZoneResults();
  }, [loaded]);

  const cityData = useMemo(() => {
    if (!loaded) return [];
    return cityOrder.map((cityName) => {
      const citySources = sources.filter((s) => s.cityName === cityName);
      const m = citySources.filter((s) => s.level === 'municipal').length;
      const c = citySources.filter((s) => s.level === 'county').length;
      const t = citySources.filter((s) => s.level === 'township').length;
      const total = m + c + t;
      const area = cityArea[cityName] || 0;
      const density = area > 0 ? ((total / area) * 10000).toFixed(2) : '0';
      const surface = citySources.filter((s) => s.type === '地表水').length;
      const ground = citySources.filter((s) => s.type === '地下水').length;
      const population = citySources.reduce((sum, s) => sum + (s.population || 0), 0);
      return {
        cityName,
        municipal: m,
        county: c,
        township: t,
        total,
        surface,
        ground,
        area,
        density,
        population,
      };
    });
  }, [loaded, sources]);

  const totalAll = cityData.reduce((s, d) => s + d.total, 0);
  const totalMunicipal = cityData.reduce((s, d) => s + d.municipal, 0);
  const totalCounty = cityData.reduce((s, d) => s + d.county, 0);
  const totalTownship = cityData.reduce((s, d) => s + d.township, 0);
  const totalSurface = cityData.reduce((s, d) => s + d.surface, 0);
  const totalGround = cityData.reduce((s, d) => s + d.ground, 0);
  const totalPopulation = cityData.reduce((s, d) => s + d.population, 0);
  const maxTotal = Math.max(...cityData.map((d) => d.total));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">河北省水源地统计仪表盘</h1>
        <p className="text-sm mt-1 text-gray-500">基于 {totalAll} 个水源地的综合统计分析</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '水源地总数', value: totalAll, sub: '13个地级市', color: 'text-blue-800' },
          {
            label: '市级',
            value: totalMunicipal,
            sub: `${((totalMunicipal / totalAll) * 100).toFixed(1)}%`,
            color: 'text-blue-600',
          },
          {
            label: '县级',
            value: totalCounty,
            sub: `${((totalCounty / totalAll) * 100).toFixed(1)}%`,
            color: 'text-green-600',
          },
          {
            label: '乡镇级',
            value: totalTownship,
            sub: `${((totalTownship / totalAll) * 100).toFixed(1)}%`,
            color: 'text-amber-600',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-lg p-4 bg-white border border-gray-200">
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className={`text-2xl md:text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
            <div className="text-xs mt-1 text-gray-500">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          {
            label: '地表水源地',
            value: totalSurface,
            sub: `${((totalSurface / totalAll) * 100).toFixed(1)}%`,
            color: 'text-sky-600',
          },
          {
            label: '地下水源地',
            value: totalGround,
            sub: `${((totalGround / totalAll) * 100).toFixed(1)}%`,
            color: 'text-violet-600',
          },
          {
            label: '全省平均密度',
            value: `${((totalAll / 188800) * 10000).toFixed(2)}`,
            sub: '个/万km2',
            color: 'text-red-600',
          },
          {
            label: '供水总人口',
            value: totalPopulation > 0 ? `${totalPopulation.toFixed(1)}` : '-',
            sub:
              totalPopulation > 0
                ? `${cityData.filter((d) => d.population > 0).length}市有数据`
                : '暂无数据',
            color: 'text-emerald-600',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-lg p-4 bg-white border border-gray-200">
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className={`text-2xl md:text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
            <div className="text-xs mt-1 text-gray-500">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* P4-8: 编码规范化统计 */}
      {loaded &&
        (() => {
          const codeMap = batchGenerateCodes(sources);
          const codeStats = summarizeCodes(codeMap);
          return (
            <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base md:text-lg font-semibold">水源地编码统计</h2>
                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                  SD + 行政区划(6) + 类型(1) + 级别(1) + 序号(3)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-600">{codeStats.total}</div>
                  <div className="text-[9px] text-blue-400">已编码水源地</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-600">{codeStats.byCity.length}</div>
                  <div className="text-[9px] text-green-400">覆盖城市</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-amber-600">
                    {codeStats.byType.find((t) => t.type === '地下水')?.count || 0}
                  </div>
                  <div className="text-[9px] text-amber-400">地下水</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {codeStats.byType.find((t) => t.type === '地表水')?.count || 0}
                  </div>
                  <div className="text-[9px] text-purple-400">地表水</div>
                </div>
              </div>
              {/* 编码示例 */}
              <div className="text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg p-3">
                <div className="font-medium text-gray-600">编码示例：</div>
                <code className="text-[10px] bg-white px-2 py-1 rounded border">
                  SD130100-1-1-001 → 石家庄市(130100) + 地下水(1) + 市级(1) + 001号
                </code>
                <code className="text-[10px] bg-white px-2 py-1 rounded border ml-2">
                  SD130200-2-2-003 → 唐山市(130200) + 地表水(2) + 县级(2) + 003号
                </code>
              </div>
            </div>
          );
        })()}

      {/* 各市堆叠水平柱状图 */}
      <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
        <h2 className="text-base md:text-lg font-semibold mb-4">各市水源地数量分布</h2>
        <div className="space-y-2">
          {cityData.map((d) => (
            <div key={d.cityName} className="flex items-center gap-2">
              <div className="w-16 md:w-20 text-xs text-right shrink-0 truncate text-gray-500">
                {d.cityName.replace('市', '')}
              </div>
              <div className="flex-1 h-6 rounded overflow-hidden flex bg-gray-100">
                {d.total > 0 && (
                  <>
                    <div
                      className="h-full flex items-center justify-center text-xs text-white"
                      style={{
                        width: `${(d.municipal / maxTotal) * 100}%`,
                        background: '#2F5496',
                        minWidth: d.municipal > 0 ? 2 : 0,
                      }}
                    >
                      {d.municipal}
                    </div>
                    <div
                      className="h-full flex items-center justify-center text-xs text-white"
                      style={{
                        width: `${(d.county / maxTotal) * 100}%`,
                        background: '#548235',
                        minWidth: d.county > 0 ? 2 : 0,
                      }}
                    >
                      {d.county}
                    </div>
                    <div
                      className="h-full flex items-center justify-center text-xs text-white"
                      style={{
                        width: `${(d.township / maxTotal) * 100}%`,
                        background: '#BF8F00',
                        minWidth: d.township > 0 ? 2 : 0,
                      }}
                    >
                      {d.township > 0 ? d.township : ''}
                    </div>
                  </>
                )}
              </div>
              <div className="w-10 text-xs font-bold text-right shrink-0">{d.total}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: '#2F5496' }}
            ></span>
            市级
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: '#548235' }}
            ></span>
            县级
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: '#BF8F00' }}
            ></span>
            乡镇级
          </span>
        </div>
      </div>

      {/* 饼图 + 密度排名 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
          <h2 className="text-base md:text-lg font-semibold mb-4">水源类型占比</h2>
          <div className="flex items-center gap-6">
            <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
              <div
                className="rounded-full"
                style={{
                  width: 140,
                  height: 140,
                  background: `conic-gradient(#0EA5E9 0% ${(totalSurface / totalAll) * 100}%, #8B5CF6 ${(totalSurface / totalAll) * 100}% 100%)`,
                }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="rounded-full flex items-center justify-center text-center bg-white"
                  style={{ width: 80, height: 80 }}
                >
                  <div>
                    <div className="text-lg font-bold">{totalAll}</div>
                    <div className="text-xs text-gray-500">总数</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm shrink-0 bg-sky-500"></span>地表水
                </div>
                <div className="ml-5 text-lg font-bold text-sky-600">{totalSurface}</div>
                <div className="ml-5 text-xs text-gray-500">
                  {((totalSurface / totalAll) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm shrink-0 bg-violet-500"></span>地下水
                </div>
                <div className="ml-5 text-lg font-bold text-violet-600">{totalGround}</div>
                <div className="ml-5 text-xs text-gray-500">
                  {((totalGround / totalAll) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
          <h2 className="text-base md:text-lg font-semibold mb-4">水源地密度排名（个/万km2）</h2>
          <div className="space-y-1.5">
            {[...cityData]
              .sort((a, b) => parseFloat(b.density) - parseFloat(a.density))
              .map((d, i) => {
                const avgDensity = (totalAll / 188800) * 10000;
                const dn = parseFloat(d.density);
                const isAbove = dn >= avgDensity;
                const maxD = Math.max(...cityData.map((x) => parseFloat(x.density)));
                return (
                  <div key={d.cityName} className="flex items-center gap-2 text-xs">
                    <span
                      className={`w-4 text-right shrink-0 font-bold ${isAbove ? 'text-red-600' : 'text-gray-400'}`}
                    >
                      {i + 1}
                    </span>
                    <span className="w-14 shrink-0 truncate">{d.cityName.replace('市', '')}</span>
                    <div className="flex-1 h-4 rounded overflow-hidden bg-gray-100">
                      <div
                        className={`h-full rounded ${isAbove ? 'bg-red-500' : 'bg-gray-400'}`}
                        style={{ width: `${Math.min(100, (dn / maxD) * 100)}%` }}
                      ></div>
                    </div>
                    <span
                      className={`w-12 text-right font-bold shrink-0 ${isAbove ? 'text-red-600' : ''}`}
                    >
                      {d.density}
                    </span>
                  </div>
                );
              })}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            全省均值: {((totalAll / 188800) * 10000).toFixed(2)}
          </div>
        </div>
      </div>

      {/* ====== 保护区统计 ====== */}
      <div className="space-y-4">
        {/* 分隔标题 */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200"></div>
          <span className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            保护区统计
          </span>
          <div className="h-px flex-1 bg-gray-200"></div>
        </div>

        {zoneResults.length === 0 ? (
          <div className="rounded-lg p-8 bg-white border border-gray-200 text-center">
            <div className="text-gray-400 mb-3">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500">暂无保护区计算数据</p>
            <p className="text-xs text-gray-400 mt-1">
              请先前往{' '}
              <a href="#/zone-calc" className="text-blue-600 hover:underline">
                保护区划分
              </a>{' '}
              页面进行计算
            </p>
          </div>
        ) : (
          zoneResults.length > 0 &&
          (() => {
            const zs = zoneResults;

            // 汇总
            const totalZoneCount = zs.length;
            const allZones: ZoneResult[] = zs.flatMap((z) => z.zones);
            const primaryZones = allZones.filter((z) => z.level === '一级');
            const secondaryZones = allZones.filter((z) => z.level === '二级');
            const quasiZones = allZones.filter((z) => z.level === '准保护区');
            const totalPrimaryArea = primaryZones.reduce((s, z) => s + z.area, 0);
            const totalSecondaryArea = secondaryZones.reduce((s, z) => s + z.area, 0);
            const totalQuasiArea = quasiZones.reduce((s, z) => s + z.area, 0);
            const methodCounts: Record<string, number> = {};
            allZones.forEach((z) => {
              methodCounts[z.method] = (methodCounts[z.method] || 0) + 1;
            });

            // 建立水源地 -> 城市的映射
            const nameToCity = new Map<string, string>();
            sources.forEach((s) => nameToCity.set(s.name, s.cityName));

            // 按城市分组
            const cityZoneMap = new Map<
              string,
              {
                count: number;
                primaryArea: number;
                secondaryArea: number;
                totalArea: number;
                sources: string[];
              }
            >();
            zs.forEach((zr) => {
              const city = nameToCity.get(zr.sourceName) || '未知';
              const pArea = zr.zones.find((z) => z.level === '一级')?.area || 0;
              const sArea = zr.zones.find((z) => z.level === '二级')?.area || 0;
              const existing = cityZoneMap.get(city) || {
                count: 0,
                primaryArea: 0,
                secondaryArea: 0,
                totalArea: 0,
                sources: [],
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
              .filter(Boolean) as typeof zs extends (infer T)[] ? any[] : never[];
            const maxCityZoneArea = Math.max(...cityZoneData.map((d) => d.totalArea), 1);

            // 按地下水类型分组
            const gwTypeMap = new Map<string, number>();
            zs.forEach((zr) => {
              const t = zr.params.gwType || zr.params.swType || '未分类';
              gwTypeMap.set(t, (gwTypeMap.get(t) || 0) + 1);
            });

            return (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  已对 <b className="text-gray-700">{totalZoneCount}</b>{' '}
                  个水源地完成保护区划分计算，覆盖 {cityZoneMap.size} 个城市
                </p>

                {/* 汇总卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    {
                      label: '已计算水源地',
                      value: totalZoneCount,
                      sub: `覆盖${cityZoneMap.size}市`,
                      color: 'text-blue-800',
                    },
                    {
                      label: '一级保护区总面积',
                      value: totalPrimaryArea.toFixed(1),
                      sub: `${primaryZones.length}个`,
                      color: 'text-red-600',
                    },
                    {
                      label: '二级保护区总面积',
                      value: totalSecondaryArea.toFixed(1),
                      sub: `${secondaryZones.length}个`,
                      color: 'text-orange-600',
                    },
                    {
                      label: '准保护区总面积',
                      value: totalQuasiArea.toFixed(1),
                      sub: `${quasiZones.length}个`,
                      color: 'text-yellow-600',
                    },
                    {
                      label: '保护区总面积',
                      value: (totalPrimaryArea + totalSecondaryArea + totalQuasiArea).toFixed(1),
                      sub: 'km²',
                      color: 'text-violet-600',
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="rounded-lg p-3 bg-white border border-gray-200"
                    >
                      <div className="text-[10px] text-gray-500">{card.label}</div>
                      <div className={`text-xl font-bold mt-0.5 ${card.color}`}>{card.value}</div>
                      <div className="text-[10px] mt-0.5 text-gray-400">{card.sub}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 各市保护区面积柱状图 */}
                  <div className="md:col-span-2 rounded-lg p-4 bg-white border border-gray-200">
                    <h2 className="text-sm font-semibold mb-3">各市保护区面积分布（km²）</h2>
                    <div className="space-y-1.5">
                      {cityZoneData.map((d) => (
                        <div key={d.cityName || d.sources[0]} className="flex items-center gap-2">
                          <div className="w-16 text-xs text-right shrink-0 truncate text-gray-500">
                            {d.sources[0]
                              ? (nameToCity.get(d.sources[0]) || '').replace('市', '')
                              : ''}
                          </div>
                          <div className="flex-1 h-5 rounded overflow-hidden flex bg-gray-100">
                            <div
                              className="h-full"
                              style={{
                                width: `${(d.primaryArea / maxCityZoneArea) * 100}%`,
                                background: '#DC2626',
                                minWidth: d.primaryArea > 0 ? 2 : 0,
                              }}
                            ></div>
                            <div
                              className="h-full"
                              style={{
                                width: `${(d.secondaryArea / maxCityZoneArea) * 100}%`,
                                background: '#F97316',
                                minWidth: d.secondaryArea > 0 ? 2 : 0,
                              }}
                            ></div>
                          </div>
                          <div className="w-16 text-xs font-bold text-right shrink-0">
                            {d.totalArea.toFixed(1)}
                          </div>
                          <div className="w-8 text-[10px] text-right shrink-0 text-gray-400">
                            {d.count}个
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block w-3 h-3 rounded-sm"
                          style={{ background: '#DC2626' }}
                        ></span>
                        一级
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block w-3 h-3 rounded-sm"
                          style={{ background: '#F97316' }}
                        ></span>
                        二级
                      </span>
                    </div>
                  </div>

                  {/* 右侧：方法分布 + 水源类型分布 */}
                  <div className="space-y-4">
                    {/* 计算方法分布 */}
                    <div className="rounded-lg p-4 bg-white border border-gray-200">
                      <h2 className="text-sm font-semibold mb-3">计算方法分布</h2>
                      <div className="space-y-2">
                        {Object.entries(methodCounts)
                          .sort((a, b) => b[1] - a[1])
                          .map(([method, count]) => {
                            const maxMethod = Math.max(...Object.values(methodCounts));
                            const pct = ((count / maxMethod) * 100).toFixed(0);
                            return (
                              <div key={method} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600">{method}</span>
                                  <span className="font-bold">{count}</span>
                                </div>
                                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${pct}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* 水源类型分布 */}
                    <div className="rounded-lg p-4 bg-white border border-gray-200">
                      <h2 className="text-sm font-semibold mb-3">水源类型分布</h2>
                      <div className="space-y-1.5">
                        {Array.from(gwTypeMap.entries())
                          .sort((a, b) => b[1] - a[1])
                          .map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{type}</span>
                              <span className="font-bold">
                                {count}{' '}
                                <span className="text-gray-400 font-normal">
                                  ({((count / totalZoneCount) * 100).toFixed(1)}%)
                                </span>
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 保护区面积TOP10排名 */}
                <div className="rounded-lg p-4 bg-white border border-gray-200">
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
                        const totalArea = zr.zones.reduce((s, z) => s + z.area, 0);
                        const pArea = zr.zones.find((z) => z.level === '一级')?.area || 0;
                        const sArea = zr.zones.find((z) => z.level === '二级')?.area || 0;
                        const qArea = zr.zones.find((z) => z.level === '准保护区')?.area || 0;
                        const city = nameToCity.get(zr.sourceName) || '';
                        const maxArea = zs.reduce(
                          (m, z) =>
                            Math.max(
                              m,
                              z.zones.reduce((s, zz) => s + zz.area, 0),
                            ),
                          0,
                        );
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span
                              className={`w-4 text-right shrink-0 text-xs font-bold ${i < 3 ? 'text-red-600' : 'text-gray-400'}`}
                            >
                              {i + 1}
                            </span>
                            <span
                              className="w-36 md:w-48 shrink-0 truncate text-xs"
                              title={`${city} ${zr.sourceName}`}
                            >
                              {zr.sourceName}
                            </span>
                            <div className="flex-1 h-5 rounded overflow-hidden flex bg-gray-100">
                              <div
                                className="h-full"
                                style={{
                                  width: `${(pArea / maxArea) * 100}%`,
                                  background: '#DC2626',
                                  minWidth: pArea > 0 ? 2 : 0,
                                }}
                              ></div>
                              <div
                                className="h-full"
                                style={{
                                  width: `${(sArea / maxArea) * 100}%`,
                                  background: '#F97316',
                                  minWidth: sArea > 0 ? 2 : 0,
                                }}
                              ></div>
                              <div
                                className="h-full"
                                style={{
                                  width: `${(qArea / maxArea) * 100}%`,
                                  background: '#EAB308',
                                  minWidth: qArea > 0 ? 2 : 0,
                                }}
                              ></div>
                            </div>
                            <span className="w-20 text-xs font-bold text-right shrink-0">
                              {totalArea.toFixed(2)} km²
                            </span>
                          </div>
                        );
                      })}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: '#DC2626' }}
                      ></span>
                      一级
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: '#F97316' }}
                      ></span>
                      二级
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: '#EAB308' }}
                      ></span>
                      准保护区
                    </span>
                  </div>
                </div>

                {/* 各市保护区面积占比环形图 */}
                <div className="rounded-lg p-4 bg-white border border-gray-200">
                  <h2 className="text-sm font-semibold mb-3">各市保护区面积占比</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 一级保护区面积占比 */}
                    <div>
                      <div className="text-xs text-gray-500 mb-2">一级保护区</div>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
                          {(() => {
                            const cityAreas = cityZoneData.map((d) => ({
                              name: d.sources[0] ? nameToCity.get(d.sources[0]) || '未知' : '未知',
                              area: d.primaryArea,
                            }));
                            const topCities = [...cityAreas]
                              .sort((a, b) => b.area - a.area)
                              .slice(0, 5);
                            const total = topCities.reduce((s, c) => s + c.area, 0);
                            const colors = ['#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED'];
                            let cumulative = 0;
                            const gradientParts = topCities.map((c, i) => {
                              const pct = total > 0 ? (c.area / total) * 100 : 0;
                              const start = cumulative;
                              cumulative += pct;
                              return `${colors[i % colors.length]} ${start}% ${cumulative}%`;
                            });
                            return (
                              <>
                                <div
                                  className="rounded-full"
                                  style={{
                                    width: 100,
                                    height: 100,
                                    background: `conic-gradient(${gradientParts.join(', ')})`,
                                  }}
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div
                                    className="rounded-full flex items-center justify-center text-center bg-white"
                                    style={{ width: 56, height: 56 }}
                                  >
                                    <div className="text-xs font-bold text-red-600">
                                      {totalPrimaryArea.toFixed(1)}
                                    </div>
                                    <div className="text-[9px] text-gray-400">km²</div>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="space-y-1 text-xs">
                          {[...cityZoneData]
                            .sort((a, b) => b.primaryArea - a.primaryArea)
                            .slice(0, 5)
                            .map((d, i) => {
                              const city = d.sources[0]
                                ? nameToCity.get(d.sources[0]) || '未知'
                                : '未知';
                              const colors = [
                                '#DC2626',
                                '#2563EB',
                                '#059669',
                                '#D97706',
                                '#7C3AED',
                              ];
                              return (
                                <div key={i} className="flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-sm shrink-0"
                                    style={{ background: colors[i % colors.length] }}
                                  ></span>
                                  <span className="truncate max-w-[60px]">
                                    {city.replace('市', '')}
                                  </span>
                                  <span className="text-gray-400">{d.primaryArea.toFixed(1)}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                    {/* 二级保护区面积占比 */}
                    <div>
                      <div className="text-xs text-gray-500 mb-2">二级保护区</div>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
                          {(() => {
                            const topCities = [...cityZoneData]
                              .sort((a, b) => b.secondaryArea - a.secondaryArea)
                              .slice(0, 5);
                            const total = topCities.reduce((s, c) => s + c.secondaryArea, 0);
                            const colors = ['#F97316', '#2563EB', '#059669', '#D97706', '#7C3AED'];
                            let cumulative = 0;
                            const gradientParts = topCities.map((c, i) => {
                              const pct = total > 0 ? (c.area / total) * 100 : 0;
                              const start = cumulative;
                              cumulative += pct;
                              return `${colors[i % colors.length]} ${start}% ${cumulative}%`;
                            });
                            return (
                              <>
                                <div
                                  className="rounded-full"
                                  style={{
                                    width: 100,
                                    height: 100,
                                    background: `conic-gradient(${gradientParts.join(', ')})`,
                                  }}
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div
                                    className="rounded-full flex items-center justify-center text-center bg-white"
                                    style={{ width: 56, height: 56 }}
                                  >
                                    <div className="text-xs font-bold text-orange-600">
                                      {totalSecondaryArea.toFixed(1)}
                                    </div>
                                    <div className="text-[9px] text-gray-400">km²</div>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="space-y-1 text-xs">
                          {[...cityZoneData]
                            .sort((a, b) => b.secondaryArea - a.secondaryArea)
                            .slice(0, 5)
                            .map((d, i) => {
                              const city = d.sources[0]
                                ? nameToCity.get(d.sources[0]) || '未知'
                                : '未知';
                              const colors = [
                                '#F97316',
                                '#2563EB',
                                '#059669',
                                '#D97706',
                                '#7C3AED',
                              ];
                              return (
                                <div key={i} className="flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-sm shrink-0"
                                    style={{ background: colors[i % colors.length] }}
                                  ></span>
                                  <span className="truncate max-w-[60px]">
                                    {city.replace('市', '')}
                                  </span>
                                  <span className="text-gray-400">
                                    {d.secondaryArea.toFixed(1)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 保护区明细表 */}
                <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
                  <div className="p-4 pb-2">
                    <h2 className="text-sm font-semibold">保护区计算明细表</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-500">#</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-500">
                            水源地
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-500">
                            城市
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-500">
                            类型
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold text-red-600">
                            一级(km²)
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold text-red-600">
                            一级R(m)
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold text-orange-600">
                            二级(km²)
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold text-orange-600">
                            二级R(m)
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-500">
                            方法
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-500">
                            计算时间
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {zs.map((zr, i) => {
                          const city = nameToCity.get(zr.sourceName) || '-';
                          const z1 = zr.zones.find((z) => z.level === '一级');
                          const z2 = zr.zones.find((z) => z.level === '二级');
                          const zType =
                            zr.params.gwType || zr.params.swType || zr.params.sourceType;
                          const calcTime = new Date(zr.calculatedAt).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                          return (
                            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                              <td className="px-2 py-1.5 font-medium truncate max-w-[200px]">
                                {zr.sourceName}
                              </td>
                              <td className="px-2 py-1.5 text-gray-500">{city}</td>
                              <td className="px-2 py-1.5 text-gray-500">{zType}</td>
                              <td className="px-2 py-1.5 text-center font-medium text-red-700">
                                {z1?.area || '-'}
                              </td>
                              <td className="px-2 py-1.5 text-center text-red-500">
                                {z1?.radius || '-'}
                              </td>
                              <td className="px-2 py-1.5 text-center font-medium text-orange-700">
                                {z2?.area || '-'}
                              </td>
                              <td className="px-2 py-1.5 text-center text-orange-500">
                                {z2?.radius || '-'}
                              </td>
                              <td className="px-2 py-1.5 text-center text-gray-500">
                                {z1?.method || '-'}
                              </td>
                              <td className="px-2 py-1.5 text-center text-gray-400">{calcTime}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* 明细表 */}
      <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
        <div className="p-4 md:p-6 pb-2">
          <h2 className="text-base md:text-lg font-semibold">各市水源地明细表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-500">城市</th>
                <th className="px-3 py-2 text-center font-semibold" style={{ color: '#2F5496' }}>
                  市级
                </th>
                <th className="px-3 py-2 text-center font-semibold" style={{ color: '#548235' }}>
                  县级
                </th>
                <th className="px-3 py-2 text-center font-semibold text-amber-600">乡镇级</th>
                <th className="px-3 py-2 text-center font-semibold">合计</th>
                <th className="px-3 py-2 text-center font-semibold text-sky-600">地表水</th>
                <th className="px-3 py-2 text-center font-semibold text-violet-600">地下水</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500">面积</th>
                <th className="px-3 py-2 text-center font-semibold text-emerald-600">供水人口</th>
                <th className="px-3 py-2 text-center font-semibold text-red-600">密度</th>
              </tr>
            </thead>
            <tbody>
              {cityData.map((d) => (
                <tr key={d.cityName} className="border-t border-gray-200">
                  <td className="px-3 py-2 font-medium">{d.cityName}</td>
                  <td className="px-3 py-2 text-center">{d.municipal}</td>
                  <td className="px-3 py-2 text-center">{d.county}</td>
                  <td className="px-3 py-2 text-center text-amber-600">{d.township}</td>
                  <td className="px-3 py-2 text-center font-bold">{d.total}</td>
                  <td className="px-3 py-2 text-center">{d.surface}</td>
                  <td className="px-3 py-2 text-center">{d.ground}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{d.area.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center text-emerald-700 font-medium">
                    {d.population > 0 ? d.population.toFixed(1) : '-'}
                  </td>
                  <td className="px-3 py-2 text-center font-medium">{d.density}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="px-3 py-2 font-bold">合计</td>
                <td className="px-3 py-2 text-center font-bold" style={{ color: '#2F5496' }}>
                  {totalMunicipal}
                </td>
                <td className="px-3 py-2 text-center font-bold" style={{ color: '#548235' }}>
                  {totalCounty}
                </td>
                <td className="px-3 py-2 text-center font-bold text-amber-600">{totalTownship}</td>
                <td className="px-3 py-2 text-center font-bold">{totalAll}</td>
                <td className="px-3 py-2 text-center font-bold text-sky-600">{totalSurface}</td>
                <td className="px-3 py-2 text-center font-bold text-violet-600">{totalGround}</td>
                <td className="px-3 py-2 text-center font-bold text-gray-500">188,800</td>
                <td className="px-3 py-2 text-center font-bold text-emerald-700">
                  {totalPopulation > 0 ? totalPopulation.toFixed(1) : '-'}
                </td>
                <td className="px-3 py-2 text-center font-bold text-red-600">
                  {((totalAll / 188800) * 10000).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
