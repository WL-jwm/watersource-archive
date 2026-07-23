import React, { useMemo, useEffect } from 'react';
import { useWaterSourceStore, ZoneCalcRecord } from '@/stores/waterSourceStore';
import { ZoneResult } from '@/lib/zoneCalcEngine';
import { batchGenerateCodes, summarizeCodes } from '@/lib/waterSourceCoder';
import CodeStatsPanel from '@/components/dashboard/CodeStatsPanel';
import ZoneStatsPanel from '@/components/dashboard/ZoneStatsPanel';
import DataExchangeModal from '@/components/DataExchangeModal';

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

  const [dataExchangeOpen, setDataExchangeOpen] = React.useState(false);

  const handleImportJSON = (json: string) => {
    useWaterSourceStore.getState().importJSON(json, 'merge');
  };

  const handleImportRecords = (records: Partial<import('@/stores/waterSourceStore').WaterSourceRecord>[]) => {
    // 将导入的记录合并到 store
    const store = useWaterSourceStore.getState();
    const existing = new Set(store.sources.map((s) => s.id));
    const newRecords = records.map((r, i) => ({
      id: r.id || `import_${Date.now()}_${i}`,
      cityName: r.cityName || '',
      level: r.level || 'county',
      name: r.name || '',
      type: r.type || '地表水',
      subType: r.subType || '',
      county: r.county || '',
      status: r.status || '在用',
      population: r.population || 0,
      river: r.river || '',
      lng: r.lng || 0,
      lat: r.lat || 0,
      dataVersion: 1,
    }));
    const toAdd = newRecords.filter((r) => !existing.has(r.id));
    const toUpdate = newRecords.filter((r) => existing.has(r.id));
    const merged = [...store.sources.map((s) => toUpdate.find((u) => u.id === s.id) || s), ...toAdd];
    useWaterSourceStore.setState({ sources: merged });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">河北省水源地统计仪表盘</h1>
          <p className="text-sm mt-1 text-gray-500">基于 {totalAll} 个水源地的综合统计分析</p>
        </div>
        <button
          onClick={() => setDataExchangeOpen(true)}
          className="text-xs px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          数据交换
        </button>
      </div>

      {/* 顶部统计卡片 */}
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

      {/* 类型统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: '地表水源地', value: totalSurface, sub: `${((totalSurface / totalAll) * 100).toFixed(1)}%`, color: 'text-sky-600' },
          { label: '地下水源地', value: totalGround, sub: `${((totalGround / totalAll) * 100).toFixed(1)}%`, color: 'text-violet-600' },
          { label: '全省平均密度', value: `${((totalAll / 188800) * 10000).toFixed(2)}`, sub: '个/万km2', color: 'text-red-600' },
          {
            label: '供水总人口',
            value: totalPopulation > 0 ? `${totalPopulation.toFixed(1)}` : '-',
            sub: totalPopulation > 0 ? `${cityData.filter((d) => d.population > 0).length}市有数据` : '暂无数据',
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

      {/* 编码规范化统计 */}
      <CodeStatsPanel loaded={loaded} sources={sources} />

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
                      style={{ width: `${(d.municipal / maxTotal) * 100}%`, background: '#2F5496', minWidth: d.municipal > 0 ? 2 : 0 }}
                    >
                      {d.municipal}
                    </div>
                    <div
                      className="h-full flex items-center justify-center text-xs text-white"
                      style={{ width: `${(d.county / maxTotal) * 100}%`, background: '#548235', minWidth: d.county > 0 ? 2 : 0 }}
                    >
                      {d.county}
                    </div>
                    <div
                      className="h-full flex items-center justify-center text-xs text-white"
                      style={{ width: `${(d.township / maxTotal) * 100}%`, background: '#BF8F00', minWidth: d.township > 0 ? 2 : 0 }}
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
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#2F5496' }}></span>市级</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#548235' }}></span>县级</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#BF8F00' }}></span>乡镇级</span>
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
                <div className="rounded-full flex items-center justify-center text-center bg-white" style={{ width: 80, height: 80 }}>
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
                <div className="ml-5 text-xs text-gray-500">{((totalSurface / totalAll) * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm shrink-0 bg-violet-500"></span>地下水
                </div>
                <div className="ml-5 text-lg font-bold text-violet-600">{totalGround}</div>
                <div className="ml-5 text-xs text-gray-500">{((totalGround / totalAll) * 100).toFixed(1)}%</div>
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
                    <span className={`w-4 text-right shrink-0 font-bold ${isAbove ? 'text-red-600' : 'text-gray-400'}`}>
                      {i + 1}
                    </span>
                    <span className="w-14 shrink-0 truncate">{d.cityName.replace('市', '')}</span>
                    <div className="flex-1 h-4 rounded overflow-hidden bg-gray-100">
                      <div
                        className={`h-full rounded ${isAbove ? 'bg-red-500' : 'bg-gray-400'}`}
                        style={{ width: `${Math.min(100, (dn / maxD) * 100)}%` }}
                      ></div>
                    </div>
                    <span className={`w-12 text-right font-bold shrink-0 ${isAbove ? 'text-red-600' : ''}`}>
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
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200"></div>
          <span className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            保护区统计
          </span>
          <div className="h-px flex-1 bg-gray-200"></div>
        </div>
        <ZoneStatsPanel zoneResults={zoneResults} sources={sources} />
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
                <th className="px-3 py-2 text-center font-semibold" style={{ color: '#2F5496' }}>市级</th>
                <th className="px-3 py-2 text-center font-semibold" style={{ color: '#548235' }}>县级</th>
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
                <td className="px-3 py-2 text-center font-bold" style={{ color: '#2F5496' }}>{totalMunicipal}</td>
                <td className="px-3 py-2 text-center font-bold" style={{ color: '#548235' }}>{totalCounty}</td>
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
      <DataExchangeModal
        open={dataExchangeOpen}
        onClose={() => setDataExchangeOpen(false)}
        sources={sources}
        onImportJSON={handleImportJSON}
        onImportRecords={handleImportRecords}
      />
    </div>
  );
};

export default Dashboard;
