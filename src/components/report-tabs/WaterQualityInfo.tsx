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

const WaterQualityInfo: React.FC<{ source: WaterSource }> = ({ source }) => {
  const wq = source.waterQuality;
  const [sortBy, setSortBy] = React.useState<'default' | 'pi-desc' | 'name'>('default');
  const [filterClass, setFilterClass] = React.useState<string>('all');

  const filteredItems = React.useMemo(() => {
    let items = [...wq.items];
    if (filterClass !== 'all') {
      items = items.filter((item) => item.qualifiedClass === filterClass);
    }
    if (sortBy === 'pi-desc') {
      items.sort((a, b) => b.standardIndex - a.standardIndex);
    } else if (sortBy === 'name') {
      items.sort((a, b) => a.paramName.localeCompare(b.paramName, 'zh'));
    }
    return items;
  }, [wq.items, sortBy, filterClass]);

  const classOptions = ['all', 'I类', 'II类', 'III类', 'IV类', 'V类'];

  // Class distribution
  const classDist: Record<string, number> = {};
  wq.items.forEach((item) => {
    const cls = item.qualifiedClass || '-';
    classDist[cls] = (classDist[cls] || 0) + 1;
  });

  return (
    <div className="space-y-5">
      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="text-base font-bold text-accent-500">{wq.monitoringDate}</div>
          <div className="text-xs text-text-secondary">监测日期</div>
        </div>
        <div className="stat-card">
          <div className="text-base font-bold text-accent-500">{wq.totalItems}项</div>
          <div className="text-xs text-text-secondary">监测指标总数</div>
        </div>
        <div className="stat-card">
          <div
            className={`text-base font-bold ${wq.qualifiedRate === 100 ? 'text-success' : 'text-warning'}`}
          >
            {wq.qualifiedRate}%
          </div>
          <div className="text-xs text-text-secondary">达标率（GB/T 14848-2017 III类）</div>
        </div>
        <div className="stat-card">
          <div className="text-base font-bold text-accent-500">{wq.monitoringPoints.length}个</div>
          <div className="text-xs text-text-secondary">监测井</div>
        </div>
      </div>

      {/* Class distribution */}
      <div className="card p-4">
        <h4 className="text-sm font-semibold text-text-primary mb-3">水质类别分布</h4>
        <div className="flex flex-wrap gap-3">
          {Object.entries(classDist)
            .sort(([, a], [, b]) => b - a)
            .map(([cls, count]) => (
              <div key={cls} className="flex items-center gap-2">
                <span className={`badge text-xs ${getClassColor(cls)}`}>{cls}</span>
                <span className="text-sm font-medium text-text-primary">{count}项</span>
                <span className="text-xs text-text-tertiary">
                  ({((count / wq.totalItems) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Evaluation */}
      <div className="card p-4 bg-emerald-50/50 border-emerald-200">
        <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          评价结论
        </h4>
        <p className="text-sm text-text-secondary leading-relaxed">{wq.evaluation}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-secondary">排序:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input w-auto text-xs py-1"
          >
            <option value="default">默认顺序</option>
            <option value="pi-desc">标准指数降序</option>
            <option value="name">名称排序</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-secondary">类别:</span>
          <div className="flex gap-1">
            {classOptions.map((cls) => (
              <button
                key={cls}
                onClick={() => setFilterClass(cls)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  filterClass === cls
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-tertiary text-text-secondary hover:bg-surface-border'
                }`}
              >
                {cls === 'all' ? '全部' : cls}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-text-tertiary ml-auto">
          显示 {filteredItems.length}/{wq.items.length} 项
        </span>
      </div>

      {/* Items table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>指标名称</th>
                <th className="w-16">单位</th>
                <th className="w-20 text-right">III类标准</th>
                <th className="w-20 text-right">监测值</th>
                <th className="w-24 text-right">标准指数Pi</th>
                <th className="w-20 text-center">水质类别</th>
                <th className="w-36">达标指示</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item: any, idx: number) => {
                const piColor =
                  item.standardIndex === 0
                    ? 'text-text-tertiary'
                    : item.standardIndex <= 0.4
                      ? 'text-success'
                      : item.standardIndex <= 0.7
                        ? 'text-accent-500'
                        : item.standardIndex <= 1.0
                          ? 'text-warning'
                          : 'text-danger';
                const barColor =
                  item.standardIndex === 0
                    ? 'bg-surface-border'
                    : item.standardIndex <= 0.4
                      ? 'bg-success'
                      : item.standardIndex <= 0.7
                        ? 'bg-accent-500'
                        : item.standardIndex <= 1.0
                          ? 'bg-warning'
                          : 'bg-danger';
                return (
                  <tr key={idx}>
                    <td className="text-text-tertiary text-xs">{idx + 1}</td>
                    <td className="font-medium">{item.paramName}</td>
                    <td className="text-text-secondary text-xs">{item.unit}</td>
                    <td className="text-right font-mono text-text-secondary text-xs">
                      {item.standardValue > 0 ? item.standardValue : '-'}
                    </td>
                    <td className="text-right font-mono text-xs">{item.monitoringValue}</td>
                    <td className={`text-right font-mono text-xs font-semibold ${piColor}`}>
                      {item.standardIndex > 0 ? item.standardIndex.toFixed(3) : '-'}
                    </td>
                    <td className="text-center">
                      <span className={`badge text-[10px] ${getClassColor(item.qualifiedClass)}`}>
                        {item.qualifiedClass}
                      </span>
                    </td>
                    <td>
                      <div className="quality-bar">
                        <div
                          className={`quality-bar-fill ${barColor}`}
                          style={{ width: `${Math.min((item.standardIndex / 1.5) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pi explanation */}
      <div className="text-xs text-text-tertiary space-y-0.5">
        <p>
          标准指数 Pi = 监测值 / III类标准值。Pi 越小水质越好: &lt;= 0.4 优, &lt;= 0.7 良, &lt;= 1.0
          达标, &gt; 1.0 超标
        </p>
        <p>评价标准: GB/T 14848-2017《地下水质量标准》</p>
      </div>
    </div>
  );
};

export default WaterQualityInfo;
