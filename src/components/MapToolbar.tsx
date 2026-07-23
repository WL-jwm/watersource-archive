/**
 * MapToolbar - 地图工具栏组件
 *
 * 提供绘制工具、测量工具和图层操作按钮
 */

import React from 'react';
import type { DrawTool } from '@/lib/mapDrawTools';

interface MapToolbarProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  onUndo: () => void;
  onClear: () => void;
  featureCount: number;
  isDrawing: boolean;
}

interface ToolButton {
  tool: DrawTool;
  label: string;
  icon: string;
  color: string;
  group: 'draw' | 'measure' | 'action';
}

const TOOLS: ToolButton[] = [
  // 绘制工具
  { tool: 'point', label: '标注', icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z', color: '#DC2626', group: 'draw' },
  { tool: 'line', label: '画线', icon: 'M3 17l6-6 4 4 8-8', color: '#DC2626', group: 'draw' },
  { tool: 'polygon', label: '画面', icon: 'M3 6l6-3 6 3 3 6-3 6-6 3-6-3-3-6z', color: '#7C3AED', group: 'draw' },
  { tool: 'circle', label: '画圆', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z', color: '#DC2626', group: 'draw' },
  // 测量工具
  { tool: 'measure-distance', label: '测距', icon: 'M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4', color: '#2563EB', group: 'measure' },
  { tool: 'measure-area', label: '测面', icon: 'M3 5l9-2 9 2v14l-9 2-9-2V5z', color: '#059669', group: 'measure' },
];

const MapToolbar: React.FC<MapToolbarProps> = ({
  activeTool,
  onToolChange,
  onUndo,
  onClear,
  featureCount,
  isDrawing,
}) => {
  const drawTools = TOOLS.filter((t) => t.group === 'draw');
  const measureTools = TOOLS.filter((t) => t.group === 'measure');

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-surface border-b border-border shrink-0">
      {/* 绘制工具组 */}
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] text-text-quaternary mr-1">绘制</span>
        {drawTools.map((t) => (
          <button
            key={t.tool}
            onClick={() => onToolChange(activeTool === t.tool ? 'none' : t.tool)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
              activeTool === t.tool
                ? 'text-white border-transparent'
                : 'bg-surface text-text-secondary border-border hover:border-accent-300'
            }`}
            style={activeTool === t.tool ? { backgroundColor: t.color } : {}}
            title={t.label}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
            </svg>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* 测量工具组 */}
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] text-text-quaternary mr-1">测量</span>
        {measureTools.map((t) => (
          <button
            key={t.tool}
            onClick={() => onToolChange(activeTool === t.tool ? 'none' : t.tool)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
              activeTool === t.tool
                ? 'text-white border-transparent'
                : 'bg-surface text-text-secondary border-border hover:border-accent-300'
            }`}
            style={activeTool === t.tool ? { backgroundColor: t.color } : {}}
            title={t.label}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
            </svg>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {featureCount > 0 && (
        <>
          <div className="w-px h-5 bg-border mx-1" />
          {/* 操作按钮 */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={onUndo}
              disabled={featureCount === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-text-secondary hover:border-accent-300 disabled:opacity-30"
              title="撤销最后一笔"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6" />
              </svg>
              <span className="hidden sm:inline">撤销</span>
            </button>
            <button
              onClick={onClear}
              disabled={featureCount === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30"
              title="清空全部"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">清空</span>
            </button>
            <span className="text-[10px] text-text-quaternary ml-1">
              {featureCount} 个要素
            </span>
          </div>
        </>
      )}

      {/* 绘制中提示 */}
      {isDrawing && (
        <div className="ml-auto flex items-center gap-1.5 text-xs text-blue-600">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          {activeTool === 'line' || activeTool === 'measure-distance'
            ? '点击添加节点，双击结束'
            : activeTool === 'polygon' || activeTool === 'measure-area'
              ? '点击添加顶点，双击闭合'
              : activeTool === 'circle'
                ? '点击设置圆心，再次点击确定半径'
                : '点击地图放置标注'}
        </div>
      )}
    </div>
  );
};

export default MapToolbar;
