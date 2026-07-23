/** 精确计算面板（手动输入水文地质参数，解析法） */

import React, { useState } from 'react';
import { useWaterSourceStore, type WaterSourceRecord, type ZoneCalcRecord } from '@/stores/waterSourceStore';
import { calcProtectionZones, type CalcParams, type CalcResult } from '@/lib/zoneCalcEngine';
import {
  type RecommendedParams,
  PARAM_RECOMMENDATIONS,
  getSmartRecommendation,
} from './calcRecommendations';

function PreciseCalcPanel({ onResult }: {
  onResult: (result: CalcResult, customParams?: ZoneCalcRecord['customParams']) => void;
}) {
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState<'地下水' | '地表水'>('地下水');
  const [gwType, setGwType] = useState<'孔隙水' | '裂隙水' | '岩溶水'>('孔隙水');
  const [swType, setSwType] = useState<'河流型' | '湖库型'>('河流型');
  const [reservoirSize, setReservoirSize] = useState<'小型' | '中型' | '大型'>('中型');

  // P3-19: 智能推荐
  const [recommendation, setRecommendation] = useState<RecommendedParams | null>(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recommendSource, setRecommendSource] = useState<string>('');

  // 解析法参数
  const [K, setK] = useState<string>('');
  const [M, setM] = useState<string>('');
  const [T, setT] = useState<string>('');
  const [S, setS] = useState<string>('');
  const [I, setI] = useState<string>('');
  const [ne, setNe] = useState<string>('');

  // 地表水参数（河流型）
  const [riverFlow, setRiverFlow] = useState<string>('');
  const [riverWidth, setRiverWidth] = useState<string>('');
  const [riverDepth, setRiverDepth] = useState<string>('');
  const [riverSlope, setRiverSlope] = useState<string>('');
  const [isTidal, setIsTidal] = useState<boolean>(false);
  const [tidalUpstreamDistance, setTidalUpstreamDistance] = useState<string>('');
  const [hasTributary, setHasTributary] = useState<boolean>(false);

  // 地表水参数（湖库型）
  const [lakeArea, setLakeArea] = useState<string>('');
  const [lakeCapacity, setLakeCapacity] = useState<string>('');
  const [maxDepth, setMaxDepth] = useState<string>('');
  const [intakeType, setIntakeType] = useState<'岸边' | '湖心' | '分层取水'>('湖心');
  const [intakeDepth, setIntakeDepth] = useState<string>('');

  // P3-3: 从URL参数恢复
  React.useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const src = params.get('source');
    if (src) {
      setSourceName(decodeURIComponent(src));
      // 查找对应的保存参数
      const { zoneResults } = useWaterSourceStore.getState();
      const saved = zoneResults.find((zr) => zr.sourceName === src && zr.customParams);
      if (saved?.customParams) {
        const cp = saved.customParams;
        if (cp.K) setK(cp.K);
        if (cp.M) setM(cp.M);
        if (cp.T) setT(cp.T);
        if (cp.S) setS(cp.S);
        if (cp.I) setI(cp.I);
        if (cp.ne) setNe(cp.ne);
        if (cp.riverFlow) setRiverFlow(cp.riverFlow);
        if (cp.riverWidth) setRiverWidth(cp.riverWidth);
        if (cp.lakeArea) setLakeArea(cp.lakeArea);
        if (cp.riverFlow || cp.riverWidth || cp.lakeArea) setSourceType('地表水');
        // A1: 恢复新增地表水参数
        if (cp.riverDepth) setRiverDepth(cp.riverDepth);
        if (cp.riverSlope) setRiverSlope(cp.riverSlope);
        if (cp.lakeCapacity) setLakeCapacity(cp.lakeCapacity);
        if (cp.maxDepth) setMaxDepth(cp.maxDepth);
      }
    }
  }, []);

  const handleCalc = () => {
    if (!sourceName.trim()) {
      alert('请输入水源地名称');
      return;
    }

    const params: CalcParams = { sourceType };

    if (sourceType === '地下水') {
      params.gwType = gwType;
      params.permeability = K ? parseFloat(K) : undefined;
      params.aquiferThickness = M ? parseFloat(M) : undefined;
      params.transmissivity = T ? parseFloat(T) : undefined;
      params.storativity = S ? parseFloat(S) : undefined;
      params.hydraulicGradient = I ? parseFloat(I) : undefined;
      params.effectivePorosity = ne ? parseFloat(ne) : undefined;
    } else {
      params.swType = swType;
      if (swType === '河流型') {
        params.riverFlow = riverFlow ? parseFloat(riverFlow) : undefined;
        params.riverWidth = riverWidth ? parseFloat(riverWidth) : undefined;
        params.riverDepth = riverDepth ? parseFloat(riverDepth) : undefined;
        params.riverSlope = riverSlope ? parseFloat(riverSlope) : undefined;
        params.isTidal = isTidal;
        params.tidalUpstreamDistance =
          isTidal && tidalUpstreamDistance ? parseFloat(tidalUpstreamDistance) : undefined;
        params.hasTributary = hasTributary;
      } else {
        params.reservoirSize = reservoirSize;
        params.lakeArea = lakeArea ? parseFloat(lakeArea) : undefined;
        params.lakeCapacity = lakeCapacity ? parseFloat(lakeCapacity) : undefined;
        params.maxDepth = maxDepth ? parseFloat(maxDepth) : undefined;
        params.intakeType = intakeType;
        params.intakeDepth =
          intakeType === '分层取水' && intakeDepth ? parseFloat(intakeDepth) : undefined;
      }
    }

    const result = calcProtectionZones(sourceName.trim(), params);
    // P3-3: 保存自定义参数用于下次恢复
    const customParams: ZoneCalcRecord['customParams'] = {};
    if (K) customParams.K = K;
    if (M) customParams.M = M;
    if (T) customParams.T = T;
    if (S) customParams.S = S;
    if (I) customParams.I = I;
    if (ne) customParams.ne = ne;
    if (riverFlow) customParams.riverFlow = riverFlow;
    if (riverWidth) customParams.riverWidth = riverWidth;
    if (lakeArea) customParams.lakeArea = lakeArea;
    if (riverDepth) customParams.riverDepth = riverDepth;
    if (riverSlope) customParams.riverSlope = riverSlope;
    if (lakeCapacity) customParams.lakeCapacity = lakeCapacity;
    if (maxDepth) customParams.maxDepth = maxDepth;
    onResult(result, customParams);
  };

  const loadExample = () => {
    setSourceName('示例孔隙水水源地');
    setSourceType('地下水');
    setGwType('孔隙水');
    setK('15');
    setM('30');
    setT('');
    setS('0.15');
    setI('0.002');
    setNe('0.25');
  };

  // P3-19: 智能推荐 - 基于当前选择的类型，或从已选水源地推断
  const handleSmartRecommend = (record?: WaterSourceRecord) => {
    let rec: RecommendedParams | null = null;
    let source = '';

    if (record) {
      // 从水源地记录推断
      rec = getSmartRecommendation(record);
      source = `${record.cityName} · ${record.subType || record.type}`;
      setSourceName(record.name);
      setTypeAndSubtype(record);
    } else {
      // 根据当前面板选择的类型
      const type = sourceType;
      const subType = type === '地下水' ? gwType : swType;
      rec = PARAM_RECOMMENDATIONS[type]?.[subType] || null;
      source = `${type} · ${subType}`;
    }

    if (rec) {
      setRecommendation(rec);
      setShowRecommendation(true);
      setRecommendSource(source);
    }
  };

  // P3-19: 填入推荐参数的中间值
  const applyRecommendation = () => {
    if (!recommendation) return;
    if (recommendation.K)
      setK(recommendation.K.split('~')[1]?.trim() || recommendation.K.split('~')[0]?.trim() || '');
    if (recommendation.M)
      setM(recommendation.M.split('~')[1]?.trim() || recommendation.M.split('~')[0]?.trim() || '');
    if (recommendation.S)
      setS(recommendation.S.split('~')[1]?.trim() || recommendation.S.split('~')[0]?.trim() || '');
    if (recommendation.I)
      setI(recommendation.I.split('~')[1]?.trim() || recommendation.I.split('~')[0]?.trim() || '');
    if (recommendation.ne)
      setNe(
        recommendation.ne.split('~')[1]?.trim() || recommendation.ne.split('~')[0]?.trim() || '',
      );
    if (recommendation.riverFlow)
      setRiverFlow(
        recommendation.riverFlow.split('~')[1]?.trim() ||
          recommendation.riverFlow.split('~')[0]?.trim() ||
          '',
      );
    if (recommendation.riverWidth)
      setRiverWidth(
        recommendation.riverWidth.split('~')[1]?.trim() ||
          recommendation.riverWidth.split('~')[0]?.trim() ||
          '',
      );
    if (recommendation.lakeArea)
      setLakeArea(
        recommendation.lakeArea.split('~')[1]?.trim() ||
          recommendation.lakeArea.split('~')[0]?.trim() ||
          '',
      );
    if (recommendation.riverDepth)
      setRiverDepth(
        recommendation.riverDepth.split('~')[1]?.trim() ||
          recommendation.riverDepth.split('~')[0]?.trim() ||
          '',
      );
    if (recommendation.riverSlope)
      setRiverSlope(
        recommendation.riverSlope.split('~')[1]?.trim() ||
          recommendation.riverSlope.split('~')[0]?.trim() ||
          '',
      );
    if (recommendation.lakeCapacity)
      setLakeCapacity(
        recommendation.lakeCapacity.split('~')[1]?.trim() ||
          recommendation.lakeCapacity.split('~')[0]?.trim() ||
          '',
      );
    if (recommendation.maxDepth)
      setMaxDepth(
        recommendation.maxDepth.split('~')[1]?.trim() ||
          recommendation.maxDepth.split('~')[0]?.trim() ||
          '',
      );
    if (recommendation.intakeType) setIntakeType(recommendation.intakeType);
    if (recommendation.gwType) setGwType(recommendation.gwType);
    if (recommendation.reservoirSize) setReservoirSize(recommendation.reservoirSize);
    setShowRecommendation(false);
  };

  // P3-19: 填入推荐参数的上限（保守方案）
  const applyConservativeRecommendation = () => {
    if (!recommendation) return;
    if (recommendation.K) {
      const parts = recommendation.K.split('~');
      setK(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.M) {
      const parts = recommendation.M.split('~');
      setM(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.S) {
      const parts = recommendation.S.split('~');
      setS(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.I) {
      const parts = recommendation.I.split('~');
      setI(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.ne) {
      const parts = recommendation.ne.split('~');
      setNe(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.riverFlow) {
      const parts = recommendation.riverFlow.split('~');
      setRiverFlow(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.riverWidth) {
      const parts = recommendation.riverWidth.split('~');
      setRiverWidth(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.lakeArea) {
      const parts = recommendation.lakeArea.split('~');
      setLakeArea(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.riverDepth) {
      const parts = recommendation.riverDepth.split('~');
      setRiverDepth(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.riverSlope) {
      const parts = recommendation.riverSlope.split('~');
      setRiverSlope(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.lakeCapacity) {
      const parts = recommendation.lakeCapacity.split('~');
      setLakeCapacity(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.maxDepth) {
      const parts = recommendation.maxDepth.split('~');
      setMaxDepth(parts[1]?.trim() || parts[0]?.trim() || '');
    }
    if (recommendation.intakeType) setIntakeType(recommendation.intakeType);
    if (recommendation.gwType) setGwType(recommendation.gwType);
    if (recommendation.reservoirSize) setReservoirSize(recommendation.reservoirSize);
    setShowRecommendation(false);
  };

  // P3-19: 根据水源地记录设置类型
  const setTypeAndSubtype = (record: WaterSourceRecord) => {
    setSourceType(record.type as '地下水' | '地表水');
    if (record.type === '地下水') {
      if (record.subType && ['孔隙水', '裂隙水', '岩溶水'].includes(record.subType)) {
        setGwType(record.subType as '孔隙水' | '裂隙水' | '岩溶水');
      }
    } else {
      if (record.subType && ['河流型', '湖库型'].includes(record.subType)) {
        setSwType(record.subType as '河流型' | '湖库型');
      }
    }
  };

  // P3-19: 快速推荐按钮（无弹窗直接填入）
  const quickRecommend = () => {
    handleSmartRecommend();
  };

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">精确计算（解析法）</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={quickRecommend}
            className="text-[10px] px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium"
          >
            智能推荐
          </button>
          <button
            onClick={loadExample}
            className="text-[10px] px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            加载示例
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 基本参数 */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600 border-b pb-1">基本参数</div>
          <input
            type="text"
            placeholder="水源地名称"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          />
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as any)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="地下水">地下水</option>
            <option value="地表水">地表水</option>
          </select>
          {sourceType === '地下水' ? (
            <select
              value={gwType}
              onChange={(e) => setGwType(e.target.value as any)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
            >
              <option value="孔隙水">孔隙水（冲洪积扇/冲积平原）</option>
              <option value="裂隙水">裂隙水（基岩裂隙）</option>
              <option value="岩溶水">岩溶水（碳酸盐岩）</option>
            </select>
          ) : (
            <>
              <select
                value={swType}
                onChange={(e) => setSwType(e.target.value as any)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
              >
                <option value="河流型">河流型</option>
                <option value="湖库型">湖库型</option>
              </select>
              {swType === '湖库型' && (
                <select
                  value={reservoirSize}
                  onChange={(e) => setReservoirSize(e.target.value as any)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                >
                  <option value="小型">小型（水面面积 &lt; 5km²）</option>
                  <option value="中型">中型（5 ~ 50km²）</option>
                  <option value="大型">大型（≥ 50km²）</option>
                </select>
              )}
            </>
          )}
        </div>

        {/* 水文地质参数（地下水） */}
        {sourceType === '地下水' ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600 border-b pb-1">
              水文地质参数（解析法需要）
            </div>
            {[
              { label: '渗透系数 K (m/d)', value: K, set: setK, placeholder: '如 15' },
              { label: '含水层厚度 M (m)', value: M, set: setM, placeholder: '如 30' },
              {
                label: '导水系数 T (m²/d)',
                value: T,
                set: setT,
                placeholder: '如 450（可由K×M算得）',
              },
              { label: '储水系数 S（给水度）', value: S, set: setS, placeholder: '如 0.15' },
              { label: '水力坡度 I', value: I, set: setI, placeholder: '如 0.002' },
              { label: '有效孔隙度 n', value: ne, set: setNe, placeholder: '如 0.25' },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[10px] text-gray-500">{f.label}</label>
                <input
                  type="number"
                  step="any"
                  placeholder={f.placeholder}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                />
              </div>
            ))}
          </div>
        ) : swType === '河流型' ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600 border-b pb-1">河流参数</div>
            {[
              {
                label: '平均流量 (m³/s)',
                value: riverFlow,
                set: setRiverFlow,
                placeholder: '如 50',
              },
              {
                label: '平均河宽 (m)',
                value: riverWidth,
                set: setRiverWidth,
                placeholder: '如 100',
              },
              {
                label: '平均水深 (m)',
                value: riverDepth,
                set: setRiverDepth,
                placeholder: '如 3',
              },
              {
                label: '河床纵比降 (‰)',
                value: riverSlope,
                set: setRiverSlope,
                placeholder: '如 0.5',
              },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[10px] text-gray-500">{f.label}</label>
                <input
                  type="number"
                  step="any"
                  placeholder={f.placeholder}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                />
              </div>
            ))}
            {/* A1: 潮汐 + 支流 */}
            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-1 text-[10px] text-gray-600">
                <input
                  type="checkbox"
                  checked={isTidal}
                  onChange={(e) => setIsTidal(e.target.checked)}
                  className="w-3 h-3"
                />
                潮汐河段
              </label>
              <label className="flex items-center gap-1 text-[10px] text-gray-600">
                <input
                  type="checkbox"
                  checked={hasTributary}
                  onChange={(e) => setHasTributary(e.target.checked)}
                  className="w-3 h-3"
                />
                有支流汇入
              </label>
            </div>
            {isTidal && (
              <div>
                <label className="text-[10px] text-gray-500">潮汐上溯距离 (m)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="如 500"
                  value={tidalUpstreamDistance}
                  onChange={(e) => setTidalUpstreamDistance(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600 border-b pb-1">湖库参数</div>
            <div>
              <label className="text-[10px] text-gray-500">水面面积 (km²)</label>
              <input
                type="number"
                step="any"
                placeholder="如 10"
                value={lakeArea}
                onChange={(e) => setLakeArea(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
              />
            </div>
            {/* A1: 库容 + 水深 + 取水口类型 */}
            <div>
              <label className="text-[10px] text-gray-500">总库容 (亿 m³)</label>
              <input
                type="number"
                step="any"
                placeholder="如 5.0"
                value={lakeCapacity}
                onChange={(e) => setLakeCapacity(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500">最大水深 (m)</label>
              <input
                type="number"
                step="any"
                placeholder="如 30"
                value={maxDepth}
                onChange={(e) => setMaxDepth(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500">取水口类型</label>
              <select
                value={intakeType}
                onChange={(e) => setIntakeType(e.target.value as '岸边' | '湖心' | '分层取水')}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
              >
                <option value="湖心">湖心取水</option>
                <option value="岸边">岸边取水</option>
                <option value="分层取水">分层取水</option>
              </select>
            </div>
            {intakeType === '分层取水' && (
              <div>
                <label className="text-[10px] text-gray-500">取水层深度 (m)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="如 20"
                  value={intakeDepth}
                  onChange={(e) => setIntakeDepth(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* P3-19: 智能推荐信息面板 */}
      {showRecommendation && recommendation && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-800">参数推荐</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                {recommendSource}
              </span>
            </div>
            <button
              onClick={() => setShowRecommendation(false)}
              className="text-[10px] text-gray-400 hover:text-gray-600"
            >
              关闭
            </button>
          </div>
          <p className="text-[10px] text-gray-600 leading-relaxed">{recommendation.description}</p>
          {sourceType === '地下水' && (
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {recommendation.K && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">K (m/d)</div>
                  <div className="font-medium text-gray-700">{recommendation.K}</div>
                </div>
              )}
              {recommendation.M && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">M (m)</div>
                  <div className="font-medium text-gray-700">{recommendation.M}</div>
                </div>
              )}
              {recommendation.S && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">S</div>
                  <div className="font-medium text-gray-700">{recommendation.S}</div>
                </div>
              )}
              {recommendation.I && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">I</div>
                  <div className="font-medium text-gray-700">{recommendation.I}</div>
                </div>
              )}
              {recommendation.ne && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">n</div>
                  <div className="font-medium text-gray-700">{recommendation.ne}</div>
                </div>
              )}
            </div>
          )}
          {sourceType === '地表水' && swType === '河流型' && (
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {recommendation.riverFlow && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">流量 (m³/s)</div>
                  <div className="font-medium text-gray-700">{recommendation.riverFlow}</div>
                </div>
              )}
              {recommendation.riverWidth && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">河宽 (m)</div>
                  <div className="font-medium text-gray-700">{recommendation.riverWidth}</div>
                </div>
              )}
              {recommendation.riverDepth && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">水深 (m)</div>
                  <div className="font-medium text-gray-700">{recommendation.riverDepth}</div>
                </div>
              )}
              {recommendation.riverSlope && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">比降 (‰)</div>
                  <div className="font-medium text-gray-700">{recommendation.riverSlope}</div>
                </div>
              )}
            </div>
          )}
          {sourceType === '地表水' && swType === '湖库型' && recommendation.lakeArea && (
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                <div className="text-gray-400">面积 (km²)</div>
                <div className="font-medium text-gray-700">{recommendation.lakeArea}</div>
              </div>
              {recommendation.lakeCapacity && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">库容 (亿m³)</div>
                  <div className="font-medium text-gray-700">{recommendation.lakeCapacity}</div>
                </div>
              )}
              {recommendation.maxDepth && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">最大水深 (m)</div>
                  <div className="font-medium text-gray-700">{recommendation.maxDepth}</div>
                </div>
              )}
              {recommendation.intakeType && (
                <div className="bg-white rounded px-2 py-1 border border-emerald-100">
                  <div className="text-gray-400">取水口</div>
                  <div className="font-medium text-gray-700">{recommendation.intakeType}</div>
                </div>
              )}
            </div>
          )}
          <div className="text-[9px] text-gray-400 italic">依据：{recommendation.basis}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={applyRecommendation}
              className="text-[10px] px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
            >
              填入中间值
            </button>
            <button
              onClick={applyConservativeRecommendation}
              className="text-[10px] px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-medium"
            >
              填入上限（保守）
            </button>
            <button
              onClick={() => setShowRecommendation(false)}
              className="text-[10px] px-2 py-1.5 text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleCalc}
        className="w-full text-xs px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
      >
        开始计算
      </button>
    </div>
  );
};

// ===== 计算结果展示 =====

export default PreciseCalcPanel;
