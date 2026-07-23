import React from 'react';
import { formatYield } from '@/utils/helpers';
import type { WaterSource } from '@/types';

const SourceCard: React.FC<{ source: WaterSource; onClick: () => void }> = ({
  source,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left card-hover group relative overflow-hidden outline-none focus:ring-2 focus:ring-accent-500"
  >
    <div className="absolute inset-0 flex items-center justify-center bg-primary-500/0 group-hover:bg-primary-500/5 transition-colors duration-200 z-10 pointer-events-none">
      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-medium text-primary-500 bg-surface/90 px-3 py-1.5 rounded-full shadow-card">
        点击查看详情
      </span>
    </div>
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${source.type === '地表水' ? 'bg-blue-500' : 'bg-green-500'}`}
        />
        <h4 className="font-semibold text-sm truncate">{source.name}</h4>
        {source.type && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
              source.type === '地表水'
                ? 'bg-blue-500/10 text-blue-600'
                : 'bg-green-500/10 text-green-600'
            }`}
          >
            {source.type}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-text-tertiary">
        {source.location && (
          <span className="truncate" title={source.location}>
            <svg
              className="w-3 h-3 inline mr-1"
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
            {source.location}
          </span>
        )}
        {source.dailyYield != null && (
          <span>
            <svg
              className="w-3 h-3 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            {formatYield(source.dailyYield)}
          </span>
        )}
        {source.wells && source.wells.length > 0 && (
          <span>
            <svg
              className="w-3 h-3 inline mr-1"
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
            {source.wells.length} 眼井
          </span>
        )}
        {source.protectionZones && source.protectionZones.length > 0 && (
          <span>
            <svg
              className="w-3 h-3 inline mr-1"
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
            {source.protectionZones.length} 级保护区
          </span>
        )}
      </div>
      {source.waterQuality && source.waterQuality.qualifiedRate != null && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs text-text-tertiary">水质达标率:</span>
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              source.waterQuality.qualifiedRate === 100
                ? 'bg-green-500/10 text-green-600'
                : source.waterQuality.qualifiedRate >= 80
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-red-500/10 text-red-600'
            }`}
          >
            {source.waterQuality.qualifiedRate}%
          </span>
        </div>
      )}
      {source.hydrogeology && (
        <div className="mt-2 text-xs text-text-tertiary">
          含水层: {source.hydrogeology.aquiferType || '-'} · 渗透系数{' '}
          {source.hydrogeology.permeabilityCoeff || '-'}
        </div>
      )}
    </div>
  </button>
);

export default SourceCard;
