import React, { useMemo, useState } from 'react';
import { ARCHIVE_SOURCES } from '@/data/archiveSources';

/** 档案状态配色 */
const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  已接入: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '已接入（水井/归档边界）' },
  已收录: { bg: 'bg-blue-100', text: 'text-blue-700', label: '已收录（可补批复文号）' },
  部分收录: { bg: 'bg-amber-100', text: 'text-amber-700', label: '部分收录' },
  待补坐标: { bg: 'bg-red-100', text: 'text-red-700', label: '待补坐标（档案已录入）' },
};

const SOURCE_STYLE: Record<string, { badge: string; label: string }> = {
  收集报告库: { badge: 'bg-purple-100 text-purple-700', label: '收集报告库' },
  空间档案资料包: { badge: 'bg-cyan-100 text-cyan-700', label: '空间档案资料包' },
};

const ArchiveSourcesPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | string>('all');
  const [kw, setKw] = useState('');

  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    ARCHIVE_SOURCES.forEach((r) => {
      s[r.recordStatus] = (s[r.recordStatus] ?? 0) + 1;
    });
    return s;
  }, []);

  const srcStats = useMemo(() => {
    const s: Record<string, number> = {};
    ARCHIVE_SOURCES.forEach((r) => {
      s[r.source] = (s[r.source] ?? 0) + 1;
    });
    return s;
  }, []);

  const list = useMemo(() => {
    return ARCHIVE_SOURCES.filter((r) => {
      if (filter !== 'all' && r.recordStatus !== filter) return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (kw && !r.name.includes(kw) && !(r.region || '').includes(kw) && !r.approvalNo.includes(kw)) return false;
      return true;
    });
  }, [filter, sourceFilter, kw]);

  const order = ['待补坐标', '部分收录', '已收录', '已接入'];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800">归档水源地档案</h1>
          <p className="text-sm text-gray-500 mt-1">
            已收集水源地数据整理录入，共 {ARCHIVE_SOURCES.length} 条（U盘收集报告库 + 空间档案资料包）。无坐标水源地已录入档案，待补坐标后可在地图显示。
          </p>
        </div>

        {/* 状态统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {order.map((k) => {
            const st = STATUS_STYLE[k];
            const n = stats[k] ?? 0;
            return (
              <button
                key={k}
                onClick={() => setFilter(filter === k ? 'all' : k)}
                className={`p-3 rounded-lg border text-left transition ${
                  filter === k ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className={`text-xs font-medium ${st.text}`}>{st.label}</div>
                <div className="text-2xl font-bold mt-1">{n}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">点击筛选</div>
              </button>
            );
          })}
        </div>

        {/* 来源筛选 */}
        <div className="mb-3 flex flex-wrap gap-2">
          {['all', ...Object.keys(srcStats)].map((s) => {
            const active = sourceFilter === s;
            const n = s === 'all' ? ARCHIVE_SOURCES.length : srcStats[s];
            return (
              <button
                key={s}
                onClick={() => setSourceFilter(active ? 'all' : s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {s === 'all' ? `全部来源 (${n})` : `${s === '收集报告库' ? '收集报告库' : '空间档案资料包'} (${n})`}
              </button>
            );
          })}
        </div>

        {/* 搜索 */}
        <div className="mb-3 flex gap-2">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索水源地名称 / 地区 / 批复文号"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full max-w-sm"
          />
          <div className="text-sm text-gray-400 self-center">共 {list.length} 条</div>
        </div>

        {/* 表格 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-left">
                  <th className="px-3 py-2.5 font-medium">水源地名称</th>
                  <th className="px-3 py-2.5 font-medium">地区</th>
                  <th className="px-3 py-2.5 font-medium">来源</th>
                  <th className="px-3 py-2.5 font-medium">坐标</th>
                  <th className="px-3 py-2.5 font-medium">档案状态</th>
                  <th className="px-3 py-2.5 font-medium">平台边界/点位</th>
                  <th className="px-3 py-2.5 font-medium">批复文号 / 说明</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const st = STATUS_STYLE[r.recordStatus];
                  const sc = SOURCE_STYLE[r.source];
                  const hasCoord = r.lng != null && r.lat != null;
                  return (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                      <td className="px-3 py-2 text-gray-600">{r.region || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sc.badge}`}>{sc.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              hasCoord ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {r.coordStatus}
                          </span>
                        </div>
                        {hasCoord && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {r.lng!.toFixed(4)}, {r.lat!.toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        边界{r.platformBoundary} · 点位{r.platformPoint}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px] truncate" title={`${r.approvalNo || ''} ${r.dataStatus || ''}`}>
                        {r.approvalNo || r.dataStatus || '—'}
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      暂无符合条件的记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-400">
          说明：「待补坐标」水源地已录入档案（空间档案资料包来源含高德行政中心近似坐标），坐标补全后可通过「归档水源地新增模板」接入地图水井/归档边界图层。
        </div>
      </div>
    </div>
  );
};

export default ArchiveSourcesPage;
