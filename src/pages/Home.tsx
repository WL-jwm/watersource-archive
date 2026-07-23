import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import {
  getReportStats,
  formatNumber,
  formatYield,
  searchReports,
  downloadJSON,
  readJSONFile,
} from '@/utils/helpers';
import { hebeiDivisions } from '@/data/hebeiDivisions';
import type { WaterSource, WaterSourceInfo } from '@/types';

// 从region字段提取市名
function extractCityName(region: string): string {
  if (!region) return '其他';
  const m = region.match(/河北省(.{2,5}市)/);
  if (m) return m[1];
  const m2 = region.match(/(.{2,5}市)/);
  if (m2) return m2[1];
  return '其他';
}

// 获取市信息（含行政区划统计）
function getCityInfo(cityName: string) {
  const city = hebeiDivisions.cities.find((c) => c.name === cityName);
  return city || null;
}

// 获取某市已知水源地信息（从懒加载的数据中查找）
function getCityKnownSources(
  cityName: string,
  wsCities: any[],
): { municipal: WaterSourceInfo[]; county: WaterSourceInfo[]; township: WaterSourceInfo[] } {
  const found = wsCities.find((c) => c.cityName === cityName);
  return found
    ? { municipal: found.municipal, county: found.county, township: found.township || [] }
    : { municipal: [], county: [], township: [] };
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const {
    reports,
    searchQuery,
    addReport,
    importData,
    deleteReport,
    setSelectedReportId,
    setSelectedSourceId,
  } = useAppStore();
  const [showImportConfirm, setShowImportConfirm] = React.useState(false);
  const [expandedCities, setExpandedCities] = React.useState<Set<string>>(new Set());
  const [showAllSources, setShowAllSources] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // P2-1: 懒加载水源地静态数据
  const [wsData, setWsData] = React.useState<{ cities: any[]; stats: any } | null>(null);
  React.useEffect(() => {
    import('@/data/hebeiWaterSources').then((m) => {
      setWsData({ cities: m.hebeiWaterSources, stats: m.getHebeiWaterSourceStats() });
    });
  }, []);

  const filteredReports = searchReports(reports, searchQuery);
  const stats = getReportStats(reports);
  const wsStats = wsData?.stats ?? {
    totalCities: 0,
    totalMunicipal: 0,
    totalCounty: 0,
    totalTownship: 0,
    total: 0,
    totalSurface: 0,
    totalGround: 0,
    surfaceRatio: '0%',
  };

  const toggleCity = (cityName: string) => {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(cityName)) next.delete(cityName);
      else next.add(cityName);
      return next;
    });
  };

  // 按市分组（报告+已知水源地库）
  const cityGroupData = React.useMemo(() => {
    // 收集有报告的市
    const reportCities = new Set<string>();
    for (const r of filteredReports) {
      const city = extractCityName(r.region);
      reportCities.add(city);
    }

    // 合并：有报告的市 + 有已知水源地的市
    const wsCities = wsData?.cities || [];
    const allCities = new Set([...reportCities, ...wsCities.map((c: any) => c.cityName)]);

    // 按标准顺序排列
    const orderedCities = hebeiDivisions.cities.map((c) => c.name);
    const sortedCities = [...allCities].sort((a, b) => {
      const ia = orderedCities.indexOf(a);
      const ib = orderedCities.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    const groups = sortedCities.map((cityName) => {
      const cityReports = filteredReports.filter((r) => extractCityName(r.region) === cityName);
      const knownSources = getCityKnownSources(cityName, wsCities);
      // 统计报告中的水源地/井数/面积
      let sources = 0,
        wells = 0,
        area = 0;
      for (const r of cityReports) {
        sources += r.waterSources.length;
        for (const ws of r.waterSources) {
          wells += ws.wells?.length || 0;
          area += ws.protectionZones?.reduce((s, pz) => s + (pz.area || 0), 0) || 0;
        }
      }

      return {
        cityName,
        reports: cityReports,
        knownMunicipal: knownSources.municipal,
        knownCounty: knownSources.county,
        knownTownship: knownSources.township,
        knownTotal:
          knownSources.municipal.length + knownSources.county.length + knownSources.township.length,
        reportStats: { reports: cityReports.length, sources, wells, area },
      };
    });

    return groups;
  }, [filteredReports, wsData]);

  const handleExport = () => {
    downloadJSON(
      JSON.stringify(reports, null, 2),
      `水源地档案_${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await readJSONFile(file);
      importData(json);
      setShowImportConfirm(false);
    } catch {
      alert('导入失败，请检查文件格式');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // P2-1: 示例报告懒加载

  const handleLoadSample = async () => {
    const { wanquanReport, yangjiapuReport } = await import('@/data/sampleData');
    const sampleReports = [wanquanReport, yangjiapuReport];
    const existingIds = new Set(reports.map((r) => r.id));
    let count = 0;
    for (const r of sampleReports) {
      if (!existingIds.has(r.id)) {
        addReport(r);
        count++;
      }
    }
    if (count === 0) {
      alert('示例数据已全部加载');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`确定删除报告"${name.replace(/（[^）]*）/, '')}"？此操作不可恢复。`)) {
      deleteReport(id);
    }
  };

  const handleSourceClick = (reportId: string, sourceId: string) => {
    setSelectedReportId(reportId);
    setSelectedSourceId(sourceId);
    navigate(`/report/${reportId}`);
  };

  // 有搜索词时使用平铺模式，无搜索词时使用城市分组模式
  const isSearchMode = searchQuery.trim().length > 0;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={handleLoadSample} className="btn-accent">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          加载示例数据
        </button>
        <button onClick={() => setShowImportConfirm(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          导入数据
        </button>
        {reports.length > 0 && (
          <button onClick={handleExport} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            导出数据
          </button>
        )}
      </div>

      {/* Import dialog */}
      {showImportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">导入数据</h3>
            <p className="text-sm text-text-secondary mb-3">
              选择之前导出的 JSON 文件，数据将合并到现有记录中。
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="input mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowImportConfirm(false)} className="btn-secondary">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: '全省水源地',
            value: wsStats.total,
            icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
            color: 'bg-accent-500',
            sub: `市级${wsStats.totalMunicipal} / 县级${wsStats.totalCounty} / 乡镇级${wsStats.totalTownship}`,
          },
          {
            label: '技术报告',
            value: stats.reportCount,
            icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
            color: 'bg-primary-500',
            sub: reports.length > 0 ? `${stats.sourceCount} 个水源地` : '点击加载示例',
          },
          {
            label: '覆盖城市',
            value: cityGroupData.length,
            icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
            color: 'bg-green-500',
            sub: '河北省11个设区市',
          },
          {
            label: '地表水/地下水',
            value: `${wsStats.totalSurface}/${wsStats.totalGround}`,
            icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
            color: 'bg-amber-500',
            sub: `地表水占比 ${wsStats.surfaceRatio}`,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center shrink-0`}
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-[11px] text-text-tertiary">{s.label}</p>
              {s.sub && <p className="text-[10px] text-text-quaternary truncate">{s.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {filteredReports.length === 0 && cityGroupData.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <p className="text-lg font-medium">暂无数据</p>
          <p className="text-sm mt-1">点击"加载示例数据"或"导入数据"开始使用</p>
        </div>
      ) : isSearchMode ? (
        /* ===== 搜索模式：平铺所有匹配报告 ===== */
        <div>
          <p className="text-xs text-text-tertiary mb-3">搜索到 {filteredReports.length} 条报告</p>
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={(id) => handleDelete(id, report.reportName)}
              onSourceClick={(sourceId) => handleSourceClick(report.id, sourceId)}
            />
          ))}
        </div>
      ) : (
        /* ===== 城市分组模式 ===== */
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            覆盖 {cityGroupData.length} 个地级市 · 全省 {wsStats.total} 个水源地
            <span
              className="ml-auto flex items-center gap-1.5 cursor-pointer hover:text-accent-500 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowAllSources(!showAllSources);
              }}
            >
              {showAllSources ? '收起全部' : '展开全部城市'}
              <svg
                className={`w-3.5 h-3.5 transition-transform ${showAllSources ? 'rotate-180' : ''}`}
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
            </span>
          </div>

          {cityGroupData.map((group) => {
            const {
              cityName,
              reportStats,
              knownMunicipal,
              knownCounty,
              knownTownship,
              knownTotal,
              reports: cityReports,
            } = group;
            const cityInfo = getCityInfo(cityName);
            const isExpanded =
              expandedCities.has(cityName) || (cityReports.length > 0 && cityReports.length <= 3);
            const surfaceCount = [...knownMunicipal, ...knownCounty, ...knownTownship].filter(
              (s) => s.type === '地表水',
            ).length;
            const groundCount = [...knownMunicipal, ...knownCounty, ...knownTownship].filter(
              (s) => s.type === '地下水',
            ).length;

            return (
              <div key={cityName}>
                {/* 市级标题栏 */}
                <div
                  className="flex items-center gap-3 mb-3 cursor-pointer group"
                  onClick={() => toggleCity(cityName)}
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {cityName.replace('市', '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-text-primary group-hover:text-accent-500 transition-colors">
                      {cityName}
                    </h2>
                    <p className="text-[11px] text-text-tertiary">
                      {reportStats.reports > 0 && (
                        <span className="text-primary-500 font-medium">
                          {reportStats.reports} 份报告 ·{' '}
                        </span>
                      )}
                      {knownTotal > 0 && (
                        <span>
                          {knownTotal} 个水源地（市级{knownMunicipal.length}/县级
                          {knownCounty.length}/乡镇级{knownTownship.length}）
                          {(surfaceCount > 0 || groundCount > 0) && (
                            <>
                              <span className="text-text-tertiary"> (</span>
                              {surfaceCount > 0 && (
                                <span className="text-blue-500">地表水{surfaceCount}</span>
                              )}
                              {surfaceCount > 0 && groundCount > 0 && (
                                <span className="text-text-tertiary">/</span>
                              )}
                              {groundCount > 0 && (
                                <span className="text-green-500">地下水{groundCount}</span>
                              )}
                              <span className="text-text-tertiary">)</span>
                            </>
                          )}
                        </span>
                      )}
                      {reportStats.sources > 0 && (
                        <span>
                          {' '}
                          · {reportStats.sources} 个档案水源 · {reportStats.wells} 眼井
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* 水源地数量徽章 */}
                    {knownTotal > 0 && (
                      <span className="text-[10px] bg-accent-500/10 text-accent-600 px-2 py-0.5 rounded-full font-medium">
                        {knownTotal}个水源地
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-text-quaternary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>

                {/* 展开内容 */}
                {isExpanded && (
                  <div className="ml-4 border-l-2 border-accent-200 pl-4 space-y-4">
                    {/* 技术报告卡片 */}
                    {cityReports.map((report) => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        onDelete={(id) => handleDelete(id, report.reportName)}
                        onSourceClick={(sourceId) => handleSourceClick(report.id, sourceId)}
                      />
                    ))}

                    {/* 水源地名录（从数据库） */}
                    {knownTotal > 0 && (
                      <div className="bg-surface border border-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <svg
                            className="w-4 h-4 text-accent-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                          </svg>
                          <h3 className="text-sm font-bold">{cityName}水源地名录</h3>
                          <span className="text-[10px] text-text-quaternary">
                            数据来源：河北省生态环境厅及各市生态环境局公示
                          </span>
                        </div>

                        {/* 市级水源地 */}
                        {knownMunicipal.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-text-tertiary mb-2 font-medium">
                              市级水源地（{knownMunicipal.length}个）
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {knownMunicipal.map((ws, i) => (
                                <WaterSourceItem key={`${ws.name}-${i}`} source={ws} level="市级" />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 县级水源地 */}
                        {knownCounty.length > 0 && (
                          <div>
                            <p className="text-xs text-text-tertiary mb-2 font-medium">
                              县级水源地（{knownCounty.length}个）
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {knownCounty.map((ws, i) => (
                                <WaterSourceItem key={`${ws.name}-${i}`} source={ws} level="县级" />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 乡镇级水源地 */}
                        {knownTownship.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-text-tertiary mb-2 font-medium">
                              乡镇级水源地（{knownTownship.length}个）
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {knownTownship.map((ws, i) => (
                                <WaterSourceItem
                                  key={`${ws.name}-tw-${i}`}
                                  source={ws}
                                  level="乡镇级"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 无报告也无水源地数据时的提示 */}
                    {cityReports.length === 0 && knownTotal === 0 && (
                      <p className="text-xs text-text-quaternary italic py-2">暂无数据</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ===== 水源地名录条目组件 ===== */
const WaterSourceItem: React.FC<{ source: WaterSourceInfo; level: string }> = ({
  source,
  level,
}) => (
  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary-500/[0.02] border border-border/50 hover:border-accent-300 transition-colors">
    <div
      className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${source.type === '地表水' ? 'bg-blue-500' : 'bg-green-500'}`}
    />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium truncate">{source.name}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span
          className={`text-[10px] px-1.5 py-0 rounded ${source.type === '地表水' ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'}`}
        >
          {source.type}
        </span>
        {source.subType && (
          <span className="text-[10px] text-text-quaternary">{source.subType}</span>
        )}
        <span className="text-[10px] text-text-quaternary">{source.county}</span>
      </div>
      {source.remark && (
        <p className="text-[10px] text-text-quaternary mt-0.5 truncate" title={source.remark}>
          {source.remark}
        </p>
      )}
    </div>
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium ${
        level === '市级'
          ? 'bg-amber-500/15 text-amber-700'
          : level === '县级'
            ? 'bg-emerald-500/15 text-emerald-700'
            : 'bg-sky-500/15 text-sky-700'
      }`}
    >
      {level}
    </span>
  </div>
);

/* ===== 报告卡片组件 ===== */
const ReportCard: React.FC<{
  report: ReturnType<typeof useAppStore.getState>['reports'][number];
  onDelete: (id: string) => void;
  onSourceClick: (sourceId: string) => void;
}> = ({ report, onDelete, onSourceClick }) => (
  <div className="bg-surface border border-border rounded-lg p-5">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold truncate">{report.reportName}</h3>
        <p className="text-xs text-text-tertiary mt-0.5">
          {report.region || '未知区域'} · {report.compileUnit || '未知单位'} ·{' '}
          {new Date(report.updatedAt).toLocaleDateString('zh-CN')}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(report.id);
        }}
        className="btn-ghost p-1.5 text-text-tertiary hover:text-danger shrink-0"
        title="删除报告"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>

    <div className="flex flex-wrap gap-4 text-sm text-text-secondary mb-4">
      <span className="flex items-center gap-1.5">
        <svg
          className="w-4 h-4 text-accent-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
        </svg>
        {report.waterSources.length} 个水源地
      </span>
      <span className="flex items-center gap-1.5">
        <svg
          className="w-4 h-4 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
        {report.waterSources.reduce((sum, ws) => sum + (ws.wells?.length || 0), 0)} 眼监测井
      </span>
      <span className="flex items-center gap-1.5">
        <svg
          className="w-4 h-4 text-amber-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
          />
        </svg>
        保护区{' '}
        {report.waterSources
          .reduce(
            (sum, ws) => sum + (ws.protectionZones?.reduce((a, pz) => a + (pz.area || 0), 0) || 0),
            0,
          )
          .toFixed(2)}{' '}
        km\u00B2
      </span>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {report.waterSources.map((ws) => (
        <SourceCard key={ws.id} source={ws} onClick={() => onSourceClick(ws.id)} />
      ))}
    </div>
  </div>
);

/* ===== 水源地卡片组件 ===== */
const SourceCard: React.FC<{ source: WaterSource; onClick: () => void }> = ({
  source,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left card-hover group relative overflow-hidden outline-none focus:ring-2 focus:ring-accent-500"
  >
    <div className="absolute inset-0 flex items-center justify-center bg-primary-500/0 group-hover:bg-primary-500/5 transition-colors duration-200 z-10 pointer-events-none">
      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-medium text-primary-500 bg-surface/90 px-3 py-1.5 rounded-full shadow-card">
        点击查看详情
      </span>
    </div>
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${source.type === '地表水' ? 'bg-blue-500' : 'bg-green-500'}`}
        />
        <h4 className="font-semibold text-sm truncate">{source.name}</h4>
        {source.type && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
              source.type === '地表水'
                ? 'bg-blue-500/10 text-blue-600'
                : 'bg-green-500/10 text-green-600'
            }`}
          >
            {source.type}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-text-tertiary">
        {source.location && (
          <span className="truncate" title={source.location}>
            <svg
              className="w-3 h-3 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
            </svg>
            {source.location}
          </span>
        )}
        {source.dailyYield != null && (
          <span>
            <svg
              className="w-3 h-3 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            {formatYield(source.dailyYield)}
          </span>
        )}
        {source.wells && source.wells.length > 0 && (
          <span>
            <svg
              className="w-3 h-3 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            {source.wells.length} 眼井
          </span>
        )}
        {source.protectionZones && source.protectionZones.length > 0 && (
          <span>
            <svg
              className="w-3 h-3 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
            {source.protectionZones.length} 级保护区
          </span>
        )}
      </div>
      {source.waterQuality && source.waterQuality.qualifiedRate != null && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs text-text-tertiary">水质达标率:</span>
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              source.waterQuality.qualifiedRate === 100
                ? 'bg-green-500/10 text-green-600'
                : source.waterQuality.qualifiedRate >= 80
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-red-500/10 text-red-600'
            }`}
          >
            {source.waterQuality.qualifiedRate}%
          </span>
        </div>
      )}
      {source.hydrogeology && (
        <div className="mt-2 text-xs text-text-tertiary">
          含水层: {source.hydrogeology.aquiferType || '-'} · 渗透系数{' '}
          {source.hydrogeology.permeabilityCoeff || '-'}
        </div>
      )}
    </div>
  </button>
);

export default Home;
