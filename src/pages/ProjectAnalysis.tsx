/**
 * 建设项目与水源地保护区空间关系分析页面
 *
 * 功能：
 * 1. 输入建设项目坐标和占地范围
 * 2. 一键分析是否涉及饮用水水源保护区
 * 3. 展示涉及清单和最近距离
 * 4. 给出法规提示
 */

import React, { useState, useMemo } from 'react';
import { useWaterSourceStore, WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';
import {
  checkProjectAgainstZones,
  haversineDistance,
  type ProjectInput,
  type AnalysisResult,
} from '@/lib/spatialAnalysis';
import {
  analyzeBuffer,
  type SensitiveTarget,
  type BufferAnalysisSummary,
  SENSITIVE_TARGET_TEMPLATES,
} from '@/lib/bufferAnalysisEngine';
import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';

// ===== 主页面 =====

const ProjectAnalysis: React.FC = () => {
  const { loaded, sources, zoneResults, loadZoneResults } = useWaterSourceStore();

  const [projectName, setProjectName] = useState('');
  const [lng, setLng] = useState('');
  const [lat, setLat] = useState('');
  const [radiusM, setRadiusM] = useState('500');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [targets, setTargets] = useState<SensitiveTarget[]>([]);
  const [bufferResult, setBufferResult] = useState<BufferAnalysisSummary | null>(null);

  // P3-12: 从URL参数恢复项目信息
  React.useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const name = params.get('name');
    const lngVal = params.get('lng');
    const latVal = params.get('lat');
    if (name) setProjectName(decodeURIComponent(name));
    if (lngVal) setLng(lngVal);
    if (latVal) setLat(latVal);
  }, []);

  // 加载保护区结果
  React.useEffect(() => {
    if (loaded && zoneResults.length === 0) {
      loadZoneResults();
    }
  }, [loaded]);

  const handleAnalyze = () => {
    if (!projectName.trim()) {
      alert('请输入项目名称');
      return;
    }
    const lngVal = parseFloat(lng);
    const latVal = parseFloat(lat);
    const radiusVal = parseFloat(radiusM) || 0;
    if (isNaN(lngVal) || isNaN(latVal)) {
      alert('请输入有效的经纬度');
      return;
    }
    if (lngVal < 113 || lngVal > 120 || latVal < 35 || latVal > 43) {
      alert('经纬度不在河北省范围内（经度113~120，纬度35~43）');
      return;
    }
    if (zoneResults.length === 0) {
      alert('暂无保护区计算结果，请先在"保护区划分"页面进行计算');
      return;
    }

    setAnalyzing(true);
    // 使用setTimeout避免UI阻塞
    setTimeout(() => {
      const project: ProjectInput = {
        name: projectName.trim(),
        lng: lngVal,
        lat: latVal,
        radiusM: radiusVal,
      };
      const analysisResult = checkProjectAgainstZones(project, zoneResults, sources);
      setResult(analysisResult);
      setAnalyzing(false);
    }, 50);
  };

  const loadExample = () => {
    setProjectName('示例：某工业园区建设项目');
    setLng('114.569');
    setLat('38.152');
    setRadiusM('500');
  };

  if (!loaded) {
    return <div className="p-6 text-center text-gray-500">数据加载中...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold">建设项目与水源地保护区空间分析</h1>
        <p className="text-xs text-gray-500 mt-1">
          输入建设项目位置坐标，自动判断是否涉及饮用水水源保护区，计算最近距离
        </p>
      </div>

      {/* 输入区 */}
      <div className="rounded-lg p-4 bg-white border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">项目信息</h3>
          <button
            onClick={loadExample}
            className="text-[10px] px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            加载示例
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-500">项目名称</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="如：XX产业园区"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500">中心经度 (东经)</label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="如 114.569"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">中心纬度 (北纬)</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="如 38.152"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-500">项目占地半径 (米)，点状项目填0</label>
              <input
                type="number"
                step="any"
                value={radiusM}
                onChange={(e) => setRadiusM(e.target.value)}
                placeholder="如 500"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
              />
            </div>
            <div className="text-[10px] text-gray-400">
              <p>提示：占地半径为项目中心到边界的最远距离。矩形项目取对角线一半。</p>
              <p>河北省经度范围：113~120°E，纬度范围：35~43°N</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing || zoneResults.length === 0}
          className="mt-3 w-full text-xs px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 font-medium"
        >
          {analyzing ? '分析中...' : '开始分析'}
        </button>
        <p className="text-[10px] text-gray-400 mt-1">
          当前已加载 {zoneResults.length} 个保护区计算结果
        </p>
      </div>

      {/* 分析结果 */}
      {result && (
        <div className="space-y-3">
          {/* 总体结论 */}
          <div
            className={`rounded-lg p-4 border-2 ${
              result.hasInvolved ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{result.hasInvolved ? '⚠️' : '✅'}</span>
              <div>
                <div
                  className={`text-base font-bold ${
                    result.hasInvolved ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {result.hasInvolved
                    ? `涉及 ${result.involvedZones.length} 个保护区`
                    : '不涉及饮用水水源保护区'}
                </div>
                {result.nearestZone && (
                  <div className="text-xs text-gray-600">
                    最近保护区边界距离：
                    <span
                      className={`font-bold ${
                        result.nearestEdgeDistanceM < 0
                          ? 'text-red-600'
                          : result.nearestEdgeDistanceM < 5000
                            ? 'text-amber-600'
                            : 'text-green-600'
                      }`}
                    >
                      {result.nearestEdgeDistanceM < 0
                        ? `项目在保护区内（深入 ${Math.abs(result.nearestEdgeDistanceM)}m）`
                        : `${result.nearestEdgeDistanceM.toLocaleString()} m`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 涉及清单 */}
          {result.involvedZones.length > 0 && (
            <div className="rounded-lg overflow-hidden bg-white border border-red-200">
              <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                <h3 className="text-sm font-semibold text-red-700">涉及保护区清单</h3>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">水源地</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">城市</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500">级别</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500">半径(m)</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500">面积(km²)</th>
                    <th className="px-3 py-2 text-center font-semibold text-red-600">
                      边界距离(m)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.involvedZones.map((z, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-red-50/50">
                      <td className="px-3 py-1.5 font-medium">{z.sourceName}</td>
                      <td className="px-3 py-1.5 text-gray-500">{z.cityName}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${
                            z.level === '一级'
                              ? 'bg-red-500'
                              : z.level === '二级'
                                ? 'bg-orange-500'
                                : 'bg-yellow-500'
                          }`}
                        >
                          {z.level}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">{z.zoneRadiusM}</td>
                      <td className="px-3 py-1.5 text-center">{z.zoneAreaKm2}</td>
                      <td className="px-3 py-1.5 text-center font-bold text-red-600">
                        {z.edgeDistanceM < 0 ? `-${Math.abs(z.edgeDistanceM)}` : z.edgeDistanceM}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 最近保护区信息（未涉及时） */}
          {!result.hasInvolved && result.nearestZone && (
            <div className="rounded-lg p-4 bg-white border border-gray-200">
              <h3 className="text-sm font-semibold mb-2">最近的保护区</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">水源地</span>
                  <div className="font-medium">{result.nearestZone.sourceName}</div>
                </div>
                <div>
                  <span className="text-gray-500">城市</span>
                  <div>{result.nearestZone.cityName}</div>
                </div>
                <div>
                  <span className="text-gray-500">级别</span>
                  <div>{result.nearestZone.level}</div>
                </div>
                <div>
                  <span className="text-gray-500">边界距离</span>
                  <div className="font-bold text-green-600">
                    {result.nearestEdgeDistanceM.toLocaleString()} m
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 法规提示 */}
          <div className="rounded-lg p-4 bg-amber-50 border border-amber-200">
            <h3 className="text-xs font-semibold text-amber-700 mb-2">法规提示</h3>
            <div className="text-[10px] text-amber-800 space-y-1">
              {result.hasInvolved ? (
                <>
                  <p>
                    <strong>《中华人民共和国水污染防治法》第六十五条：</strong>
                    禁止在饮用水水源一级保护区内新建、改建、扩建与供水设施和保护水源无关的建设项目；已建成的与供水设施和保护水源无关的建设项目，由县级以上人民政府责令拆除或者关闭。
                  </p>
                  <p>
                    <strong>《中华人民共和国水污染防治法》第六十六条：</strong>
                    禁止在饮用水水源二级保护区内新建、改建、扩建排放污染物的建设项目；已建成的排放污染物的建设项目，由县级以上人民政府责令拆除或者关闭。
                  </p>
                  <p className="text-amber-600 mt-2">
                    上述分析基于保护区圆形近似模型，实际保护区边界以政府批复文件为准。建议进一步核实项目具体位置与保护区拐点坐标的空间关系。
                  </p>
                </>
              ) : (
                <p>
                  该建设项目不在已计算的饮用水水源保护区范围内。但需注意：（1）可能存在尚未纳入本次计算的保护区；（2）实际保护区边界以政府批复文件为准；（3）建议结合当地生态环境主管部门意见综合判断。
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* P4-6: 缓冲分析面板 */}
      {zoneResults.length > 0 && (
        <div className="rounded-lg p-4 bg-white border border-red-200 space-y-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-red-700">敏感目标缓冲分析</h3>
          </div>
          <p className="text-[10px] text-gray-500">
            添加敏感目标（学校、医院、企业等），分析其与保护区边界的距离关系
          </p>

          {/* 添加目标表单 */}
          <div className="flex flex-wrap gap-2 items-end">
            <input
              type="text"
              placeholder="目标名称"
              className="text-xs border border-gray-200 rounded px-2 py-1.5 w-28"
              id="buf-target-name"
            />
            <select
              className="text-xs border border-gray-200 rounded px-2 py-1.5"
              id="buf-target-type"
            >
              {SENSITIVE_TARGET_TEMPLATES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.type}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="经度"
              className="text-xs border border-gray-200 rounded px-2 py-1.5 w-24"
              id="buf-target-lng"
            />
            <input
              type="number"
              placeholder="纬度"
              className="text-xs border border-gray-200 rounded px-2 py-1.5 w-24"
              id="buf-target-lat"
            />
            <button
              onClick={() => {
                const name =
                  (document.getElementById('buf-target-name') as HTMLInputElement)?.value || '';
                const type = (document.getElementById('buf-target-type') as HTMLSelectElement)
                  ?.value as SensitiveTarget['type'];
                const lngVal = parseFloat(
                  (document.getElementById('buf-target-lng') as HTMLInputElement)?.value || '',
                );
                const latVal = parseFloat(
                  (document.getElementById('buf-target-lat') as HTMLInputElement)?.value || '',
                );
                if (!name || isNaN(lngVal) || isNaN(latVal)) {
                  alert('请填写完整信息');
                  return;
                }
                const newTarget: SensitiveTarget = {
                  id: `T${Date.now()}`,
                  name,
                  type,
                  lng: lngVal,
                  lat: latVal,
                };
                setTargets((prev) => [...prev, newTarget]);
              }}
              className="text-xs px-2 py-1.5 bg-red-500 text-white rounded hover:bg-red-600"
            >
              添加
            </button>
          </div>

          {/* 目标列表 + 分析按钮 */}
          {targets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">已添加 {targets.length} 个目标</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const zoneSources = zoneResults
                        .map((zr) => {
                          const s = sources.find((src) => src.name === zr.sourceName);
                          if (!s?.lng || !s?.lat) return null;
                          return generateSourceZoneVertices(
                            zr.sourceId,
                            zr.sourceName,
                            s.lng,
                            s.lat,
                            zr.zones,
                          );
                        })
                        .filter(Boolean) as any[];
                      const summary = analyzeBuffer(targets, zoneSources);
                      setBufferResult(summary);
                    }}
                    className="text-xs px-3 py-1.5 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                  >
                    执行分析
                  </button>
                  <button
                    onClick={() => {
                      setTargets([]);
                      setBufferResult(null);
                    }}
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    清空
                  </button>
                </div>
              </div>

              {/* 分析结果 */}
              {bufferResult && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-red-50 rounded p-2 text-center">
                      <div className="text-lg font-bold text-red-600">
                        {bufferResult.highRiskCount}
                      </div>
                      <div className="text-[9px] text-red-400">高危</div>
                    </div>
                    <div className="bg-amber-50 rounded p-2 text-center">
                      <div className="text-lg font-bold text-amber-600">
                        {bufferResult.watchCount}
                      </div>
                      <div className="text-[9px] text-amber-400">关注</div>
                    </div>
                    <div className="bg-green-50 rounded p-2 text-center">
                      <div className="text-lg font-bold text-green-600">
                        {bufferResult.safeCount}
                      </div>
                      <div className="text-[9px] text-green-400">安全</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2 text-center">
                      <div className="text-lg font-bold text-gray-600">
                        {bufferResult.insideCount}
                      </div>
                      <div className="text-[9px] text-gray-400">区内</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border px-2 py-1 text-left">目标</th>
                          <th className="border px-2 py-1">类型</th>
                          <th className="border px-2 py-1 text-right">距边界(m)</th>
                          <th className="border px-2 py-1">最近保护区</th>
                          <th className="border px-2 py-1">预警</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bufferResult.results.map((r, i) => (
                          <tr
                            key={i}
                            className={
                              r.alertLevel === '高危'
                                ? 'bg-red-50'
                                : r.alertLevel === '关注'
                                  ? 'bg-amber-50'
                                  : ''
                            }
                          >
                            <td className="border px-2 py-1">{r.target.name}</td>
                            <td className="border px-2 py-1 text-center">{r.target.type}</td>
                            <td className="border px-2 py-1 text-right">
                              {r.insideZone ? '区内' : r.distanceToBoundary}
                            </td>
                            <td className="border px-2 py-1 text-center">{r.nearestZone}</td>
                            <td className="border px-2 py-1 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] ${
                                  r.alertLevel === '高危'
                                    ? 'bg-red-100 text-red-700'
                                    : r.alertLevel === '关注'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {r.alertLevel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 无计算结果提示 */}
      {loaded && zoneResults.length === 0 && (
        <div className="rounded-lg p-6 bg-gray-50 border border-gray-200 text-center">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm text-gray-600 font-medium">暂无保护区计算结果</p>
          <p className="text-xs text-gray-400 mt-1">
            请先前往
            <a href="#/zone-calc" className="text-blue-600 underline">
              保护区划分
            </a>
            页面进行计算
          </p>
        </div>
      )}
    </div>
  );
};

export default ProjectAnalysis;
