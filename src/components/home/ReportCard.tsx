import React from 'react';
import SourceCard from './SourceCard';

const ReportCard: React.FC<{
  report: import('@/types').WaterSourceReport;
  onDelete: (id: string) => void;
  onSourceClick: (sourceId: string) => void;
}> = ({ report, onDelete, onSourceClick }) => (
  <div className="bg-surface border border-border rounded-lg p-5">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold truncate">{report.reportName}</h3>
        <p className="text-xs text-text-tertiary mt-0.5">
          {report.region || '未知区域'} · {report.compileUnit || '未知单位'} ·{' '}
          {new Date(report.updatedAt).toLocaleDateString('zh-CN')}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(report.id);
        }}
        className="btn-ghost p-1.5 text-text-tertiary hover:text-danger shrink-0"
        title="删除报告"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>

    <div className="flex flex-wrap gap-4 text-sm text-text-secondary mb-4">
      <span className="flex items-center gap-1.5">
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
        {report.waterSources.length} 个水源地
      </span>
      <span className="flex items-center gap-1.5">
        <svg
          className="w-4 h-4 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
        {report.waterSources.reduce((sum, ws) => sum + (ws.wells?.length || 0), 0)} 眼监测井
      </span>
      <span className="flex items-center gap-1.5">
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
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
          />
        </svg>
        保护区{' '}
        {report.waterSources
          .reduce(
            (sum, ws) => sum + (ws.protectionZones?.reduce((a, pz) => a + (pz.area || 0), 0) || 0),
            0,
          )
          .toFixed(2)}{' '}
        km\u00B2
      </span>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {report.waterSources.map((ws) => (
        <SourceCard key={ws.id} source={ws} onClick={() => onSourceClick(ws.id)} />
      ))}
    </div>
  </div>
);

export default ReportCard;
