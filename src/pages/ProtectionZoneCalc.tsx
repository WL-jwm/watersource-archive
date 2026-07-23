/**
 * 保护区划分计算页面
 *
 * 功能：
 * 1. 单个/批量水源地保护区计算
 * 2. 经验值法 + 解析法（Cooper-Jacob）
 * 3. 计算结果展示（参数/公式/面积/边界描述）
 * 4. 结果持久化到IDB
 * 5. 从水源地列表快速导入
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';

// ===== P3-19: 参数智能推荐 =====
interface RecommendedParams {
  K?: string;
  M?: string;
  T?: string;
  S?: string;
  I?: string;
  ne?: string;
  riverFlow?: string;
  riverWidth?: string;
  riverDepth?: string;
  riverSlope?: string;
  lakeArea?: string;
  lakeCapacity?: string;
  maxDepth?: string;
  reservoirSize?: '大型' | '中型' | '小型';
  intakeType?: '岸边' | '湖心' | '分层取水';
  gwType?: '孔隙水' | '裂隙水' | '岩溶水';
  description: string;
  basis: string;
}

/**
 * 基于HJ 338-2018和河北省区域水文地质特征的参数推荐表
 * 数据来源：
 * - HJ 338-2018 附录B 各类型含水层水文地质参数经验值范围
 * - 河北省水文地质图集（河北省地质矿产勘查开发局）
 * - 河北省地下水资源评价报告
 * - 各水源地环评报告实测参数统计
 */
const PARAM_RECOMMENDATIONS: Record<string, Record<string, RecommendedParams>> = {
  地下水: {
    孔隙水: {
      K: '5 ~ 20',
      M: '15 ~ 40',
      T: '',
      S: '0.08 ~ 0.25',
      I: '0.001 ~ 0.005',
      ne: '0.15 ~ 0.30',
      gwType: '孔隙水',
      description:
        '河北省山前冲洪积扇/冲积平原区典型参数。太行山前（石家庄、保定、邢台、邯郸）K偏高(10~30m/d)，中部平原（衡水、沧州）K偏低(2~8m/d)。',
      basis: 'HJ 338-2018 附录B 表B.1 + 河北省水文地质图集',
    },
    裂隙水: {
      K: '0.5 ~ 5',
      M: '10 ~ 30',
      T: '',
      S: '0.01 ~ 0.05',
      I: '0.005 ~ 0.02',
      ne: '0.05 ~ 0.15',
      gwType: '裂隙水',
      description:
        '燕山-太行山基岩裂隙水。承德、张家口山区裂隙发育不均匀，K变化大。一般风化裂隙带K=1~5m/d，构造裂隙带可达5~10m/d。',
      basis: 'HJ 338-2018 附录B 表B.2 + 张承山区水文地质普查',
    },
    岩溶水: {
      K: '20 ~ 200',
      M: '20 ~ 80',
      T: '',
      S: '0.05 ~ 0.20',
      I: '0.002 ~ 0.01',
      ne: '0.10 ~ 0.25',
      gwType: '岩溶水',
      description:
        '碳酸盐岩溶裂隙含水层。河北典型岩溶水水源地（如邢台百泉、邯郸黑龙洞、石家庄威州）K值变化极大，高度非均质，解析法结果仅供参考。建议结合示踪试验或数值模拟验证。',
      basis: 'HJ 338-2018 附录B 表B.3 + 河北省岩溶水资源评价',
    },
  },
  地表水: {
    河流型: {
      riverFlow: '10 ~ 100',
      riverWidth: '50 ~ 300',
      riverDepth: '2 ~ 5',
      riverSlope: '0.3 ~ 1.5',
      description:
        '河北省主要河流型水源地（滹沱河、滏阳河、漳河等）。流量因季节差异大，枯水期流量可能仅为年均值的1/3~1/5。',
      basis: 'HJ 338-2018 第5.2节 + 河北省水文年鉴',
    },
    湖库型: {
      lakeArea: '5 ~ 50',
      lakeCapacity: '1 ~ 20',
      maxDepth: '15 ~ 40',
      reservoirSize: '中型',
      intakeType: '湖心',
      description:
        '河北省主要湖库型水源地（岗南水库17.04亿m³、黄壁庄水库12.1亿m³、朱庄水库4.36亿m³等）。',
      basis: 'HJ 338-2018 第5.3节 + 河北省大中型水库统计',
    },
  },
};

