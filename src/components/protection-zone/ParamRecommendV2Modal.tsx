/**
 * P0: H1 智能参数推荐V2 弹窗
 *
 * 集成 paramRecommenderV2 引擎到 ProtectionZoneCalc
 * - 选择水源地后一键推荐全部参数
 * - 显示参数来源/敏感性/合理范围
 * - 参数验证反馈
 * - 一键填入到 PreciseCalcPanel
 */

import { useMemo, useState } from 'react';
import { type WaterSourceRecord, useWaterSourceStore } from '@/stores/waterSourceStore';
import {
  recommendParams,
  validateParams,
  type ParamRecommendationResult,
} from '@/lib/paramRecommenderV2';
import type { CalcParams } from '@/lib/zoneCalcEngine';

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (params: {
    sourceName: string;
    sourceType: '地下水' | '地表水';
    gwType?: '孔隙水' | '裂隙水' | '岩溶水';
    swType?: '河流型' | '湖库型';
    reservoirSize?: '小型' | '中型' | '大型';
    K?: string;
    M?: string;
    T?: string;
    I?: string;
    ne?: string;
    riverFlow?: string;
    riverWidth?: string;
    riverDepth?: string;
    riverSlope?: string;
    isTidal?: boolean;
    intakeType?: string;
  }) => void;
  currentSourceType: '地下水' | '地表水';
  currentSourceName?: string;
}

export default function ParamRecommendV2Modal({
  open,
  onClose,
  onApply,
  currentSourceType,
  currentSourceName,
}: Props) {
  const { sources } = useWaterSourceStore();
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [result, setResult] = useState<ParamRecommendationResult | null>(null);
  const [applied, setApplied] = useState(false);

  const filteredSources = useMemo(
    () => sources.filter((s) => s.type === currentSourceType),
    [sources, currentSourceType],
  );

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId),
    [sources, selectedSourceId],
  );

  const handleRecommend = () => {
    if (!selectedSource) {
      // 用默认值创建一个虚拟记录
      const dummy: WaterSourceRecord = {
        id: 'dummy',
        cityName: '默认',
        level: 'county',
        name: currentSourceName || '未命名',
        type: currentSourceType,
        subType: '',
        county: '',
        status: '在用',
        population: 0,
        river: '',
        lng: 0,
        lat: 0,
        dataVersion: 1,
      };
      setResult(recommendParams(dummy));
    } else {
      setResult(recommendParams(selectedSource));
    }
    setApplied(false);
  };

  const handleApply = () => {
    if (!result) return;
    const p = result.calcParams;
    onApply({
      sourceName: selectedSource?.name || currentSourceName || '',
      sourceType: currentSourceType,
      gwType: p.gwType,
      swType: p.swType,
      reservoirSize: p.reservoirSize,
      K: p.permeability != null ? String(p.permeability) : undefined,
      M: p.aquiferThickness != null ? String(p.aquiferThickness) : undefined,
      T: p.transmissivity != null ? String(p.transmissivity) : undefined,
      I: p.hydraulicGradient != null ? String(p.hydraulicGradient) : undefined,
      ne: p.effectivePorosity != null ? String(p.effectivePorosity) : undefined,
      riverFlow: p.riverFlow != null ? String(p.riverFlow) : undefined,
      riverWidth: p.riverWidth != null ? String(p.riverWidth) : undefined,
      riverDepth: p.riverDepth != null ? String(p.riverDepth) : undefined,
      riverSlope: p.riverSlope != null ? String(p.riverSlope) : undefined,
      isTidal: p.isTidal,
      intakeType: p.intakeType,
    });
    setApplied(true);
    setTimeout(() => onClose(), 600);
  };

  if (!open) return null;

  const sensitivityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };

  const sensitivityLabels: Record<string, string> = {
    high: '高敏感',
    medium: '中敏感',
    low: '低敏感',
  };

  const sourceColors: Record<string, string> = {
    规范: 'bg-blue-50 text-blue-600',
    经验: 'bg-purple-50 text-purple-600',
    实测: 'bg-green-50 text-green-600',
    推断: 'bg-gray-50 text-gray-600',
    计算: 'bg-indigo-50 text-indigo-600',
  };

  const validation = result ? validateParams(result.calcParams) : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">智能参数推荐 V2</h2>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              河北省11市经验参数库
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 水源地选择 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              选择水源地（用于匹配城市经验参数）
            </label>
            <div className="flex gap-2">
              <select
                value={selectedSourceId}
                onChange={(e) => {
                  setSelectedSourceId(e.target.value);
                  setResult(null);
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">不选择（使用默认参数）</option>
                {filteredSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.cityName} · {s.subType})
                  </option>
                ))}
              </select>
              <button
                onClick={handleRecommend}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium whitespace-nowrap"
              >
                生成推荐
              </button>
            </div>
            {selectedSource && (
              <div className="mt-1 text-xs text-gray-500">
                {selectedSource.cityName} · {selectedSource.type} ·{' '}
                {selectedSource.subType || '-'} · 服务人口{' '}
                {selectedSource.population?.toLocaleString() || '未知'}
              </div>
            )}
          </div>

          {/* 推荐结果 */}
          {result && (
            <div className="space-y-4">
              {/* 方法与置信度 */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div>
                  <div className="text-xs text-gray-500">推荐方法</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {result.recommendedMethod}
                  </div>
                </div>
                <div className="border-l border-gray-200 pl-3">
                  <div className="text-xs text-gray-500">置信度</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {result.confidence}%
                  </div>
                </div>
                <div className="border-l border-gray-200 pl-3 flex-1">
                  <div className="text-xs text-gray-500">方法说明</div>
                  <div className="text-xs text-gray-600">{result.methodReason}</div>
                </div>
              </div>

              {/* 警告 */}
              {result.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <span>⚠</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 参数列表 */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">推荐参数</div>
                <div className="space-y-2">
                  {result.params.map((p) => (
                    <div
                      key={p.field as string}
                      className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2.5"
                    >
                      {/* 参数名 */}
                      <div className="w-32 flex-shrink-0">
                        <div className="text-xs font-medium text-gray-800">{p.label}</div>
                        {p.unit && <div className="text-[10px] text-gray-400">单位: {p.unit}</div>}
                      </div>
                      {/* 推荐值 */}
                      <div className="w-20 flex-shrink-0 text-center">
                        <div className="text-sm font-bold text-gray-800">{String(p.value)}</div>
                      </div>
                      {/* 来源 */}
                      <div className="flex-shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${sourceColors[p.source] || 'bg-gray-50 text-gray-600'}`}
                        >
                          {p.source}
                        </span>
                      </div>
                      {/* 敏感性 */}
                      <div className="flex-shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${sensitivityColors[p.sensitivity]}`}
                        >
                          {sensitivityLabels[p.sensitivity]}
                        </span>
                      </div>
                      {/* 来源说明 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-500 truncate">{p.sourceDetail}</div>
                        {p.range && (
                          <div className="text-[10px] text-gray-400">
                            范围: {p.range.min} ~ {p.range.max} {p.range.unit}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 参数验证 */}
              {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div
                  className={`rounded-lg p-3 border ${
                    validation.errors.length > 0
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="text-xs font-semibold mb-1">参数验证</div>
                  {validation.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-600">
                      ✕ {e}
                    </div>
                  ))}
                  {validation.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-amber-600">
                      ⚠ {w}
                    </div>
                  ))}
                </div>
              )}

              {validation && validation.valid && validation.warnings.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                  ✓ 参数验证通过
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {result && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={applied}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${
                applied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {applied ? '✓ 已填入' : '填入参数'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
