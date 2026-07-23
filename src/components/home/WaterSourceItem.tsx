import React from 'react';
import type { WaterSourceInfo } from '@/types';

const WaterSourceItem: React.FC<{ source: WaterSourceInfo; level: string }> = ({
  source,
  level,
}) => (
  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary-500/[0.02] border border-border/50 hover:border-accent-300 transition-colors">
    <div
      className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${source.type === '地表水' ? 'bg-blue-500' : 'bg-green-500'}`}
    />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium truncate">{source.name}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span
          className={`text-[10px] px-1.5 py-0 rounded ${source.type === '地表水' ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'}`}
        >
          {source.type}
        </span>
        {source.subType && (
          <span className="text-[10px] text-text-quaternary">{source.subType}</span>
        )}
        <span className="text-[10px] text-text-quaternary">{source.county}</span>
      </div>
      {source.remark && (
        <p className="text-[10px] text-text-quaternary mt-0.5 truncate" title={source.remark}>
          {source.remark}
        </p>
      )}
    </div>
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium ${
        level === '市级'
          ? 'bg-amber-500/15 text-amber-700'
          : level === '县级'
            ? 'bg-emerald-500/15 text-emerald-700'
            : 'bg-sky-500/15 text-sky-700'
      }`}
    >
      {level}
    </span>
  </div>
);

export default WaterSourceItem;