/** 河北省各水文地质区典型参数（更精细化推荐） */
const REGIONAL_PARAMS: Record<string, Record<string, RecommendedParams>> = {
  石家庄市: {
    孔隙水: {
      K: '10 ~ 30',
      M: '20 ~ 45',
      S: '0.10 ~ 0.22',
      I: '0.002 ~ 0.004',
      ne: '0.20 ~ 0.30',
      description: '太行山前冲洪积扇，含水层颗粒粗、厚度大',
      basis: '石家庄市地下水水源地环评报告统计',
    },
  },
  保定市: {
    孔隙水: {
      K: '8 ~ 25',
      M: '20 ~ 50',
      S: '0.08 ~ 0.20',
      I: '0.002 ~ 0.005',
      ne: '0.18 ~ 0.28',
      description: '山前冲洪积扇，含水层厚，补给条件好',
      basis: '保定市地下水资源评价',
    },
  },
  邢台市: {
    孔隙水: {
      K: '5 ~ 18',
      M: '15 ~ 35',
      S: '0.08 ~ 0.20',
      I: '0.002 ~ 0.006',
      ne: '0.15 ~ 0.25',
      description: '山前~中东部过渡带，由西向东K递减',
      basis: '邢台市地下水水源地调查报告',
    },
  },
  邯郸市: {
    孔隙水: {
      K: '5 ~ 15',
      M: '15 ~ 30',
      S: '0.06 ~ 0.18',
      I: '0.002 ~ 0.005',
      ne: '0.15 ~ 0.25',
      description: '山前冲洪积扇前缘，含水层厚度渐小',
      basis: '邯郸市地下水水源地调查',
    },
  },
  衡水市: {
    孔隙水: {
      K: '2 ~ 8',
      M: '10 ~ 25',
      S: '0.04 ~ 0.12',
      I: '0.001 ~ 0.003',
      ne: '0.12 ~ 0.20',
      description: '中部冲积平原，含水层颗粒细，T偏低',
      basis: '衡水市地下水超采区评价',
    },
  },
  沧州市: {
    孔隙水: {
      K: '1 ~ 6',
      M: '10 ~ 20',
      S: '0.03 ~ 0.10',
      I: '0.0005 ~ 0.002',
      ne: '0.10 ~ 0.18',
      description: '滨海平原，含水层以粉细砂为主',
      basis: '沧州市深层地下水开采评价',
    },
  },
  张家口市: {
    裂隙水: {
      K: '1 ~ 8',
      M: '10 ~ 25',
      S: '0.01 ~ 0.06',
      I: '0.005 ~ 0.015',
      ne: '0.05 ~ 0.12',
      description: '坝上高原及山间盆地，含水层薄',
      basis: '张家口市水源地调查报告',
    },
  },
  承德市: {
    裂隙水: {
      K: '0.5 ~ 5',
      M: '8 ~ 20',
      S: '0.01 ~ 0.05',
      I: '0.005 ~ 0.02',
      ne: '0.05 ~ 0.10',
      description: '燕山山区基岩裂隙，非均质性强',
      basis: '承德市水源地调查报告',
    },
  },
  唐山市: {
    孔隙水: {
      K: '8 ~ 25',
      M: '20 ~ 40',
      S: '0.08 ~ 0.20',
      I: '0.001 ~ 0.004',
      ne: '0.15 ~ 0.25',
      description: '山前冲积扇+滨海过渡带',
      basis: '唐山市地下水资源评价',
    },
  },
  廊坊市: {
    孔隙水: {
      K: '3 ~ 12',
      M: '15 ~ 30',
      S: '0.05 ~ 0.15',
      I: '0.001 ~ 0.003',
      ne: '0.12 ~ 0.22',
      description: '冲积平原区，含水层中等厚度',
      basis: '廊坊市地下水资源调查',
    },
  },
};

/** 根据水源地记录推断推荐参数 */
function getSmartRecommendation(record?: WaterSourceRecord): RecommendedParams | null {
  if (!record) return null;
  const type = record.type as '地下水' | '地表水';
  const subType = record.subType || (type === '地下水' ? '孔隙水' : '河流型');
  const city = record.cityName;

  // 优先使用区域精细化参数
  const regional = REGIONAL_PARAMS[city]?.[subType];
  const generic = PARAM_RECOMMENDATIONS[type]?.[subType];

  if (regional) {
    return { ...generic, ...regional };
  }
  return generic || null;
}
import { useWaterSourceStore, WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';
import {
  CalcParams,
  CalcResult,
  ZoneResult,
  calcProtectionZones,
  calcBatch,
  inferDefaultParams,
} from '@/lib/zoneCalcEngine';
import { exportZoneExcel } from '@/lib/zoneExcelExporter';
import {
  toGeoJSON,
  toBatchGeoJSON,
  exportGeoJSON,
  exportKML,
  exportWKT,
  exportBatchGeoJSON as exportAllGeoJSON,
} from '@/lib/zoneGISExporter';
import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';
import { clipBatchZones, loadAdminBoundaries, summarizeClipResults } from '@/lib/zoneClipEngine';
import type { SourceClipResult } from '@/lib/zoneClipEngine';
import { analyzeSensitivity, toChartData } from '@/lib/sensitivityEngine';
import type { SensitivityResult } from '@/lib/sensitivityEngine';
import {
  generateZoneReport,
  generateBatchReports,
  type ReportConfig,
} from '@/lib/zoneReportGenerator';
import { generatePdfReport } from '@/lib/reportPdfExporter';
import ReportConfigModal from '@/components/ReportConfigModal';
import WellFieldCalc from '@/components/WellFieldCalc';
import CompliancePanel from '@/components/CompliancePanel';

// ===== 快速计算（仅选水源地+水源类型，用默认参数）=====

const QuickCalcPanel: React.FC<{
  sources: WaterSourceRecord[];
  onBatchResult: (results: CalcResult[], sourceIds?: Map<string, string>) => void;
}> = ({ sources, onBatchResult }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gwType, setGwType] = useState<'孔隙水' | '裂隙水' | '岩溶水'>('孔隙水');
  const [calcMethod, setCalcMethod] = useState<'经验值法' | '自动选择'>('自动选择');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sources.map((s) => s.id)));
  const clearSelect = () => setSelectedIds(new Set());

  const handleCalcAll = () => {
    if (
      sources.length === 0 ||
      !window.confirm(`确定对全部 ${sources.length} 个地下水水源地进行保护区计算？`)
    )
      return;
    const sourceIdMap = new Map<string, string>();
    const allResults = sources.map((s) => {
      const baseParams = inferDefaultParams(s.type, s.subType);
      if (baseParams.sourceType === '地下水') baseParams.gwType = gwType;
      sourceIdMap.set(s.name, s.id);
      return calcProtectionZones(s.name, baseParams);
    });
    onBatchResult(allResults, sourceIdMap);
  };

  const handleCalc = () => {
    if (selectedIds.size === 0) return;
    const selected = sources.filter((s) => selectedIds.has(s.id));
    const sourceIdMap = new Map<string, string>();
    const results = selected.map((s) => {
      const baseParams = inferDefaultParams(s.type, s.subType);
      if (baseParams.sourceType === '地下水') {
        baseParams.gwType = gwType;
      }
      sourceIdMap.set(s.name, s.id);
      return calcProtectionZones(s.name, baseParams);
    });
    onBatchResult(results, sourceIdMap);
  };

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-3">
      <h3 className="text-sm font-semibold">快速批量计算（经验值法）</h3>
      <p className="text-xs text-gray-500">选择水源地，指定地下水类型，一键计算保护区</p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={gwType}
          onChange={(e) => setGwType(e.target.value as typeof gwType)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5"
        >
          <option value="孔隙水">孔隙水</option>
          <option value="裂隙水">裂隙水</option>
          <option value="岩溶水">岩溶水</option>
        </select>
        <button
          onClick={selectAll}
          className="text-xs px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
        >
          全选
        </button>
        <button
          onClick={clearSelect}
          className="text-xs px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
        >
          清除
        </button>
        <span className="text-xs text-gray-400">
          已选 {selectedIds.size} / {sources.length} 个
        </span>
        <button
          onClick={handleCalcAll}
          disabled={sources.length === 0}
          className="text-xs px-2 py-1.5 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
        >
          一键全部计算
        </button>
        <button
          onClick={handleCalc}
          disabled={selectedIds.size === 0}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 ml-auto"
        >
          计算 ({selectedIds.size}个)
        </button>
      </div>

      {/* 已选水源地列表 */}
      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded p-2 space-y-0.5">
        {sources.slice(0, 50).map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(s.id)}
              onChange={() => toggleSelect(s.id)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-500 w-16 truncate">{s.cityName.replace('市', '')}</span>
            <span className="font-medium text-blue-800 truncate flex-1">{s.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                s.level === 'municipal'
                  ? 'bg-blue-100 text-blue-700'
                  : s.level === 'county'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {{ municipal: '市级', county: '县级', township: '乡镇级' }[s.level]}
            </span>
          </label>
        ))}
        {sources.length > 50 && (
          <div className="text-xs text-gray-400 text-center py-2">仅显示前50个，更多请使用筛选</div>
        )}
      </div>
    </div>
  );
};

