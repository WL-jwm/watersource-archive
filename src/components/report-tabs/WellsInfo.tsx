import React from 'react';
import {
  formatNumber,
  formatYield,
  formatArea,
  getTotalZoneArea,
  getTotalZonePoints,
  getClassColor,
} from '@/utils/helpers';
import type { WaterSource } from '@/types';

const WellsInfo: React.FC<{ source: WaterSource }> = ({ source }) => (
  <div>
    <div className="flex items-center justify-between mb-4">
      <h3 className="section-title mb-0">水井信息 ({source.wells.length}眼)</h3>
      <div className="text-xs text-text-tertiary">
        成井深度: {source.wells[0]?.wellDepth || '-'}m | 管材:{' '}
        {source.wells[0]?.casingMaterial || '-'} | 滤水管: {source.wells[0]?.screenMaterial || '-'}
      </div>
    </div>
    {source.wells.map((well: any) => (
      <div key={well.id} className="card p-4 lg:p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-semibold text-text-primary">
            {well.wellNumber}
            <span className="ml-2 text-xs font-mono text-text-tertiary bg-surface-tertiary px-2 py-0.5 rounded">
              {well.wellCode}
            </span>
          </h4>
          <span
            className={`badge ${well.status === '在用' ? 'badge-success' : well.status === '备用' ? 'badge-warning' : 'badge-neutral'}`}
          >
            {well.status}
          </span>
        </div>
        {/* Well visual summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-surface-tertiary rounded-lg">
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">{well.wellDepth}m</div>
            <div className="text-[10px] text-text-tertiary">井深</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">{well.wellDiameter}mm</div>
            <div className="text-[10px] text-text-tertiary">井径</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">{well.staticWaterLevel}m</div>
            <div className="text-[10px] text-text-tertiary">静水位</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">{well.completionDate}</div>
            <div className="text-[10px] text-text-tertiary">建成时间</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div className="info-item">
            <span className="info-label">坐标（经度, 纬度）</span>
            <span className="info-value font-mono text-xs">
              {well.longitude.toFixed(6)}, {well.latitude.toFixed(6)}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">井壁管材质</span>
            <span className="info-value">{well.casingMaterial}</span>
          </div>
          <div className="info-item">
            <span className="info-label">滤水管材质</span>
            <span className="info-value">{well.screenMaterial}</span>
          </div>
          <div className="info-item">
            <span className="info-label">滤水段（取水段）</span>
            <span className="info-value">{well.screenInterval}</span>
          </div>
          <div className="info-item">
            <span className="info-label">涌水量（降深关系）</span>
            <span className="info-value">{well.yieldAtDrawdown}</span>
          </div>
          <div className="info-item">
            <span className="info-label">预期使用年限</span>
            <span className="info-value">{well.expectedLife}</span>
          </div>
        </div>
        {well.remarks && (
          <div className="mt-3 pt-3 border-t border-surface-border text-xs text-text-secondary bg-surface-tertiary/50 rounded px-3 py-2">
            备注: {well.remarks}
          </div>
        )}
      </div>
    ))}
  </div>
);

export default WellsInfo;
