import React from 'react';
import { formatArea, getTotalZoneArea, getTotalZonePoints, getClassColor } from '@/utils/helpers';
import type { WaterSource } from '@/types';

const HydrogeologyInfo: React.FC<{ source: WaterSource }> = ({ source }) => {
  const h = source.hydrogeology;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="section-title">含水层特征参数</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">含水层类型</span>
            <span className="info-value">{h.aquiferType}</span>
          </div>
          <div className="info-item">
            <span className="info-label">岩性</span>
            <span className="info-value">{h.lithology}</span>
          </div>
          <div className="info-item">
            <span className="info-label">含水层厚度</span>
            <span className="info-value">{h.aquiferThickness}m</span>
          </div>
          <div className="info-item">
            <span className="info-label">含水层埋深</span>
            <span className="info-value">{h.aquiferDepth}</span>
          </div>
          <div className="info-item">
            <span className="info-label">渗透系数 K</span>
            <span className="info-value font-mono">{h.permeabilityCoeff}</span>
          </div>
          <div className="info-item">
            <span className="info-label">导水系数 T</span>
            <span className="info-value font-mono">{h.transmissivity}</span>
          </div>
          <div className="info-item">
            <span className="info-label">水力坡度</span>
            <span className="info-value font-mono">{h.hydraulicGradient}</span>
          </div>
          <div className="info-item">
            <span className="info-label">地下水流向</span>
            <span className="info-value">{h.groundwaterFlowDirection}</span>
          </div>
        </div>
      </div>

      {/* Key parameters highlight */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3 bg-blue-50/50 border-blue-200 text-center">
          <div className="text-lg font-bold text-blue-600">{h.permeabilityCoeff}</div>
          <div className="text-[10px] text-text-secondary">渗透系数 K (m/d)</div>
        </div>
        <div className="card p-3 bg-blue-50/50 border-blue-200 text-center">
          <div className="text-lg font-bold text-blue-600">{h.transmissivity}</div>
          <div className="text-[10px] text-text-secondary">导水系数 T (m2/d)</div>
        </div>
        <div className="card p-3 bg-blue-50/50 border-blue-200 text-center">
          <div className="text-lg font-bold text-blue-600">{h.aquiferThickness}m</div>
          <div className="text-[10px] text-text-secondary">含水层厚度</div>
        </div>
        <div className="card p-3 bg-blue-50/50 border-blue-200 text-center">
          <div className="text-lg font-bold text-blue-600">{h.hydraulicGradient}</div>
          <div className="text-[10px] text-text-secondary">水力坡度</div>
        </div>
      </div>

      {/* 补径排 */}
      <div>
        <h3 className="section-title">补给、径流、排泄条件</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-l-emerald-400">
            <h4 className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
              补给条件
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">{h.rechargeConditions}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-sky-400">
            <h4 className="text-sm font-semibold text-sky-600 mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
              径流条件
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">{h.runoffConditions}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-amber-400">
            <h4 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
              排泄条件
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">{h.dischargeConditions}</p>
          </div>
        </div>
      </div>

      {/* 结构与隔水层 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-2">含水层结构描述</h4>
          <p className="text-sm text-text-secondary leading-relaxed">{h.aquiferStructure}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-2">隔水层特征</h4>
          <p className="text-sm text-text-secondary leading-relaxed">{h.confiningBed}</p>
        </div>
      </div>
    </div>
  );
};

export default HydrogeologyInfo;
