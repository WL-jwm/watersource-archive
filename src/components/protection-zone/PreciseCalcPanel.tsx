/**
 * 精确计算面板（手动输入水文地质参数，解析法）
 *
 * N7 重构：使用拆分子组件
 * - GroundwaterParams: 地下水参数表单
 * - RiverParams: 河流参数表单
 * - LakeParams: 湖库参数表单
 * - RecommendationPanel: 智能推荐信息面板
 */

import { useToast } from '@/hooks/useToast';
import React, { useState } from 'react';
import { type WaterSourceRecord, type ZoneCalcRecord, useWaterSourceStore } from '@/stores/waterSourceStore';
import { calcProtectionZones, type CalcParams, type CalcResult } from '@/lib/zoneCalcEngine';
import ParamRecommendV2Modal from './ParamRecommendV2Modal';
import {
  type RecommendedParams,
  PARAM_RECOMMENDATIONS,
  getSmartRecommendation,
} from './calcRecommendations';
import GroundwaterParams from './GroundwaterParams';
import RiverParams from './RiverParams';
import LakeParams from './LakeParams';
import RecommendationPanel, { extractValue } from './RecommendationPanel';

function PreciseCalcPanel({ onResult }: {
  onResult: (result: CalcResult, customParams?: ZoneCalcRecord['customParams']) => void;
}) {
  // 基本参数
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState<'地下水' | '地表水'>('地下水');
  const [gwType, setGwType] = useState<'孔隙水' | '裂隙水' | '岩溶水'>('孔隙水');
  const [swType, setSwType] = useState<'河流型' | '湖库型'>('河流型');
  const [reservoirSize, setReservoirSize] = useState<'小型' | '中型' | '大型'>('中型');

  // 推荐
  const [recommendation, setRecommendation] = useState<RecommendedParams | null>(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recommendSource, setRecommendSource] = useState<string>('');
  const [v2ModalOpen, setV2ModalOpen] = useState(false);

  // 地下水参数
  const [K, setK] = useState('');
  const [M, setM] = useState('');
  const [T, setT] = useState('');
  const [S, setS] = useState('');
  const [I, setI] = useState('');
  const [ne, setNe] = useState('');

  // 河流参数
  const [riverFlow, setRiverFlow] = useState('');
  const [riverWidth, setRiverWidth] = useState('');
  const [riverDepth, setRiverDepth] = useState('');
  const [riverSlope, setRiverSlope] = useState('');
  const [isTidal, setIsTidal] = useState(false);
  const [tidalUpstreamDistance, setTidalUpstreamDistance] = useState('');
  const [hasTributary, setHasTributary] = useState(false);

  // 湖库参数
  const [lakeArea, setLakeArea] = useState('');
  const [lakeCapacity, setLakeCapacity] = useState('');
  const [maxDepth, setMaxDepth] = useState('');
  const [intakeType, setIntakeType] = useState<'岸边' | '湖心' | '分层取水'>('湖心');
  const [intakeDepth, setIntakeDepth] = useState('');

  // 从URL恢复参数
  React.useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const src = params.get('source');
    if (src) {
      setSourceName(decodeURIComponent(src));
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
        if (cp.riverDepth) setRiverDepth(cp.riverDepth);
        if (cp.riverSlope) setRiverSlope(cp.riverSlope);
        if (cp.lakeCapacity) setLakeCapacity(cp.lakeCapacity);
        if (cp.maxDepth) setMaxDepth(cp.maxDepth);
      }
    }
  }, []);

  // ===== 计算逻辑 =====
  const toast = useToast();
  const handleCalc = () => {
    if (!sourceName.trim()) { toast.warning('请输入水源地名称'); return; }

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
        params.tidalUpstreamDistance = isTidal && tidalUpstreamDistance ? parseFloat(tidalUpstreamDistance) : undefined;
        params.hasTributary = hasTributary;
      } else {
        params.reservoirSize = reservoirSize;
        params.lakeArea = lakeArea ? parseFloat(lakeArea) : undefined;
        params.lakeCapacity = lakeCapacity ? parseFloat(lakeCapacity) : undefined;
        params.maxDepth = maxDepth ? parseFloat(maxDepth) : undefined;
        params.intakeType = intakeType;
        params.intakeDepth = intakeType === '分层取水' && intakeDepth ? parseFloat(intakeDepth) : undefined;
      }
    }

    const result = calcProtectionZones(sourceName.trim(), params);
    const customParams: ZoneCalcRecord['customParams'] = {};
    if (K) customParams.K = K; if (M) customParams.M = M; if (T) customParams.T = T;
    if (S) customParams.S = S; if (I) customParams.I = I; if (ne) customParams.ne = ne;
    if (riverFlow) customParams.riverFlow = riverFlow; if (riverWidth) customParams.riverWidth = riverWidth;
    if (lakeArea) customParams.lakeArea = lakeArea; if (riverDepth) customParams.riverDepth = riverDepth;
    if (riverSlope) customParams.riverSlope = riverSlope; if (lakeCapacity) customParams.lakeCapacity = lakeCapacity;
    if (maxDepth) customParams.maxDepth = maxDepth;
    onResult(result, customParams);
  };

  const loadExample = () => {
    setSourceName('示例孔隙水水源地'); setSourceType('地下水'); setGwType('孔隙水');
    setK('15'); setM('30'); setT(''); setS('0.15'); setI('0.002'); setNe('0.25');
  };

  // ===== 推荐逻辑 =====
  const handleSmartRecommend = (record?: WaterSourceRecord) => {
    let rec: RecommendedParams | null = null;
    let source = '';
    if (record) {
      rec = getSmartRecommendation(record);
      source = `${record.cityName} · ${record.subType || record.type}`;
      setSourceName(record.name);
      setTypeAndSubtype(record);
    } else {
      const type = sourceType;
      const subType = type === '地下水' ? gwType : swType;
      rec = PARAM_RECOMMENDATIONS[type]?.[subType] || null;
      source = `${type} · ${subType}`;
    }
    if (rec) { setRecommendation(rec); setShowRecommendation(true); setRecommendSource(source); }
  };

  const applyRecommendation = (mode: 'mid' | 'upper') => {
    if (!recommendation) return;
    const r = recommendation;
    const get = (val: string | undefined) => extractValue(val, mode);
    if (r.K) setK(get(r.K)); if (r.M) setM(get(r.M)); if (r.S) setS(get(r.S));
    if (r.I) setI(get(r.I)); if (r.ne) setNe(get(r.ne));
    if (r.riverFlow) setRiverFlow(get(r.riverFlow)); if (r.riverWidth) setRiverWidth(get(r.riverWidth));
    if (r.lakeArea) setLakeArea(get(r.lakeArea)); if (r.riverDepth) setRiverDepth(get(r.riverDepth));
    if (r.riverSlope) setRiverSlope(get(r.riverSlope)); if (r.lakeCapacity) setLakeCapacity(get(r.lakeCapacity));
    if (r.maxDepth) setMaxDepth(get(r.maxDepth));
    if (r.intakeType) setIntakeType(r.intakeType);
    if (r.gwType) setGwType(r.gwType);
    if (r.reservoirSize) setReservoirSize(r.reservoirSize);
    setShowRecommendation(false);
  };

  const handleV2Apply = (v2: {
    sourceName: string; sourceType: '地下水' | '地表水';
    gwType?: '孔隙水' | '裂隙水' | '岩溶水'; swType?: '河流型' | '湖库型';
    reservoirSize?: '小型' | '中型' | '大型';
    K?: string; M?: string; T?: string; I?: string; ne?: string;
    riverFlow?: string; riverWidth?: string; riverDepth?: string; riverSlope?: string;
    isTidal?: boolean; intakeType?: string;
  }) => {
    if (v2.sourceName) setSourceName(v2.sourceName);
    setSourceType(v2.sourceType);
    if (v2.gwType) setGwType(v2.gwType);
    if (v2.swType) setSwType(v2.swType);
    if (v2.reservoirSize) setReservoirSize(v2.reservoirSize);
    if (v2.K !== undefined) setK(v2.K); if (v2.M !== undefined) setM(v2.M);
    if (v2.T !== undefined) setT(v2.T); if (v2.I !== undefined) setI(v2.I);
    if (v2.ne !== undefined) setNe(v2.ne);
    if (v2.riverFlow !== undefined) setRiverFlow(v2.riverFlow);
    if (v2.riverWidth !== undefined) setRiverWidth(v2.riverWidth);
    if (v2.riverDepth !== undefined) setRiverDepth(v2.riverDepth);
    if (v2.riverSlope !== undefined) setRiverSlope(v2.riverSlope);
    if (v2.isTidal !== undefined) setIsTidal(v2.isTidal);
    if (v2.intakeType) setIntakeType(v2.intakeType as '岸边' | '湖心' | '分层取水');
  };

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

  // ===== 渲染 =====
  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">精确计算（解析法）</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSmartRecommend()} className="text-[10px] px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium">
            智能推荐
          </button>
          <button onClick={() => setV2ModalOpen(true)} className="text-[10px] px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium">
            V2推荐
          </button>
          <button onClick={loadExample} className="text-[10px] px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50">
            加载示例
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 基本参数 */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600 border-b pb-1">基本参数</div>
          <input type="text" placeholder="水源地名称" value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as '地下水' | '地表水')} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5">
            <option value="地下水">地下水</option>
            <option value="地表水">地表水</option>
          </select>
          {sourceType === '地下水' ? (
            <select value={gwType} onChange={(e) => setGwType(e.target.value as '孔隙水' | '裂隙水' | '岩溶水')} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5">
              <option value="孔隙水">孔隙水（冲洪积扇/冲积平原）</option>
              <option value="裂隙水">裂隙水（基岩裂隙）</option>
              <option value="岩溶水">岩溶水（碳酸盐岩）</option>
            </select>
          ) : (
            <>
              <select value={swType} onChange={(e) => setSwType(e.target.value as '河流型' | '湖库型')} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5">
                <option value="河流型">河流型</option>
                <option value="湖库型">湖库型</option>
              </select>
              {swType === '湖库型' && (
                <select value={reservoirSize} onChange={(e) => setReservoirSize(e.target.value as '小型' | '中型' | '大型')} className="w-full text-xs border border-gray-200 rounded px-2 py-1.5">
                  <option value="小型">小型（水面面积 &lt; 5km²）</option>
                  <option value="中型">中型（5 ~ 50km²）</option>
                  <option value="大型">大型（≥ 50km²）</option>
                </select>
              )}
            </>
          )}
        </div>

        {/* 水文地质参数 */}
        {sourceType === '地下水' ? (
          <GroundwaterParams K={K} setK={setK} M={M} setM={setM} T={T} setT={setT} S={S} setS={setS} I={I} setI={setI} ne={ne} setNe={setNe} />
        ) : swType === '河流型' ? (
          <RiverParams
            riverFlow={riverFlow} setRiverFlow={setRiverFlow}
            riverWidth={riverWidth} setRiverWidth={setRiverWidth}
            riverDepth={riverDepth} setRiverDepth={setRiverDepth}
            riverSlope={riverSlope} setRiverSlope={setRiverSlope}
            isTidal={isTidal} setIsTidal={setIsTidal}
            tidalUpstreamDistance={tidalUpstreamDistance} setTidalUpstreamDistance={setTidalUpstreamDistance}
            hasTributary={hasTributary} setHasTributary={setHasTributary}
          />
        ) : (
          <LakeParams
            lakeArea={lakeArea} setLakeArea={setLakeArea}
            lakeCapacity={lakeCapacity} setLakeCapacity={setLakeCapacity}
            maxDepth={maxDepth} setMaxDepth={setMaxDepth}
            intakeType={intakeType} setIntakeType={setIntakeType}
            intakeDepth={intakeDepth} setIntakeDepth={setIntakeDepth}
          />
        )}
      </div>

      {/* 推荐面板 */}
      {showRecommendation && recommendation && (
        <RecommendationPanel
          recommendation={recommendation}
          sourceLabel={recommendSource}
          sourceType={sourceType}
          swType={swType}
          onApplyMid={() => applyRecommendation('mid')}
          onApplyConservative={() => applyRecommendation('upper')}
          onClose={() => setShowRecommendation(false)}
        />
      )}

      <button onClick={handleCalc} className="w-full text-xs px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium">
        开始计算
      </button>
      <ParamRecommendV2Modal
        open={v2ModalOpen}
        onClose={() => setV2ModalOpen(false)}
        onApply={handleV2Apply}
        currentSourceType={sourceType}
        currentSourceName={sourceName}
      />
    </div>
  );
};

export default PreciseCalcPanel;
