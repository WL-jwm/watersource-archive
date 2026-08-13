/**
 * N6: MapView 拆分 — 地图图例组件
 *
 * 可折叠图例，展示水源地级别颜色和保护区圈层说明
 */

import React from 'react';

interface MapLegendProps {
  collapsed: boolean;
  showZones: boolean;
  showActualZones: boolean;
  onToggle: () => void;
}

const levelConfig: Record<string, { color: string; label: string }> = {
  municipal: { color: '#2F5496', label: '市级' },
  county: { color: '#548235', label: '县级' },
  township: { color: '#BF8F00', label: '乡镇级' },
};

const MapLegend: React.FC<MapLegendProps> = ({ collapsed, showZones, showActualZones, onToggle }) => {
  return (
    <div
      className={`absolute bottom-4 left-4 z-[1000] bg-surface/95 backdrop-blur border border-border rounded-lg shadow-lg transition-all duration-200 ${collapsed ? 'p-2' : 'p-3'}`}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full"
      >
        <span className="text-[10px] font-semibold text-text-tertiary">图例</span>
        <svg
          className={`w-3 h-3 text-text-tertiary transition-transform ${collapsed ? '' : 'rotate-180'}`}
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
      {!collapsed && (
        <div className="space-y-1.5 mt-2">
          {Object.entries(levelConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: cfg.color }}
              />
              <span className="text-xs text-text-secondary">{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full border border-white shadow-sm opacity-30"
              style={{ backgroundColor: '#888' }}
            />
            <span className="text-xs text-text-tertiary">已取消</span>
          </div>
          {showActualZones && (
            <>
              <div className="w-full h-px bg-border my-1" />
              <div className="text-[10px] font-semibold text-text-tertiary">实际保护区范围</div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full border-2"
                  style={{ borderColor: '#2563EB', backgroundColor: '#2563EB40' }}
                />
                <span className="text-xs text-text-secondary">一级保护区</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full border-2"
                  style={{ borderColor: '#10B981', backgroundColor: '#10B98140' }}
                />
                <span className="text-xs text-text-secondary">二级保护区</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full border-2"
                  style={{ borderColor: '#7C3AED', backgroundColor: '#7C3AED40' }}
                />
                <span className="text-xs text-text-secondary">准保护区</span>
              </div>
            </>
          )}
          {showZones && (
            <>
              <div className="w-full h-px bg-border my-1" />
              <div className="text-[10px] font-semibold text-text-tertiary">保护区</div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full border-2"
                  style={{ borderColor: '#DC2626', backgroundColor: '#DC262620' }}
                />
                <span className="text-xs text-text-secondary">一级保护区</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full border-2"
                  style={{ borderColor: '#F97316', backgroundColor: '#F9731620' }}
                />
                <span className="text-xs text-text-secondary">二级保护区</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-2.5 border-2"
                  style={{
                    borderColor: '#DC2626',
                    backgroundColor: '#DC262620',
                    borderRadius: '2px',
                  }}
                />
                <span className="text-xs text-text-secondary">河流型(矩形)</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-2.5 border-2"
                  style={{
                    borderColor: '#F97316',
                    backgroundColor: '#F9731620',
                    clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
                  }}
                />
                <span className="text-xs text-text-secondary">扇形(解析法)</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MapLegend;
