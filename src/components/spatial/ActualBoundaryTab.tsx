/**
 * P8.4: 实际边界避让分析 Tab
 *
 * 基于真实保护区边界多边形（zone-boundaries / KMZ），用 turf 精确判断项目
 * 与保护区边界的包含/相交/距离，并叠加审计标记（已取消/已调整）。
 * 区别于计算圈层的圆形近似。
 */

import React, { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { useZoneAuditStore } from '@/data/zoneAuditStore';
import {
  ALL_BOUNDARY_CITIES,
  runBoundaryAvoidance,
  NEAR_THRESHOLD_M,
  type AvoidanceAnalysis,
} from '@/lib/actualBoundaryAvoidance';

const ActualBoundaryTab: React.FC = () => {
  const auditRules = useZoneAuditStore((s) => s.rules);
  const toast = useToast();
  const [name, setName] = useState('');
  const [lng, setLng] = useState('');
  const [lat, setLat] = useState('');
  const [radius, setRadius] = useState('');
  const [city, setCity] = useState('all');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AvoidanceAnalysis | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    const lngV = parseFloat(lng);
    const latV = parseFloat(lat);
    if (Number.isNaN(lngV) || Number.isNaN(latV)) {
      setError('请输入有效的项目经度和纬度');
      return;
    }
    if (lngV < 113 || lngV > 120 || latV < 36 || latV > 43) {
      setError('坐标超出河北省范围，请检查（约 113~120°E, 36~43°N）');
      return;
    }
    setError('');
    setRunning(true);
    try {
      const radiusM = radius.trim() ? parseFloat(radius) : 0;
      const res = await runBoundaryAvoidance(
        name.trim() || '未命名项目',
        lngV,
        latV,
        Number.isNaN(radiusM) ? 0 : radiusM,
        auditRules,
        city,
      );
      setResult(res);
      if (res.hasInvolved) {
        toast.success(`发现 ${res.involved.length} 个需避让的保护区`);
      } else {
        toast.info('未发现涉及保护区，项目相对安全');
      }
    } catch {
      setError('避让分析失败，请稍后重试');
    } finally {
      setRunning(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'cancelled') return 'bg-gray-200 text-gray-600';
    if (status === 'adjusted') return 'bg-orange-100 text-orange-700';
    return '';
  };
  const statusLabel = (status: string) => {
    if (status === 'cancelled') return '已取消';
    if (status === 'adjusted') return '已调整';
    return '';
  };

  const involvedCount = result ? result.involved.length : 0;
  const cancelledCount = result
    ? result.checks.filter((c) => c.auditStatus === 'cancelled').length
    : 0;

  return (
    <div className="space-y-3">
      <div className="text-xs text-text-tertiary">
        基于真实保护区边界（KMZ/省政府批复）做项目避让判断。已取消保护区不参与避让判定，已调整保护区提示需核验。
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="项目名称"
          className="border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
        />
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
        >
          <option value="all">全省</option>
          {ALL_BOUNDARY_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="项目经度（如 115.67）"
          className="border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
        />
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="项目纬度（如 37.96）"
          className="border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
        />
        <input
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          placeholder="项目半径(m)（可选，如厂区半径）"
          className="border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
        />
        <button
          onClick={run}
          disabled={running}
          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {running ? '分析中…' : '开始避让分析'}
        </button>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</div>}

      {result && (
        <>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-surface border border-border rounded-lg p-2.5">
              <div className="text-xl font-bold text-text-primary">{result.checks.length}</div>
              <div className="text-[11px] text-text-tertiary">检查保护区</div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-2.5">
              <div className="text-xl font-bold text-red-600">{involvedCount}</div>
              <div className="text-[11px] text-red-500">需避让</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
              <div className="text-xl font-bold text-amber-600">
                {result.nearest && !result.hasInvolved ? result.nearest.absDistanceM : '—'}
              </div>
              <div className="text-[11px] text-amber-500">最近边界(m)</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
              <div className="text-xl font-bold text-gray-500">{cancelledCount}</div>
              <div className="text-[11px] text-gray-500">已取消(剔除)</div>
            </div>
          </div>

          {/* 需避让列表 */}
          {involvedCount > 0 && (
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">
                需避让的保护区（{involvedCount}）
              </h3>
              <div className="bg-surface border border-red-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50 text-left text-xs text-red-600">
                      <th className="px-3 py-2 font-medium">名称</th>
                      <th className="px-3 py-2 font-medium">城市</th>
                      <th className="px-3 py-2 font-medium">级别</th>
                      <th className="px-3 py-2 font-medium">关系</th>
                      <th className="px-3 py-2 font-medium">距边界(m)</th>
                      <th className="px-3 py-2 font-medium">审计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.involved.map((c, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-text-primary">{c.name}</td>
                        <td className="px-3 py-2 text-xs text-text-secondary">{c.city}</td>
                        <td className="px-3 py-2 text-xs text-text-secondary">{c.level}</td>
                        <td className="px-3 py-2 text-xs">
                          {c.isInside ? (
                            <span className="text-red-600 font-medium">在保护区内</span>
                          ) : (
                            <span className="text-amber-600 font-medium">触及边界</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-text-primary">
                          {c.isInside ? `深入 ${c.absDistanceM}` : `${c.absDistanceM}`}
                        </td>
                        <td className="px-3 py-2">
                          {c.auditStatus !== 'normal' && (
                            <span
                              className={`inline-block text-[11px] px-1.5 py-0.5 rounded-full ${statusBadge(c.auditStatus)}`}
                            >
                              {statusLabel(c.auditStatus)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 临近列表 */}
          {!result.hasInvolved && result.nearest && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">
              ✓ 项目未涉及任何有效保护区。最近为「{result.nearest.name}」（{result.nearest.city}
              ），距边界 {result.nearest.absDistanceM} 米
              {result.nearest.absDistanceM < NEAR_THRESHOLD_M ? '，已临近保护区，建议复核' : '，安全距离充足'}。
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActualBoundaryTab;