// ===== 精确计算（手动输入水文地质参数，解析法）=====

const PreciseCalcPanel: React.FC<{
  onResult: (result: CalcResult, customParams?: ZoneCalcRecord['customParams']) => void;
}> = ({ onResult }) => {
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

const ResultCard: React.FC<{ result: CalcResult; index: number }> = ({ result, index }) => (
  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
    <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-800">#{index + 1}</span>
        <span className="text-sm font-semibold">{result.sourceName}</span>
        <span className="text-[10px] text-gray-500">
          {result.params.sourceType}
          {result.params.gwType ? ` · ${result.params.gwType}` : ''}
        </span>
      </div>
      <span className="text-[10px] text-gray-400">
        {new Date(result.calculatedAt).toLocaleString('zh-CN')}
      </span>
    </div>

    {result.warnings.length > 0 && (
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
        {result.warnings.map((w, i) => (
          <div key={i} className="text-[10px] text-amber-700 flex items-start gap-1">
            <span className="shrink-0">⚠</span>
            {w}
          </div>
        ))}
      </div>
    )}

    <div className="p-4 space-y-3">
      {result.zones.map((zone) => (
        <div
          key={zone.level}
          className={`rounded-lg p-3 border ${
            zone.level === '一级'
              ? 'border-red-200 bg-red-50/50'
              : zone.level === '二级'
                ? 'border-orange-200 bg-orange-50/50'
                : 'border-yellow-200 bg-yellow-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  zone.level === '一级'
                    ? 'bg-red-500 text-white'
                    : zone.level === '二级'
                      ? 'bg-orange-500 text-white'
                      : 'bg-yellow-500 text-white'
                }`}
              >
                {zone.level}保护区
              </span>
              <span className="text-[10px] text-gray-500">{zone.method}</span>
            </div>
            <div className="text-right">
              <span
                className={`text-lg font-bold ${
                  zone.level === '一级'
                    ? 'text-red-700'
                    : zone.level === '二级'
                      ? 'text-orange-700'
                      : 'text-yellow-700'
                }`}
              >
                {zone.area}
              </span>
              <span className="text-xs text-gray-500 ml-0.5">km²</span>
              {zone.radius && <div className="text-[10px] text-gray-400">R = {zone.radius}m</div>}
              {zone.length && zone.width && (
                <div className="text-[10px] text-gray-400">
                  {zone.length}m × {zone.width}m
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-gray-600 space-y-1">
            <div>
              <span className="font-medium text-gray-700">公式：</span>
              <pre className="whitespace-pre-wrap mt-0.5 text-[10px] bg-white/60 rounded p-1.5 border">
                {zone.formula}
              </pre>
            </div>
            <div>
              <span className="font-medium text-gray-700">边界描述：</span>
              <span className="ml-1">{zone.boundaryDescription}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">参数：</span>
              <span className="ml-1">{zone.keyParams}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">依据：</span>
              <span className="ml-1">{zone.standard}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ===== P3-17: 方案对比组件 =====
const ComparePanel: React.FC<{ results: CalcResult[] }> = ({ results }) => {
  const [selectedResults, setSelectedResults] = useState<[number, number]>([-1, -1]);
  const [compareName, setCompareName] = useState('');

  // 按名称分组
  const groupedResults = useMemo(() => {
    const groups: Record<string, CalcResult[]> = {};
    results.forEach((r, idx) => {
      if (!groups[r.sourceName]) groups[r.sourceName] = [];
      groups[r.sourceName].push({ ...r, _idx: idx } as CalcResult & { _idx: number });
    });
    return groups;
  }, [results]);

  // 有多次计算的水源地
  const multiCalcSources = useMemo(() => {
    return Object.entries(groupedResults)
      .filter(([, list]) => list.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);
  }, [groupedResults]);

  // 对比数据
  const comparison = useMemo(() => {
    if (selectedResults[0] < 0 || selectedResults[1] < 0) return null;
    const r1 = results[selectedResults[0]];
    const r2 = results[selectedResults[1]];
    if (!r1 || !r2) return null;

    const zones: Array<{
      level: string;
      area1: number;
      area2: number;
      diff: number;
      diffPct: number;
      method1: string;
      method2: string;
      r1: ZoneResult;
      r2: ZoneResult;
    }> = [];

    const levels = ['一级', '二级', '准保护区'];
    for (const lv of levels) {
      const z1 = r1.zones.find((z) => z.level === lv);
      const z2 = r2.zones.find((z) => z.level === lv);
      if (z1 || z2) {
        const a1 = z1?.area || 0;
        const a2 = z2?.area || 0;
        zones.push({
          level: lv,
          area1: a1,
          area2: a2,
          diff: a2 - a1,
          diffPct: a1 > 0 ? ((a2 - a1) / a1) * 100 : a2 > 0 ? 100 : 0,
          method1: z1?.method || '-',
          method2: z2?.method || '-',
          r1: z1!,
          r2: z2!,
        });
      }
    }

    return { r1, r2, zones };
  }, [selectedResults, results]);

  if (results.length < 2) {
    return (
      <div className="rounded-lg p-6 bg-white border border-gray-200 text-center">
        <div className="text-gray-400 mb-2">暂无足够数据进行对比</div>
        <p className="text-[10px] text-gray-400">请先在快速计算或精确计算中生成至少2个计算结果</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-3">
      <h3 className="text-sm font-semibold">方案对比</h3>
      <p className="text-xs text-gray-500">选择两次计算结果，并排对比保护区划分方案的差异</p>

      {/* 快速选择：同名水源地的多次计算 */}
      {multiCalcSources.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600">同名水源地多次计算（快速选择）</div>
          {multiCalcSources.slice(0, 5).map(([name, list]) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 truncate w-48">{name}</span>
              <span className="text-[10px] text-gray-400">{list.length}次计算</span>
              <div className="flex gap-1 ml-auto">
                <select
                  className="text-[10px] border border-gray-200 rounded px-1 py-0.5"
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setSelectedResults((prev) => [v, prev[1]]);
                    setCompareName(name);
                  }}
                >
                  <option value="-1">方案A</option>
                  {list.map((r, i) => (
                    <option key={i} value={(r as any)._idx}>
                      {r.params.gwType || r.params.swType || ''} ·{' '}
                      {new Date(r.calculatedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
                <span className="text-gray-300">vs</span>
                <select
                  className="text-[10px] border border-gray-200 rounded px-1 py-0.5"
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setSelectedResults((prev) => [prev[0], v]);
                    setCompareName(name);
                  }}
                >
                  <option value="-1">方案B</option>
                  {list.map((r, i) => (
                    <option key={i} value={(r as any)._idx}>
                      {r.params.gwType || r.params.swType || ''} ·{' '}
                      {new Date(r.calculatedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 自由选择：从全部结果中选择任意两个 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-blue-700">方案 A</label>
          <select
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
            value={selectedResults[0]}
            onChange={(e) => setSelectedResults((prev) => [parseInt(e.target.value), prev[1]])}
          >
            <option value={-1}>-- 选择计算结果 --</option>
            {results.map((r, i) => (
              <option key={i} value={i}>
                #{i + 1} {r.sourceName} ({r.params.gwType || r.params.swType || r.params.sourceType}
                )
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-orange-700">方案 B</label>
          <select
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
            value={selectedResults[1]}
            onChange={(e) => setSelectedResults((prev) => [prev[0], parseInt(e.target.value)])}
          >
            <option value={-1}>-- 选择计算结果 --</option>
            {results.map((r, i) => (
              <option key={i} value={i}>
                #{i + 1} {r.sourceName} ({r.params.gwType || r.params.swType || r.params.sourceType}
                )
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 对比结果 */}
      {comparison && (
        <div className="space-y-3">
          {/* 方案信息头 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg p-2.5 bg-blue-50 border border-blue-200 space-y-1">
              <div className="text-xs font-semibold text-blue-800">方案 A</div>
              <div className="text-[11px] font-medium">{comparison.r1.sourceName}</div>
              <div className="text-[10px] text-blue-600">
                {comparison.r1.params.sourceType === '地下水'
                  ? `${comparison.r1.params.gwType || ''} ${comparison.r1.params.permeability ? `K=${comparison.r1.params.permeability}m/d` : ''} ${comparison.r1.params.aquiferThickness ? `M=${comparison.r1.params.aquiferThickness}m` : ''} ${comparison.r1.params.transmissivity ? `T=${comparison.r1.params.transmissivity}m²/d` : ''}`
                  : `${comparison.r1.params.swType || ''} ${comparison.r1.params.riverFlow ? `Q=${comparison.r1.params.riverFlow}m³/s` : ''}`}
              </div>
            </div>
            <div className="rounded-lg p-2.5 bg-orange-50 border border-orange-200 space-y-1">
              <div className="text-xs font-semibold text-orange-800">方案 B</div>
              <div className="text-[11px] font-medium">{comparison.r2.sourceName}</div>
              <div className="text-[10px] text-orange-600">
                {comparison.r2.params.sourceType === '地下水'
                  ? `${comparison.r2.params.gwType || ''} ${comparison.r2.params.permeability ? `K=${comparison.r2.params.permeability}m/d` : ''} ${comparison.r2.params.aquiferThickness ? `M=${comparison.r2.params.aquiferThickness}m` : ''} ${comparison.r2.params.transmissivity ? `T=${comparison.r2.params.transmissivity}m²/d` : ''}`
                  : `${comparison.r2.params.swType || ''} ${comparison.r2.params.riverFlow ? `Q=${comparison.r2.params.riverFlow}m³/s` : ''}`}
              </div>
            </div>
          </div>

          {/* 面积对比表 */}
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">级别</th>
                  <th className="px-3 py-2 text-center font-semibold text-blue-600">方案A (km²)</th>
                  <th className="px-3 py-2 text-center font-semibold text-orange-600">
                    方案B (km²)
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">差异 (km²)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">差异 (%)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">方法对比</th>
                </tr>
              </thead>
              <tbody>
                {comparison.zones.map((z) => (
                  <tr key={z.level} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          z.level === '一级'
                            ? 'bg-red-500 text-white'
                            : z.level === '二级'
                              ? 'bg-orange-500 text-white'
                              : 'bg-yellow-500 text-white'
                        }`}
                      >
                        {z.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-blue-700">
                      {z.area1.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-orange-700">
                      {z.area2.toFixed(4)}
                    </td>
                    <td
                      className={`px-3 py-2 text-center font-medium ${
                        z.diff > 0
                          ? 'text-green-600'
                          : z.diff < 0
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }`}
                    >
                      {z.diff > 0 ? '+' : ''}
                      {z.diff.toFixed(4)}
                    </td>
                    <td
                      className={`px-3 py-2 text-center ${
                        Math.abs(z.diffPct) > 50 ? 'text-red-600 font-bold' : 'text-gray-600'
                      }`}
                    >
                      {z.area1 > 0 ? `${z.diffPct > 0 ? '+' : ''}${z.diffPct.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-[10px] text-gray-500">
                      {z.method1} vs {z.method2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 可视化对比：面积条形图 */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">面积对比可视化</div>
            {comparison.zones.map((z) => {
              const maxArea = Math.max(z.area1, z.area2, 0.01);
              return (
                <div key={z.level} className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span
                      className={`font-bold w-10 ${
                        z.level === '一级'
                          ? 'text-red-600'
                          : z.level === '二级'
                            ? 'text-orange-600'
                            : 'text-yellow-600'
                      }`}
                    >
                      {z.level}
                    </span>
                    <span className="text-blue-600 w-16 text-right">{z.area1.toFixed(2)}</span>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded"
                          style={{ width: `${(z.area1 / maxArea) * 100}%` }}
                        />
                      </div>
                      <div className="h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded"
                          style={{ width: `${(z.area2 / maxArea) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-orange-600 w-16">{z.area2.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 公式对比 */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">公式对比</div>
            {comparison.zones.map((z) => (
              <div
                key={z.level}
                className={`rounded-lg p-2 border ${
                  z.level === '一级'
                    ? 'border-red-200'
                    : z.level === '二级'
                      ? 'border-orange-200'
                      : 'border-yellow-200'
                }`}
              >
                <div
                  className={`text-[10px] font-bold mb-1 ${
                    z.level === '一级'
                      ? 'text-red-600'
                      : z.level === '二级'
                        ? 'text-orange-600'
                        : 'text-yellow-600'
                  }`}
                >
                  {z.level}保护区
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-blue-50/50 rounded p-1.5">
                    <div className="text-gray-400 mb-0.5">方案A</div>
                    <pre className="whitespace-pre-wrap text-[9px] text-gray-700">
                      {z.r1?.formula || '未计算'}
                    </pre>
                    {z.r1?.keyParams && (
                      <div className="text-gray-500 mt-1">参数: {z.r1.keyParams}</div>
                    )}
                  </div>
                  <div className="bg-orange-50/50 rounded p-1.5">
                    <div className="text-gray-400 mb-0.5">方案B</div>
                    <pre className="whitespace-pre-wrap text-[9px] text-gray-700">
                      {z.r2?.formula || '未计算'}
                    </pre>
                    {z.r2?.keyParams && (
                      <div className="text-gray-500 mt-1">参数: {z.r2.keyParams}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 方法差异分析 */}
          <div className="rounded-lg p-3 bg-purple-50 border border-purple-200">
            <div className="text-xs font-semibold text-purple-800 mb-2">差异分析</div>
            <div className="text-[10px] text-gray-600 space-y-1">
              {comparison.zones.some((z) => z.method1 !== z.method2) && (
                <p>
                  <strong>方法差异：</strong>
                  {comparison.zones
                    .filter((z) => z.method1 !== z.method2)
                    .map((z) => `${z.level}保护区（${z.method1} vs ${z.method2}）`)
                    .join('；')}
                </p>
              )}
              {comparison.zones.some((z) => Math.abs(z.diffPct) > 100) && (
                <p className="text-red-600">
                  <strong>显著差异：</strong>
                  {comparison.zones
                    .filter((z) => Math.abs(z.diffPct) > 100)
                    .map((z) => `${z.level}保护区差异${Math.abs(z.diffPct).toFixed(0)}%`)
                    .join('；')}
                  ，建议核查参数合理性。
                </p>
              )}
              {comparison.zones.every(
                (z) => z.method1 === z.method2 && Math.abs(z.diffPct) <= 20,
              ) && (
                <p className="text-green-600">
                  两方案计算结果接近（差异均 &lt; 20%），结果可信度较高。
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!comparison && multiCalcSources.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">从上方下拉框中选择两个方案进行对比</p>
          <p className="text-[10px] text-gray-300 mt-1">
            提示：对同一水源地用不同参数分别计算后，可在此对比结果
          </p>
        </div>
      )}
    </div>
  );
};

// ===== 主页面 =====

const ProtectionZoneCalc: React.FC = () => {
  const { loaded, sources, zoneResults, saveZoneResult, deleteZoneResult, loadZoneResults } =
    useWaterSourceStore();
  const [results, setResults] = useState<CalcResult[]>([]);
  const [activeTab, setActiveTab] = useState<'quick' | 'precise' | 'compare'>('quick');
  const [autoSave, setAutoSave] = useState(true);
  // P3-18: 批量导出进度
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    cityName: string;
  } | null>(null);
  const [batchExporting, setBatchExporting] = useState(false);
  const [clipResults, setClipResults] = useState<SourceClipResult[] | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const [sensitivityResult, setSensitivityResult] = useState<SensitivityResult | null>(null);
  // B1: 报告配置弹窗
  const [reportConfigOpen, setReportConfigOpen] = useState(false);

  // B1: 报告生成处理
  const handleGenerateReport = async (config: ReportConfig, format: 'word' | 'pdf' | 'both') => {
    const opts = { ...config, cityNames: config.cityNames };
    if (format === 'word' || format === 'both') {
      await generateZoneReport(zoneResults, sources, opts);
    }
    if (format === 'pdf' || format === 'both') {
      await generatePdfReport(zoneResults, sources, opts);
    }
  };

  // P3-12: 从URL参数自动切换到精确计算并切换Tab
  React.useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    if (params.get('source')) {
      setActiveTab('precise');
    }
  }, []);

  // 加载时恢复历史计算结果
  useEffect(() => {
    if (loaded && zoneResults.length === 0) {
      loadZoneResults().then(() => {
        const stored = useWaterSourceStore.getState().zoneResults;
        if (stored.length > 0) {
          setResults(
            stored.map((zr) => ({
              sourceName: zr.sourceName,
              params: zr.params,
              zones: zr.zones,
              calculatedAt: zr.calculatedAt,
              warnings: zr.warnings,
            })),
          );
        }
      });
    } else if (zoneResults.length > 0 && results.length === 0) {
      // zoneResults已加载但results未恢复
      setResults(
        zoneResults.map((zr) => ({
          sourceName: zr.sourceName,
          params: zr.params,
          zones: zr.zones,
          calculatedAt: zr.calculatedAt,
          warnings: zr.warnings,
        })),
      );
    }
  }, [loaded]);

  // 保存计算结果到IDB
  const persistResult = useCallback(
    async (
      result: CalcResult,
      sourceId?: string,
      customParams?: ZoneCalcRecord['customParams'],
    ) => {
      if (!autoSave) return;
      const record: ZoneCalcRecord = {
        id: `${result.sourceName}_${Date.now()}`,
        sourceId: sourceId || result.sourceName,
        sourceName: result.sourceName,
        params: result.params,
        zones: result.zones,
        calculatedAt: result.calculatedAt,
        warnings: result.warnings,
        customParams,
      };
      await saveZoneResult(record);
    },
    [autoSave, saveZoneResult],
  );

  const handleBatchResult = useCallback(
    (newResults: CalcResult[], sourceIds?: Map<string, string>) => {
      setResults((prev) => [...prev, ...newResults]);
      newResults.forEach((r, i) => {
        const sid = sourceIds?.get(r.sourceName);
        persistResult(r, sid);
      });
    },
    [persistResult],
  );

  const handleSingleResult = useCallback(
    (result: CalcResult, customParams?: ZoneCalcRecord['customParams']) => {
      setResults((prev) => [...prev, result]);
      persistResult(result, undefined, customParams);
    },
    [persistResult],
  );

  const clearResults = () => setResults([]);

  // P4-5: 准备GIS导出数据
  const prepareGisExport = useCallback(() => {
    return zoneResults
      .map((zr) => {
        const source = sources.find((s) => s.name === zr.sourceName);
        const lng = source?.lng;
        const lat = source?.lat;
        if (lng == null || lat == null) return null;
        return generateSourceZoneVertices(zr.sourceId, zr.sourceName, lng, lat, zr.zones);
      })
      .filter(Boolean) as ReturnType<typeof generateSourceZoneVertices>[];
  }, [zoneResults, sources]);

  // 仅地下水水源地用于快速计算
  const gwSources = useMemo(() => sources.filter((s) => s.type === '地下水'), [sources]);

  if (!loaded) {
    return <div className="p-6 text-center text-gray-500">数据加载中...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold">水源地保护区划分</h1>
        <p className="text-xs text-gray-500 mt-1">
          依据 HJ 338-2018《饮用水水源保护区划分技术规范》，支持经验值法和解析法(Cooper-Jacob)
        </p>
      </div>

      {/* Tab切换 - 移动端横向滚动 */}
      <div className="flex overflow-x-auto border-b border-gray-200 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'quick'
              ? 'border-blue-500 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          快速批量计算
        </button>
        <button
          onClick={() => setActiveTab('precise')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'precise'
              ? 'border-blue-500 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          精确计算（解析法）
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'compare'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          方案对比
          {results.length >= 2 && (
            <span className="ml-1 text-[10px] bg-purple-100 text-purple-600 px-1 rounded-full">
              {results.length}
            </span>
          )}
        </button>
      </div>

      {/* 计算面板 */}
      {activeTab === 'quick' ? (
        <QuickCalcPanel sources={gwSources} onBatchResult={handleBatchResult} />
      ) : activeTab === 'precise' ? (
        <PreciseCalcPanel onResult={handleSingleResult} />
      ) : (
        <ComparePanel results={results} />
      )}

      {/* 结果汇总 */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold">计算结果（{results.length}个）</div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>自动保存</span>
              </label>
              {autoSave && (
                <span className="text-[10px] text-green-600">
                  &#10003; 已保存{zoneResults.length}条
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {zoneResults.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm(`确定清空全部${zoneResults.length}条保存的计算结果？`)) {
                      useWaterSourceStore.getState().clearZoneResults();
                      setResults([]);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  清空已保存
                </button>
              )}
              <button
                onClick={clearResults}
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
              >
                清空显示
              </button>
              {zoneResults.length > 0 && (
                <>
                  <button
                    onClick={() => exportZoneExcel(zoneResults, sources, { includeVertices: true })}
                    className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 hover:bg-green-50"
                  >
                    导出Excel
                  </button>
                  <button
                    onClick={() => setReportConfigOpen(true)}
                    className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    导出报告(Word/PDF)
                  </button>
                  {/* P4-5: GIS导出 */}
                  <div className="relative group inline-block">
                    <button className="text-xs px-2 py-1 rounded border border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                      GIS导出
                      <svg
                        className="w-2.5 h-2.5"
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
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white border border-purple-200 rounded-lg shadow-lg py-1 w-44 z-30 hidden group-hover:block">
                      <button
                        onClick={() => {
                          const items = prepareGisExport();
                          if (items.length === 0) return alert('无已保存的计算结果');
                          exportAllGeoJSON(items);
                        }}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
                      >
                        <span className="text-green-500">●</span> GeoJSON（QGIS/ArcGIS通用）
                      </button>
                      <button
                        onClick={() => {
                          const items = prepareGisExport();
                          if (items.length === 0) return alert('无已保存的计算结果');
                          items.forEach((item) => exportKML(item));
                        }}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
                      >
                        <span className="text-blue-500">●</span> KML（Google Earth）
                      </button>
                      <button
                        onClick={() => {
                          const items = prepareGisExport();
                          if (items.length === 0) return alert('无已保存的计算结果');
                          items.forEach((item) => exportWKT(item));
                        }}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
                      >
                        <span className="text-amber-500">●</span> WKT（文本图层）
                      </button>
                      <div className="border-t border-purple-100 my-1"></div>
                      <div className="px-3 py-1.5 text-[9px] text-gray-400 leading-tight">
                        导出所有已保存计算结果的保护区坐标
                        <br />
                        坐标系：WGS84（EPSG:4326）
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          `将按城市分组生成${
                            new Set(
                              zoneResults.map((r) => {
                                const s = sources.find((s) => s.name === r.sourceName);
                                return s?.cityName || '未知';
                              }),
                            ).size
                          }个独立Word报告文件，是否继续？`,
                        )
                      )
                        return;
                      setBatchExporting(true);
                      setBatchProgress({ current: 0, total: 0, cityName: '' });
                      try {
                        await generateBatchReports(zoneResults, sources, {
                          includeVertices: true,
                          onProgress: (current, total, cityName) => {
                            setBatchProgress({ current, total, cityName });
                          },
                        });
                      } finally {
                        setBatchExporting(false);
                        setBatchProgress(null);
                      }
                    }}
                    disabled={batchExporting}
                    className="text-xs px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {batchExporting
                      ? `导出中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : ''}`
                      : '批量导出(按城市分报告)'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* P3-18: 批量导出进度条 */}
          {batchExporting && batchProgress && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl p-6 mx-4 max-w-sm w-full">
                <h3 className="text-lg font-bold text-gray-800 mb-3">批量导出Word报告</h3>
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>正在生成：{batchProgress.cityName}</span>
                    <span>
                      {batchProgress.current}/{batchProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">每个城市生成一个独立Word文件，请勿关闭页面</p>
              </div>
            </div>
          )}

          {/* 汇总表 */}
          <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">水源地</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">类型</th>
                  <th className="px-3 py-2 text-center font-semibold text-red-600">一级(km²)</th>
                  <th className="px-3 py-2 text-center font-semibold text-orange-600">二级(km²)</th>
                  <th className="px-3 py-2 text-center font-semibold text-yellow-600">
                    准保护(km²)
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">上游(m)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">下游(m)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">岸宽(m)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">方法</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const z1 = r.zones.find((z) => z.level === '一级');
                  const z2 = r.zones.find((z) => z.level === '二级');
                  const zq = r.zones.find((z) => z.level === '准保护区');
                  return (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{r.sourceName}</td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {r.params.sourceType === '地下水'
                          ? r.params.gwType || ''
                          : r.params.swType || ''}
                      </td>
                      <td className="px-3 py-1.5 text-center font-medium text-red-700">
                        {z1?.area || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center font-medium text-orange-700">
                        {z2?.area || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center font-medium text-yellow-700">
                        {zq?.area || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">
                        {z1?.riverExt?.upstreamLength || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">
                        {z1?.riverExt?.downstreamLength || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">
                        {z1?.riverExt?.bankWidth || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">{z1?.method || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 详细结果卡片 */}
          {results.map((r, i) => (
            <ResultCard key={i} result={r} index={i} />
          ))}
        </div>
      )}

      {/* P4-7: 参数敏感性分析面板 */}
      {results.length > 0 && results[results.length - 1].params.sourceType === '地下水' && (
        <div className="rounded-lg p-4 bg-white border border-amber-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-amber-700">参数敏感性分析</h3>
            </div>
            <button
              onClick={() => {
                const lastResult = results[results.length - 1];
                const result = analyzeSensitivity(
                  lastResult.sourceName,
                  lastResult.params,
                  lastResult.zones[0]?.method || '解析法',
                );
                setSensitivityResult(result);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              分析
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            固定其他参数不变，在合理范围内变化单个参数，观察保护区面积响应（仅支持地下水解析法）
          </p>

          {sensitivityResult && sensitivityResult.curves.length > 0 && (
            <div className="space-y-4">
              {/* 敏感度排名 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {sensitivityResult.curves.map((curve, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-2 text-center ${
                      curve.sensitivityLevel === '高'
                        ? 'bg-red-50 border border-red-200'
                        : curve.sensitivityLevel === '中'
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-green-50 border border-green-200'
                    }`}
                  >
                    <div
                      className={`text-xs font-bold ${
                        curve.sensitivityLevel === '高'
                          ? 'text-red-600'
                          : curve.sensitivityLevel === '中'
                            ? 'text-amber-600'
                            : 'text-green-600'
                      }`}
                    >
                      {curve.paramKey}
                    </div>
                    <div className="text-[9px] text-gray-500">{curve.paramName}</div>
                    <div
                      className={`text-[9px] font-medium mt-0.5 ${
                        curve.sensitivityLevel === '高'
                          ? 'text-red-500'
                          : curve.sensitivityLevel === '中'
                            ? 'text-amber-500'
                            : 'text-green-500'
                      }`}
                    >
                      {curve.sensitivityLevel}敏感度
                    </div>
                  </div>
                ))}
              </div>

              {/* 敏感度曲线图表（用纯CSS+div模拟简易图表） */}
              {sensitivityResult.curves.slice(0, 2).map((curve, ci) => {
                const chartData = toChartData(curve);
                const maxArea = Math.max(...chartData.map((d) => d.area2), 0.001);
                return (
                  <div key={ci} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-medium text-gray-700">
                        {curve.paramName}（{curve.paramKey}）对二级保护区面积影响
                      </span>
                      <span className="text-gray-400">
                        基准值: {curve.baseValue} {curve.unit}
                      </span>
                    </div>
                    <div className="flex items-end gap-px h-20 bg-gray-50 rounded p-1">
                      {chartData.map((d, di) => (
                        <div
                          key={di}
                          className="flex-1 flex flex-col items-center justify-end h-full group relative"
                        >
                          <div
                            className="w-full bg-amber-400 hover:bg-amber-500 rounded-t transition-colors cursor-pointer"
                            style={{ height: `${Math.max((d.area2 / maxArea) * 100, 1)}%` }}
                            title={`${curve.paramKey}=${d.paramValue}\n二级面积: ${d.area2.toFixed(4)} km²`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[8px] text-gray-400">
                      <span>{curve.range[0]}</span>
                      <span className="text-amber-600 font-medium">{curve.baseValue}</span>
                      <span>
                        {curve.range[1]} {curve.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sensitivityResult && sensitivityResult.curves.length === 0 && (
            <div className="text-[10px] text-gray-400 text-center py-2">
              当前参数配置不支持敏感性分析（需填入渗透系数K和储水系数S等水文地质参数）
            </div>
          )}
        </div>
      )}

      {/* A2: 多井干扰保护区计算面板 */}
      <div className="rounded-lg p-4 bg-white border border-cyan-200">
        <WellFieldCalc />
      </div>

      {/* B3: 合规性检查面板 */}
      {zoneResults.length > 0 && (
        <div className="rounded-lg p-4 bg-white border border-teal-200">
          <CompliancePanel zoneResults={zoneResults} sources={sources} />
        </div>
      )}

      {/* P4-3: 行政区划裁剪面板 */}
      {zoneResults.length > 0 && (
        <div className="rounded-lg p-4 bg-white border border-indigo-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-indigo-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <h3 className="text-sm font-semibold text-indigo-700">行政区划裁剪</h3>
            </div>
            <button
              onClick={async () => {
                setClipLoading(true);
                try {
                  const items = prepareGisExport();
                  if (items.length === 0) {
                    alert('无已保存的计算结果');
                    return;
                  }
                  const getCityName = (name: string) => {
                    const s = sources.find((src) => src.name === name);
                    return s?.cityName || '未知';
                  };
                  const results = await clipBatchZones(items, getCityName);
                  setClipResults(results);
                } catch (e) {
                  console.error('裁剪计算失败:', e);
                  alert('裁剪计算失败: ' + (e as Error).message);
                } finally {
                  setClipLoading(false);
                }
              }}
              disabled={clipLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:bg-indigo-300 transition-colors"
            >
              {clipLoading ? '计算中...' : '执行裁剪'}
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            将保护区理论范围与行政区划边界求交集，计算实际管控面积（扣除超出行政边界的部分）
          </p>

          {clipResults &&
            clipResults.length > 0 &&
            (() => {
              const summary = summarizeClipResults(clipResults);
              return (
                <div className="space-y-3">
                  {/* 汇总卡片 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-indigo-600">
                        {summary.totalSources}
                      </div>
                      <div className="text-[9px] text-indigo-400">水源地总数</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-red-600">{summary.clippedSources}</div>
                      <div className="text-[9px] text-red-400">被裁剪数量</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-amber-600">
                        {summary.totalOriginalArea.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-amber-400">理论面积 km²</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-green-600">
                        {summary.totalClippedArea.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-green-400">实际面积 km²</div>
                    </div>
                  </div>
                  {summary.reductionPct > 0.01 && (
                    <div className="text-xs text-center text-gray-500">
                      裁剪缩减 {summary.totalReduction.toFixed(2)} km²（{summary.reductionPct}%）
                    </div>
                  )}

                  {/* 明细表 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-indigo-100">
                          <th className="border border-indigo-200 px-2 py-1 text-left">水源地</th>
                          <th className="border border-indigo-200 px-2 py-1 text-left">城市</th>
                          <th className="border border-indigo-200 px-2 py-1">级别</th>
                          <th className="border border-indigo-200 px-2 py-1 text-right">
                            理论 km²
                          </th>
                          <th className="border border-indigo-200 px-2 py-1 text-right">
                            实际 km²
                          </th>
                          <th className="border border-indigo-200 px-2 py-1 text-right">
                            裁剪比例
                          </th>
                          <th className="border border-indigo-200 px-2 py-1">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clipResults.flatMap((cr) =>
                          cr.zones.map((z, i) => (
                            <tr
                              key={`${cr.sourceName}-${i}`}
                              className={z.isClipped ? 'bg-red-50' : ''}
                            >
                              <td className="border border-gray-200 px-2 py-1 text-left max-w-[120px] truncate">
                                {cr.sourceName}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-left">
                                {cr.cityName}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-center">
                                {z.level}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-right">
                                {z.originalArea.toFixed(4)}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-right">
                                {z.clippedArea.toFixed(4)}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-right">
                                {z.clipRatio < 1 ? `${(z.clipRatio * 100).toFixed(1)}%` : '-'}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-center">
                                {z.isClipped ? (
                                  <span className="text-red-500">被裁剪</span>
                                ) : (
                                  <span className="text-green-500">完整</span>
                                )}
                              </td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* 参考说明 */}
      <div className="rounded-lg p-4 bg-gray-50 border border-gray-200">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">技术依据</h3>
        <div className="text-[10px] text-gray-500 space-y-1">
          <p>
            <strong>HJ 338-2018</strong>《饮用水水源保护区划分技术规范》
          </p>
          <p>
            <strong>解析法原理：</strong>
            基于Cooper-Jacob近似解，通过导水系数T和储水系数S计算给定运移时间t内地下水污染羽的扩展半径。一级保护区取t=60天（常规病原体灭活时间），二级保护区取t=25年。
          </p>
          <p>
            <strong>经验值法：</strong>
            当缺少详细水文地质参数时，按地下水类型（孔隙水/裂隙水/岩溶水）查表取典型半径值。
          </p>
          <p>
            <strong>适用范围：</strong>
            孔隙水裂隙水适用解析法；岩溶水含水层非均质性强，解析法结果仅供参考，应结合示踪试验或数值模拟验证。
          </p>
        </div>
      </div>
      {/* B1: 报告配置弹窗 */}
      <ReportConfigModal
        open={reportConfigOpen}
        onClose={() => setReportConfigOpen(false)}
        onGenerate={handleGenerateReport}
      />
    </div>
  );
};

export default ProtectionZoneCalc;
