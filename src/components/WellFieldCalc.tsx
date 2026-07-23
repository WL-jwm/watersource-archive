/**
 * A2: 多井干扰保护区计算面板
 *
 * 功能：
 * 1. 取水井坐标录入（表格输入，支持手动添加/删除井）
 * 2. 水文地质参数输入（T/S/K/M）
 * 3. 计算结果展示（合并后保护区 + 各井独立保护区）
 * 4. 结果对比（叠加法 vs 等效半径法）
 */

import React, { useState } from 'react';
import {
  calcWellFieldZones,
  generateWellFieldVertices,
  generateSingleWellCircles,
  type WellInfo,
  type WellFieldCalcParams,
  type WellFieldZoneResult,
} from '@/lib/wellFieldCalcEngine';

interface WellRow extends WellInfo {
  /** 临时编辑用 */
  _editing?: boolean;
}

const WellFieldCalc: React.FC = () => {
  // 井列表
  const [wells, setWells] = useState<WellRow[]>([
    { id: 'w1', name: '1号井', lng: 114.502, lat: 38.005 },
    { id: 'w2', name: '2号井', lng: 114.508, lat: 38.012 },
  ]);

  // 水文地质参数
  const [transmissivity, setTransmissivity] = useState('100');
  const [storativity, setStorativity] = useState('0.0001');
  const [permeability, setPermeability] = useState('');
  const [aquiferThickness, setAquiferThickness] = useState('');
  const [dailyYield, setDailyYield] = useState('5000');

  // 计算结果
  const [result, setResult] = useState<WellFieldZoneResult | null>(null);
  const [error, setError] = useState<string>('');

  // 井操作
  const addWell = () => {
    const idx = wells.length + 1;
    setWells([...wells, { id: `w${Date.now()}`, name: `${idx}号井`, lng: 114.5, lat: 38.0 }]);
  };

  const removeWell = (id: string) => {
    if (wells.length <= 1) return;
    setWells(wells.filter((w) => w.id !== id));
  };

  const updateWell = (id: string, field: keyof WellRow, value: string) => {
    setWells(wells.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  };

  // 计算
  const handleCalc = () => {
    setError('');
    try {
      const params: WellFieldCalcParams = {
        wells: wells.map((w) => ({
          id: w.id,
          name: w.name,
          lng: parseFloat(String(w.lng)),
          lat: parseFloat(String(w.lat)),
          yield: w.yield ? parseFloat(String(w.yield)) : undefined,
        })),
        transmissivity: transmissivity ? parseFloat(transmissivity) : undefined,
        storativity: storativity ? parseFloat(storativity) : undefined,
        permeability: permeability ? parseFloat(permeability) : undefined,
        aquiferThickness: aquiferThickness ? parseFloat(aquiferThickness) : undefined,
        dailyYield: dailyYield ? parseFloat(dailyYield) : undefined,
      };
      const r = calcWellFieldZones(params);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算失败');
      setResult(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 border border-cyan-100">
        <h3 className="text-sm font-bold text-gray-800">多井干扰保护区计算</h3>
        <p className="text-[10px] text-gray-500 mt-0.5">
          依据 HJ 338-2018
          第6.2节，多井水源地应考虑井群干扰效应。支持叠加法（几何合并）和等效半径法。
        </p>
      </div>

      {/* 井列表 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600">
            取水井列表（{wells.length}口）
          </label>
          <button
            onClick={addWell}
            className="text-[10px] px-2 py-0.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            + 添加井
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-1 py-1 text-left text-gray-500">编号</th>
                <th className="px-1 py-1 text-left text-gray-500">名称</th>
                <th className="px-1 py-1 text-left text-gray-500">经度</th>
                <th className="px-1 py-1 text-left text-gray-500">纬度</th>
                <th className="px-1 py-1 text-left text-gray-500">取水量(m³/d)</th>
                <th className="px-1 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {wells.map((w, i) => (
                <tr key={w.id} className="border-b border-gray-100">
                  <td className="px-1 py-1 text-gray-400">{i + 1}</td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={w.name || ''}
                      onChange={(e) => updateWell(w.id, 'name', e.target.value)}
                      className="w-16 text-[10px] border border-gray-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.0001"
                      value={w.lng}
                      onChange={(e) => updateWell(w.id, 'lng', e.target.value)}
                      className="w-20 text-[10px] border border-gray-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="0.0001"
                      value={w.lat}
                      onChange={(e) => updateWell(w.id, 'lat', e.target.value)}
                      className="w-20 text-[10px] border border-gray-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="均分"
                      value={w.yield || ''}
                      onChange={(e) => updateWell(w.id, 'yield', e.target.value)}
                      className="w-16 text-[10px] border border-gray-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <button
                      onClick={() => removeWell(w.id)}
                      disabled={wells.length <= 1}
                      className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xs"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 水文地质参数 */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">水文地质参数</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] text-gray-400">导水系数 T (m²/d)</label>
            <input
              type="number"
              step="any"
              value={transmissivity}
              onChange={(e) => setTransmissivity(e.target.value)}
              className="w-full text-[10px] border border-gray-200 rounded px-1.5 py-1"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400">储水系数 S</label>
            <input
              type="number"
              step="any"
              value={storativity}
              onChange={(e) => setStorativity(e.target.value)}
              className="w-full text-[10px] border border-gray-200 rounded px-1.5 py-1"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400">总取水量 (m³/d)</label>
            <input
              type="number"
              step="any"
              value={dailyYield}
              onChange={(e) => setDailyYield(e.target.value)}
              className="w-full text-[10px] border border-gray-200 rounded px-1.5 py-1"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400">渗透系数 K (m/d)</label>
            <input
              type="number"
              step="any"
              placeholder="可选"
              value={permeability}
              onChange={(e) => setPermeability(e.target.value)}
              className="w-full text-[10px] border border-gray-200 rounded px-1.5 py-1"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400">含水层厚度 M (m)</label>
            <input
              type="number"
              step="any"
              placeholder="可选"
              value={aquiferThickness}
              onChange={(e) => setAquiferThickness(e.target.value)}
              className="w-full text-[10px] border border-gray-200 rounded px-1.5 py-1"
            />
          </div>
        </div>
      </div>

      {/* 计算按钮 */}
      <button
        onClick={handleCalc}
        className="w-full py-2 rounded-lg bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-700"
      >
        计算多井干扰保护区
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-[10px] text-red-600">
          {error}
        </div>
      )}

      {/* 计算结果 */}
      {result && (
        <div className="space-y-3">
          {/* 方法摘要 */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="text-xs font-bold text-blue-800 mb-1">
              计算方法：{result.method} | 井数：{result.wellCount}
            </div>
            <div className="text-[10px] text-gray-600 space-y-0.5">
              <div>
                质心坐标：({result.centerLng}, {result.centerLat})
              </div>
              <div>井群分布面积：{(result.wellFieldArea / 1e6).toFixed(3)} km²</div>
              <div>等效半径：{result.equivalentRadius} m</div>
            </div>
          </div>

          {/* 保护区结果 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-center">
              <div className="text-[9px] text-gray-500">一级保护区</div>
              <div className="text-sm font-bold text-green-700">{result.primary.radius}m</div>
              <div className="text-[9px] text-gray-400">{result.primary.area} km²</div>
              <div className="text-[8px] text-gray-400 mt-0.5">
                干扰系数 ×{result.primary.interferenceFactor}
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-2 text-center">
              <div className="text-[9px] text-gray-500">二级保护区</div>
              <div className="text-sm font-bold text-orange-700">{result.secondary.radius}m</div>
              <div className="text-[9px] text-gray-400">{result.secondary.area} km²</div>
              <div className="text-[8px] text-gray-400 mt-0.5">
                干扰系数 ×{result.secondary.interferenceFactor}
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-2 text-center">
              <div className="text-[9px] text-gray-500">准保护区</div>
              <div className="text-sm font-bold text-yellow-700">{result.quasi.radius}m</div>
              <div className="text-[9px] text-gray-400">{result.quasi.area} km²</div>
            </div>
          </div>

          {/* 边界描述 */}
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
            <div className="text-[9px] font-medium text-gray-500 mb-1">边界描述</div>
            <div className="text-[10px] text-gray-600 space-y-1">
              <div>
                <span className="text-green-600">一级：</span>
                {result.primary.description}
              </div>
              <div>
                <span className="text-orange-600">二级：</span>
                {result.secondary.description}
              </div>
              <div>
                <span className="text-yellow-600">准保护：</span>
                {result.quasi.description}
              </div>
            </div>
          </div>

          {/* 各井独立结果 */}
          <div>
            <div className="text-[9px] font-medium text-gray-500 mb-1">各井独立保护区半径</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-1 py-0.5 text-left text-gray-500">井名</th>
                    <th className="px-1 py-0.5 text-right text-gray-500">取水量(m³/d)</th>
                    <th className="px-1 py-0.5 text-right text-gray-500">一级(m)</th>
                    <th className="px-1 py-0.5 text-right text-gray-500">二级(m)</th>
                    <th className="px-1 py-0.5 text-right text-gray-500">准保护(m)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.singleWells.map((w) => (
                    <tr key={w.wellId} className="border-b border-gray-100">
                      <td className="px-1 py-0.5 text-gray-600">{w.wellName || w.wellId}</td>
                      <td className="px-1 py-0.5 text-right text-gray-500">{w.yield.toFixed(0)}</td>
                      <td className="px-1 py-0.5 text-right font-medium text-green-600">
                        {w.primaryRadius}
                      </td>
                      <td className="px-1 py-0.5 text-right font-medium text-orange-600">
                        {w.secondaryRadius}
                      </td>
                      <td className="px-1 py-0.5 text-right font-medium text-yellow-600">
                        {w.quasiRadius}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 警告信息 */}
          {result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <div className="text-[9px] font-medium text-amber-700 mb-1">计算警告</div>
              <ul className="text-[9px] text-amber-600 space-y-0.5 list-disc list-inside">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 拐点坐标 */}
          {(() => {
            const vertices = generateWellFieldVertices(
              result.centerLng,
              result.centerLat,
              result.primary.radius,
              16,
            );
            return (
              <details>
                <summary className="text-[9px] font-medium text-gray-500 cursor-pointer">
                  一级保护区拐点坐标（16点）
                </summary>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-1 py-0.5 text-left text-gray-500">编号</th>
                        <th className="px-1 py-0.5 text-right text-gray-500">经度</th>
                        <th className="px-1 py-0.5 text-right text-gray-500">纬度</th>
                        <th className="px-1 py-0.5 text-right text-gray-500">方位角</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vertices.map((v) => (
                        <tr key={v.id} className="border-b border-gray-100">
                          <td className="px-1 py-0.5 text-gray-600">{v.id}</td>
                          <td className="px-1 py-0.5 text-right text-gray-500">{v.lng}</td>
                          <td className="px-1 py-0.5 text-right text-gray-500">{v.lat}</td>
                          <td className="px-1 py-0.5 text-right text-gray-500">{v.azimuth}°</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default WellFieldCalc;
