import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ARCHIVE_SOURCES } from '@/data/archiveSources';
import { useWaitCoordStore } from '@/data/waitCoordStore';

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
  const [tab, setTab] = useState<'all' | 'wait'>('all');
  const [filter, setFilter] = useState<'all' | string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | string>('all');
  const [kw, setKw] = useState('');
  const [waitFilter, setWaitFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [drafts, setDrafts] = useState<Record<string, { lng: string; lat: string; note: string }>>({});
  const { records, setCoord, clearCoord } = useWaitCoordStore();

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

  // Tab1 全部档案列表
  const list = useMemo(() => {
    return ARCHIVE_SOURCES.filter((r) => {
      if (filter !== 'all' && r.recordStatus !== filter) return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (kw && !r.name.includes(kw) && !(r.region || '').includes(kw) && !r.approvalNo.includes(kw)) return false;
      return true;
    });
  }, [filter, sourceFilter, kw]);

  // Tab2 待核实坐标列表（52 条待补坐标）
  const waitList = useMemo(() => {
    return ARCHIVE_SOURCES.filter((r) => {
      if (r.recordStatus !== '待补坐标') return false;
      const ver = records[r.name]?.verified ?? false;
      if (waitFilter === 'verified' && !ver) return false;
      if (waitFilter === 'unverified' && ver) return false;
      if (kw && !r.name.includes(kw) && !(r.region || '').includes(kw)) return false;
      return true;
    });
  }, [records, waitFilter, kw]);

  const order = ['待补坐标', '部分收录', '已收录', '已接入'];
  const verifiedCount = useMemo(
    () => ARCHIVE_SOURCES.filter((r) => r.recordStatus === '待补坐标' && records[r.name]?.verified).length,
    [records],
  );

  const setDraft = (name: string, field: 'lng' | 'lat' | 'note', value: string) => {
    setDrafts((d) => {
      const prev = d[name] ?? { lng: '', lat: '', note: '' };
      const next: { lng: string; lat: string; note: string } = {
        lng: prev.lng ?? '',
        lat: prev.lat ?? '',
        note: prev.note ?? '',
      };
      next[field] = value;
      return { ...d, [name]: next };
    });
  };

  const saveCoord = (r: (typeof ARCHIVE_SOURCES)[number]) => {
    const d = drafts[r.name] ?? { lng: '', lat: '', note: '' };
    const lng = d.lng.trim() ? parseFloat(d.lng) : undefined;
    const lat = d.lat.trim() ? parseFloat(d.lat) : undefined;
    setCoord(r.name, { lng, lat, note: d.note, verified: true });
  };

  /** 导出已核实坐标 */
  const exportVerified = () => {
    const verified = Object.values(records).filter((v) => v.verified);
    if (verified.length === 0) {
      alert('暂无已核实的坐标可导出，请先在列表核实保存坐标。');
      return;
    }
    const data = verified.map((v) => {
      const src = ARCHIVE_SOURCES.find((s) => s.name === v.name);
      return {
        水源地名称: v.name,
        地区: src?.region || '',
        精确经度: v.lng ?? '',
        精确纬度: v.lat ?? '',
        备注: v.note || '',
        核实时间: v.updatedAt ? new Date(v.updatedAt).toLocaleString() : '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '已核实坐标');
    XLSX.writeFile(wb, `水源地_已核实坐标_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800">归档水源地档案</h1>
          <p className="text-sm text-gray-500 mt-1">
            已收集水源地数据整理录入，共 {ARCHIVE_SOURCES.length} 条（U盘收集报告库 + 空间档案资料包）。
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            全部档案（{ARCHIVE_SOURCES.length}）
          </button>
          <button
            onClick={() => setTab('wait')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === 'wait' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            待核实坐标（{52}，已核实 {verifiedCount}）
          </button>
        </div>

        {tab === 'wait' ? (
          /* ============ Tab2 待核实坐标管理 ============ */
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(['all', 'unverified', 'verified'] as const).map((wf) => (
                <button
                  key={wf}
                  onClick={() => setWaitFilter(wf)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    waitFilter === wf ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {wf === 'all' ? '全部' : wf === 'verified' ? '已核实' : '未核实'}
                </button>
              ))}
              <input
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                placeholder="搜索水源地名称"
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={exportVerified}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                title="导出已核实的坐标到 Excel"
              >
                导出已核实坐标（{verifiedCount}）
              </button>
              <div className="text-sm text-gray-400">共 {waitList.length} 条</div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 text-left">
                      <th className="px-3 py-2.5 font-medium">水源地名称</th>
                      <th className="px-3 py-2.5 font-medium">地区</th>
                      <th className="px-3 py-2.5 font-medium">参考坐标</th>
                      <th className="px-3 py-2.5 font-medium">精确经度</th>
                      <th className="px-3 py-2.5 font-medium">精确纬度</th>
                      <th className="px-3 py-2.5 font-medium">备注</th>
                      <th className="px-3 py-2.5 font-medium">状态</th>
                      <th className="px-3 py-2.5 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitList.map((r) => {
                      const ver = records[r.name];
                      const hasRef = r.lng != null && r.lat != null;
                      const d = drafts[r.name] ?? { lng: hasRef ? String(r.lng) : '', lat: hasRef ? String(r.lat) : '', note: '' };
                      const isVerified = ver?.verified ?? false;
                      return (
                        <tr key={r.id} className={`border-t border-gray-100 hover:bg-gray-50 ${isVerified ? 'bg-emerald-50/40' : ''}`}>
                          <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                          <td className="px-3 py-2 text-gray-600">{r.region || '—'}</td>
                          <td className="px-3 py-2 text-xs text-gray-400">
                            {hasRef ? `${r.lng!.toFixed(4)}, ${r.lat!.toFixed(4)}` : '无参考坐标'}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={d.lng}
                              onChange={(e) => setDraft(r.name, 'lng', e.target.value)}
                              placeholder="经度"
                              className="w-24 px-2 py-1 border border-gray-200 rounded text-xs"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={d.lat}
                              onChange={(e) => setDraft(r.name, 'lat', e.target.value)}
                              placeholder="纬度"
                              className="w-24 px-2 py-1 border border-gray-200 rounded text-xs"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={d.note}
                              onChange={(e) => setDraft(r.name, 'note', e.target.value)}
                              placeholder="来源/说明"
                              className="w-36 px-2 py-1 border border-gray-200 rounded text-xs"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {isVerified ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">已核实</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-600">待核实</span>
                            )}
                            {ver?.updatedAt && (
                              <div className="text-[10px] text-gray-400 mt-0.5">{new Date(ver.updatedAt).toLocaleString()}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => saveCoord(r)}
                                className="px-2 py-1 rounded text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-700"
                              >
                                {isVerified ? '更新' : '保存核实'}
                              </button>
                              {isVerified && (
                                <button
                                  onClick={() => clearCoord(r.name)}
                                  className="px-2 py-1 rounded text-[11px] font-medium bg-gray-200 text-gray-600 hover:bg-gray-300"
                                >
                                  取消
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {waitList.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                          暂无符合条件的记录
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              填写精确井位坐标后点「保存核实」即可标记已核实并持久化到本地；后续可导出已核实坐标接入地图图层。
            </div>
          </div>
        ) : (
          /* ============ Tab1 全部档案 ============ */
          <div>
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

            <div className="mb-3 flex gap-2">
              <input
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                placeholder="搜索水源地名称 / 地区 / 批复文号"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full max-w-sm"
              />
              <div className="text-sm text-gray-400 self-center">共 {list.length} 条</div>
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchiveSourcesPage;
