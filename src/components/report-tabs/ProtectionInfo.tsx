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
import CoordinatePreview from './CoordinatePreview';

const ProtectionInfo: React.FC<{ source: WaterSource }> = ({ source }) => (
  <div className="space-y-5">
    <h3 className="section-title">
      保护区划分方案
      <span className="ml-2 text-sm font-normal text-text-tertiary">
        （依据 HJ 338-2018《饮用水水源保护区划分技术规范》）
      </span>
    </h3>

    {/* Zone summary cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="stat-card">
        <div className="text-base font-bold text-accent-500">{source.protectionZones.length}</div>
        <div className="text-xs text-text-secondary">保护区级别数</div>
      </div>
      <div className="stat-card">
        <div className="text-base font-bold text-accent-500">
          {getTotalZoneArea(source).toFixed(3)}
        </div>
        <div className="text-xs text-text-secondary">总面积 (km2)</div>
      </div>
      <div className="stat-card">
        <div className="text-base font-bold text-accent-500">{getTotalZonePoints(source)}</div>
        <div className="text-xs text-text-secondary">拐点总数</div>
      </div>
      <div className="stat-card">
        <div className="text-base font-bold text-accent-500">HJ 338-2018</div>
        <div className="text-xs text-text-secondary">划分依据</div>
      </div>
    </div>

    {source.protectionZones.map((zone: any) => (
      <div
        key={zone.id}
        className={`card p-4 lg:p-5 ${zone.level.includes('一级') ? 'zone-level-1' : zone.level.includes('二级') ? 'zone-level-2' : 'zone-level-quasi'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${zone.level.includes('一级') ? 'bg-red-500' : zone.level.includes('二级') ? 'bg-amber-500' : 'bg-blue-400'}`}
            />
            {zone.level}
          </h4>
          <div className="flex items-center gap-3">
            <span className="badge-info">{zone.area.toFixed(3)} km2</span>
            <span className="badge-neutral">{zone.boundaryType.split('（')[0]}</span>
          </div>
        </div>
        <div className="mb-4 p-3 bg-surface-tertiary rounded-lg">
          <span className="info-label">边界描述</span>
          <p className="text-sm text-text-secondary leading-relaxed mt-1">
            {zone.boundaryDescription}
          </p>
        </div>

        {zone.boundaryPoints.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-accent-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              拐点坐标 ({zone.boundaryPoints.length}个)
            </h5>
            <div className="card overflow-hidden mb-3">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-16 text-center">编号</th>
                      <th className="w-32 text-right">经度 (E)</th>
                      <th className="w-32 text-right">纬度 (N)</th>
                      <th>位置描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zone.boundaryPoints.map((pt: any, idx: number) => (
                      <tr key={idx}>
                        <td className="text-center font-mono font-medium">{pt.pointNumber}</td>
                        <td className="text-right font-mono text-xs">{pt.longitude.toFixed(6)}</td>
                        <td className="text-right font-mono text-xs">{pt.latitude.toFixed(6)}</td>
                        <td className="text-text-secondary text-xs">{pt.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <CoordinatePreview points={zone.boundaryPoints} zoneName={zone.level} />
          </div>
        )}
      </div>
    ))}
  </div>
);

export default ProtectionInfo;
